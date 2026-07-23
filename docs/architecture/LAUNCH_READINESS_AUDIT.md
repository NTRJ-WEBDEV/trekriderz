# TrekRiderz Launch Readiness Audit

**Status:** Inspection and planning only. Nothing in this document has been implemented, fixed, or migrated as part of producing it — that is deliberate scope, per the brief that commissioned it. Every finding below was traced to actual code or a real migration file; where a claim could not be verified directly, it is stated as unverified rather than assumed.

**Method:** This audit was produced by four parallel research passes across mobile navigation/traveller UX, partner/admin experience, legacy schema/security/booking readiness, and production config/UX/code quality, plus a direct read of `PARTNER_PLATFORM.md`, `COMMERCE_PHILOSOPHY.md`, `MIGRATION_PLAN.md`, and `UX_BLUEPRINT.md`. The two highest-severity security findings (the wide-open `rental_vehicles` RLS policy and RBAC not being wired into the core approval tables) were independently re-verified against the migration files directly rather than taken on faith.

**Framing, per the brief:** this release is not "TrekRiderz, fully realized" — it's a strong, trustworthy core that also has to work as a professional portfolio showcase. Findings below are judged against *that* bar, not against the full long-term vision in `PARTNER_PLATFORM.md`/`COMMERCE_PHILOSOPHY.md`, which are correctly treated throughout as target architecture, not a description of what should already exist.

---

## 1. Executive Summary

TrekRiderz's core social/discovery product — feed, stories, chat, profiles, discovery, reviews, and the admin review/audit/trust workflow — is genuinely solid: real data, no fabrication, and (per this session's own work) a consolidated data layer that didn't exist a week ago. That is the platform's actual strength, and it should be the headline of any showcase conversation.

But the platform is not production-safe today, for reasons that have nothing to do with unfinished features and everything to do with three specific, fixable defects:

1. **A wide-open database write policy** (`rental_vehicles` and ~8 adjacent tables) that lets any authenticated user — including a regular traveller account — write to tables that should be admin- or owner-only.
2. **The RBAC system that governs the admin UI was never connected to the database layer** for the core partner-approval tables. Today, exactly one hardcoded email address can actually approve/reject/suspend a homestay or send a guide-document review — every other admin, however they're provisioned through the Team screen, will see the buttons work and the database silently refuse the write.
3. **A schema/table split** (`properties` vs. legacy `homestays`, `rental_vehicles` vs. legacy `cms_vehicles`) that `MIGRATION_PLAN.md` already flagged as unresolved, and which this session's own work partially and accidentally deepened by adding two new route files (`homestays/index.tsx`, `guides/index.tsx`) without noticing that two *older*, still-live top-level files (`homestays.tsx`, `guides.tsx`) already occupied the same routes.

None of these three are large rebuilds. All three are targeted, bounded fixes — a handful of `DROP POLICY`/`CREATE POLICY` statements, deleting two duplicate files, and re-pointing seven call sites to the table the rest of the app already uses. That's the actual headline: **the blockers are narrow and fixable in days, not a re-architecture**, but they are real, and none of them should be waved through to a closed beta, let alone a Play Store submission or a client demo, without being fixed first.

## 2. Current Product Maturity Assessment

| Layer | Maturity | Basis |
|---|---|---|
| Social/content (feed, stories, reels, chat, profiles, communities) | **Launch-ready to needs-polish** | Real queries throughout, no fabricated data found, consistent empty-state/loading patterns. |
| Discovery & reviews | **Launch-ready**, recently and substantially improved | Reviews went from four hardcoded "No reviews yet" states to a genuine end-to-end system this session; a Discovery Engine now gives every browse surface one shared, correct query layer. |
| Partner onboarding & review workflow | **Functional, with real gaps** | Registration → document upload → structured Request-Changes → resubmission → approval is real and wired for homestays and guides. Post-approval editing is broken for guides specifically, and suspension doesn't actually suspend anything for any partner type. |
| Admin operations tooling | **Ahead of typical MVP scope** | Review workspace, audit queue, trust panel, dashboard, and a dozen smaller CMS modules are all substantively built, not stubs — genuinely more admin tooling than most launches this size have. Undermined by the RBAC/RLS disconnect above, which currently limits it to a single usable admin account. |
| Booking & payments | **Correctly not built yet, per `MIGRATION_PLAN.md`'s own sequencing** — but the groundwork has a specific, identified gap (see §9) | No code path anywhere writes a real payment order; this is honest, not broken. The gap that *does* matter: the one real reservation path (`bookings` table) is permanently bound to the legacy `homestays` table at the SQL function level, which needs fixing before booking work resumes, not after. |
| Security posture | **Has a small number of serious, concrete holes, not a general weakness** | RLS is used consistently almost everywhere; the wide-open policy and the RBAC/RLS gap are narrow, nameable exceptions, not evidence of a systemically unsafe approach. |
| Production/deployment config | **Mostly ready** | Real branding, real deep links, real privacy/terms content, clean builds on both platforms. Missing: crash reporting, Play Store listing assets, and a confusing dead duplicate legacy web app sitting in the repo root. |
| Test coverage | **Effectively zero** | A Playwright suite exists but asserts against a defunct legacy page; no unit-test framework exists anywhere in the repo. |

