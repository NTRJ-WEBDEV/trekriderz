# TrekRiderz Commerce Blueprint

**Status:** Architecture and business design only. No code, no migrations, no payment gateway integration — nothing in this document has been built.

**Scope:** How TrekRiderz prices its service, splits money between customers/partners/platform, handles refunds and cancellations, and pays partners — in a way that funds a sustainable trust platform without making adventure expensive or making partners feel squeezed.

**Relationship to existing docs:** [PARTNER_PLATFORM.md](./PARTNER_PLATFORM.md) already established the *mechanics* — the price waterfall (§5.1), commission-vs-markup choice (§5.2), an illustrative cancellation-policy × refund-bracket table (§5.5), and the payout-timing principle (§12.1, §12.4, and the `APPROVED_PAYMENTS_PENDING` gate). This document is where those mechanics get actual **numbers and philosophy** — the refund brackets in that document's §5.5 are carried forward here as ratified, not re-litigated, and the force-majeure/emergency/no-show categories that document didn't cover are added on top.

---

## Before the twelve sections: the tension in the brief itself

You asked me to challenge your thinking, so I'll start there rather than bury it at the end.

**"Affordable" and "sustainable, hire employees, keep developing" are in real tension, and the brief doesn't yet resolve it.** Every cost you listed — servers, AI APIs, maps, gateway charges, taxes, future salaries, product development — is a cost that scales with usage and time, while "keep travel affordable" pulls commission rates down. Both are correct goals. But if commission is set low *across the board* to maximize the "affordable" perception, the platform under-funds the exact verification/audit/support infrastructure that is supposed to be its differentiator — and an underfunded trust platform isn't a cheaper trust platform, it's a worse one. The resolution isn't "charge less" — it's "charge fairly and transparently relative to value delivered, and make the reasoning visible" (Section 9 is where that reasoning gets said out loud to customers). A platform that races to the lowest possible take-rate can't out-verify Airbnb or OYO while doing *more* manual verification work than either — that's not a viable position, and I'd rather say so now than have the numbers quietly fail later. Sections 1, 2, and 12 make the actual case for why the recommended rates are the affordable-*and*-sustainable answer, not a compromise between the two.

Two more places I'm pushing back rather than just designing what was asked, flagged inline where they occur: an unfunded "always 100% refund for force-majeure" promise (Section 6) is a real balance-sheet risk, not just a nice policy; and "we don't want to squeeze partners" needs to explicitly include *payout speed*, not just commission rate — partners have their own trust relationship with the platform, distinct from the customer-facing one, and it gets less founder attention by default (Section 8).

---

## 1. Pricing Philosophy

| Model | How it works | Strength | Weakness |
|---|---|---|---|
| Percentage only | Commission = X% of booking value, always | Scales naturally with value, transparent, industry-standard mental model | Breaks at both ends — a ₹300 hostel-bunk booking's commission may not cover the fixed cost of processing it (gateway fixed fee, support triage); a ₹50,000 luxury booking's commission grows unboundedly even though verification/support cost per listing doesn't scale 1:1 with price |
| Flat fee | Fixed ₹ per booking, regardless of price | Predictable for partners | Actively punishes affordability — a flat ₹100 fee is 20% on a ₹500 booking and 0.4% on a ₹25,000 one, which is backwards for a platform that says it wants to protect budget travelers |
| Hybrid (% + floor + cap) | Percentage as the mechanism, with a minimum ₹ floor and maximum ₹ cap per booking | Aligns commission with actual cost-to-serve at both extremes; floor protects the platform on cheap bookings, cap protects partners on expensive ones | Slightly more complex to explain than a single flat percentage |
| Category-tiered percentage | Different % by category/price-tier, not a single blanket rate | This is what actually delivers "a ₹500 hostel booking should not pay the same percentage as a ₹25,000 luxury villa" — a *cap alone* doesn't achieve that, different *rates* by segment do | Requires maintaining a rate table instead of one number; needs periodic review as categories evolve |

**Recommendation: category-tiered percentage commission, each tier with its own minimum ₹ floor and maximum ₹ cap.** Percentage-only or flat-only each fail one end of the affordability spectrum; tiering plus floor/cap is the only combination that treats a hostel bunk and a luxury villa as the genuinely different economic situations they are, while still guaranteeing the platform recovers its fixed per-transaction cost at the bottom and doesn't over-charge at the top. Section 2 is this recommendation turned into actual numbers.

