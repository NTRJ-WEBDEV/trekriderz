#!/usr/bin/env node
/**
 * One-time seed import: pulls waterfalls, peaks, viewpoints and campsites
 * for the Western Ghats from OpenStreetMap (via the Overpass API) and
 * inserts them into public.pois as pre-approved, bulk-trusted data.
 *
 * This is NOT part of the app runtime — run it manually, once (or re-run
 * later to pick up new OSM edits; it's idempotent via ON CONFLICT DO NOTHING
 * against the pois_osm_dedup unique index on (source, osm_type, osm_id)).
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx SUPABASE_PROJECT_REF=xxx node scripts/import-osm-pois.mjs
 *
 * Deliberately excludes trailheads: OSM trailhead tagging (highway=trailhead,
 * information=guidepost, route relations, etc.) is inconsistent and noisy
 * across the Western Ghats — importing it in bulk would produce a lot of
 * low-quality/duplicate pins. Trailheads are left to user submissions or
 * admin curation instead, where a human can verify each one.
 */

import dns from 'node:dns';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

// This sandbox/host has broken IPv6 egress; Node's default "happy eyeballs"
// dual-stack resolution hangs on the IPv6 attempt before falling back to IPv4.
// Affects the Supabase Management API calls below (plain `fetch`).
dns.setDefaultResultOrder('ipv4first');

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF;

if (!SUPABASE_ACCESS_TOKEN || !SUPABASE_PROJECT_REF) {
  console.error('Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF env vars.');
  process.exit(1);
}

// Western Ghats bounding box (south, west, north, east) — roughly the Tapi
// river (Gujarat/Maharashtra border) down to Kanyakumari (Tamil Nadu tip).
const BBOX = '8.0,72.5,21.5,77.5';

// The main public instance — the authoritative, fully-loaded database (an
// alternate mirror, overpass.osm.ch, was tried and found to have an
// effectively empty dataset — zero results even for globally-known
// landmarks — so it's not usable).
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// OSM tag -> our pois.category enum value.
const TAG_TO_CATEGORY = [
  { key: 'natural', value: 'waterfall', category: 'waterfall' },
  { key: 'natural', value: 'peak', category: 'peak' },
  { key: 'tourism', value: 'viewpoint', category: 'viewpoint' },
  { key: 'tourism', value: 'camp_site', category: 'campsite' },
];

