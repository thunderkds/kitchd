# KitchenOS — Chef & Kitchen Operations Platform
### Product Requirements Document & Implementation Plan

**Reference inspiration:** Taskade "Simple Store Manager" app kit — a workspace-style dashboard combining projects (lists/kanban/tables), an AI agent, notes, and automations, wrapped in a clean sidebar + workspace layout with client/team access.

---

## 1. Problem & Vision

Chefs and kitchen teams (bakeries, restaurants, catering, cloud kitchens) currently juggle recipes on paper, prep lists on whiteboards, stock counts in someone's head, and communication over group chat apps not built for kitchen work. **KitchenOS** is a single workspace where a chef can:

- Keep **recipes/guidelines/SOPs** standardized and versioned.
- Track **ingredients & food inventory** (stock, expiry, low-stock alerts).
- Run daily **prep/production tasks** as a kanban or checklist.
- **Communicate** with the team (shift notes, announcements, comments) without leaving the app.
- Jot quick **notes** (a recipe idea, a customer request, a substitution) that don't need a full workflow.

## 2. Target Users / Personas

| Persona | Needs |
|---|---|
| **Head Chef / Owner** | Standardize recipes, oversee stock & cost, assign tasks, see everything at a glance |
| **Sous Chef / Baker** | Follow guidelines exactly, log prep progress, flag low stock, leave notes for next shift |
| **Kitchen Staff** | See today's tasks, checklists, read announcements, mark items done |
| **Manager/Admin (optional)** | Manage users, view reports, manage suppliers/orders |

## 3. MVP Scope (Must-Have)

### 3.1 Notes
- Quick, freeform notes (title + rich text/markdown body).
- Pin/unpin, tag (e.g. `#recipe-idea`, `#customer`, `#shift`), search.
- Attach a note to a Recipe, Task, or stand alone.
- Per-user "My Notes" + shared "Team Notes" space.

### 3.2 Guidelines (Recipes & SOPs)
- Structured recipe entity: name, category, ingredients (qty + unit), steps, yield/servings, prep & cook time, photo, allergens, cost (auto-computed from ingredient cost), version history.
- Non-recipe SOPs (e.g. "Opening Checklist", "Sanitation Procedure") as step-by-step guideline documents.
- Checklists derived from guidelines can be "run" as a task instance (see 3.5).
- Search & filter by category/tag; view mode: card grid or list.

### 3.3 Communication
- **Announcements** channel (chef/admin broadcasts to all staff, read receipts).
- **Shift notes / handoff log** — timestamped, per-shift, visible to next shift.
- **Comments** on any Recipe, Task, or Inventory item (threaded, @mentions).
- Optional: simple **direct/group chat** (stretch — MVP can start with comments + announcements only).
- Notifications (in-app bell + optional email/push) for mentions, low stock, assigned tasks.

### 3.4 Food / Inventory Management
- Ingredient catalog: name, unit, cost/unit, supplier, category, allergen flags.
- Stock ledger: current qty, min-threshold, batch/expiry date, location (fridge/freezer/dry).
- Stock movements: receive stock, consume (manual or auto-deduct when a recipe/task is completed), waste/adjustment log with reason.
- Low-stock & expiring-soon alerts on dashboard + notification.
- Basic supplier list per ingredient (name, contact, lead time) — stretch: purchase order generation.

### 3.5 Task & Prep Management
- Kanban board (To Do / In Progress / Done) and/or daily checklist view.
- Tasks can be: ad-hoc, or generated from a Guideline/Recipe ("Prep 20x sourdough loaves").
- Assign to user, due date/time, recurrence (daily prep lists repeat every morning).
- Completing a recipe-linked task can prompt/auto-deduct ingredient stock.

### 3.6 Dashboard (Home)
- Widget-style overview (Taskade-style): today's tasks, low-stock alerts, latest announcements, pinned notes, quick links to recipes.
- Role-based view (chef sees full ops view; staff sees "my tasks today").

## 4. Recommended Additional Features (Post-MVP / Nice-to-Have)