---

## 2. Suggested Initial Commission Model

All figures below are a **launch recommendation to be tuned against real data**, not a permanent commitment — but they are real numbers, not placeholders, because a commerce philosophy document that refuses to commit to a starting point isn't usable.

| Category | Commission % | Min (₹) | Max cap (₹) | Why |
|---|---|---|---|---|
| Hostels / Dorms | 8% | 15 | — (ticket size never reaches cap territory) | Lowest price-sensitivity tolerance of any segment — a backpacker on a ₹300 bunk feels every rupee. Keep the rate low deliberately; the floor exists only as a backstop so an unusually cheap booking still covers processing cost. |
| Budget Homestays | 10% | 80 | — | Still an affordability-sensitive segment (domestic budget travelers, students), but average ticket and partner margin are both a step up from hostels. |
| Mid-range Homestays | 12% | 250 | 1,200 | The "typical" segment. 12% is deliberately *below* what most Indian OTAs charge (commonly 15–20%+) — undercutting typical OTA take-rates is how "affordable" gets proven, not just claimed. |
| Premium Homestays | 14% | 500 | 1,800 | Customers here are markedly less price-sensitive, but the cap keeps the absolute fee reasonable as nightly rate climbs through the bracket — without it, the top of this bracket pays more than the next bracket's minimum, which is an awkward, unfair discontinuity. |
| Luxury Resorts | 15% | 1,000 | 3,000 | Highest willingness-to-pay segment, can sustain the highest rate — **but the cap here is the most important number in this table.** Without it, a ₹50,000/night villa pays ₹7,500 commission on one night purely because of price, not because verifying/supporting it costs 50× more than a mid-range homestay. An uncapped luxury tier also creates a perverse incentive: staff quietly prioritizing high-revenue listings for review attention over high-risk ones. The cap removes that incentive by design. |
| Tour Guides | 15% | 150 | 750 | Guides are individuals with thin margins, not businesses with economies of scale — but guiding also carries the heaviest *safety-verification* cost per partner (certifications, video interview, emergency-contact requirements, per `PARTNER_PLATFORM.md` §3.2). The rate is deliberately higher to fund that, the cap keeps a single high-day-rate technical trek from being punished disproportionately. |
| Bike Rentals | 10% | 30 | 150 | Same affordability logic as hostels — thin-margin, backpacker-adjacent segment. |
| Vehicle Rentals (car/jeep/tempo) | 12% | 150 | 600 | Mid-tier ticket size, same logic as mid-range homestays. |
| Camping Operators | 12% | 60 | 400 | Blends guide-like service intensity with lodging-like ticket size; moderate rate reflects that blend. |
| Trip Organisers | 15% | 450 | 5,000 | Highest operational complexity of any category — per `PARTNER_PLATFORM.md` §3.2, organiser trust is *inherited* from verifying every declared component partner, meaning TrekRiderz does *more* verification work per organiser booking, not less. This justifies the top rate. The cap matters most here too: these are the highest-ticket single bookings on the platform, and an uncapped 15% on a ₹50,000 multi-day expedition (₹7,500) would push organisers toward going direct. |

**Reading the table as a whole:** rate rises with customer price-tolerance and platform verification effort, not simply with ticket size — that's the deliberate design, and it's *why* a cap exists on every bracket that can plausibly reach one. The floor exists on every bracket because no booking, however cheap, should cost the platform money to facilitate.

---

## 3. Platform Fee Philosophy

| Approach | What it looks like | Trust impact |
|---|---|---|
| Hidden | Fee folded silently into a total the customer never sees broken down | Ruled out outright — directly contradicts "no hidden charges" |
| Included | Fee folded into the displayed price, no line-item breakdown | Simple, but reads as "the partner is just expensive" — customers can't tell what they're paying TrekRiderz *for*, which wastes the entire justification in Section 9 |
| Visible | A general "fees included" disclaimer, no itemization | Weak middle ground — discloses that a fee exists without explaining it |
| **Split (recommended)** | Partner price + a clearly labeled **"TrekRiderz Service Fee"** shown as its own line at checkout, before payment | Strongest trust option — customers see exactly where their money goes, can mentally cross-check the partner's own direct rate, and the fee becomes something TrekRiderz can *explain* (Section 9) rather than something to notice and resent |

