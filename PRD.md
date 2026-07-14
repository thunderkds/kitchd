# PRD — KitchenOS
**Last updated**: 2026-07-02
**Status**: Draft
**Owner**: hungnh1110@gmail.com

> **Scope of this document**: *What* to build and *why* — product intent, user stories, requirements, success metrics.
> Technical decisions, architecture, agent config, and task state live in `PROJECT_SPEC.md`.
> If Out of Scope here conflicts with Critical Constraints there, resolve the conflict before Stage 2.

---

## Overview

Chefs and kitchen teams currently juggle recipes on paper, prep lists on whiteboards, stock counts in someone's head, and communication over group-chat apps not built for kitchen work. KitchenOS is a single workspace where a chef can standardize recipes/SOPs, track ingredient stock with expiry and low-stock alerts, run daily prep/production as a kanban or checklist, communicate with the team without leaving the app, and jot quick notes tied to a recipe, task, or nothing in particular. This build starts as a solo, self-use tool for the founder (a chef) to validate the idea, with the data model kept multi-tenant-ready for a possible future SaaS product.

---

## Personas

| ID | Name | Role | Pain Point |
|----|------|------|-----------|
| P1 | Head Chef / Owner | Standardizes recipes, oversees stock & cost, assigns tasks, wants a single at-a-glance view | Recipes drift across paper/memory; no visibility into stock or task status without walking the floor |
| P2 | Sous Chef / Baker | Follows guidelines exactly, logs prep progress, flags low stock, leaves notes for the next shift | No reliable way to hand off context between shifts; guideline versions get out of sync |
| P3 | Kitchen Staff | Sees today's tasks, checklists, announcements; marks items done | No single place to see "what do I do today" on a phone/tablet |
| P4 | Manager/Admin (optional) | Manages users, views reports, manages suppliers/orders | No role-scoped view of ops without full owner access |

---

## User Stories

| ID | Story | Persona |
|----|-------|---------|
| US-001 | As a Head Chef, I want to create a recipe with ingredients and steps so that the system computes an estimated cost automatically. | P1 |
| US-002 | As a Head Chef, I want to create non-recipe SOPs (e.g. opening checklist) so that procedures are standardized and versioned. | P1 |
| US-003 | As a Head Chef, I want to create a daily prep task list and assign it to staff so that work is tracked, not verbal. | P1 |
| US-004 | As Kitchen Staff, I want to see and check off my assigned tasks on a tablet so that I know what to do today without asking. | P3 |
| US-005 | As a Sous Chef, I want completing a recipe-linked task to deduct ingredient stock so that inventory stays accurate without extra data entry. | P2 |
| US-006 | As any team member, I want to see ingredients flagged when they drop below a minimum threshold so that we don't run out mid-service. | P1, P2 |
| US-007 | As a Sous Chef, I want to post a shift note visible to the next shift so that context isn't lost between shifts. | P2 |
| US-008 | As any team member, I want to leave a comment with an @mention on a recipe or task so that the mentioned person is notified. | P1, P2, P3 |
| US-009 | As any team member, I want to create a quick note, optionally linked to a recipe or task, tag it, and search it later so that ideas and one-offs aren't lost. | P1, P2, P3 |
| US-010 | As an Admin, I want roles to restrict who can edit guidelines/inventory versus who can only view and complete tasks so that staff can't accidentally break standardized data. | P4 |
| US-011 | As Kitchen Staff, I want the whole app to work on a phone/tablet without horizontal scrolling so that I can use it at the pass. | P1, P2, P3 |
| US-012 | As a Head Chef, I want a home dashboard showing today's tasks, low-stock alerts, latest announcements, and pinned notes so that I get a full picture at a glance. | P1 |
| US-013 | As the founder/developer, I want every push/PR automatically linted, typechecked, and tested, and every merge to `staging` automatically deployed, so that I can iterate quickly without manually re-verifying and re-deploying by hand. | P1 (founder, acting as maintainer) |
| US-014 | As any user, I want to switch the app's visual theme (Simple or Dark Neon) and have my choice follow me across devices, so that I can use the interface style I prefer wherever I log in. | P1 (post-MVP, added 2026-07-14) |

