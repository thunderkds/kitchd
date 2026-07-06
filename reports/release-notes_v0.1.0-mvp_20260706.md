# KitchenOS v0.1.0-mvp — Release Notes
**Date**: 2026-07-06
**Scope**: T001–T024 (full MVP milestone)

This is the first release candidate — the complete MVP feature set, independently QA-verified end-to-end against seeded demo data (T022).

## Features

- **Auth & multi-tenancy**: JWT signup/login, Organization → Kitchen → User model, invite flow with role assignment (T001, T002)
- **RBAC**: shared `RolesGuard` + `@Roles()` decorator enforced across every module; two dedicated audit passes (T019, T024) confirmed zero permission gaps and zero ad-hoc checks outside the guard
- **Inventory**: Ingredient CRUD, StockBatch/StockMovement append-only ledger, low-stock + expiring-soon alerts (T004, T007)
- **Recipes**: CRUD with ingredient builder and always-live cost roll-up (T005)
- **Guidelines (SOPs)**: CRUD (T006)
- **Tasks**: CRUD, kanban + list views, generate-from-recipe/guideline, stock deduction on completion with a mandatory confirm-before-apply step (T008, T009, T011)
- **Recurring tasks**: nightly job clones daily-recurring task templates into today's occurrence (T010)
- **Notes**: standalone or linked to a recipe/task, tagging, pinning, search (T012)
- **Announcements**: broadcast with read receipts, Owner/Chef-only authoring (T013)
- **Shift log**: per-shift handoff feed (T014)
- **Comments**: polymorphic across entities, @mentions with notification hook (T015)
- **Notifications**: mention + low-stock-transition alerts, unread count, mark-as-read (T016)
- **Realtime**: Socket.IO push for task/comment/announcement updates, kitchen-scoped rooms, JWT-authenticated handshake (T017)
- **Dashboard**: role-aware landing page aggregating today's tasks, low stock, announcements, and pinned notes (T018)
- **CSV export**: ingredient and recipe export, RBAC-gated (T020)
- **Mobile responsive**: verified zero-overflow at 375/768/1024px across every page (T021)
- **CI/CD**: GitHub Actions lint/test/build on every push/PR; staging auto-deploy to Render on merge to `staging` (T023) — **staging deploy requires one-time operator setup, see `RUNBOOK.md`**
- **Demo data & onboarding**: idempotent seed script (1 org, 4 role-users, 5 ingredients, 3 recipes, 3 tasks, notes/announcements) and a full onboarding walkthrough doc (T022)

## Fixes

- Dashboard's Tasks widget now defaults to the safe, scoped view for a stale session with no cached user record, instead of leaking the broader "all Kitchen tasks" view (found in T018 review)
- Task-recurrence template deletion now preserves generated occurrence history (`onDelete: SetNull`) instead of cascading a delete (found in T010 review)
- Mention notifications now show the author's name instead of a raw internal ID (found during T022's QA pass)
- Fixed a pre-existing `vite.config.ts` bug that would have made every CI build of `apps/web` fail (found during T023 review)

## Internal

- Two full RBAC audit passes (T019 covering Inventory/Recipes/Guidelines/Tasks, T024 covering Notes/Announcements/ShiftLog/Comments) — matrix-tested every module × role × verb combination
- All schema migrations across the milestone are additive-only; every one passed a `migration-safety` GO review (reversible, zero-downtime, no data loss)
- Full regression: 23 backend test suites / 181 tests, 14 frontend test files / 59 tests, all green

## Known limitation (flagged, not fixed)

- The `ADMIN` role has no user-creation path anywhere in the product today (the invite flow only allows Chef/Staff/Viewer) — every RBAC rule that references Admin (e.g. Announcements excluding it) is currently unreachable by any real user. Needs a product decision: add an Owner-can-promote-to-Admin flow, or treat Admin as intentionally dormant for this milestone.