// Retry wrapper for the Supabase Management API calls below (plain `fetch`) —
// this environment's egress is occasionally flaky at the connection level.
async function fetchWithRetry(url, options, retries = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastErr = err;
      const delay = attempt * 1500;
      console.warn(`  (network error on attempt ${attempt}/${retries}: ${err.message} — retrying in ${delay}ms)`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function buildOverpassQuery() {
  const clauses = TAG_TO_CATEGORY.flatMap(({ key, value }) =>
    ['node', 'way', 'relation'].map(
      (type) => `  ${type}["${key}"="${value}"](${BBOX});`
    )
  ).join('\n');

  return `[out:json][timeout:180];\n(\n${clauses}\n);\nout center;`;
}

// Node's own HTTP clients (fetch/undici *and* the raw `https` module) get a
// consistent 406 from overpass-api.de that curl does not — reproduced with
// identical request bodies/headers, so it's not a flakiness or header
// mismatch issue, but something about Node's TLS/HTTP client fingerprint
// that whatever fronts the public instance doesn't like. Shelling out to
// curl (which is proven to work against this exact endpoint) sidesteps it —
// this is just choosing a working HTTP client for a public, query-only API,
// not evading any access control.
async function fetchOverpass(retries = 4) {
  const query = buildOverpassQuery();
  const tmpFile = join(tmpdir(), `overpass-query-${Date.now()}.txt`);
  await writeFile(tmpFile, query, 'utf8');
  try {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const { stdout } = await execFileAsync(
        'curl',
        ['-s', '-X', 'POST', OVERPASS_URL, '--data-urlencode', `data@${tmpFile}`],
        { maxBuffer: 100 * 1024 * 1024 } // responses can be several MB of JSON
      );
      try {
        const json = JSON.parse(stdout);
        if (json.remark) console.warn(`  (Overpass remark: ${json.remark})`);
        return json.elements || [];
      } catch {
        // The public instance occasionally answers with an HTML error page
        // (rate-limit/overload) instead of JSON — retry rather than fail.
        if (attempt === retries) {
          throw new Error(`Overpass returned non-JSON after ${retries} attempts: ${stdout.slice(0, 200)}`);
        }
        const delay = attempt * 3000;
        console.warn(`  (Overpass returned non-JSON on attempt ${attempt}/${retries} — retrying in ${delay}ms)`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

function categoryFor(tags) {
  for (const { key, value, category } of TAG_TO_CATEGORY) {
    if (tags[key] === value) return category;
  }
  return null;
}

function sqlEscape(str) {
  return String(str).replace(/'/g, "''");
}

async function runSql(query, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetchWithRetry(
      `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    );
    const body = await res.json();
    if (res.ok) return body;
    // "Failed to check user auth status" is a transient Management API
    // hiccup, not a real permission error (confirmed: retrying the same
    // token/query succeeds) — worth a backoff-retry rather than failing
    // the whole batched import over one flaky response.
    if (attempt < retries) {
      const delay = attempt * 2000;
      console.warn(`  (Supabase query failed on attempt ${attempt}/${retries}: ${JSON.stringify(body)} — retrying in ${delay}ms)`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    throw new Error(`Supabase query failed: ${JSON.stringify(body)}`);
  }
}

function toRowValues(poi) {
  return `('${sqlEscape(poi.name)}', '${poi.category}', ${poi.lat}, ${poi.lng}, 'osm', '${poi.osm_type}', '${sqlEscape(poi.osm_id)}', 'approved')`;
}

async function insertBatch(batch) {
  const values = batch.map(toRowValues).join(',\n  ');
  const query = `
    INSERT INTO public.pois (name, category, lat, lng, source, osm_type, osm_id, status)
    VALUES
      ${values}
    ON CONFLICT (source, osm_type, osm_id) WHERE (osm_id IS NOT NULL) DO NOTHING
    RETURNING id;
  `;
  const result = await runSql(query);
  return Array.isArray(result) ? result.length : 0;
}

async function main() {
  console.log('Querying Overpass API for Western Ghats POIs...');
  const elements = await fetchOverpass();
  console.log(`Fetched ${elements.length} raw OSM elements.`);

  const pois = [];
  let skippedUnnamed = 0;
  let skippedNoCategory = 0;
  let skippedNoCoords = 0;

  for (const el of elements) {
    const tags = el.tags || {};
    if (!tags.name) {
      skippedUnnamed++;
      continue;
    }
    const category = categoryFor(tags);
    if (!category) {
      skippedNoCategory++;
      continue;
    }
    const lat = el.type === 'node' ? el.lat : el.center?.lat;
    const lng = el.type === 'node' ? el.lon : el.center?.lon;
    if (lat == null || lng == null) {
      skippedNoCoords++;
      continue;
    }
    pois.push({
      name: tags.name,
      category,
      lat,
      lng,
      osm_type: el.type,
      osm_id: String(el.id),
    });
  }

  console.log(`Valid POIs to import: ${pois.length}`);
  console.log(`Skipped (unnamed): ${skippedUnnamed}`);
  console.log(`Skipped (no matching category): ${skippedNoCategory}`);
  console.log(`Skipped (no coordinates): ${skippedNoCoords}`);

  const BATCH_SIZE = 75;
  let inserted = 0;
  for (let i = 0; i < pois.length; i += BATCH_SIZE) {
    const batch = pois.slice(i, i + BATCH_SIZE);
    const count = await insertBatch(batch);
    inserted += count;
    console.log(
      `Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pois.length / BATCH_SIZE)}: ` +
      `${count}/${batch.length} inserted (rest were duplicates already present)`
    );
  }

  const duplicates = pois.length - inserted;

  console.log('\n=== Import Summary ===');
  console.log(`Total OSM elements fetched:   ${elements.length}`);
  console.log(`Skipped as unnamed:           ${skippedUnnamed}`);
  console.log(`Skipped as uncategorized:     ${skippedNoCategory}`);
  console.log(`Skipped for missing coords:   ${skippedNoCoords}`);
  console.log(`Candidate POIs processed:     ${pois.length}`);
  console.log(`Newly inserted:               ${inserted}`);
  console.log(`Skipped as duplicates:        ${duplicates}`);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