---

## Functional Requirements

| ID | Requirement | Traces to |
|----|-------------|-----------|
| FR-001 | System must allow creating/editing a Recipe with name, category, ingredients (qty + unit), steps, yield, prep/cook time, photo, allergens, and version history. | US-001 |
| FR-002 | System must auto-compute a Recipe's estimated cost from its RecipeIngredient list × Ingredient cost_per_unit. | US-001 |
| FR-003 | System must support Guideline (SOP) documents distinct from Recipes: title, type, ordered steps, attachments. | US-002 |
| FR-004 | System must support Task CRUD with status (To Do/In Progress/Done), assignee, due date/time, and optional recurrence rule. | US-003 |
| FR-005 | System must support generating a Task with a checklist pre-populated from a Recipe's or Guideline's steps. | US-003 |
| FR-006 | System must render Tasks in at least a kanban view and a list/checklist view. | US-003, US-004 |
| FR-007 | System must let a user mark a Task (or its checklist items) complete on a touch/tablet interface. | US-004 |
| FR-008 | On completion of a recipe-linked Task, the system must show the computed stock deduction (recipe qty × servings) and require one-tap confirmation before applying it — not a silent automatic deduction. | US-005 |
| FR-009 | System must maintain a StockMovement ledger (receive/consume/waste/adjust) with qty, reason, actor, timestamp per Ingredient. | US-005, US-006 |
| FR-010 | System must flag any Ingredient whose current stock is below its min_threshold, surfaced on the dashboard and via notification. | US-006 |
| FR-011 | System must support StockBatch tracking with expiry_date and flag items expiring soon. | US-006 |
| FR-012 | System must allow creating a ShiftLog entry (author, shift, body, timestamp) visible to subsequent shifts in a time-sorted feed. | US-007 |
| FR-013 | System must support threaded Comments on any Recipe, Task, or Ingredient with @mention parsing. | US-008 |
| FR-014 | System must notify a mentioned user (in-app) when they are @mentioned in a Comment. | US-008 |
| FR-015 | System must support Note CRUD with title, markdown body, tags, pin/unpin, and optional link to a Recipe/Task/Ingredient. | US-009 |
| FR-016 | System must support full-text search over Notes by title, body, and tags. | US-009 |
| FR-017 | System must separate "My Notes" (author-scoped) from "Team Notes" (shared) views. | US-009 |
| FR-018 | System must enforce role-based permissions: Owner/Admin and Chef can edit Guidelines/Inventory; Staff can view Guidelines, manage own Tasks, and add Notes/Comments; Viewer is read-only. | US-010 |
| FR-019 | System must render all core views (Dashboard, Tasks, Guidelines, Inventory, Notes, Announcements) responsively without horizontal scroll from phone width upward. | US-011 |
| FR-020 | System must render a Dashboard aggregating: today's Tasks, low-stock alerts, latest Announcements, and pinned Notes, scoped to the logged-in user's role. | US-012 |
| FR-021 | System must support an Announcements channel: Owner/Chef broadcasts to all Staff, with per-user read receipts. | US-012 |
| FR-022 | System must record an audit trail (who/when/what) for Recipe edits and Stock adjustments. | NFR-driven, supports US-001, US-005 |
| FR-023 | System must support CSV export for Inventory and Recipes. | Doc §5 |
| FR-024 | A CI pipeline must run lint, typecheck, and the full test suite for `/apps/web` and `/apps/api` on every push and pull request; a separate CD pipeline must deploy to a Railway staging environment automatically on merge to the `staging` branch only (never `main`). | US-013 |
| FR-025 | System must support a user-selectable UI theme ("Simple" default, "Dark Neon" alternate), persisted per-user account so it follows the user across devices, with an architecture extensible to future themes without per-component code changes. | US-014 (post-MVP, added 2026-07-14) |

