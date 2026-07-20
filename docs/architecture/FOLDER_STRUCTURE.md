# Folder Structure

New in Phase 2, both apps:

```
lib/services/
├── PermissionService.ts
├── AuditService.ts
├── SearchService.ts
├── NotificationService.ts   (mobile only)
├── ApprovalService.ts       (mobile only)
└── MediaService.ts          (mobile only)
```

`mobile/lib/` already held 22 files acting as a de facto service layer with no dedicated subfolder (`storage.ts`, `moderation.ts`, `social.ts`, `notifications.ts`, etc.) — `lib/services/` is new and specifically for the cross-cutting admin/RBAC-adjacent services built in this phase. Existing `lib/*.ts` files were left where they are; this isn't a reorganization of what was already there, only a home for what's new. Web previously had no `lib/services/` at all (just `lib/supabase.ts`, `supabase-server.ts`, `payment.ts`, `constants.ts`, `site-settings.ts`).

```
mobile/hooks/
└── usePermissions.ts    — new; wraps PermissionService the same way usePostActions.ts
                            wraps its own logic and usePostRealtime.ts wraps realtime —
                            same pattern this codebase already uses, not a new one
```

```
supabase/migrations/
└── 20260720000001_rbac_and_activity_log.sql   — new tables: roles, permissions,
    role_permissions, admin_activity_log; new column: profiles.role_id;
    new functions: has_permission(), my_permissions()
```

```
docs/architecture/    — new; this folder
├── Architecture.md
├── RBAC.md
├── PERMISSION_MATRIX.md
├── MIGRATION_PLAN.md
├── SERVICE_DIAGRAM.md
├── FOLDER_STRUCTURE.md   (this file)
└── FUTURE_ROADMAP.md
```

No other structural changes. `mobile/app/admin/`, `web/app/admin/`, `mobile/components/`, `web/components/` all keep their existing shape — Phase 2's instruction was "extend, don't redesign," and the folder layout reflects that: new capability got a new, narrowly-scoped home instead of triggering a reorganization of what already worked.
