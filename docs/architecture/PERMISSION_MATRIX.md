# Permission Matrix

Source of truth: `supabase/migrations/20260720000001_rbac_and_activity_log.sql` (the `role_permissions` seed section). This file is a human-readable rendering of that seed data — if they ever disagree, the migration wins.

`super_admin` has every permission below and is omitted from the columns for readability.

| Permission | Ops Manager | Trip Coord. | Guide Mgr | Homestay Mgr | Rental Mgr | Moderator | Content Mgr | Support | Finance |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `rbac.manage` | | | | | | | | | |
| `profiles.manage` | | | | | | | | | |
| `activity_log.view` | ✓ | ✓ | | | | | | | |
| `trips.manage` | ✓ | ✓ | | | | | | | |
| `trips.view` | ✓ | ✓ | ✓ | | | | ✓ | ✓ | |
| `expeditions.manage` | ✓ | ✓ | | | | | | | |
| `communities.manage` | ✓ | | | | | | | | |
| `guides.approve` | ✓ | | ✓ | | | | | | |
| `guides.edit` | ✓ | | ✓ | | | | | | |
| `guides.delete` | | | ✓ | | | | | | |
| `homestays.approve` | ✓ | | | ✓ | | | | | |
| `homestays.edit` | ✓ | | | ✓ | | | | | |
| `homestays.delete` | | | | ✓ | | | | | |
| `rentals.approve` | ✓ | | | | ✓ | | | | |
| `rentals.edit` | ✓ | | | | ✓ | | | | |
| `rentals.delete` | | | | | ✓ | | | | |
| `bookings.view` | ✓ | ✓ | ✓ | ✓ | ✓ | | | ✓ | ✓ |
| `bookings.refund` | ✓ | | | | | | | | ✓ |
| `bookings.cancel` | ✓ | | | | | | | | |
| `finance.view` | | | | | | | | | ✓ |
| `finance.edit` | | | | | | | | | ✓ |
| `cms.publish` | | | | | | | ✓ | | |
| `cms.edit` | | | | | | | ✓ | | |
| `cms.view` | ✓ | | | | | | ✓ | | |
| `users.view` | ✓ | | | | | ✓ | | ✓ | ✓ |
| `users.ban` | ✓ | | | | | ✓ | | | |
| `users.verify` | ✓ | | | | | | | | |
| `users.role_manage` | | | | | | | | | |
| `reels.moderate` | ✓ | | | | | ✓ | | | |
| `posts.delete` | ✓ | | | | | ✓ | | | |
| `stories.moderate` | ✓ | | | | | ✓ | | | |
| `comments.moderate` | ✓ | | | | | ✓ | | | |
| `reports.resolve` | ✓ | | | | | ✓ | | ✓ | |
| `sos.manage` | ✓ | | | | | | | ✓ | |
| `analytics.view` | ✓ | | | | | | | | |

## Adding a new permission

1. `INSERT INTO permissions (key, description) VALUES (...)` in a new migration (never edit `20260720000001` after it's applied).
2. Grant it to the relevant role(s) via `role_permissions`.
3. Update this table.
4. Call `hasPermission('your.new.key')` at the call site — nothing else needs to change, since both apps already read from `my_permissions()`.

No screen should ever hardcode a role name again — if a check needs a role that doesn't map to an existing permission, that's a sign a new permission key belongs in the migration, not a new `role === 'x'` comparison in the component.