## 3. Critical Blockers

Ten findings. Each blocks production launch; several also block closed beta or payments specifically as noted. Severity Blocker means: shipping with this unfixed creates either a live security hole, a fully broken advertised feature, or an admin operations dead-end.

| # | Finding | Evidence | User/Business Impact | Before Beta | Before Payments | Before Production |
|---|---|---|---|---|---|---|
| B1 | **`rental_vehicles` and ~8 CMS-adjacent tables have a live `FOR ALL TO authenticated USING (true)` RLS policy** (`"Vehicles auth write"`, plus equivalents on `trip_photos`, `trip_itinerary`, `stories`, `places_guide`, `site_settings`, `vehicle_photos`, `cms_vehicles`, `cms_vehicle_photos`, `youtube_videos`) | `supabase/migrations/20260629000001_cms_admin.sql:161` — verified directly by the orchestrator: created once, never dropped or replaced in any of the 95 migration files. A later migration (`20260703000001_post_reports_and_admin_rls.sql`) only adds a *narrower* SELECT policy alongside it — RLS policies OR together, so the permissive one still wins. | Any authenticated traveller account can insert/update/delete any vehicle listing (including approving their own), deface `site_settings`, plant fake `stories`, or rewrite another user's `trip_itinerary`. | Yes | Yes | Yes |
| B2 | **RBAC is not wired into RLS for the core partner-approval tables** — `properties`, `room_types`, `property_inquiries`, `guide_inquiries`, `rental_inquiries` RLS, and the `guide-documents` storage bucket's SELECT policy, all still hardcode one email address | `supabase/migrations/20260709000005_fix_properties_admin_policy.sql:19-54` (`auth.uid() IN (SELECT id FROM public.users WHERE email = 'ntrjwebdev@gmail.com')`, 5 separate policies) and `20260705000003_fix_guide_documents_admin_policy.sql:12-17`. Verified directly: no later migration replaces any of these with `has_permission(...)`. | A staff member granted `homestay_manager`/`rental_manager`/`guide_manager` via the Team screen sees working buttons in the admin UI, but every actual approve/reject/suspend write and every document signed-URL fetch silently fails for anyone except the one hardcoded account. **The admin panel cannot scale past one person today.** | Yes | Yes | Yes |
| B3 | **Admin "Suspend" is cosmetic** — it flips `is_suspended`/`is_active` but nothing reads those columns anywhere on the public side; every browse query filters on `status = 'approved'` only | `web/lib/services/ApprovalService.ts:102-121`; confirmed zero query anywhere (`mobile/app/homestays.tsx:48`, `rentals/index.tsx:70-74`, `guides.tsx:52`, `DiscoveryService.ts:172,212,253`) checks `is_suspended`/`is_active`. No `notify()` call from `setSuspended`/`setGuideActive` either. | A suspended partner — someone an admin has explicitly decided shouldn't be operating — remains fully visible, bookable, and enquiry-able to travellers, and is never told they were suspended. This is a live trust/safety gap, not a cosmetic one. | No (but should fix before any real partner data exists) | Yes | Yes |
| B4 | **Guide profiles cannot be edited after approval, through any working path** | `guide/application-status.tsx`'s "Edit Profile" routes to `guide/register.tsx`, which is insert-only and immediately blocks any existing row (`handleSubmit`, ~line 385-394) with an "Application Exists" alert. | Every approved guide is permanently frozen at whatever rate/bio/photos they submitted at registration — they cannot ever update pricing, add photos, or fix a typo. | Yes (guides are a launch partner type) | Yes | Yes |
| B5 | **Legacy `homestays` table is still live in 7 mobile screens and 1 SQL function**, while `properties` is the canonical, actually-used table for registration/creation | `mobile/app/host/availability.tsx:37,121`, `admin/add-homestay.tsx:43`, `booking/[id].tsx:53`, `booking-details/[id].tsx:71`, `bookings/index.tsx:46`, `map/index.tsx:67`, `ai-planner.tsx:102`; `supabase/migrations/20260411000000_booking_request_function.sql` (`create_booking_request()` hardcodes `FROM public.homestays`). | The homestay availability/cancellation-policy screen is **dead on arrival for 100% of hosts who registered through the current flow** — it queries a table their listing was never written to, and always shows "Register a homestay first." Map pins, AI Planner recommendations, and booking cancellation-policy lookups for homestays are similarly broken. | Yes (availability is a stated feature) | Yes | Yes |
| B6 | **Two self-inflicted route collisions**: `mobile/app/homestays.tsx` vs. `mobile/app/homestays/index.tsx`, and `mobile/app/guides.tsx` vs. `mobile/app/guides/index.tsx` | Confirmed by direct filesystem inspection: both legacy top-level files (dated Jul 18) and the new browse screens built this session (dated Jul 22) coexist under the same resolved route. | Expo Router same-level file collisions are undefined-winner territory — whichever file wins, either the newly-built (correct, `properties`/`rental_vehicles`-based) browse screen or the old (legacy-table, `homestays`/broken) one becomes unreachable, silently. | Yes | Yes | Yes |
| B7 | **Missing role/permission guards on three admin screens**: `mobile/app/admin/add-guide.tsx`, `admin/add-homestay.tsx`, `admin/vehicle-detail.tsx` | Confirmed: zero `usePermissions`/`isStaff` check in any of the three, unlike the correctly-guarded `admin/index.tsx:38-46`. | Any authenticated user who navigates directly to these routes can insert a fake `is_verified: true, rating: 5.0` guide, insert a fake `status: 'approved', rating: 5.0` homestay, or approve/reject a rental listing — client-side, with only RLS (see B1/B2) as a backstop, and B1/B2 show that backstop is currently absent or hardcoded-narrow. | Yes | Yes | Yes |
| B8 | **Team page role assignment is a no-op** — it writes `profiles.role`, a legacy text column nothing in the app reads anymore (every real check uses `profiles.role_id`) | `web/app/admin/team/page.tsx:47-50` (`supabase.from("profiles").update({ role })`), vs. every `has_permission()`/`hasPermission()` call keying off `role_id` (`supabase/migrations/20260720000001_rbac_and_activity_log.sql:49`). Also only offers 2 of the 11 seeded roles. | **There is currently no working UI to grant or change staff permissions.** Combined with B2, this means the admin system has exactly one functional operator today, full stop. | Yes | Yes | Yes |
| B9 | **Admin manual-insert screens fabricate data**: `admin/add-homestay.tsx` and `admin/add-guide.tsx` insert `status: 'approved'` (skipping the entire verification workflow) and `rating: 5.0` (a fake perfect score with zero underlying reviews) | `mobile/app/admin/add-homestay.tsx:53,55`; `mobile/app/admin/add-guide.tsx:54-56`. | Any listing added this way looks identically "verified" and "top-rated" to a real, reviewed partner — directly undermines the platform's entire trust premise, and is exactly the kind of fabricated-data pattern the rest of the codebase has been deliberately avoiding. | Yes | Yes | Yes |
| B10 | **Effectively zero real test coverage** — a Playwright e2e suite exists but asserts against a defunct legacy Next.js app, not the current product; no unit-test framework exists anywhere | `tests/e2e/*.spec.ts` + root `playwright.config.ts` assert copy (`"Trek Together. Explore More."`) that only exists in root `pages/index.js`, not `web/app/page.tsx`. No Jest/Vitest config or `__tests__` directory anywhere in `mobile/`, `web/`, or root. | Nothing in this fairly large codebase is regression-tested today. Every fix recommended in this document is itself untestable-by-CI until this is addressed. | No | No | Recommended, not strictly blocking |