**Recommendation: split display, always, before payment — never buried in totals, never revealed only in T&Cs or post-payment.** This is the single highest-leverage lever for "customers do not feel cheated," and it's what makes the Service Promise in Section 9 possible at all — you can't explain a fee customers can't see.

---

## 4. Payment Gateway Charges

Indian gateways typically charge roughly 2%+GST per transaction (method-dependent — UPI often cheaper, cards/netbanking around that range). Someone pays this; the question is who.

- **Customer absorbs (separate "processing fee" line)** — technically transparent if disclosed, but reads to most Indian consumers as exactly the "convenience fee" pattern that OTAs and ticketing platforms get criticized for. Given the founder philosophy explicitly names hidden/junk fees as unacceptable, a *visible* processing fee still functions as a junk fee in how customers perceive it.
- **Partner absorbs (deducted from payout)** — unfair and opaque to partners specifically, because the fee varies by *which payment method the customer chose*, something entirely outside the partner's control. Charging a partner more because a customer paid by card instead of UPI violates "we do NOT want to squeeze partners."
- **Platform absorbs (folded into commission)** — the recommendation. Gateway cost is a genuine cost of doing business, like rent or hosting, not a customer- or partner-facing pass-through. The commission rates in Section 2 are calibrated on the assumption that they already cover average blended gateway cost.

**Why this is also the better long-term bet, not just the fairer one today:** as volume grows, TrekRiderz can negotiate better gateway rates — but only the party who actually pays the fee benefits from negotiating it down. If gateway cost were passed through to partners or customers, TrekRiderz would have no direct incentive to optimize it. Absorbing it keeps that incentive where the leverage is.

---

## 5. Taxes

