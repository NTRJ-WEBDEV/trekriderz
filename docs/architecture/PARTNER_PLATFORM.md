# TrekRiderz Partner Platform — Architecture Blueprint

**Status:** Architecture only. No code, no migrations, nothing in this document has been built. This is the blueprint for the phase that comes after it.

**Scope:** How TrekRiderz onboards, verifies, audits, pays, and manages the four partner types (Homestay Owners, Rental Owners, Trek/Tour Guides, Trip Organisers) so that "verified" means something a customer can trust.

**Relationship to existing docs:** [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) documents real, current schema debt this blueprint deliberately does not paper over — `properties`/`homestays` are two disconnected tables, `rental_vehicles`/`cms_vehicles` likewise, and the website's Razorpay integration has zero callers anywhere (payments are effectively unbuilt today, not "offline mode by choice"). [FUTURE_ROADMAP.md](./FUTURE_ROADMAP.md) placed "Partner Portal" and "Finance" out of scope for the RBAC phase — this document is that scope, designed from first principles rather than from the current table shapes. Where the current schema and the ideal design disagree, this document says so explicitly instead of quietly assuming today's tables are right.

**Trip Organisers do not exist as a partner concept today.** `guided_expeditions` rows belong to a single `guide_id` — there is no separate "organiser" entity, no organiser onboarding, no organiser-specific verification. Everything in this document about Trip Organisers is net-new design, not a description of something partially built.

---

## 0. Design Principles

1. **Trust is the product, not a feature bolted onto listings.** A customer choosing a homestay in a village they've never heard of is trusting TrekRiderz's judgment, not the homestay's own claims. Every mechanism below exists to make that judgment visible and auditable, not just internally trustworthy.
2. **Verification is tiered, not binary.** Not every partner needs a physical site visit before going live — that doesn't scale past a few hundred partners. Risk-based tiering (documents → video → physical) lets the highest-trust-requirement partners (homestays, where a customer physically stays overnight) get the deepest verification while lower-risk partners (a guide who's already led 40 trips with no complaints) can be verified faster.
3. **Nothing is permanently approved.** Approval is a snapshot, not a certificate. The periodic audit system is what keeps "verified" true over time instead of true-at-onboarding-only.
4. **One partner lifecycle, four partner types.** The four partner types have different data and different risk profiles, but they should share one state machine, one review workspace, one trust-scoring framework, and one financial ledger shape. Divergent implementations per partner type is exactly the kind of fragmentation that produced the `properties`/`homestays` split — this document designs against repeating that.
5. **Design for 10 years, sequence for 6 months.** Section 16 turns this into a build order. Nothing here assumes it all ships at once.

---

## 1. Partner Types — Differentiation Matrix

| | Homestay Owner | Rental Owner | Trek/Tour Guide | Trip Organiser |
|---|---|---|---|---|
| **What they sell** | Nights in a physical space | Vehicle-days | Personal guiding service | A packaged, scheduled group expedition |
| **Inventory model** | Calendar (per room type) | Calendar (per vehicle) | Availability windows, not a calendar — a guide can decline any request | Fixed-seat, fixed-date departures |
| **Physical verification need** | High — customer sleeps there overnight | Medium — safety-critical (brakes, insurance) but inspectable via documents + photos | Low-medium — the person, not a place, is the product | Medium — often re-using verified guides/homestays/rentals as components |
| **Identity vs business verification** | Both (owner identity + ownership proof) | Both (owner identity + vehicle RC/insurance) | Identity only, unless operating as a registered outfitter | Both — an organiser is a business relationship even if a sole proprietor |
| **Safety-critical fields** | Emergency exits, first-aid availability | Insurance validity, maintenance record | Certifications (wilderness first aid, high-altitude), emergency contacts | Component partner list (which guide/vehicle/homestay is actually being used), emergency protocol |
| **Re-audit cadence driver** | Photo freshness + facility condition | Insurance/RC expiry | Certification expiry | Composition changes (swapped guide/vehicle mid-cycle) |
| **Primary trust signal** | Repeat-guest %, review consistency | Cancellation rate, on-time pickup | Response rate, completion rate, certifications current | On-time departure rate, itinerary-accuracy complaints |
| **Existing schema today** | `properties` (real) + orphaned `homestays` (schema drift, no `CREATE TABLE` in repo) | `rental_vehicles` (real) + `cms_vehicles` (admin-authored catalog, unrelated) | `guides` (real, two overlapping generations of columns) | **None** — implicit in `guided_expeditions.guide_id` |

**Read on this table:** the two existing marketplace entities (`properties`, `rental_vehicles`) already need reconciliation before they can be trusted as a Partner Platform foundation (see [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)). Guides are single-table-clean but carry legacy-column debt. Trip Organiser is a blank page — which is actually the easiest one to get right, since there's no legacy to reconcile.

---

## 2. Registration Flow

### 2.1 The shared spine

Every partner type moves through the same six stages; only the *content* of each stage differs.

```
Account Creation → Business Profile → Identity Verification →
Business/Location Verification → Financial Setup → Listing Draft → Submit for Review
```