## 4. High-Priority Launch Work

Fourteen findings. These don't block a controlled closed beta with a small, trusted user set, but should be resolved before payments or a public production release.

| # | Finding | Evidence | Impact | Recommended Action |
|---|---|---|---|---|
| H1 | `/discover` route collision: `app/discover.tsx` (travel-partner/ride matching) vs. `app/(tabs)/discover.tsx` (general listing discovery, tab hidden via `href: null`) — both fully built, different features | Filesystem + router.push cross-reference | Whichever loses is a fully-built feature silently unreachable | Manually verify on-device which wins; rename one route |
| H2 | Android intent filter registers a `user/` deep link path with no handler | `mobile/app.json:41-53` vs. `mobile/lib/deep-linking.ts:90-96` (only handles `trip/`, `post/`) | Tapping a `trekriderz.app/user/{id}` link does nothing | Add the missing handler branch |
| H3 | `expeditions/manage/[id].tsx` has no client-side owner check, relies entirely on unverified RLS | No `guide_id` comparison found in the file | Unverified whether a non-owner guide can act on another guide's expedition | Add explicit ownership check; verify RLS independently |
| H4 | Dead calendar-booking subsystem: `booking/[id].tsx`, `bookings/index.tsx`, `booking-details/[id].tsx` — unreachable from any live navigation, no Razorpay call anywhere client-side | `grep` for any `router.push('/booking/...')` found none; notification type `'booking'` that would deep-link here is never created | Confusing dead code; also contains a live bug (H9) worth fixing only if revived | Explicit decision: delete, or finish wiring into the enquiry-based model that replaced it |
| H5 | Rental vehicle registration collects **zero** identity/ownership verification documents | `mobile/app/rentals/register.tsx` — confirmed no document/identity field; acknowledged in `supabase/migrations/20260727000001_internal_trust_engine.sql:140`'s own comment | Every vehicle owner's Trust Checklist permanently shows an unactionable "Submit your identity document" | Add document upload to rental registration, or remove the checklist item honestly until it's collected |
| H6 | Rental vehicle registration never notifies admins on submission | `mobile/app/rentals/register.tsx` — no `notifications` insert, unlike `host/create.tsx:629`/`guide/register.tsx:435` | New vehicle listings are invisible to staff except by manually polling the queue | Add the missing `notify()` call, matching the other two registration flows |
| H7 | No crash reporting anywhere (mobile or web) | Grep for Sentry/Bugsnag/Crashlytics in code and both `package.json` files: zero hits | Zero visibility into real-user crashes once this ships | Add Sentry (or equivalent) to both apps before public release |
| H8 | `partner_trust_events` and `partner_audit_records`/`partner_audit_schedule` are documented as append-only but RLS-enforced as fully mutable (`FOR ALL`, includes UPDATE/DELETE) for staff | `20260727000001_internal_trust_engine.sql:57-59`; `20260726000001_partner_audit_system.sql:82-92` — both comments say "append-only," neither policy enforces it (unlike `admin_activity_log`, which correctly grants INSERT+SELECT only) | A staff account could alter or delete historical trust/audit records, breaking the "traceable to real data" guarantee these systems were explicitly built around | Split into separate INSERT/SELECT-only policies, matching `admin_activity_log`'s pattern |
| H9 | Booking-cancellation notification uses the wrong column (`body` instead of `message`) and notifies the wrong recipient (the cancelling traveller, not the host, despite a comment saying "Notify host/guide") | `mobile/app/booking-details/[id].tsx:156-161`; correct column confirmed via `supabase/migrations/20260718000002_notification_system_fixes.sql:44` | Silently fails (error not checked) — hosts are never told a booking was cancelled | Fix column name and recipient; only matters if H4 is revived, otherwise moot |
| H10 | `bookings.resource_type` CHECK constraint doesn't include `'property'` or `'vehicle'` — `properties`/`rental_vehicles` can never produce a real reservation row as-is | `supabase/migrations/20260322000000_bookings_and_payments.sql` CHECK definition; confirmed via `create_booking_request()`'s hardcoded `homestays` reference | This is the actual schema blocker for real bookings on 2 of 3 launch partner types, not payments per se | Scope as the first concrete task of the eventual booking-reconciliation phase (§9) |
| H11 | No RLS policy allows a guide (resource owner) to accept/reject a booking made against them — not just unbuilt UI, structurally impossible today | `supabase/migrations/20260322000000_bookings_and_payments.sql:52-58` grants only the customer SELECT/INSERT/UPDATE on their own booking row | Guide accept/reject (required per `PARTNER_PLATFORM.md` §6) cannot be built without a new RLS policy first | Scope alongside H10 in the booking-reconciliation phase |
| H12 | Direct Supabase access is scattered with no enforced service-layer boundary | 47 mobile screens + 5 components call `supabase.from(...)` directly (202 occurrences) vs. 9 files in `mobile/lib`/`services`; similar ratio on web | Makes exactly the kind of table-name drift this audit repeatedly found (B5, and the `rentals`-table bug fixed this session) easy to reintroduce | Not a rewrite — extend the existing `DiscoveryService`/`*Service.ts` convention to new screens as they're touched, rather than a blanket refactor |
| H13 | `WeatherWidget` silently shows fabricated weather data (hardcoded `MOCK_WEATHER`) with no "estimated"/"unavailable" disclosure when location is denied or the live fetch fails | `mobile/components/WeatherWidget.tsx:20-31,96,110,113` | For a trek-safety-oriented app, presenting invented weather as live is a real trust risk, not just cosmetic polish | Show an explicit "forecast unavailable" state instead of a fabricated one |
| H14 | Partner-side RLS UPDATE policies on `review_change_requests`/`review_document_status` don't restrict which columns a partner can touch, despite the app-layer intent that only `status`/`partner_comment` are partner-writable | `supabase/migrations/20260725000001_review_workspace_partner_access.sql:65-71,111-117` — both policy comments admit the restriction is enforced only by the app, not the database | A technically-inclined partner could call the Supabase REST API directly and self-mark their own document `status='verified'`, bypassing human review entirely | Add a column-level check (trigger or `WITH CHECK` on unchanged columns) rather than relying on the app never being bypassed |

