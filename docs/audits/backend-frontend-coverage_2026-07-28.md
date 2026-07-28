# Backend↔Frontend Coverage Audit — 2026-07-28

**Task**: T042
**Method**: enumerated every `@Get/@Post/@Patch/@Put/@Delete` across all `*.controller.ts` in `apps/api/src`, then matched each route's path fragments against all non-test `.ts`/`.tsx` sources in `apps/web/src`. Findings below were each confirmed by hand — a route is reported as unreachable only after checking `App.tsx`'s route table, `layout/navigation.ts`, and the relevant `features/*/api.ts`.

**Result: 9 of 58 backend routes have no frontend consumer.** They span 6 distinct product features that are fully built, tested, RBAC-gated and merged on the backend, yet cannot be reached by any user of the web app.

---

## Why this audit exists

This is a recurring defect *class*, not a set of unrelated misses. Every instance so far was discovered by the user stumbling into it, one at a time:

| Discovered | Gap | Closed by |
|---|---|---|
| 2026-07-19 | Inventory, Guidelines, Announcements pages never built | T031 / T032 / T033 |
| 2026-07-20 | Task creation UI never built | T035 |
| 2026-07-20 | Recipes page never built | T036 |
| 2026-07-23 | Task *edit* UI never built | T039 |
| 2026-07-28 | `minThreshold` never collected by the ingredient form | T041 |

The mechanism is always the same: a backend task ships correctly **within its own declared scope**, and no downstream task is ever scheduled to build the consumer. Nothing fails, no test goes red, and CI stays green — the feature is simply unreachable. Seeded demo data frequently masks it (T041's thresholds were hardcoded in `seed.ts`, so low-stock alerting looked healthy for nine days while being dead for every real ingredient).

`memory/learnings.md` recommended a full-app sweep after T035 on 2026-07-20. It was not run, and T039 and T041 are the direct cost of that. This audit is that sweep.

---

## Findings, in severity order

### F1 — Invite acceptance has no UI. Team onboarding is impossible. **(P0)**

`POST /users/invite/accept` has no frontend caller, and `App.tsx` declares no invite-accept route — `/login` is the only public route.

An Owner or Admin can send an invite from `TeamPage` (`POST /users/invite` works), the backend mints a token with a 7-day expiry, and then the invitee has nowhere to go.

**This is silently harmful, not merely missing.** `LoginPage`'s signup mode posts to `/auth/signup`, which per T001 creates a **brand-new organization and kitchen**. An invitee who receives an invite and does the obvious thing — click through and "sign up" — lands in their own empty tenant rather than the kitchen that invited them. No error is shown. The user believes they have joined; they have not.

Consequence: the multi-user premise of the product is unreachable. Every role in FR-018 beyond the founding Owner (Chef, Staff, Viewer) is unreachable in practice, which also explains the long-standing "ADMIN role has no creation path" note in memory — same family of defect.

Backend contract, already complete: `acceptInvite({ token, password })` → `AuthResult` (access token + user). It validates status, expiry (returning 404 for expired so it can't be used to probe which emails were invited), and rejects an email that already has an account. A single public route such as `/invite/accept?token=…` with a password field is the entire missing piece.

### F2 — Shift Log: the whole module is unreachable. **(P1)**

`GET /shift-logs` and `POST /shift-logs` have no frontend caller. There is no `features/shift-logs/` directory, no page, and **no sidebar entry** — the nav has 9 items and Shift Log is not among them.

T014 shipped the module complete with RBAC (Viewer correctly denied), date filtering, newest-first ordering, and passing e2e tests. None of it is reachable. This is the largest single piece of dead product surface.

### F3 — Expiring-soon alerts: half of T007 is dead. **(P1)**

`GET /inventory/alerts/expiring` has no frontend caller, while its sibling `GET /inventory/alerts/low-stock` has 8. T007 delivered both endpoints; only low-stock ever got a widget.

Cheapest fix on this list — `LowStockWidget` is a working template for exactly this shape, and `StockBatch.expiryDate` is already populated. For a kitchen product, food expiry is arguably higher user value than low stock.

### F4 — CSV export: the entire T020 task is dead. **(P1)**

`GET /export/ingredients` and `GET /export/recipes` have no frontend caller. There is no export button anywhere in the app. T020 shipped and has never been usable.

### F5 — Recipe version history is invisible. **(P2)**

`GET /recipes/:id/versions` has no frontend caller. T005 built an append-only `RecipeVersion` table specifically so cost changes over time would be auditable; the data accumulates and no user can see it.

### F6 — Kitchen rename has no UI. **(P2)**

`GET /kitchens/:id` and `PATCH /kitchens/:id` have no frontend caller. A kitchen's name is fixed at signup forever. Smallest gap here; a natural fit for the existing Settings page.

---

## Registered follow-up tasks

| Task | Finding | Priority | Complexity |
|---|---|---|---|
| T043 | F1 — invite acceptance page | **P0** | C2 |
| T044 | F2 — Shift Log page + nav entry | P1 | C2 |
| T045 | F3 — expiring-soon widget | P1 | C1 |
| T046 | F4 — CSV export controls | P1 | C1 |
| T047 | F5 — recipe version history | P2 | C1 |
| T048 | F6 — kitchen rename in Settings | P2 | C0 |

---

## Process change — stop the class, not just the instances

Fixing these six leaves the mechanism intact. The guide template now requires, for any task that adds or changes a backend route or a persisted field, a **Consumer** declaration:

> **Consumer**: which frontend surface reaches this route/field, **or** an explicit `UI deferred to Txxx` naming a registered task, **or** `Intentionally headless` with a reason.

A backend task may not be marked Done with that line blank. This converts an invisible omission into a visible, reviewable one — the reviewer sees an empty field rather than having to notice an absence. It is the same reasoning that made T041's Evidence table catch missing tests: gaps are only caught when something explicitly asks for them.

Re-run this sweep after any milestone; the script is short enough to live in the task guide for T042.