A partner can stop and resume at any stage — nothing is lost if they close the app mid-registration (draft persistence is a hard requirement; the current guide/homestay/rental registration flows are single-session forms with no resume, which is worth fixing early since abandonment at a 20-field form is exactly where "trust from day one" starts leaking).

### 2.2 Field requirements by partner type

Legend: **M** = mandatory to submit for review, **O** = optional, **M\*** = mandatory before paid-booking activation (see 2.3's `APPROVED_PAYMENTS_PENDING` state — a listing may be approved and visible before this is complete, but cannot collect payment until it is), **—** = not applicable.

| Field group | Homestay | Rental | Guide | Organiser |
|---|---|---|---|---|
| Legal/display name | M | M | M | M |
| Phone (OTP verified) | M | M | M | M |
| Email (verified) | M | M | M | M |
| Government ID (Aadhaar/Voter/DL) | M | M | M | M |
| Business registration / GST | O (M if >₹20L turnover, self-declared then spot-checked) | O | — | M (organisers are always a business relationship) |
| Ownership/lease proof | M | M (RC in owner's name) | — | — |
| Property address + GPS pin | M | M (base/pickup location) | M (primary service area) | M (registered office or primary operating base) |
| Emergency contact | O | O | **M** (safety-critical — guide is alone with customers in remote terrain) | **M** |
| Bank account details | M\* | M\* | M\* | M\* |
| Insurance | O today → **M** recommended (fire/liability) | **M** (vehicle insurance, checked for validity date) | O (personal accident cover recommended, not required) | **M** (public liability — organiser is legally exposed for the whole group) |
| Certifications | — | — | O, but required for any "high-altitude" or "technical" trek category | O at org level, required per-guide they use |
| Languages spoken | — | — | M | O |
| Base pricing | M | M | M | M |
| Media (min photo count) | M — min 8, incl. exterior, each room type, bathroom, common area | M — min 5, incl. all four sides + interior | M — min 1 profile photo, 3 recommended (in-field action shots) | M — min 5 (past-expedition photos or, for a new organiser, component photos) |
| Video intro | O | O | O (recommended — single biggest driver of guide trust from a stranger's perspective) | O |

### 2.3 Verification sub-flows (shared, invoked from within registration)

- **Phone verification** — OTP at account creation. Blocking: can't proceed past Account Creation without it.
- **Email verification** — link-click, non-blocking for registration progress but blocking for final submission (prevents disposable-email spam accounts).
- **Identity verification** — document upload + liveness-style selfie match (a photo of the person holding their ID, minimum viable version; a proper liveness SDK is a future feature, not a Phase 2 requirement). Reviewed in Verification Workflow (Section 3), not auto-approved.
- **Business verification** — GST number format + checksum validated client-side immediately; actual GST authenticity is a manual reviewer check (a GST verification API integration is a reasonable near-term addition, not assumed here).
- **Bank verification** — penny-drop (₹1 transfer + name-match against account holder name) or equivalent. This gates **paid-booking activation**, not listing approval or visibility — but it also gates *checkout itself*, not just payout release. A partner whose identity/business verification is approved but whose bank/payout details are not yet verified enters a distinct state, **`APPROVED_PAYMENTS_PENDING`**, rather than either being blocked entirely or (the earlier, wrong, version of this design) allowed to accept paid bookings on the strength of identity verification alone:

  ```
  Identity/business verification approved
    → Listing may be approved and (optionally) become visible
    → Enquiries and non-payment booking requests may be allowed, if enabled
    → Paid booking activation requires verified bank + payout details
  ```

  **In `APPROVED_PAYMENTS_PENDING`, a partner can:** complete listing setup, configure rooms/vehicles/treks and pricing, upload photos, manage policies, configure availability/calendar, receive enquiries (if the partner type/listing has enquiries enabled), and preview their own public listing exactly as a customer would see it.

  **What stays disabled:** the checkout/payment-collection step of the booking workflow (Section 6) is hard-gated off for this partner until bank verification passes — not merely "payout held," the booking cannot be paid for at all. The listing transitions to full `Live` (payment-capable) automatically the moment bank verification completes; no separate re-approval is needed, since identity/business verification already passed.

  **Why gate checkout itself, not just payout release:** allowing a customer to pay into a booking whose payout destination isn't yet verified creates exactly the failure modes a trust platform can't afford — **unpayable balances** (money collected with nowhere verified to send it), **payout fraud** (a bad actor collecting real payments against a bank account that turns out not to be theirs, discovered only after money has already moved), **payout disputes** (a partner claiming a payout failure was TrekRiderz's fault when it was actually an unverified/mismatched account), **abandoned settlements** (a partner who never completes bank verification leaves a balance in limbo indefinitely, with no clean way to unwind a completed booking), and **reconciliation problems** (finance has to treat every booking against an unverified partner as provisional, which defeats the purpose of a clean append-only ledger in Section 15). Decoupling "can a customer see and enquire about this listing" from "can a customer pay this listing" is what lets registration/verification throughput stay fast (per Section 0's tiering principle) without ever putting real money at risk on an unverified payout destination.
- **Location verification** — GPS pin drop, reverse-geocoded to confirm state/district match what the partner typed (catches copy-pasted or wildly wrong addresses immediately, before a human reviewer wastes time on it). Satellite-view confirmation is a reviewer step (Section 3), not automated.
- **Map verification** — reviewer manually drags/confirms the pin against satellite imagery during review; partner-facing map placement is just the first draft of that pin, not the final word.

### 2.4 What we'd regret not collecting today

Per the prompt's own question — three fields that are cheap to collect now and expensive to backfill later:
1. **Structured emergency contact** for guides/organisers (name, relationship, phone) — currently nothing captures this at all; retrofitting it after an incident, rather than before one, is the wrong order.
2. **Primary photo capture timestamp/EXIF**, stored explicitly rather than inferred from "when was this row last updated" — this is the entire foundation of the "photo freshness" trust signal in Section 7. If this isn't captured at upload time, freshness can never be reconstructed retroactively.
3. **Component declaration for Trip Organisers** (which guide, which vehicle, which homestay is actually being used per expedition) — without this as structured data from day one, "did the organiser actually use verified partners" is un-auditable, and it's the single biggest fraud vector for this partner type (an organiser claiming a verified guide who never actually shows up).

---

## 3. Verification Workflow

### 3.1 Reviewer roles

Maps onto existing RBAC roles (`guide_manager`, `homestay_manager`, `rental_manager` already exist per the RBAC migration) plus one net-new role this phase needs: **`trip_organiser_manager`** (or fold into `operations_manager` initially if the volume doesn't justify a dedicated role yet — a sequencing call, not an architecture one).

| Role | Responsibility |
|---|---|
| Content Reviewer | Tier 1 — document completeness, photo quality, obvious red flags. High volume, fast SLA. |
| Verification Specialist | Tier 2 — cross-checks identity/business documents, GST validity, bank verification status. Makes the Approve/Request Changes/Reject call for most partners. |
| Field Auditor | Tier 3 — physical or video verification, geographically or category assigned. Only invoked when Tier 2 flags risk or the partner type/value tier requires it by policy. |

### 3.2 Verification tiers

```
Tier 1: Document Review        → automatable checks + human skim (minutes)
Tier 2: Manual Profile Review   → full cross-check (the "real" review, hours)
Tier 3: Physical/Video Verification → risk-based, not universal (days, scheduling-dependent)
```

**Who gets Tier 3, and how:**

| Partner type | Default Tier 3 trigger |
|---|---|
| Homestay | Always, for first listing at a new address. Video call is the default (photo/video walkthrough with the reviewer live); physical visit reserved for high-value listings (>₹5,000/night average) or when video verification looks suspicious (stock-photo suspicion, address doesn't match visible surroundings). |
| Rental | Never by default — insurance/RC document validity plus photo cross-check is sufficient for Tier 2. Escalate to video if the vehicle photos look inconsistent with the claimed make/model/year. |
| Guide | Video call, always, before first approval — this is the one partner type where "is this actually a real, competent person" can't be established from documents alone. No physical visit needed. |
| Organiser | Video call for the organiser + verification that every declared component partner (guide/vehicle/homestay) is *already independently verified* on the platform. An organiser cannot compose expeditions out of unverified components — this is the mechanism that makes organiser trust inherit from, rather than bypass, the other three partner types' verification. |

### 3.3 Decision outcomes

- **Approve** — listing enters `APPROVED_PAYMENTS_PENDING` if bank/payout verification (Section 2.3) isn't yet complete, or straight to full `Live` if it already is (or re-enters `Live` directly if this was a reverification of an already-payment-verified partner).
- **Request Changes** — structured, itemized (see Section 9.1 — not a freeform "fix your stuff" message). Partner resubmits only the flagged items; unflagged data doesn't need to be touched or re-reviewed.
- **Reject** — terminal for this submission; partner may re-register after addressing the stated reason, but this is not a "try again" loop on the same case.
- **Suspend** — used post-approval (complaint, audit failure, expired document) — listing goes invisible to customers but partner data/history is retained, distinct from Reject.
- **Reverification** — triggered by the periodic audit system (Section 7) or a significant profile change (Section 4.3's "material change" definition), re-enters the same Tier 1→2→(3) pipeline but scoped to what changed, not a full re-review of static fields.

### 3.4 SLA targets (design target, not a committed number)

Tier 1: same-day. Tier 2: 48 hours. Tier 3 video: scheduled within 3 business days of Tier 2 pass. Tier 3 physical: scheduled within 7 days, dependent on auditor geographic coverage — this is the one stage with real operational (not just software) scaling limits, worth flagging now rather than discovering it at 500 pending homestays.

---

## 4. Listing Management

### 4.1 Inventory model per partner type

| | Homestay | Rental | Guide | Organiser |
|---|---|---|---|---|
| Unit of inventory | Room type × date | Vehicle × date | Guide × date-range availability (not per-day slots) | Expedition departure × seats |
| Already exists today | `room_types` (rich — occupancy, seasonal/peak/off-season pricing, min-nights) | Single vehicle record, local/outstation pricing tiers | No calendar concept at all | `guided_expeditions` + `expedition_packages` + `expedition_itinerary_days` (already fairly complete) |

### 4.2 Shared listing content, all partner types

Media (photos + video), pricing (Section 5), amenities/features (partner-type-specific vocabulary but same underlying tag-list pattern `properties.amenities`/`rental_vehicles.features` already use), policies & rules (cancellation policy, house rules, safety rules), nearby attractions (currently nowhere — net new, valuable for both customer conversion and, per Section 7, an audit-verified field so it can't be fabricated), meal plans (homestay-specific), parking/pool/WiFi/jeep/campfire/pet-friendly (all just entries in the shared amenity-tag pattern, not separate boolean columns each — the existing `amenities text[]` approach on `properties` is the right shape, not the older per-boolean-column pattern also present in the schema; new amenity types should be additive strings, never new columns).

### 4.3 Editing after approval — the "material change" distinction

This is the workflow gap that will hurt most if left undesigned: **not every edit should re-trigger review**, or partners will stop making legitimate small corrections; **but some edits absolutely must**, or verification becomes theater.

| Change type | Examples | Re-review? |
|---|---|---|
| Cosmetic | Typo fixes, description wording, amenity tag additions that don't change safety/legal claims | No — auto-applied, logged |
| Material | Address/GPS pin change, primary photo replacement, price change beyond a configurable threshold (e.g. >20%), any document replacement, certification changes | Yes — scoped re-review of only the changed field(s), not the whole listing |
| Safety-critical | Insurance document, identity document, emergency contact removal | Yes — always Tier 2 minimum, regardless of size of change |

Every listing needs a **change history** (who changed what, when, and whether it triggered re-review) — this is a natural extension of the `admin_activity_log` pattern already in production, generalized to also log *partner-initiated* changes, not just staff actions.

---

## 5. Pricing System

### 5.1 The price waterfall

```
Partner base price
  × seasonal/weekend/festival multiplier   (partner-set, bounded by platform min/max policy)
  = Partner listed price
  + Platform fee / − Platform commission   (see 5.2 — customer-facing markup vs partner-side commission are different models, pick one per partner type deliberately)
  + Taxes (GST, where applicable)
  − Discounts / coupons
  = Customer-facing price

Partner payout = Partner listed price
  − Commission
  − Cancellation-policy-driven deductions (if applicable to this booking)
  − Damage claims (if applicable, rentals mainly)
  + Adjustments (goodwill credits, dispute resolutions)
```

### 5.2 Commission vs markup — a decision this document flags, doesn't make

Two models exist in the wild for marketplaces like this, and TrekRiderz should pick deliberately rather than let it vary accidentally by partner type:
- **Commission model** (like Airbnb host-side fee): partner sets price, platform takes a cut, customer sees partner price + platform's *own* separately-shown service fee.
- **Markup model** (like many hotel OTAs): partner sets a net rate, platform marks it up to the customer-facing price, partner never sees the markup.

Recommendation: **commission model, uniformly, across all four partner types** — it's more transparent (customers price-compare against partner rates elsewhere, e.g. the homestay's own Instagram, and a see-through commission avoids a "why is this 40% more here" trust hit), and it composes cleanly with the existing `properties.commission_rate` field, which already exists and is per-partner-configurable.

### 5.3 Pricing tiers already well-modeled, to be extended not replaced

`room_types` already has base/weekend/peak-season/off-season pricing with date ranges — this exact shape should become the **shared seasonal-pricing primitive** for all four partner types (a guide's per-trek rate during peak trekking season, a rental's festival-week surge, an organiser's early-bird departure pricing), rather than each partner type inventing its own seasonal pricing shape. Shared room/private room/dorm pricing already exists conceptually via `room_types.room_category` + `max_occupancy`/`base_occupancy` + `extra_guest_charge` — extend the category vocabulary, don't redesign the mechanism.

### 5.4 Coupons & discounts

Two funding sources, tracked distinctly so payout math is never ambiguous: **platform-funded** (TrekRiderz absorbs the discount — marketing spend) vs **partner-funded** (partner opts in to a promotional price — partner's payout is reduced accordingly, never TrekRiderz's take). A coupon must declare which one it is at creation; this single distinction prevents an entire category of "why was my payout lower than expected" partner disputes.

### 5.5 Refund calculation

Driven by `cancellation_policy` (flexible/moderate/strict/non_refundable — already exists on `properties`, should become a shared enum across all partner types) crossed with time-before-service brackets:

| Policy | >7 days before | 3–7 days | 1–3 days | <24h / no-show |
|---|---|---|---|---|
| Flexible | 100% | 100% | 50% | 0% |
| Moderate | 100% | 50% | 0% | 0% |
| Strict | 50% | 0% | 0% | 0% |
| Non-refundable | 0% | 0% | 0% | 0% |

(Illustrative brackets — the actual percentages are a business/legal decision, not an architecture one; the *shape* — policy × time-bracket matrix, evaluated at cancellation time and stored as a resolved snapshot on the booking so later policy changes don't retroactively alter historical bookings — is the architectural point.)

---

## 6. Booking Workflow

```
Inquiry → Booking Request → Partner Accept/Reject* → Payment → Confirmation
  → Pre-arrival reminders → Arrival/Check-in → Stay/Service → Completion
  → Review prompt → [Dispute window] → Payout release
```

\* Accept/Reject only applies where availability isn't purely calendar-confirmed (Guides and, optionally, Organisers for custom-date requests) — Homestay/Rental bookings against an open calendar slot can confirm immediately on payment, no partner action needed, which is both better UX and removes a partner-response-time dependency from the customer's critical path.

**The Payment step is itself gated by partner state (Section 2.3).** Against a partner in `APPROVED_PAYMENTS_PENDING`, the workflow above stops at Inquiry/Booking Request — there is no Payment step to enter, and checkout is not offered. This isn't a failure state; it's the intended shape for a newly-approved partner still completing bank verification, and it's why Inquiry/Booking Request are modeled as reachable independently of Payment rather than as the first two steps of one inseparable pipeline.

**Branch points, each a distinct state, not a status string:**
- **Cancellation** — customer-initiated vs partner-initiated are different flows with different refund defaults (partner-initiated cancellation should default to 100% customer refund regardless of policy — the customer didn't cause the cancellation).
- **No-show** — partner-reported, evidence-optional (a check-in system, even simple, strengthens this — see Section 12 dispute/no-show interplay), triggers no-show fee per Section 11.
- **Reschedule** — treated as cancel-and-rebook under the hood for accounting clarity (a reschedule is not a silent booking mutation; it's a paired cancellation + new booking, linked, so refund/payout math never has to special-case "what if the price changed between old and new dates").
- **Dispute** — opens a window (e.g., 48–72 hours post-completion) during which either party can flag an issue before payout finalizes. This is *why* payout release is the last step, not immediate-on-completion — payout timing is a trust mechanism, not just an accounting one.

---

## 7. Trust System

### 7.1 Trust Score — composite, not a single metric

```
Trust Score =
    Verification Tier Weight        (Tier 1/2/3 passed — base credibility floor)
  + Review Rating (recency-weighted — a rating from 2 years ago matters less than last month's)
  + Response Rate
  − Cancellation Rate (partner-initiated cancellations weighted heavier than customer-initiated)
  − Complaint History (severity-weighted, decays over time — see 7.4)
  + Audit Recency & Pass Rate
  + Repeat Customer %
  + Tenure (small positive weight — long clean history should count for something, but not so much that it outweighs recent problems)
```

This is deliberately a *formula*, not a black box, so partners can be told what moves their score — an opaque trust score is worse than no trust score, because it reads as arbitrary rather than earned.

### 7.2 Trust Score vs Quality Score — two different questions

- **Quality Score**: objective, listing-level — photo count/resolution, description completeness, amenity coverage, pricing clarity. Answers "is this listing well-presented."
- **Trust Score**: behavioral, partner-level — answers "will this partner actually deliver what they promised, reliably, over time."

A brand-new partner can have a high Quality Score (great photos, complete profile) but necessarily has a *provisional* Trust Score (no track record yet) — these should never be conflated into one number, or a well-photographed scam listing scores identically to a proven partner on day one.

### 7.3 Badges (customer-facing trust shorthand)

`Verified` (passed initial verification — baseline, not a differentiator once most partners have it), `TrekRiderz Certified` (passed a physical/video Tier 3 audit — the Airbnb-Superhost-equivalent), `Fast Responder` (response rate above threshold), `Top Rated` (rating + volume threshold), `Eco-Friendly` (self-declared + spot-checked, future category), `New Partner` (explicit, time-boxed — the honest alternative to a new listing looking suspiciously badge-free; frames "new" as a neutral fact, not a red flag, for the grace period defined in 7.4).

### 7.4 Photo freshness & score decay/recovery

Photos older than 12 months without a passed re-audit degrade the listing's Quality Score (not Trust Score directly — a stale photo is a presentation problem, though a *repeatedly* stale-photo partner who ignores audit reminders should eventually affect Trust Score too, via the audit-recency term in 7.1).

Complaint history should **decay**, not accumulate forever: a resolved complaint from 18 months ago with no repeat should contribute near-zero to the current score. A trust system that can never recover from one bad incident just teaches partners not to self-report problems — recoverability is what keeps partners honest with TrekRiderz rather than hiding issues from it.

### 7.5 Everything else requested, mapped

Response rate / cancellation rate / complaint history / audit history / repeat-customer % are each individual inputs to 7.1, computed as rolling windows (e.g., trailing 90 days weighted higher than lifetime) so a partner's *current* behavior, not their distant history, drives what a customer sees today.

---

## 8. Periodic Audit System

### 8.1 Cadence & scheduling

Default 6-month cycle, but **risk-based, not uniform** — a homestay that failed its last audit or has a rising complaint trend should re-audit sooner (e.g., 3 months); a partner with 3+ consecutive clean audits and high tenure can extend to 9–12 months. Uniform 6-month cycles for everyone is the naive version; it under-audits risky partners and over-audits proven ones.

### 8.2 Reminder cadence

60 / 30 / 14 / 7 / 1 days before due, escalating in channel and tone (in-app → email → SMS/WhatsApp for the final warnings). Overdue handling: a grace period (e.g., 14 days past due) before **auto-hiding** the listing from customer search — hidden, not deleted, and automatically restored the moment the audit is scheduled/passed. This protects customers (an unaudited listing shouldn't stay bookable indefinitely) without being punitive to a partner who's just slow to respond to a reminder.

### 8.3 Audit types (mirrors the Tier 3 verification triggers in 3.2, same infrastructure reused)

| Partner type | Standard re-audit | Escalated if... |
|---|---|---|
| Homestay | Video walkthrough | Complaint spike since last audit, or high-value listing → physical |
| Rental | Document-only (insurance/RC validity refresh) + photo comparison | Complaint pattern suggests vehicle condition mismatch → physical |
| Guide | Certification validity check + response/completion rate review | Safety complaint → video re-interview |
| Organiser | Component-partner verification refresh (are the declared guide/vehicle/homestay still independently verified and still actually used) | Itinerary-accuracy complaints → deeper review |

### 8.4 Audit checklist components

New photo set (required, not optional — this is what resets the freshness clock in 7.4), condition report (structured checklist, not freeform notes, so it's comparable audit-over-audit), facility verification (do claimed amenities still exist), price verification (does live pricing match what's actually charged — a common drift point), nearby-attraction verification (catches copy-pasted or fabricated attraction claims), location re-verification (pin still matches satellite imagery).

### 8.5 Outcomes

Pass (resets audit clock, may improve trust score per 7.1's audit-recency term) → Minor Issues (partner correction window, e.g., 7 days, listing stays live) → Fail (immediate suspend until reverified, same Reverification path as Section 3.3) → Overdue (auto-hide per 8.2, not a punitive "fail," a neutral consequence of non-response).

---

## 9. Communication System

### 9.1 "Request Changes" as a structured object, not a message

The single highest-leverage design decision in this whole document: **Request Changes must be itemized**, e.g. `{ field: "identity_doc_front_url", issue: "blurred", instructions: "Re-upload a clear photo of the front of your Aadhaar card" }` — a list of these, each independently resolvable and independently marked resolved by the partner, with the case only returning to review once *all* items are addressed. A freeform "please fix your submission" message is what turns re-review into an endless back-and-forth; a checklist is what makes it converge.

### 9.2 Message type catalog

| Category | Examples |
|---|---|
| Verification | Document requested, document expiring in 30/14/7 days, document expired (listing auto-suspends), photo quality issue, identity mismatch |
| Listing | Price clarification needed, availability reminder (calendar gone stale), material-change re-review notice |
| Audit | Reminder cascade (8.2), audit scheduled, audit result |
| Financial | Payout processed, payout held (pending bank verification), invoice/statement ready |
| Disputes & Reviews | Dispute opened, dispute resolution, new review received, review-reply reminder |
| Lifecycle | Approved, suspended (with reason), reinstated, reverification required |

### 9.3 Channel strategy

In-app notification is the system of record for everything (auditable, always present); email for anything requiring a document/link or formal record (statements, legal notices); SMS/WhatsApp reserved for time-sensitive or high-urgency items (audit overdue final warning, payout issue, suspension) — reusing the `contact_whatsapp` field already collected from partners rather than requiring a new opt-in flow.

### 9.4 Escalation

Partner non-response to a Request-Changes case after a defined window (e.g., 7 days) escalates channel and, after a second window, auto-expires the submission back to Draft — this prevents the review queue from accumulating zombie cases indefinitely.

---

## 10. Admin Review Workspace

Moves from binary approve/reject to a **case-management workspace** — one screen per verification case, not a table row with two buttons.

### 10.1 Components of the workspace

- **Review Checklist** — configurable per partner type (not hardcoded per page, the way the current guides/homestays/rentals admin pages each hardcode their own approve/reject buttons) — a checklist item is itself data (`{label, required, category}`), so adding a new required check doesn't require a code change, just a config update.
- **Documents panel** — each document has its own status (`pending / verified / rejected / expired`), not just a raw link — a reviewer marks *each document* individually, and overall case status is derived from document statuses plus checklist completion, not a single "approve" button glossing over what was actually checked.
- **Photo review panel** — per-photo flags (blurry, suspected stock photo, content mismatch with claimed listing), not just a gallery to eyeball.
- **Request Documents / Request Changes** — invokes the structured object from 9.1 directly from the workspace.
- **Internal Notes** — staff-only thread, never visible to the partner, distinct from the partner-facing message thread. (This distinction matters: reviewer reasoning like "price seems high for this area, double-check comps" should never leak to the partner as a formal request.)
- **Activity Timeline** — the existing `admin_activity_log` pattern, extended to also show partner-side events (submissions, resubmissions, message replies) inline with staff actions, so the whole case history reads as one chronological thread instead of two separate logs a reviewer has to mentally merge.
- **Assign Reviewer** — explicit assignment (avoids two reviewers working the same case simultaneously — a real failure mode once review volume exceeds one person).
- **Approval History / Audit History** — every past review and audit outcome for this partner, visible in the same workspace (not a separate screen) — a reviewer deciding on a reverification needs the partner's track record in view, not a fresh blank slate each time.
- **Trust Score & Risk Indicators** — the current computed score (Section 7) plus specific flags: new partner + unusually high price for the category, address/map-pin mismatch, photo perceptual-hash collision with an existing listing (duplicate/stolen photo suspicion — flagged here as a Future Feature in Section 13, but the *field* for a manual version of this flag should exist from day one even before the AI version ships), document expiring within N days, recent complaint spike.

### 10.2 Why this replaces, not extends, the current approve/reject pages

The guides/homestays/rentals admin pages built in the prior session (list → detail → Approve/Reject/Suspend/Feature/Delete) are a real, working foundation for Tier 1/2 review — this workspace is what they grow into once Request-Changes becomes structured (9.1), checklists become configurable, and multiple reviewer roles need to collaborate on one case rather than one admin unilaterally deciding. **Nothing about the existing pages needs to be thrown away** — the review workspace is additive structure (checklist, per-document status, assignment, internal notes) layered onto the same underlying entities, not a replacement architecture.

---

## 11. Partner Dashboard

Post-approval, partner-facing. One dashboard shape, contents adapted per partner type:

| Section | Content |
|---|---|
| Bookings | Upcoming, past, cancelled — filterable, with per-booking status and any pending action (e.g., accept/reject for guides). While the partner is `APPROVED_PAYMENTS_PENDING` (2.3), this shows enquiries/booking requests only — no paid bookings exist yet to list. |
| Revenue & Payouts | Running balance, next payout date, payout history, downloadable statements |
| Calendar/Availability | Per-partner-type shape from Section 4.1 — this is the single most-used screen for Homestay/Rental partners day-to-day |
| Analytics | Listing views, inquiry-to-booking conversion, average response time — partners managing this as a business need to see what's working |
| Reviews | View + reply (public reply, distinct from internal dispute resolution) |
| Documents | Status of every submitted document, expiry countdown, re-upload action |
| Profile & Verification | Current tier, current trust score (with the formula's factors shown, per 7.1's transparency principle), badges held |
| Audit | Next audit due date, history, reminders |
| Messages | Both the TrekRiderz↔partner thread (9.1–9.3) and, where relevant, pre-booking customer inquiries |
| Support | Help center + escalation path distinct from the Messages thread |
| Promotions | Opt-in to platform campaigns/coupons (5.4's partner-funded discount mechanism, partner-initiated) |

---

## 12. Financial System

**Reality check, stated plainly:** per [MIGRATION_PLAN.md](./MIGRATION_PLAN.md), no payment path in this codebase is actually wired end-to-end today — the website's Razorpay integration has zero callers, and the mobile `bookings` table has never had a `payment_orders` row written to it. Everything in this section is genuinely greenfield design, not a retrofit of a working system, and Finance (per `FUTURE_ROADMAP.md`'s Phase 7) is correctly sequenced *after* the marketplace-table reconciliation — building a payout ledger against two disconnected homestay tables means building it twice.

### 12.1 Fee structure

Platform commission (tiered — e.g., a lower rate for new partners during an onboarding-incentive window, standard rate after), minimum service charge floor (protects against a commission-only model producing near-zero platform revenue on very low-priced bookings), taxes (GST — invoiced separately, TrekRiderz's own GST obligation on its commission is distinct from the partner's GST on their service, don't conflate the two), payout schedule (e.g., weekly batch, T+2 after the dispute window in Section 6 closes — payout timing should never precede dispute-window close).

### 12.2 Security deposits & damage claims (rentals primarily, occasionally homestays)

Hold (authorized, not captured, at booking) → release (automatic, on completion with no claim) → claim (partner-initiated within a defined window, evidence-required, customer response window, admin arbitration if contested) → charge or partial-release resolution. This is a distinct state machine from the booking/refund one in Section 6 — a damage claim can open *after* a booking has already completed successfully.

### 12.3 Cancellation/no-show fees

Computed via the same policy × timing matrix as Section 5.5's refund table, but from the *partner's* side — a late customer cancellation that yields a 0% customer refund correspondingly yields a **partial** payout to the partner (not 100% — the platform commission still doesn't apply to money that was never actually earned as service, a policy decision to make deliberately, not default to "partner keeps everything").

### 12.4 Wallet & statements

Partner wallet accumulates net payouts; scheduled auto-payout is the default, on-demand withdrawal (subject to a minimum threshold) is the improvement worth prioritizing early since it's a common partner-satisfaction lever. Monthly statement: bookings, gross, commission, taxes, adjustments, net payout — downloadable, and this is also the natural artifact for any future tax-filing support feature.

---

## 13. Future Features (explicitly not Phase 2)

Calendar sync (iCal export as the cheap first step; Google Calendar, then Airbnb/Booking.com channel-manager integration as the expensive later steps — sequence in that order), dynamic pricing suggestions (needs booking-volume history to be worth anything — not viable until there's real data), AI photo-quality/stock-photo detection (the manual version of this — a reviewer's "suspected stock photo" flag — should exist in the workspace from day one per Section 10.1, so the AI version has a labeled dataset to train against later), duplicate-listing detection (perceptual photo hashing + address clustering), fraud detection (velocity checks on registrations from the same device/IP, listing-similarity clustering), geo-verification (photo EXIF GPS vs claimed address vs device-location-at-upload-time — a stronger, harder-to-fake version of the manual location verification in Section 2.3), smart recommendations for customers (needs the trust/quality scoring from Section 7 as an input signal — sequenced after, not before).

---

## 14. Unified Partner Lifecycle (ties Sections 2, 3, 7, 8, 9 together)

```
Draft
  │  (partner completes registration)
  ▼
Submitted ──────────────────┐
  │                         │ (reviewer requests changes, itemized per 9.1)
  ▼                         │
Under Review ────────────────┘
  │  (approved)
  ▼
Approved — Payments Pending  (2.3: listing visible, enquiries allowed, checkout disabled)
  │  (bank/payout verification passes)
  ▼
Live ◄────────────────────────────┐
  │           │                   │ (reverification passed)
  │           │ (audit due, 8.1)  │
  │           ▼                   │
  │      Audit Pending ───────────┤
  │           │                   │
  │           │ (audit fails, or  │
  │           │  complaint/report)│
  │           ▼                   │
  │      Suspended ────────────────┘
  │           │
  │           │ (no reverification within grace period)
  ▼           ▼
Deactivated (partner-initiated exit, or platform-initiated after repeated failure)
```

Every arrow in this diagram is a logged, timestamped transition (extending `admin_activity_log`'s existing pattern) — the partner's entire history is reconstructable from this transition log alone, which is itself a trust-system input (tenure, audit pass rate) and a dispute-resolution input (what was true about this partner's status at the time of a given booking).

---

## 15. Data Concepts This Implies (not a migration — concepts only)

Named here so the eventual migration-planning phase has vocabulary to start from, deliberately not specified as tables/columns:

- **Partner** — a unified identity record wrapping the type-specific entity (guide/property/rental_vehicle/organiser), holding the lifecycle state (Section 14), trust score, and badge set common to all four types. Whether this becomes a literal parent table or a shared set of columns/conventions across the four existing tables is a migration-phase decision — this document takes no position, only asserts that the *concept* needs to exist somewhere so trust scoring and the review workspace aren't reimplemented four times.
- **Document** — generic record (type, file URL, status, expiry, reviewed-by, reviewed-at) replacing the current pattern of scattered per-table URL columns (`identity_doc_front_url`, `ownership_proof_url`, etc.) — this is what makes the Documents panel (10.1) and expiry-reminder system (9.2) work generically across partner types instead of per-table special-casing.
- **VerificationCase** — the review workspace's core object (Section 10): checklist state, assigned reviewer, document statuses, internal notes thread, partner-facing message thread, decision + reason.
- **TrustScoreSnapshot** — historical, not just current-value — a trust score that can't be traced back through time can't explain itself when a partner disputes it.
- **AuditRecord** — one per audit cycle, holding the checklist results (8.4), outcome (8.5), and linking to the photo set that reset the freshness clock.
- **Payout / Ledger Transaction** — the accounting spine for Section 12, needs to exist as an append-only ledger (never mutate a past entry, only append corrections) for the same reason `admin_activity_log` is insert-only.
- **Dispute** — Section 6/12.2's evidence, response window, and resolution, as its own entity rather than a status field on a booking.
- **Message / Thread** — Section 9's structured Request-Changes items and general partner communication, as data, not just notification rows.

---

## 16. Rollout Sequencing Recommendation

Still architecture-level — a recommended order, not a sprint plan:

1. **Unify the review workspace (Section 10) across the three partner types that already exist.** Cheapest first step — no new partner type, just upgrading the existing guides/homestays/rentals admin pages from binary approve/reject into the checklist + structured-Request-Changes + assignment model. This alone fixes the biggest current gap (Section 9.1) and doesn't require touching the `properties`/`homestays` or `rental_vehicles`/`cms_vehicles` reconciliation yet.
2. **Registration flow upgrades** — structured emergency contacts, the `APPROVED_PAYMENTS_PENDING` state and checkout gate (Section 2.3 — listing visibility decoupled from payment-acceptance, not decoupled from bank verification entirely), the "material change" re-review distinction (Section 4.3). Still no new partner type.
3. **Trust scoring (Section 7) as a read-only signal first** — compute and display scores/badges before any workflow depends on them, so the formula can be tuned against real data before it gates anything.
4. **Periodic audit system (Section 8)** — needs Section 1's audit-cadence infrastructure and reuses Tier 3 verification mechanics from Section 3, so it's cheaper once those exist than if built first.
5. **Financial system (Section 12)** — deliberately last among the existing-partner-type work, and explicitly blocked on the `properties`/`homestays` and `rental_vehicles`/`cms_vehicles` reconciliation in `MIGRATION_PLAN.md` — building payouts against two disconnected homestay tables means building it twice.
6. **Trip Organiser as the fourth partner type** — newest concept, least legacy, but also the one most dependent on the other three being verified first (an organiser's trust is partly inherited from its component partners, per Section 3.2). Sequenced last deliberately, not because it's less important, but because it's the partner type best served by everything else already being solid.
7. **Future/AI features (Section 13)** — after real data volume exists to make them worth building.