## 5. Medium-Priority Polish

Grouped rather than tabled individually, since none of these block any specific launch gate on their own — they're the difference between "works" and "feels finished."

**Navigation/UX:**
- `/community` route ambiguity between `(tabs)/community.tsx` and `community/index.tsx` — same undefined-winner risk as B6, lower stakes since both are reachable via distinct in-app buttons today; verify and document which wins.
- Dead duplicate screen `mobile/app/trips/[id].tsx` (nothing navigates to it; `trip/[id].tsx` is the real one).
- `SearchService.ts` only indexes trips/communities/rental_vehicles/users — guides, properties, and expeditions aren't searchable; moot until `SearchModal.tsx` (currently dead, never rendered) is wired to something.
- No "Saved Items" screen despite a working bookmark toggle on posts/reels.
- `community/manage/[id].tsx` has no explicit client-side owner guard (same pattern as H3, lower-traffic surface).

**Partner/Admin:**
- No draft/autosave in any of the three registration flows (`host/create.tsx`, `guide/register.tsx`, `rentals/register.tsx`) — closing the app mid-form loses everything.
- No support/escalation ticketing system, despite a staff role description promising "refund requests" handling — acceptable for a small closed beta using ad hoc channels, not at scale.
- CMS admin pages (`places`, `pois`, `stories`, `videos`) have zero in-page permission checks, relying entirely on nav-hiding + RLS — recommend spot-checking their RLS policies specifically before treating this as fully covered.
- `cms_vehicles` vs. `rental_vehicles` remains an unreconciled duplicate catalog (per `MIGRATION_PLAN.md`), though the admin UI labels them clearly enough that staff confusion risk is low.