- **Menu & costing** — build menus from recipes, auto food-cost %, margin calculator.
- **Shift scheduling / calendar** — staff roster, shift swaps.
- **Waste & yield analytics** — trends, cost-of-waste reports.
- **AI Kitchen Assistant** — natural-language recipe scaling ("scale this for 150 covers"), substitution suggestions, auto-generate prep lists from a menu, ask questions against your own recipes/SOPs (RAG over guidelines).
- **Supplier/purchase-order automation** — auto-draft POs when stock hits threshold (mirrors Taskade's "automations").
- **Multi-location/multi-kitchen workspace** support.
- **Mobile app / PWA** with offline-first task checklist for kitchen floor use.
- **Client/vendor portal** (read-only share links), similar to Taskade's public share links.

## 5. Non-Functional Requirements

- **Roles & permissions**: Owner/Admin, Chef (edit guidelines/inventory/tasks), Staff (view guidelines, manage own tasks, add notes/comments), optional Viewer (read-only, e.g. auditor).
- **Responsive & mobile-first** — kitchen staff mostly on tablets/phones.
- **Offline tolerance** for the task-checklist view (kitchen wifi is unreliable) — MVP: optimistic UI + retry queue; full offline sync is post-MVP.
- **Audit trail** on recipe edits, stock adjustments (who/when/what).
- **Multi-tenant** from day one (organization → kitchens → users), even if MVP only ships one kitchen per org.
- **Performance**: dashboard loads < 1.5s p95; realtime updates for tasks/comments (WebSocket or polling).
- **Data export**: CSV export for inventory & recipes (chefs like backups).

## 6. Core Data Model (simplified ERD)

```
Organization ──< Kitchen ──< User (role)
Kitchen ──< Recipe ──< RecipeIngredient >── Ingredient ──< StockBatch
Kitchen ──< Guideline (SOP, non-recipe)
Kitchen ──< Task ──(optional FK)── Recipe / Guideline
Kitchen ──< Note ──(optional FK)── Recipe / Task / Ingredient
Kitchen ──< Announcement
Kitchen ──< ShiftLog
AnyEntity ──< Comment ──< User (author)
Ingredient ──< StockMovement (receive/consume/waste/adjust)
```

Key entities & fields:

- **User**: id, org_id, kitchen_ids[], name, email, role, avatar
- **Recipe**: id, kitchen_id, name, category, yield, prep_time, cook_time, steps[], photo_url, allergens[], version, cost_computed, created_by
- **RecipeIngredient**: recipe_id, ingredient_id, qty, unit
- **Ingredient**: id, kitchen_id, name, unit, cost_per_unit, category, allergens[], supplier_id, min_threshold
- **StockBatch**: id, ingredient_id, qty, expiry_date, location, received_at
- **StockMovement**: id, ingredient_id, type(receive/consume/waste/adjust), qty, reason, actor_id, created_at
- **Guideline**: id, kitchen_id, title, type(SOP/checklist), steps[], attachments[]
- **Task**: id, kitchen_id, title, status, assignee_id, due_at, recurrence_rule, source_recipe_id/nullable, checklist_items[]
- **Note**: id, kitchen_id, author_id, title, body_md, tags[], pinned, linked_entity(type,id)
- **Announcement**: id, kitchen_id, author_id, title, body, read_by[]
- **ShiftLog**: id, kitchen_id, author_id, shift(morning/evening), body, created_at
- **Comment**: id, entity_type, entity_id, author_id, body, mentions[], created_at

## 7. Suggested Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript, Vite, TailwindCSS | Fast, matches skills available for build |
| State/data | TanStack Query + Zustand | Simple, realtime-friendly |
| UI views | Kanban (dnd-kit), table (TanStack Table), calendar (FullCalendar) | Matches Taskade's multi-view style |
| Backend | Node.js (NestJS or Express) + PostgreSQL | Relational data (recipes/ingredients/costing) fits SQL well |
| Realtime | WebSocket (Socket.IO) or Supabase Realtime | Live comments/task updates |
| Auth | Auth0/Clerk or custom JWT + org/role model | Multi-tenant roles |
| File storage | S3-compatible (recipe photos, attachments) | |
| AI assistant (post-MVP) | Anthropic API (Claude) with RAG over Recipes/Guidelines | Matches "AI agent" parity with Taskade reference |
| Notifications | In-app + email (Postmark/SendGrid); push later | |
| Hosting | Vercel/Netlify (FE) + Railway/Render/Fly.io (BE) or single Next.js full-stack deploy | Fast MVP shipping |

*(If the team prefers a full-stack framework, Next.js + Prisma + PostgreSQL collapses FE/BE into one deployable app — recommended for MVP speed.)*

## 8. Information Architecture / Navigation (mirrors Taskade layout)

```
Sidebar:
 🏠 Dashboard
 📋 Tasks / Prep Board
 📖 Guidelines (Recipes + SOPs)
 🥫 Inventory
 📝 Notes
 📣 Announcements / Shift Log
 👥 Team & Roles (admin)
 ⚙️ Settings
```
Each section supports switchable views where relevant: **List / Kanban / Table / Calendar** — same multi-view pattern as Taskade projects.

## 9. Implementation Plan (Phased, for build agent OR AGENT CAN CONTRIBUTE TO DECICE)

### Phase 0 — Foundation (Week 1)
1. Scaffold monorepo (Next.js + TypeScript + Tailwind, or FE/BE split per stack decision).
2. Set up PostgreSQL schema/migrations for entities in §6 (start with User, Kitchen, Recipe, Ingredient, Task, Note).
3. Auth: sign-up/login, org creation, invite flow, role assignment.
4. Base layout: sidebar nav, top bar, empty-state pages for each section.

### Phase 1 — Guidelines & Inventory (Week 2)
5. Recipe CRUD (form: ingredients list builder, steps editor, photo upload).
6. Ingredient CRUD + stock batches; auto cost roll-up on recipe from ingredient costs.
7. Guideline (SOP) CRUD — simple rich-text/step list, no ingredients.
8. Low-stock threshold flag + dashboard widget.

### Phase 2 — Tasks & Notes (Week 3)
9. Task CRUD with kanban board (dnd-kit) + list/calendar toggle.
10. "Generate task from recipe" action (creates a prep task with checklist = recipe steps).
11. Recurrence support for daily prep lists (cron-based regeneration or rule-based virtual instances).
12. Notes CRUD, tagging, pin, link-to-entity, search.

### Phase 3 — Communication (Week 4)
13. Announcements (create/broadcast, read receipts).
14. Shift log (create per shift, feed view sorted by time, filter by date).
15. Comments component (reusable) attached to Recipe/Task/Ingredient; @mentions + notification.
16. Notification center (bell icon, unread count, mark-as-read).

### Phase 4 — Dashboard, Roles, Polish (Week 5)
17. Home dashboard aggregating: today's tasks, low stock, latest announcements, pinned notes.
18. Role-based visibility/permissions enforcement across all CRUD (staff vs chef vs admin).
19. CSV export for inventory & recipes.
20. Mobile responsive pass (tablet/phone breakpoints, since kitchen staff use handheld devices).
21. QA pass + seed demo data + onboarding walkthrough.

### Phase 5 — Stretch / Post-MVP
22. AI assistant (Claude-powered): recipe scaling, Q&A over guidelines (RAG), auto-generated prep lists from a menu.
23. Menu builder + food-cost analytics.
24. Shift scheduling/calendar for staff roster.
25. Supplier management + purchase-order automation.
26. Offline-first PWA for the task checklist view.
27. Public/read-only share links for a recipe or menu (parity with Taskade's share-app link).

## 10. Acceptance Criteria (MVP definition of done)

- A chef can create a recipe with ingredients & steps, and the system computes an estimated cost.
- A chef can create a daily prep task list, assign it to staff, and staff can check items off on a tablet.
- Ingredient stock decreases automatically (or via one-tap confirm) when a recipe-based task is completed.
- The system flags any ingredient below its min-threshold on the dashboard.
- Any team member can post a shift note visible to the next shift, and leave a comment on a recipe or task with an @mention that notifies the mentioned user.
- Notes can be created standalone or linked to a recipe/task, tagged, and searched.
- Roles restrict who can edit guidelines/inventory vs who can only view & complete tasks.
- The whole flow works on a phone/tablet screen without horizontal scrolling.