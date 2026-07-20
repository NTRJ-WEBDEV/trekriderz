# RBAC

## Why this exists

Before Phase 2, "admin" was two disconnected two/four-value text enums, checked inline per screen: `profiles.role === 'super_admin'` on web, `users.role === 'admin'` on mobile (and in at least two places, `user.role` was read off the raw Supabase Auth object instead of the app's own table — a bug, not a design choice; see [Architecture.md](./Architecture.md)'s "Known structural debt" and the Phase 1 report for the full list of what that broke). Neither scaled to the ten roles the platform needs, and every new module would have hand-rolled its own check.

## A security issue found while building this

`profiles` rows are auto-created for **every** `auth.users` signup — including ordinary mobile app customers, not just web staff — via the `handle_new_cms_user` trigger, and that trigger defaults `role` to `'moderator'`. The Phase 1 fix to `getAdminSession()`/`middleware.ts` checked `role IN ('super_admin', 'moderator')` — which every signed-up customer satisfied by default. That check was not actually protective.

Phase 2's fix: authorization no longer reads the `role` text column at all. It reads `profiles.role_id`, a new nullable column that **nothing defaults** — it must be explicitly granted (via the migration's one-time backfill, or later via the Team screen). See the top-of-file comment in `supabase/migrations/20260720000001_rbac_and_activity_log.sql` for the full explanation.

## Schema

```
roles              — id, key, name, description
permissions         — id, key ('guides.approve', 'trips.manage', ...), description
role_permissions    — role_id, permission_id (join table)
profiles.role_id    — nullable FK to roles; NULL = no staff access, regardless of legacy `role` text
admin_activity_log  — see the Activity Log doc (not written here, see MIGRATION_PLAN.md for the table shape)
```

## The shared authorization primitive

Two Postgres functions, defined once, called by both apps:

```sql
has_permission(permission_key TEXT) RETURNS BOOLEAN   -- single check
my_permissions() RETURNS TABLE(permission_key TEXT)    -- full set, one round trip
```

`mobile/lib/services/PermissionService.ts` and `web/lib/services/PermissionService.ts` are both thin `supabase.rpc(...)` wrappers around these — the actual logic is in the database, not reimplemented per app. This is what "one RBAC system consumed by both products" means concretely: one set of SQL functions, not two parallel TypeScript implementations that could drift.

`mobile/hooks/usePermissions.ts` wraps `PermissionService.fetchMyPermissions()` in a React hook (fetch once per `user.id` change, cache in state) — the same pattern as the existing `usePostActions`/`usePostRealtime` hooks in this codebase, so it fits how the rest of the app already does data-fetching-as-a-hook.

## The 10 roles (+ Super Admin)

| Role | Scope |
|---|---|
| `super_admin` | Everything, including RBAC itself |
| `operations_manager` | All operational modules — trips, guides, homestays, rentals, bookings, moderation, support — not Finance or RBAC |
| `trip_coordinator` | Trips + expeditions |
| `guide_manager` | Guide approval/edit/delete |
| `homestay_manager` | Homestay/property approval/edit/delete |
| `rental_manager` | Rental approval/edit/delete |
| `moderator` | Content moderation + user ban/flag, no business modules |
| `content_manager` | CMS (stories, videos, places) |
| `support` | Bookings (view), users (view), SOS, reports |
| `finance` | Finance + refunds |

Full permission-by-role grid: [PERMISSION_MATRIX.md](./PERMISSION_MATRIX.md).

## What actually changed in the code

Every place that used to do a hardcoded role-string comparison for admin access now calls through the shared system instead:

- `mobile/app/(tabs)/_layout.tsx` — Admin tab visibility
- `mobile/app/admin/index.tsx` — screen-level guard + per-tab visibility (a Guide Manager only sees the Guides tab, not all seven)
- `mobile/app/community/index.tsx` — community-creation admin bypass (was already correctly querying `users.role`, migrated for consistency)
- `mobile/app/expeditions/create.tsx` — admin bypass for the premium-guide requirement (this one had the "reads GoTrue's own role field" bug — the bypass was silently unreachable before this fix)
- `web/middleware.ts` — the network-layer staff gate (now `role_id IS NOT NULL`, not a role-string list)
- `web/lib/supabase-server.ts` (`getAdminSession`) — same fix, plus now returns the caller's full permission set
- `web/app/admin/AdminShell.tsx` — nav filtering (`superOnly`/`isSuperAdmin` boolean replaced with `hasPermission(item.permission)` per nav entry)

## What deliberately wasn't touched

- **The `handle_new_cms_user` trigger's default value.** Still sets `role = 'moderator'` on every signup. Harmless now that nothing trusts that column for authorization, but worth cleaning up eventually — touching signup-flow triggers was judged separate-phase work.
- **Granular per-button permission checks inside `mobile/app/admin/index.tsx`.** Tab-level visibility is gated; the individual approve/reject/ban buttons within a visible tab are not yet re-checked against the specific permission (they rely on RLS as the actual backstop, plus the tab being hidden in the first place). Full button-level granularity is listed in [FUTURE_ROADMAP.md](./FUTURE_ROADMAP.md).
- **RLS policies on `homestays`/`properties`/`rental_vehicles`/etc. themselves** weren't rewritten to use `has_permission()` — this pass only added the primitive and wired the *admin UI* through it. Extending it to table-level RLS is natural follow-up work, not done here to keep the migration's blast radius contained to genuinely new tables plus the two `profiles` policies that were already broken.
