# Future Roadmap

Supersedes the phase list in the Phase 1 report now that Phase 2 is done. Explicitly excluded from Phase 2 per instruction: Finance, Coupons, Support Tickets, Trip Organizer Portal, Partner Portal, Analytics Dashboard.

## Done

**Phase 1 — Architecture Cleanup.** Module ownership audit, duplicate-system documentation, five critical bug fixes (admin role detection on both platforms, hardcoded password API routes, missing role gates).

**Phase 2 — Foundation.** RBAC (roles/permissions/role_permissions, one shared `has_permission()`/`my_permissions()` primitive), Activity Log, six new service modules, canonical-table audit (Task 1 — documented, not migrated), two more hardcoded-role bugs found and fixed (`community/index.tsx`, `expeditions/create.tsx`).

## Immediate fast-follows (small, scoped, not done in Phase 2)

These surfaced while building Phase 2 but were judged out of the narrow scope of "foundation, not new features":

- **Granular in-screen permission checks.** `mobile/app/admin/index.tsx` gates tab *visibility* by permission; the buttons inside a visible tab don't yet re-check the specific permission key (RLS is the real backstop today). Low risk to add, just wasn't done to keep this pass's diff to the entry points.
- **Migrate remaining `MediaService` call sites.** 3 of 12 upload call sites moved over (`profile/edit.tsx`, `host/create.tsx` ×2) as the reference implementation. The rest (`stories/create.tsx`, `guide/register.tsx`'s document uploads, `rentals/register.tsx`, `poi/submit.tsx`, `chat/[tripId].tsx`, `(tabs)/create.tsx`, `story/create.tsx`) still call `uploadImage`/`uploadMedia` directly — same underlying function, just not yet routed through the named wrapper. `guide/register.tsx`'s document uploads specifically need a signed-URL-aware variant of `MediaService` before they can move (private bucket, current code needs the raw storage `path` back, which the simple wrapper doesn't return).
- **`ModerationService` extraction.** Report dismiss/action and user ban/flag logic in `admin/index.tsx` is now permission-gated and audit-logged, but still inline in the screen rather than in a dedicated service module.
- **Clean up the `handle_new_cms_user` trigger's default.** Still sets every signup's `profiles.role` text column to `'moderator'`. Harmless now that authorization reads `role_id` instead, but confusing for anyone reading the trigger cold.

## Phase 3 — Website Completion

Public Guide Listings, public Homestay/Rental listings (blocked on the canonical-table decision in `MIGRATION_PLAN.md`), a public reader for the Stories CMS content (admin can publish `stories` today; nothing on the website renders them), Trek/Peak pages, Blog, SEO.

## Phase 4 — Business Dashboard (Web Admin)

Guide/Homestay/Rental business-side management (pricing, performance — distinct from the approve/reject that already lives in Mobile Operations), a real Bookings module, Users CRUD (today it's analytics-only), Analytics beyond DAU. This is also where Web Admin gets its own `ApprovalService`/`NotificationService` if/when it grows approval workflows of its own.

## Phase 5 — Operations Dashboard (Mobile Operations)

Trip Check-in/Attendance, SOS Monitoring (`sos_alerts` exists, zero admin surface today), a Global Search UI built on `SearchService` (the service exists; no screen consumes it yet — deliberately, per "no placeholder screens"), Admin Notifications (pending approvals/reports/SOS surfaced to staff, reusing the existing `notifications` table/realtime pattern). Also the natural point to revisit splitting Mobile Operations into its own build target instead of a role-gated tab in the consumer app bundle.

## Phase 6 — Marketplace Reconciliation

Homestays (`properties` vs `homestays`) and Rentals (`rental_vehicles` vs `cms_vehicles`) canonical-table migrations, per the plan in `MIGRATION_PLAN.md`. Decide the fate of the website's dead Razorpay routes here too — finish wiring them or remove them, deliberately either way.

## Phase 7 — Finance

Revenue, commission, payouts, refunds, transactions, Trip Organizer commission structure. Needs Phase 6 done first — building Finance against two disconnected payment pipelines means building it twice.

## Phase 8 — Growth Features

Promotions/Coupons/Offers, CMS banners/featured carousels, Support Tickets, deeper analytics (Growth/Feed/Reels/Travel Stories), AI features on top of the existing DeepSeek/OpenAI keys.