GST is a legal obligation, not a discretionary fee, and must **never be merged into the same line as the platform's own service fee** — conflating a government-mandated tax with a discretionary fee is itself a trust-eroding pattern, because it invites the (fair) suspicion that GST is being used to pad the platform's own take. Display philosophy: GST shown as its own explicitly labeled line item ("GST"), computed transparently at the applicable rate for that service category, visible before final payment — never folded into a vague "taxes and fees" bucket. (This document doesn't pin exact current GST slabs for hospitality/tour-operator services — those are set by government notification and change independently of this architecture; the display *principle* is what belongs here.)

---

## 6. Refund Philosophy

Three genuinely different situations get grouped under "cancellation" in most platforms, and treating them identically is where trust breaks. This design separates them:

### 6.1 Policy-governed (customer's own choice to cancel, nobody's fault)

Carried forward from `PARTNER_PLATFORM.md` §5.5, now ratified as the actual figures:

| Policy | >7 days before | 3–7 days | 1–3 days | <24h / no-show |
|---|---|---|---|---|
| Flexible | 100% | 100% | 50% | 0% |
| Moderate | 100% | 50% | 0% | 0% |
| Strict | 50% | 0% | 0% | 0% |
| Non-refundable | 0% | 0% | 0% | 0% |

### 6.2 Force majeure (nobody's fault, external cause)

Weather cancellation, government restriction, forest-department closure (routinely relevant for Indian trekking permits specifically), natural disaster.

**Always 100% refund or full-value travel credit, customer's choice — never a policy-tier cancellation fee.** Charging a strict-policy cancellation fee because a government shut down a national park punishes the customer for something no one controlled, and it is one of the fastest ways to destroy exactly the trust this platform is built on.

**The challenge to this, stated plainly:** an unconditional "we always fully refund force-majeure" promise, funded ad-hoc out of whatever commission happens to be on hand that month, is a real unhedged liability — a single bad monsoon season with mass trek cancellations could create a large, unbudgeted payout obligation with zero matching revenue. The fix isn't to weaken the customer promise; it's to **fund it in advance**: a small, fixed slice of every commission collected (illustratively, on the order of 1%) should feed a ring-fenced **Customer Protection Reserve**, specifically earmarked for force-majeure refunds, so the promise is pre-funded rather than improvised under pressure the day a route closes.

### 6.3 Emergency (medical, personal)

Compassionate, evidence-based, case-by-case — **not automatically 100%** (an unconditional emergency-refund policy invites abuse), but explicitly *not* subject to the strict no-refund grid either. A manual review path, distinct from both 6.1 and 6.2, with the refund amount weighted by notice given and evidence provided.

### 6.4 Partner-caused

**Trip cancelled by organiser, or partner no-show:** 100% refund to the customer, immediately, no exceptions, no waiting on a dispute process to resolve. TrekRiderz fronts this from the Customer Protection Reserve (6.2) if needed and separately recovers from / penalizes the partner (logged against their Trust Score cancellation-rate term per `PARTNER_PLATFORM.md` §7.1). A partner no-show specifically should also trigger a platform-funded goodwill credit on top of the refund — this is a trust breach severe enough to deliberately over-correct for.

### 6.5 Customer-caused

**Guest no-show:** governed by the strict-tier row (typically 0% customer refund) — *but the partner still owes TrekRiderz its commission*, since the service was genuinely made available; a no-show is not the same as a cancellation from the platform's cost-recovery perspective.

### 6.6 Travel credits

Offered as an **optional alternative to cash**, customer's choice, often with a modest bonus to make the choice genuinely attractive (e.g., ₹1,000 cash *or* ₹1,100 credit) — never the forced or pre-selected default when a customer is entitled to and requests cash. Forcing credit over cash is flagged again explicitly in Section 11 because it's a common, tempting anti-pattern precisely because it looks like a minor UX default rather than a trust violation.

---

## 7. Cancellation Philosophy — who decides

| Scenario | Decider | Why |
|---|---|---|
| Customer cancels their own booking | Customer decides *to* cancel; refund *amount* is fixed by the policy tier (6.1), not partner discretion | Protects customers from a partner inventing punitive terms after the fact |
| Partner cancels | Partner can cancel, but never sets the refund consequence — it's always 100% to the customer (6.4) and logged against partner trust | A partner "deciding to cancel" isn't the same as a partner deciding what the customer is owed |
| Force majeure | Platform declares the event once (e.g., "Kedarnath route closed, landslide, 12–20 June") | One declaration triggers the same standardized treatment for every affected booking automatically — fairer *and* operationally far cheaper than hundreds of individual negotiations for one event |
| Genuine dispute (neither of the above cleanly applies) | Hybrid — both sides submit evidence (`PARTNER_PLATFORM.md` §6), admin makes the final call within a committed SLA | This should be the smallest category by volume; the other three mechanisms are designed specifically to keep it that way |

**Recommendation:** self-service/automatic for policy-governed and partner-caused cancellations, platform-declared batch treatment for force majeure, admin-mediated only for genuine disputes — minimizing the slowest, most expensive category rather than routing everything through it by default.

---

## 8. Payout Philosophy

**Immediate payout at booking time is the least safe option and is rejected outright** — if the trip doesn't happen (no-show, dispute, force majeure), TrekRiderz has already sent money it now has to claw back, which is operationally painful and sometimes simply impossible if the partner has already spent it. This is precisely how the "abandoned settlements" failure mode described in `PARTNER_PLATFORM.md` §2.3 happens.

**Recommended: escrow-style hold with staged release.**

1. At booking/payment: funds held by TrekRiderz, not yet released.
2. For multi-day services (organized expeditions, extended treks): a **partial release** (illustratively ~30%) at confirmed check-in/departure — the partner has now definitively begun delivering, and this eases cash-flow strain on long engagements without exposing the platform to a total loss if something goes wrong mid-trip.
3. Full/remaining release only after service completion **and** the dispute window (48–72 hours per `PARTNER_PLATFORM.md` §6) has closed with nothing open.
4. For short, single-instance bookings (one-night homestay, one-day rental): no partial release — the risk window is short enough that holding until completion isn't a partner hardship, and there's no cash-flow argument that justifies paying out before the guest has even arrived.

**The challenge here, stated plainly:** "safety" can silently become "partners wait forever for their money," which is *also* a trust failure — just on the partner side of the platform instead of the customer side, and founders instinctively under-weight it because "trust platform" reads as customer-facing by default. Partners have their own trust relationship with TrekRiderz, and a vague "eventually, safely" payout promise will lose partners to faster-paying competitors regardless of how sound the escrow logic is. The concrete commitment has to be a number, not a feeling: **T+2 business days after the dispute window closes**, matching the target already set in `PARTNER_PLATFORM.md` §12.1, stated to partners as an SLA, not an aspiration.

---

## 9. TrekRiderz Service Promise

**The promise, stated the way it should appear to customers:**

> *Every booking on TrekRiderz includes a service fee. It is not our profit — it is what makes "verified" mean something. It funds identity and business verification for every partner, in-person and video audits every six months, real human support when something goes wrong, fraud and duplicate-listing detection, the maps and AI trip-planning tools you use to plan your trip, and the infrastructure that keeps all of it running and safe. When you pay a TrekRiderz service fee, you are paying for the platform to have already checked what you can't check yourself before you arrive somewhere remote.*

That promise is only credible because Section 3 requires the fee to be visible and itemized — an invisible fee can't be explained, because there's nothing on screen to point at when explaining it. The specific cost buckets it funds (verification, audits, support, fraud prevention, platform development, AI moderation, maps, infrastructure, safety) map directly onto `PARTNER_PLATFORM.md`'s Sections 3, 7, 8, and 10 — this isn't a marketing line invented for this document, it's a description of mechanisms that already exist on paper elsewhere in this repo's architecture.

---

## 10. Future Scalability

| Feature | Design note |
|---|---|
| Coupons | Already designed in `PARTNER_PLATFORM.md` §5.4 — platform-funded vs. partner-funded, tracked distinctly. Referenced, not redesigned here. |
| Wallet / Credits | Customer-side wallet is the mirror image of the partner-side wallet in `PARTNER_PLATFORM.md` §12.4 — same underlying ledger primitive (§15's `Payout/Ledger Transaction` concept), reused rather than built twice. |
| Gift cards | Prepaid customer credit. **Must not rely on breakage (unused balance) as a revenue strategy** — that's in direct tension with the anti-profiteering founder philosophy. Generous or no expiry, stated plainly. |
| Referral rewards | Both-sided value (referrer + referee), funded from marketing/growth budget — must not distort the core commission fairness principles in Sections 1–2. |
| Membership / Loyalty | Points-earned-per-booking mechanic, funded as a retention cost, not baked into per-booking commission math. |
| Subscription (e.g. "TrekRiderz Plus") | A genuinely promising future lever: converts a variable per-booking fee into predictable recurring revenue for frequent travelers, which can *improve* their affordability perception (lower or waived per-trip fee) while giving the platform steadier cash flow. Flagged as a strong candidate for a later phase, not a launch feature. |
| Corporate discounts | A different commercial motion entirely (invoiced, negotiated B2B rates for team offsites/retreats) — shouldn't be forced into the consumer commission structure. |
| Student discounts | Aligns strongly with the affordability mission. Should be **platform-funded** (a TrekRiderz-absorbed credit for verified student IDs), not partner-funded — partners shouldn't be conscripted into subsidizing a mission choice they didn't make. |
| Adventure Pass / Season Pass | Prepaid bundled access (e.g., discounted-rate multi-trek bundles). Generates useful upfront cash, but **cannot be sold as "unlimited" without real partner-side capacity commitments** — this needs its own partner-agreement design tied to the availability/calendar system in `PARTNER_PLATFORM.md` §4.1 before it can launch responsibly. Flagged as a later-phase idea requiring dedicated design work, not something to bolt onto the core commission model casually. |

---

## 11. Things We Should Never Do

Each of these is a specific, named anti-pattern, not a vague "be good" gesture — because vague principles are exactly what erodes silently over time under revenue pressure.

- **Hidden checkout fees** — anything not shown before payment (Section 3).
- **Dynamic fake pricing** — inflating a price to show a fake "discount" off it. Customers will cross-check against the partner's own direct channel, and the moment they catch it, trust doesn't degrade gradually, it collapses.
- **Misleading discounts** — a "70% off" figure off a price nobody ever actually charged.
- **Excessive commission that gets silently passed through** — if commission is high enough that partners quietly raise their base price to compensate, customers pay *more* overall while believing TrekRiderz is helping them. This is a subtler version of squeezing both sides at once and is worth watching for even at the recommended rates in Section 2.
- **Price manipulation** — surge pricing dressed up as "demand-based" without disclosure, or pricing personalized by device/browsing history. Even where legal, it erodes trust the moment it's discovered, and it will be discovered.
- **Fake urgency** — "Only 1 room left!" when untrue, countdown timers that silently reset. Extremely common in Indian OTAs specifically; explicitly the kind of thing this platform's founder philosophy exists to not do.
- **Forcing travel credit over cash** — when a customer is entitled to and requests cash (Section 6.6), defaulting or pressuring them into credit instead.
- **Charging cancellation fees for force-majeure events** — covered in Section 6.2; restated here because it's the single easiest anti-pattern to slip into under revenue pressure ("well, technically our policy tier says...").
- **Pre-selecting the non-refundable rate at checkout** — a well-known dark pattern where the cheaper, non-refundable option is defaulted so fast-checkout customers select it without noticing what they gave up.
- **Pay-to-rank overriding trust-to-rank** — charging partners for featured placement in a way that lets a low-trust, high-paying partner outrank a high-trust, low-paying one. This would directly undermine the entire Trust System in `PARTNER_PLATFORM.md` §7 — a customer-safety ranking system that can be bought defeats its own purpose.
- **Reserves that only exist on paper** — promising force-majeure refunds (6.2) or fast payouts (Section 8) without the Customer Protection Reserve or payout-SLA discipline actually behind them. An unfunded promise is worse than no promise, because it's discovered exactly when it matters most.

---

## 12. Operational Cost Analysis

What TrekRiderz's revenue must eventually cover, in rough order of how directly it scales with growth:

| Cost | Scales with | Note |
|---|---|---|
| Servers / hosting | Users + traffic | Currently modest at early stage (Vercel + Supabase), grows with usage |
| Storage | **Partner count, not just user count** | A trust-and-verification platform stores materially more per partner than a typical listing site — identity documents, ownership/business documents, audit photo sets every six months. This is easy to under-forecast if you model storage against "users" instead of "partners × audits over time." |
| Maps | Usage (Mapbox-style per-load pricing) | Scales with every listing view and trip-planning session |
| AI APIs | Usage | Trip-planner usage today; future AI moderation/photo-quality detection (`PARTNER_PLATFORM.md` §13) is a real, scaling cost center that must be funded, not assumed free |
| Payment gateway | Transaction volume | Absorbed into commission per Section 4 — a real cost, not a pass-through |
| Support | **Verification/audit/dispute volume** | A genuinely significant *people* cost as the platform grows, not just software — this is the cost that most directly funds the trust promise in Section 9 |
| Employee salaries | Headcount (explicitly a stated future goal) | The commission model must eventually fund this without a separate, disconnected revenue plan |
| Marketing | Growth targets | Funds referrals (Section 10), not extracted from commission fairness |
| Taxes | Revenue | TrekRiderz's own corporate tax and GST compliance overhead, distinct from the GST the platform collects and remits on customers' behalf (Section 5) |
| Infrastructure | Notification volume | Domain, email, SMS/WhatsApp costs for the communication system in `PARTNER_PLATFORM.md` §9 |
| Monitoring / fraud detection | Partner + listing count | Future fraud-detection and uptime-monitoring systems (`PARTNER_PLATFORM.md` §13) |

**Why sustainable revenue matters more than the lowest possible fee:** every cost in this table is either already scaling with growth or explicitly named as a future goal by the founder (hiring, continued development). A commission structure tuned to be "as cheap as possible" rather than "fairly priced relative to what it funds" will eventually fail to cover this list — and when it does, the fix under pressure is almost always worse than the fix planned for in advance: either quietly raising rates later (breaking trust with partners who priced their business around the original number) or under-investing in verification and support (breaking the trust promise this entire platform exists to make). The tiered rates in Section 2 and the reserve-funding discipline in Section 6.2 are the mechanisms that let "affordable" and "sustainable" both be true at once, rather than a founder having to choose between them later under worse conditions than exist today.