**Data/Notifications:**
- `NotificationType` TypeScript union on both platforms includes `community_join_approved`/`community_join_rejected`, values that don't exist in the live DB CHECK constraint (`community_approved`/`community_rejected`). Currently unused, so harmless today — a landmine for the next call site written against autocomplete.
- Notification recipient (`user_id`) is completely unvalidated at the RLS layer — any authenticated user can insert a notification into any other user's inbox. Spam/harassment vector, not a data-exposure one.
- `compute_public_trust_signals()` returns raw `status` (including `rejected`/`suspended`) to any authenticated user for any entity ID — minor enumeration risk, not a core design flaw.
- `supabase/complete_schema_combined.sql`, which `CLAUDE.md` calls "the canonical full schema," is a pre-rebrand snapshot (`-- WandR Database Schema`) that predates `properties`, `rental_vehicles`, RBAC, the review workspace, audits, trust engine, and `reviews` entirely, and is truncated mid-statement. It should not be trusted or referenced as current — either regenerate it or remove the "canonical" claim from `CLAUDE.md`.
- Dead exported service functions: `mobile/lib/services/PermissionService.ts`'s `checkPermission()`, `web/lib/services/PermissionService.ts`'s `fetchMyPermissionsClient/Server` (both platforms actually call the RPC inline elsewhere instead), and 10 of 12 upload wrappers in `mobile/lib/services/MediaService.ts`.

