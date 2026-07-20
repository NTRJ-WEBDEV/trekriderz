# Migration Plan

Two kinds of migration live in this document: the RBAC/Activity Log migration that Phase 2 actually shipped, and the canonical-table migrations Phase 2 deliberately did **not** ship (Task 1 was audit-only — "no code changes until audit is complete," and the audit's own conclusion was that these need their own phase, not to be bundled in).

## Shipped: RBAC + Activity Log

`supabase/migrations/20260720000001_rbac_and_activity_log.sql`. Additive only — new tables (`roles`, `permissions`, `role_permissions`, `admin_activity_log`), one new nullable column (`profiles.role_id`), two new SQL functions (`has_permission`, `my_permissions`), and two `profiles` RLS policies replaced (they gated on the same flawed `role = 'super_admin'` text check the rest of this migration exists to retire).

**Backfill included in the migration:**
- `role_id = super_admin` for the one hardcoded email that was already `super_admin` in the legacy column.
- `role_id = operations_manager` for every `profiles` row whose corresponding `public.users.role = 'admin'` — this is safe because that column is deliberately set (no auto-default bug on the `users` side), unlike `profiles.role`.
- **Not backfilled:** any other `profiles.role = 'moderator'` row. That value is the signup trigger's default for everyone, not evidence of legitimate staff access (see [RBAC.md](./RBAC.md)). **Action required after applying this migration:** if any real moderator accounts exist beyond the two cases above, they need `role_id` granted manually via the Team screen (or a direct `UPDATE public.profiles SET role_id = ...`) — otherwise those staff members will be locked out of `/admin` until re-granted.

**Rollback:** the new tables/column/functions can be dropped independently of everything else in the schema (nothing outside this migration references them yet except the application code from this same phase). If rolling back, also revert `web/middleware.ts`, `web/lib/supabase-server.ts`, `web/app/admin/AdminShell.tsx`, `mobile/app/(tabs)/_layout.tsx`, and `mobile/app/admin/index.tsx` to their Phase 1 state, or the app will fail every permission check (closed, not open — a failed `hasPermission()` call denies access, it doesn't fall back to allowing it).

## Not shipped: the three canonical-table reconciliations

### Homestays: `properties` vs `homestays`

| | `properties` | `homestays` |
|---|---|---|
| Has a `CREATE TABLE` in this repo | Yes (`supabase_properties_migration.sql`) | **No** — referenced only via FK lookups in trigger/function migrations; exists solely in the live DB. Schema drift. |
| Approval workflow | Yes — `pending → under_review → approved/rejected/suspended`, admin UI in `mobile/app/admin/index.tsx` | No workflow; one admin-only insert screen (`mobile/app/admin/add-homestay.tsx`) hardcodes `status: 'approved'` |
| Pricing | Tiered via child `room_types` table | Flat `price_per_night` |
| Tied into real `bookings`/`payment_orders` | **No** — `bookings.resource_type` CHECK only allows `('homestay','guide','gear')`, no `'property'` value. Uses `property_inquiries` (manual/WhatsApp) instead. | **Yes** — `resource_type = 'homestay'` is a real, working booking path |
| Owner-facing screens | `host/create.tsx`, `host/manage.tsx`, `host/my-properties.tsx`, `host/status.tsx` | None |
| Public screens | `homestays.tsx`, `homestay/[id].tsx` | `(tabs)/index.tsx`, `discover.tsx`, `map/index.tsx`, `ai-planner.tsx` |
| Storage bucket | `homestays` (shared with the other table) | `homestays` (shared) |

**Why this isn't a simple "pick one, drop the other":** `properties` has the richer data model and the real approval workflow, but `homestays` is the one actually wired into the booking/payment pipeline. Neither is a strict superset. A real reconciliation needs to either (a) extend `bookings.resource_type` to accept `'property'` and build a real booking path for `properties`, then migrate `homestays` rows into `properties` and repoint the read-only screens (`index.tsx`, `discover.tsx`, `map/index.tsx`, `ai-planner.tsx`), or (b) the reverse. Recommendation: (a), since `properties` is where new development has actually been happening — but this is a call for whoever owns the booking/payments roadmap, not something to infer from file dates alone.

### Rentals: `rental_vehicles` vs `cms_vehicles`

| | `rental_vehicles` | `cms_vehicles` |
|---|---|---|
| Approval workflow | Yes | No (admin-authored, public on insert) |
| Booking path | `rental_inquiries` (manual/WhatsApp — "no inquiry/booking record at all" before `20260709000002_rental_inquiries.sql`) | None |
| Owner concept | `owner_id` → `public.users` | None (admin-authored) |
| Photos | Single `photos` jsonb array | Normalized `cms_vehicle_photos` child table, multi-row + `is_primary` |
| Location | `lat`/`lng` | None |
| Storage bucket | `vehicle-photos` (shared) | `vehicle-photos` (shared) |

**Recommendation:** `rental_vehicles` is canonical (it has owners, approval, and a booking-adjacent inquiry flow; `cms_vehicles` has none of that). The one cross-touch found — `web/app/admin/page.tsx`'s read-only count of `rental_vehicles` — suggests the web side already half-expects this. Reconciliation: give `cms_vehicles` rows a migration path into `rental_vehicles` with a `visible_on_website` flag, then point `web/app/admin/vehicles/page.tsx` at the same table Mobile Operations already manages instead of a separate catalog.

### Bookings/Payments

- Mobile path (`bookings` + `payment_orders` + `booking_history`) is **offline-payment-only** today — `mobile/lib/payment.ts` never writes `payment_orders`; grepping the whole app for `payment_orders`/`booking_history` outside the schema migration itself returns zero hits.
- The website's Razorpay integration (`web/lib/payment.ts` → `web/app/api/payments/create-order/route.ts` + `.../verify/route.ts`) is fully implemented — real order creation, real signature verification — but **has zero callers anywhere in `web/app`**. Not wired to `properties`, `rental_inquiries`, `bookings`, or any other table. Functionally dead code today, though `CLAUDE.md` frames it as "offline mode" (i.e. plausibly intentional/paused, not accidental).

**Not deleted in this pass** — Task 9 (dead code removal) was scoped to *confirmed* dead code, and payment integration code carries enough downside risk that "currently has no caller" isn't sufficient justification on its own; it may be mid-integration. Flagged here for whoever picks up Phase 6 (Marketplace Reconciliation) to either finish wiring it or remove it deliberately.

## Rollout order if/when the above proceeds

1. RBAC (done — this is the dependency everything else in this list can now build against for its own approval workflows).
2. Homestays reconciliation (touches live booking data — highest blast radius, do it with the resource_type extension planned out first, not as a mid-migration decision).
3. Rentals reconciliation (lower risk — neither table has real payment integration yet).
4. Only then: Finance, since it needs one source of truth for both.