---

## Non-Functional Requirements

| ID | Requirement | Category |
|----|-------------|----------|
| NFR-001 | Dashboard must load in < 1.5s p95. | Performance |
| NFR-002 | Task and Comment updates must propagate to other connected clients in near-real-time (WebSocket or polling). | Performance/UX |
| NFR-003 | Data model must be multi-tenant from day one (Organization → Kitchen → User), even though MVP usage is a single org/single kitchen. | Scalability |
| NFR-004 | Task-checklist view must tolerate unreliable kitchen wifi via optimistic UI updates + retry queue (full offline sync is post-MVP). | Reliability |
| NFR-005 | All UI must be responsive/mobile-first; primary target devices are tablets and phones. | Usability |
| NFR-006 | Auth must use custom JWT with an org/role model (no third-party auth provider for MVP). | Security |
| NFR-007 | Recipe edits and Stock adjustments must be attributable to a specific actor and timestamp (audit trail). | Compliance/Traceability |

---

## Success Metrics / KPIs

| Metric | Baseline | Target | How measured |
|--------|----------|--------|--------------|
| Recipes with computed cost | 0 | 100% of created recipes have a non-null computed cost | DB query: recipes where cost_computed IS NOT NULL |
| Daily task completion via app | 0 (paper/whiteboard) | Founder completes ≥1 full day's prep list through the app | Manual usage log during self-testing |
| Low-stock catches before stockout | 0 | ≥1 real low-stock alert surfaced before ingredient runs out | Manual observation during self-use |
| Mobile usability | N/A | Zero horizontal-scroll incidents across Dashboard/Tasks/Guidelines/Inventory on phone width (375px) | Manual QA pass at Stage 4/5 |

---

## Out of Scope

The following are explicitly excluded from this MVP:

- AI Kitchen Assistant (recipe scaling, RAG Q&A, auto-generated prep lists) — Post-MVP §5
- Menu & costing builder, food-cost % / margin calculator — Post-MVP §5
- Shift scheduling / staff roster / shift swaps — Post-MVP §5
- Waste & yield analytics / trend reporting — Post-MVP §5
- Supplier/purchase-order automation — Post-MVP §5
- Multi-location/multi-kitchen workspace UI (data model supports it; UI/workflow does not for MVP)
- Offline-first PWA with full sync — Post-MVP §5 (MVP: optimistic UI + retry queue only)
- Public/read-only client-vendor share links — Post-MVP §5
- Email/push notifications — deferred; MVP is in-app notification bell only
- Third-party managed auth (Auth0/Clerk) — deferred in favor of custom JWT
- Production deployment to `main` — staging deploy only for this milestone (Railway, on merge to `staging` branch)

---

## Open Questions / Assumptions

| # | Question / Assumption | Owner | Due |
|---|----------------------|-------|-----|
| 1 | Backend framework: NestJS vs Express — deferred to Stage 0.5b brainstorming. | Supervisor | Stage 0.5b |
| 2 | Realtime mechanism: Socket.IO assumed as default per requirement.md §7; not locked. | Supervisor | Stage 0.5b / ADR |
| 3 | File storage: S3-compatible assumed; concrete provider (local/minio for dev vs real S3) deferred until hosting is decided. | Supervisor | Before first deploy |
| 4 | Notifications: in-app bell only for MVP; email/push explicitly deferred to Post-MVP. | User (confirmed) | Revisit when team grows beyond solo use |
| 5 | Multi-tenant enforcement: data model built correctly now (org→kitchen→user) even though MVP usage is single org/single kitchen. | User (confirmed) | Locked per NFR-003 |
| 6 | Hosting: staging deploys to Railway on merge to `staging` branch; production/`main` deploy still deferred. | User (confirmed) | Before first production deploy |
| 7 | FR-024: CI (lint/typecheck/test/build for /apps/web and /apps/api) must run on every push/PR; CD (deploy to Railway staging) triggers only on merge to `staging`, never `main`. | User (confirmed) | Stage 3, T023 |
