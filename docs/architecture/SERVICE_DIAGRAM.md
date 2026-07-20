# Service Diagram

## Request flow for a typical admin mutation (e.g. approving a guide)

```
mobile/app/admin/index.tsx
        │
        │  user taps "Approve" on a pending guide
        ▼
ApprovalService.approveListing('guides', id, ownerId, actorId)
        │
        ├──► supabase.from('guides').update({status:'approved', ...})
        │
        ├──► NotificationService.notify({ userId: ownerId, type: 'guide_approved', ... })
        │           │
        │           └──► supabase.from('notifications').insert(...)
        │
        └──► AuditService.logAdminAction({ action: 'guides.approved', entityType: 'guides', entityId: id, ... })
                    │
                    ├──► supabase.from('profiles').select('role:roles(key)')   -- actor_role snapshot
                    └──► supabase.from('admin_activity_log').insert(...)
```

One screen action, three service calls, zero inline business logic in the component beyond wiring state to the service and back. This is the shape every admin mutation should follow going forward — see [RBAC.md](./RBAC.md) for what's still pending granular-permission-wise inside individual screens.

## Where permission checks sit

```
                    ┌─────────────────────────────┐
                    │   Postgres (source of truth) │
                    │  has_permission() / my_permissions()  │
                    └───────────────┬─────────────┘
                                    │ RPC
              ┌─────────────────────┴─────────────────────┐
              ▼                                            ▼
  mobile/lib/services/PermissionService.ts     web/lib/services/PermissionService.ts
              │                                            │
              ▼                                            ▼
  mobile/hooks/usePermissions.ts               web/lib/supabase-server.ts (getAdminSession)
              │                                            │
      ┌───────┴────────┐                          ┌────────┴────────┐
      ▼                ▼                          ▼                 ▼
 (tabs)/_layout.tsx  admin/index.tsx      middleware.ts        AdminShell.tsx
 (tab visibility)   (screen guard +        (network-layer      (nav item
                     per-tab visibility)    staff gate)         filtering)
```

## Service inventory

```
mobile/lib/services/
├── PermissionService.ts   — RPC wrapper: has_permission / my_permissions
├── AuditService.ts        — writes admin_activity_log
├── NotificationService.ts — writes notifications (replaces 4 duplicated inline inserts in admin/index.tsx)
├── ApprovalService.ts     — unifies homestay/guide/vehicle approve-reject (was 1 shared fn + 1 diverging inline copy)
├── MediaService.ts        — named upload functions per content type, wrapping lib/storage.ts
└── SearchService.ts       — config-driven multi-table ILIKE search

web/lib/services/
├── PermissionService.ts   — same RPCs, server + client variants
├── AuditService.ts        — writes admin_activity_log (source: 'web_admin')
└── SearchService.ts       — same shape as mobile's, scoped to web-managed entities
```

Web has no NotificationService/ApprovalService/MediaService yet because Web Admin doesn't have any approval workflows or media uploads of its own today (see the Phase 1 module matrix — homestays/guides/rentals approval all currently live in Mobile Operations, not Web Admin). Building those on web is Phase 4 work, not Phase 2.

## What's explicitly NOT a service yet

- **BookingService** — not built. The two booking/payment pipelines are disconnected (see [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)); wrapping them in one service now would either paper over that split or force the reconciliation migration this phase was told not to do.
- **ModerationService** — partially covered by the `reels.moderate`/`posts.delete`/etc. permission keys and the report-handling `logAdminAction` calls in `admin/index.tsx`, but there's no single `ModerationService.ts` module yet — the actions are still inline in the screen, just permission-gated and audit-logged. Extraction into a dedicated module is listed in [FUTURE_ROADMAP.md](./FUTURE_ROADMAP.md).
