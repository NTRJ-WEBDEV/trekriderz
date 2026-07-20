# TrekRiderz Platform Architecture

Written at the end of Phase 2 (Foundation). Describes what exists after Phase 1 (bug fixes, audit) and Phase 2 (RBAC, activity log, service layer). Doesn't describe aspirational future state — see [FUTURE_ROADMAP.md](./FUTURE_ROADMAP.md) for that.

## The four products

```
                    Supabase Backend (one project)
        ┌────────────┬──────────────┬──────────────┬──────────────┐
   Mobile App    Public Website   Web Admin    Mobile Operations
   (customer)    (discovery)     (business)      (field ops)
```

- **Mobile App** (`mobile/`) — the customer-facing Expo app. Feed, Reels, Stories, Trips, Communities, Chat, Homestays, Rentals, Guides, SOS, Bookings.
- **Public Website** (`web/`, non-admin routes) — marketing + discovery. SEO, trip listings, expedition browser.
- **Web Admin** (`web/app/admin/**`) — the business dashboard. CMS, trips curation, analytics.
- **Mobile Operations** — the field-ops tool. Physically lives inside the Mobile App bundle today, gated by RBAC (`profiles.role_id`) rather than being a separate build. See "Known structural debt" below.

All four read/write the same Supabase project. There is no API gateway between them — each talks to Postgres directly via the Supabase client, gated by RLS.

## Authorization model

One RBAC system, two thin client wrappers. The actual logic lives in Postgres:

```
profiles.role_id ──► roles ──► role_permissions ──► permissions
                                      │
                    has_permission(key) / my_permissions()
                         (SQL functions, SECURITY DEFINER)
                         /                          \
      mobile/lib/services/PermissionService.ts   web/lib/services/PermissionService.ts
                         \                          /
              usePermissions() hook            AdminShell nav filter
```

Both `mobile/lib/services/PermissionService.ts` and `web/lib/services/PermissionService.ts` are thin RPC wrappers around the same two Postgres functions (`has_permission`, `my_permissions`) defined in `supabase/migrations/20260720000001_rbac_and_activity_log.sql`. Neither reimplements the authorization logic — that would be the "duplicate permission logic" Phase 2 was explicitly told not to create.

Full detail: [RBAC.md](./RBAC.md).

## Service layer

Before Phase 2, business logic lived inline inside screens — every admin mutation was a raw `supabase.from(...).update(...)` call, copy-pasted per screen. Phase 2 introduced:

| Service | Mobile | Web | What it wraps |
|---|---|---|---|
| PermissionService | `mobile/lib/services/PermissionService.ts` | `web/lib/services/PermissionService.ts` | `has_permission`/`my_permissions` RPCs |
| AuditService | `mobile/lib/services/AuditService.ts` | `web/lib/services/AuditService.ts` | `admin_activity_log` inserts |
| NotificationService | `mobile/lib/services/NotificationService.ts` | — (no admin-triggered notifications on web yet) | `notifications` table inserts |
| ApprovalService | `mobile/lib/services/ApprovalService.ts` | — (web has no approval workflows yet — see module matrix) | Homestay/Guide/Vehicle approve-reject, unified |
| MediaService | `mobile/lib/services/MediaService.ts` | — | `lib/storage.ts`'s `uploadImage`/`uploadMedia`, one named function per content type |
| SearchService | `mobile/lib/services/SearchService.ts` | `web/lib/services/SearchService.ts` | Config-driven multi-table ILIKE search |

Not every service got full call-site migration — see [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) for exactly what moved and what's still pending.

## Data model: what's unresolved

Three domains are each split across two independently-built tables with no link between them. This predates Phase 2 and was **not** fixed here — Phase 1's audit found it, Phase 2's Task 1 re-confirmed it at the file level, and the actual reconciliation is scoped as its own phase because it touches live booking/payment paths:

- **Homestays**: `properties` (mobile, has the real approval workflow + room_types pricing) vs. `homestays` (older, undocumented — no CREATE TABLE anywhere in this repo, exists only in the live DB, read by several screens but has no working create/approval path of its own).
- **Rentals**: `rental_vehicles` (mobile marketplace, has real inquiries) vs. `cms_vehicles` (web showcase catalog, no booking backend).
- **Bookings/Payments**: `bookings`+`payment_orders` (mobile, currently offline-payment-only per `mobile/lib/payment.ts`) vs. the website's Razorpay API routes (`web/app/api/payments/*`) — which are fully implemented but have **zero callers anywhere in `web/app`**, i.e. currently dead code, not wired to any table.

Full inventory: [MIGRATION_PLAN.md](./MIGRATION_PLAN.md).

## Known structural debt

- **Mobile Operations isn't a separate build.** It's a role-gated screen (`mobile/app/admin/**`) inside the same Expo bundle every customer downloads. RBAC now correctly gates who can *use* it, but the code itself still ships to every device. Splitting it into its own build target is future work, not done here.
- **`profiles` vs `users`.** `profiles` (web/RBAC staff table) and `users` (mobile, all app accounts) are both keyed to `auth.users(id)` independently, with no FK between them. This is intentional (staff and customers are different populations) but the shared word "role" on two different enums remains a source of confusion — see the Phase 1 report.
- **The `handle_new_cms_user` trigger** (`20260629000001_cms_admin.sql`) still defaults every signup's `profiles.role` text column to `'moderator'`. Phase 2 stopped trusting that column for authorization (`role_id` is the real gate, and nothing defaults it), but the trigger itself wasn't changed — touching signup-flow triggers was judged out of scope for this pass. See [RBAC.md](./RBAC.md) for why this mattered.

## Folder structure

See [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md).