**Config/Deployment:**
- No analytics on mobile at all; web has an opt-in analytics component that's currently unconfigured (all env vars blank) — fine as a deliberate default, worth a decision either way before launch.
- No Play Store screenshots, listing description, or privacy-policy URL wired into `eas.json`/`app.json` anywhere.
- `google-play-service-account.json`, referenced by `eas.json`'s submit config, isn't present in the repo — expected if it's injected at CI/submit time, but worth confirming before the first real `eas submit`.
- A full second, legacy Next.js app sits at the repo root (own `package.json` named `trekriderz-web`, `pages/`, its own `app.json`/`eas.json`/`vercel.json`) alongside the real, actively-developed `web/` directory. Almost certainly dead (the real Vercel project's root directory is `web/`), but confusing to any new contributor or auditor — recommend clearly marking or removing it.

**Code quality:**
- Notification-insert logic bypasses the centralized `NotificationService` in at least 9 places, despite that service's own header comment explaining it exists specifically because a past bypass caused a silent failure bug.
- Duplicate date-formatting helpers exist locally in 4 screens despite a shared `mobile/lib/format.ts`.
- Ten screens exceed 700 lines, three exceed 1,200 (`host/create.tsx` 1735, `admin/index.tsx` 1552, `guide/register.tsx` 1241) — not urgent, but the next time any of these is touched, extracting sub-components is worth doing alongside the change rather than as a standalone refactor.
- `: any`/`as any` usage is substantial (516 occurrences on mobile, 190 on web) — real but gradual debt, not worth a dedicated sweep before launch.
- Raw `error.message` strings are surfaced directly via `Alert.alert` in ~25 places — a real showcase-polish item (see §11), not a functional bug.
- Accessibility coverage is minimal (3 instances on mobile across ~91 screens, 5 on web) — a genuine gap worth addressing incrementally, not a launch blocker for a v1.

## 6. Safe Post-Launch Deferrals

Explicitly **not** required before beta, payments, or production — listed here so they don't get pulled forward by scope creep:

- Trip Organiser as a fourth partner type (doesn't exist; `PARTNER_PLATFORM.md` itself sequences this last, after the other three partner types are solid).
- Full Trust Score formula, badges, decay/recovery mechanics (`PARTNER_PLATFORM.md` §7) — the *internal* Trust Engine and *public* trust signals built this session are the correct Phase 1 scope; the composite scoring formula is explicitly future work.
- Escrow/staged payout, wallet, ledger, Customer Protection Reserve (`COMMERCE_PHILOSOPHY.md` §8/§12.4) — correctly greenfield, correctly sequenced after the marketplace-table reconciliation, per `MIGRATION_PLAN.md`'s own rollout order.
- Vehicle availability calendar (currently a boolean toggle only) — real gap vs. homestays, but not launch-blocking.
- Formal support ticketing/escalation system — ad hoc channels are workable for a small closed beta.
- Broader admin bulk actions beyond the three approval-workflow list pages.
- Calendar sync, dynamic pricing, AI photo-quality detection, duplicate-listing detection, fraud detection, geo-verification — all explicitly named as "not Phase 2" in `PARTNER_PLATFORM.md` §13.
- Coupons/wallets/gift cards/referrals/subscriptions/corporate discounts (`COMMERCE_PHILOSOPHY.md` §10) — explicitly future-phase by that document's own framing.
- A full `ts-prune`-style dead-export sweep or a blanket `any`-elimination pass — real debt, but gradual, not urgent.

## 7. Legacy/Schema Cleanup List

Consolidating every schema-drift finding from all four research passes, with exact file paths:

| Concept | Canonical | Legacy/duplicate | Still-live references to the legacy one |
|---|---|---|---|
| Homestays | `properties` (real approval workflow, `CREATE TABLE` in repo) | `homestays` (no `CREATE TABLE` anywhere — pure schema drift in the live DB) | `mobile/app/host/availability.tsx:37,121`, `admin/add-homestay.tsx:43`, `booking/[id].tsx:53`, `booking-details/[id].tsx:71`, `bookings/index.tsx:46`, `map/index.tsx:67`, `ai-planner.tsx:102`, plus the SQL function `create_booking_request()` in `20260411000000_booking_request_function.sql` |
| Rentals | `rental_vehicles` (owners, approval, inquiries) | `cms_vehicles` (admin-authored catalog, no workflow) | `web/app/admin/vehicles/page.tsx`; also indexed separately in `web/lib/services/SearchService.ts:33-34` |
| Discovery routes | `mobile/app/homestays/index.tsx`, `mobile/app/guides/index.tsx` (new, `properties`/`rental_vehicles`-based) | `mobile/app/homestays.tsx`, `mobile/app/guides.tsx` (old, same route path, still present) | Both pairs coexist under identical resolved routes — see B6 |
| Booking/payments | N/A — nothing is canonical yet | `web/lib/payment.ts` + its two API routes (fully coded Razorpay integration, zero callers); mobile `payment_orders`/`booking_history` tables (never written) | Confirmed dead: no call site anywhere outside the route files and the schema migration itself |
| Reference schema doc | 95 tracked migration files (source of truth) | `supabase/complete_schema_combined.sql` (pre-rebrand snapshot, truncated, called "canonical" by `CLAUDE.md`) | `CLAUDE.md`'s own architecture description |
| Notification types | 18-value CHECK constraint (`20260726000001_partner_audit_system.sql:226-238`) | `NotificationType` TS union includes 2 values (`community_join_approved/rejected`) not in that CHECK | `mobile/lib/services/NotificationService.ts:10`, `web/lib/services/NotificationService.ts:9` — unused today, landmine for next call site |
| Dead service exports | — | `PermissionService.checkPermission()` (mobile), `fetchMyPermissionsClient/Server()` (web), 10 of 12 `MediaService.ts` upload wrappers | Zero callers found for any of these |

## 8. Security Findings

Restated here by severity for scanability (full evidence in §3/§4 above where duplicated):

**Critical:**
- `rental_vehicles` + ~8 CMS tables: live `FOR ALL TO authenticated USING (true)` policy, never revoked (B1).

**High:**
- RBAC not wired into RLS for `properties`/`room_types`/`property_inquiries`/`guide_inquiries`/`rental_inquiries`/`guide-documents` bucket — hardcoded single-email policies (B2).
- `partner_trust_events`/`partner_audit_records`/`partner_audit_schedule` documented append-only, enforced as fully mutable (H8).
- Partner-side UPDATE on `review_change_requests`/`review_document_status` has no column-level restriction — self-verification bypass possible via direct API call (H14).

**Medium:**
- Notification recipient (`user_id`) unvalidated — spam/harassment vector, not data exposure (§5).
- `compute_public_trust_signals()` leaks entity `status` (including `rejected`/`suspended`) to any authenticated user — minor enumeration risk (§5).

**Positive findings worth stating plainly (evidence this isn't a systemic weakness):**
- `admin_activity_log` is correctly, genuinely append-only — INSERT+SELECT policies only, explicit comment explaining why.
- `compute_partner_trust_factors()` has a real internal permission check (staff-or-owner), not just definer-privilege blind trust.
- `review_internal_notes` is correctly staff-only with no partner-facing policy at all — no leak found.
- Signed document URL expiry (`guide-documents` bucket) is a consistent 2 hours on both platforms — reasonable, not indefinite.
- Every destructive admin action checked (delete, ban, reject) on both web and mobile goes through an explicit confirmation step — no one-click destructive gap found.
- The specific `auth.users`-in-RLS-policy pattern that caused a documented past incident (per project memory) was checked for recurrence and not found in any of the newer migrations (review workspace, audits, trust engine, discovery signals all correctly query `public.users`/`public.guides`/etc.).

**Not verified, flagged honestly rather than assumed safe:**
- The `guide-documents` storage bucket's own creation/default-deny posture could not be confirmed from tracked migrations (a comment states it was set up manually as private, admin-only) — recommend a direct dashboard check rather than treating this as confirmed.

## 9. Booking and Payment Prerequisites

Per the brief: **no booking or payment work should begin yet.** This section only names what must be true before it can, based on this audit's own findings, not a design for how to build it.

1. **Fix B5 first.** The one real, currently-functioning reservation path (`bookings.resource_type = 'homestay'`) is permanently wired to the legacy `homestays` table at the SQL-function level (`create_booking_request()`). Building anything further on top of this before the `properties`/`homestays` reconciliation happens means building it twice — exactly what `MIGRATION_PLAN.md` already warned against.
2. **Extend `bookings.resource_type`** to include `'property'` and `'vehicle'` (H10) — today, `properties` and `rental_vehicles` cannot produce a real reservation row at all, regardless of UI.
3. **Add the missing guide-side RLS policy** (H11) before any accept/reject booking flow can be built for guides — this is a database gap, not a missing screen.
4. **Fix B3 (suspension) and B4 (guide profile editing) first** — building a payment flow on top of a partner base where suspension doesn't work and a third of partners can't update their own pricing is building on a foundation that's already known to be unreliable.
5. **Resolve B2 (RBAC/RLS)** before any payment-adjacent admin action (refund approval, payout release) is built — those will need multi-admin operation from day one, and the current single-account limitation would make that impossible.
6. Everything else in `PARTNER_PLATFORM.md` §12 (escrow, staged release, ledger) and `COMMERCE_PHILOSOPHY.md` (commission tiers, Customer Protection Reserve) remains correctly greenfield and out of scope until the above are true.

## 10. Play Store and Deployment Checklist

| Item | Status | Action Needed |
|---|---|---|
| Android package ID | ✅ Real (`com.trekriderz.app`) | None |
| App name/icon/splash | ✅ Fully branded, custom assets | None |
| Deep link scheme | ✅ Configured (`trekriderz://`, `https://trekriderz.app/{trip,post,user}`) | Add the missing `user/` handler (H2) |
| EAS build profiles | ✅ development/preview/production all present | Confirm `google-play-service-account.json` is available wherever `eas submit` actually runs |
| Firebase config (`google-services.json`) | ✅ Present | None |
| Privacy policy / Terms | ✅ Real content, linked on both platforms | None |
| Permissions requested contextually | ✅ Matches `UX_BLUEPRINT.md` intent | None |
| Crash reporting | ❌ None on either platform | Add Sentry or equivalent (H7) |
| Analytics | ⚠️ Mobile: none. Web: opt-in stub, unconfigured | Decide and configure before launch |
| Play Store listing assets | ❌ No screenshots, description, or privacy URL wired anywhere | Prepare before submission |
| Web build | ✅ `npm run build` passes cleanly, 51 routes, no errors/warnings | None |
| Mobile typecheck | ✅ `tsc --noEmit` passes cleanly | None |
| Legacy root Next.js app | ⚠️ Full duplicate app in repo root, likely dead but undocumented as such | Mark clearly as deprecated or remove |
| `complete_schema_combined.sql` | ⚠️ Stale, pre-rebrand, called "canonical" by `CLAUDE.md` | Regenerate or correct the claim |

## 11. Showcase-Quality Checklist

What a prospective client would notice, separated from what merely needs to work:

**Would visibly undermine a client demo (fix before showcasing):**
- Three dead buttons in Settings (`Offline Cache Management`, `Help & FAQ`, `Contact Us` — all `onPress={() => {}}`) — `mobile/app/profile/settings.tsx:92,170,171`. These are exactly the items a reviewer clicks first.
- Raw technical error strings surfaced via `Alert.alert` (~25 sites) — reads as unpolished the moment any real error occurs during a walkthrough.
- `WeatherWidget`'s silent fabricated forecast (H13) — if a reviewer notices the weather doesn't match reality, it reads as fake data, which is a credibility problem beyond just weather.
- The two self-inflicted route collisions (B6) — if the wrong screen wins, an entire built feature appears simply missing during a demo.

**Would not visibly affect a demo, but is real technical debt (mention, don't block on):**
- Accessibility coverage, `any` usage, oversized screens, scattered Supabase access, duplicate helpers.

**Already a credit to the team, worth stating in a client conversation:**
- Empty states are consistent everywhere via one shared component.
- Loading indicators are present on 76 of 91 mobile screens.
- No literal placeholder/lorem-ipsum copy found anywhere.
- "Coming soon" labels are used deliberately and honestly rather than faked — a source comment in `web/app/rentals/page.tsx:29` states this explicitly as a design choice.
- The admin operations tooling (review workspace, audit queue, trust panel, a dozen CMS modules) is genuinely more complete than most launches this size ship with.
- The dashboard shows real data and honestly marks untracked metrics as untracked rather than inventing numbers.

## 12. Exact Recommended Implementation Sequence

Scoped as independently committable milestones, narrowest-blast-radius first. This is the shortest responsible path to closed beta, not a wishlist.

**Milestone 1 — Security lockdown** *(before anything else, including closed beta)*
Fix B1 (drop and replace the wide-open `FOR ALL` policies with real ownership/staff checks), B2 (wire `has_permission()` into the properties/inquiries/guide-documents RLS), B7 (add permission guards to the three unguarded admin screens), B8 (fix the Team page to write `role_id`). These four are almost entirely `DROP POLICY`/`CREATE POLICY` and small UI-guard changes — no new tables, narrow and independently verifiable.

**Milestone 2 — Route and table de-duplication** *(before closed beta)*
Delete the two colliding legacy files (B6), verify and resolve the `/discover` and `/community` collisions (H1, medium item), re-point the seven remaining `homestays`-table call sites at `properties` (B5), reconcile `cms_vehicles` per `MIGRATION_PLAN.md`'s existing recommendation. This is the direct fix for the exact bug class this audit found repeated four times.

**Milestone 3 — Partner lifecycle integrity** *(before closed beta)*
Fix B3 (make suspension actually hide a listing, and notify the partner), B4 (build a real guide profile edit path), B9 (remove the two data-fabricating admin insert screens or route them through the real workflow), add rental registration's missing document collection and admin notification (H5/H6).

**Milestone 4 — Operational safety net** *(before public/production release)*
Add crash reporting (H7), fix the append-only RLS gap on trust/audit tables (H8), add the column-level restriction on partner review-workspace updates (H14), fix notification recipient validation (medium item), fix the weather widget's silent fabrication (H13).

**Milestone 5 — Booking prerequisite groundwork** *(before any booking/payment work begins — not booking itself)*
Extend `bookings.resource_type` (H10), add the guide-side booking RLS policy (H11), confirm the `create_booking_request()` function no longer depends on Milestone 2's homestays fix being in place. This is preparation, explicitly not implementation.

**Milestone 6 — Showcase polish** *(before using this as a portfolio piece)*
Wire the three dead Settings buttons, replace raw `error.message` surfacing with friendly copy, add basic crash-free monitoring visibility, prepare Play Store listing assets, mark or remove the legacy root Next.js app.

**Deferred, tracked but explicitly not scheduled:** everything in §6.

---

*This document should be re-read before starting Milestone 1, not treated as permanently accurate — some findings (particularly the RLS policy states) should be re-verified against the live database directly before any fix is written, since this audit worked from migration files, which are the intended source of truth but can drift from the live database exactly as `MIGRATION_PLAN.md` already documents happening once before.*
