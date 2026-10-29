# Backend↔Mobile Coverage Audit — 2026-10-29

**Task**: M011 (mobile equivalent of T042's `docs/audits/backend-frontend-coverage_2026-07-28.md`)
**Method**: enumerated every `@Get/@Post/@Patch/@Put/@Delete` across all 17 `*.controller.ts` in `apps/api/src`, joined each with its `@Controller` prefix and resolved its `@Roles`. Every exported helper in `apps/mobile/src/api.ts` was traced to a calling screen under `apps/mobile/app/**` (all 36 helpers have at least one caller — no orphan helpers), and the one direct `fetch` (`app/index.tsx:43`, login/signup) was included. Every "none" was hand-confirmed by grepping the path fragment across `apps/mobile/app` and `apps/mobile/src` (tests excluded), and every screen's reachability was checked (`dashboard.tsx:31-52` links, `tasks.tsx:482` → task detail, `invites.tsx:132` → accept).

**Route count**: `grep -rhoE "@(Get|Post|Patch|Put|Delete)\(" apps/api/src --include='*.controller.ts' | wc -l` → **59**, of which 2 are text inside a comment (`apps/api/src/users/users.controller.ts:54`, "…the bare @Get() / @Get(':id')-style"). **Real routes: 57.** No controller changed since T042 (`git log 764b6e4..HEAD` touches none); T042's "58" was a miscount.

**Result: 35 of 57 routes have a mobile consumer. 22 do not** — 6 covered by existing rows (M006/M007/M008), 1 non-product (`GET /` hello), **15 new gaps** (12 with a web consumer, 3 detail-by-id GETs unused on web too). Socket.IO (3 server→client events) has no mobile subscriber — M009.

---

## Unconsumed routes, grouped

| Feature | Routes | Disposition |
|---|---|---|
| Theme | `PATCH /users/me/theme` | **M006** |
| Comments | `GET/POST /comments`, `DELETE /comments/:id` | **M007** |
| Notifications | `GET /notifications`, `POST /notifications/mark-read` | **M008** |
| Realtime | gateway events `task.updated`, `comment.created`, `announcement.created` | **M009** (note: gateway CORS origin is `WEB_ORIGIN`; check native client handshake) |
| Shift Log | `GET/POST /shift-logs` | **new gap → M014** |
| Inventory alerts | `GET /inventory/alerts/low-stock`, `GET /inventory/alerts/expiring` | **new gap → M015** (dashboard widgets) |
| Recipe versions | `GET /recipes/:id/versions` | **new gap → M016** |
| Kitchen view/rename | `GET/PATCH /kitchens/:id` | **new gap → folded into M006** (Settings screen; PATCH is `@Roles(Role.CHEF)` only — `kitchens.controller.ts:51`) |
| Team management | `PATCH /users/:id/role`, `DELETE /users/:id` | **new gap → M017** (`app/team.tsx` is read-only) |
| CSV export | `GET /export/ingredients`, `GET /export/recipes` | **web-only by design** — a CSV download is a desktop back-office workflow; on a phone it needs a share-sheet design. Revisit only on user demand. |
| Manual stock movements | `POST /ingredients/:id/stock/movements` (waste/adjust/consume) | **gap on both platforms** (web doesn't call it either) → registered on the web board as a candidate, not mobile |
| Detail-by-id GETs | `GET /announcements/:id`, `GET /ingredients/:id`, `GET /notes/:id` | **headless by design** — both clients render from list responses |
| Hello | `GET /` | not a product route |

## Partial consumption (consumed, but incomplete)

- `PATCH /notes/:id` — mobile uses it for the pin toggle only (`notes.tsx:128`); no title/body/tag edit.
- `GET /notes` — mobile never sends `q` (search).
- `POST /users/invite/accept` — reachable only via the `kitchenos://invite/accept?token=` deep link or from `/invites` (which requires a session, `invites.tsx:24`). The login screen has no "I have an invite" entry, so a signed-out invitee without the deep link can't reach it — the T042 F1 failure family. → folded into **M017**.
- `session.ts:28` stores `themePreference` from login, but nothing applies it → **M006**.

## Full route table

| # | Verb | Path | Roles | Mobile consumer | Disposition |
|---|---|---|---|---|---|
| 1 | GET | / | public | none | not product |
| 2 | POST | /auth/signup | public | app/index.tsx:43 | consumed |
| 3 | POST | /auth/login | public | app/index.tsx:43 | consumed |
| 4 | GET | /announcements | any auth | app/announcements.tsx:29 | consumed |
| 5 | GET | /announcements/:id | any auth | none | headless |
| 6 | POST | /announcements | OWNER, CHEF | app/announcements.tsx:73 | consumed |
| 7 | GET | /comments | any auth | none | M007 |
| 8 | POST | /comments | OACS | none | M007 |
| 9 | DELETE | /comments/:id | OACS | none | M007 |
| 10 | GET | /export/ingredients | OAC | none | web-only |
| 11 | GET | /export/recipes | OAC | none | web-only |
| 12 | GET | /guidelines | any auth | app/guidelines.tsx:60 | consumed |
| 13 | GET | /guidelines/:id | any auth | app/guidelines.tsx:73 | consumed |
| 14 | POST | /guidelines | OAC | app/guidelines.tsx:129 | consumed |
| 15 | PATCH | /guidelines/:id | OAC | app/guidelines.tsx:125 | consumed |
| 16 | GET | /inventory/alerts/low-stock | any auth | none | M015 |
| 17 | GET | /inventory/alerts/expiring | any auth | none | M015 |
| 18 | GET | /ingredients | any auth | app/inventory.tsx:67 | consumed |
| 19 | GET | /ingredients/:id | any auth | none | headless |
| 20 | POST | /ingredients | OAC | app/inventory.tsx:141 | consumed |
| 21 | PATCH | /ingredients/:id | OAC | app/inventory.tsx:139 | consumed |
| 22 | POST | /ingredients/:id/stock/receive | OAC | app/inventory.tsx:173 | consumed |
| 23 | POST | /ingredients/:id/stock/movements | OAC | none | gap both platforms |
| 24 | GET | /ingredients/:id/stock/movements | any auth | app/inventory.tsx:71 | consumed |
| 25 | GET | /kitchens/:id | any auth | none | M006 |
| 26 | PATCH | /kitchens/:id | CHEF | none | M006 |
| 27 | GET | /notes | any auth | app/notes.tsx:46 | consumed (no `q`) |
| 28 | GET | /notes/:id | any auth | none | headless |
| 29 | POST | /notes | OACS | app/notes.tsx:102 | consumed |
| 30 | PATCH | /notes/:id | OACS | app/notes.tsx:128 | consumed (pin only) |
| 31 | DELETE | /notes/:id | OACS | app/notes.tsx:145 | consumed |
| 32 | GET | /notifications | any auth | none | M008 |
| 33 | POST | /notifications/mark-read | any auth | none | M008 |
| 34 | GET | /recipes | any auth | app/recipes.tsx:85 | consumed |
| 35 | GET | /recipes/:id | any auth | app/recipes.tsx:127 | consumed |
| 36 | GET | /recipes/:id/versions | any auth | none | M016 |
| 37 | POST | /recipes | OAC | app/recipes.tsx:187 | consumed |
| 38 | PATCH | /recipes/:id | OAC | app/recipes.tsx:183 | consumed |
| 39 | GET | /shift-logs | any auth | none | M014 |
| 40 | POST | /shift-logs | OACS | none | M014 |
| 41 | GET | /tasks | any auth | app/tasks.tsx:155 | consumed |
| 42 | GET | /tasks/:id | any auth | app/task/[taskId].tsx:134 | consumed |
| 43 | POST | /tasks | OAC | app/tasks.tsx:231 | consumed |
| 44 | PATCH | /tasks/:id | any auth (field checks in service) | app/task/[taskId].tsx:371 | consumed |
| 45 | POST | /tasks/:id/complete/preview | any auth | app/tasks.tsx:270 | consumed |
| 46 | POST | /tasks/:id/complete/confirm | any auth | app/tasks.tsx:276 | consumed |
| 47 | POST | /tasks/generate-from-recipe/recipe/:recipeId | OAC | app/tasks.tsx:241 | consumed |
| 48 | POST | /tasks/generate-from-recipe/guideline/:guidelineId | OAC | app/tasks.tsx:247 | consumed |
| 49 | POST | /users/invite | OWNER, ADMIN | app/invites.tsx:69 | consumed |
| 50 | POST | /users/invite/accept | public | app/invite/accept.tsx:37 | consumed (reachability: M017) |
| 51 | PATCH | /users/me/theme | any auth | none | M006 |
| 52 | GET | /users/invites | OWNER, ADMIN | app/invites.tsx:37 | consumed |
| 53 | GET | /users/assignable | OWNER, ADMIN, CHEF | app/tasks.tsx:176 | consumed |
| 54 | DELETE | /users/invites/:id | OWNER, ADMIN | app/invites.tsx:92 | consumed |
| 55 | GET | /users | OWNER, ADMIN | app/team.tsx:23 | consumed |
| 56 | PATCH | /users/:id/role | OWNER, ADMIN | none | M017 |
| 57 | DELETE | /users/:id | OWNER, ADMIN | none | M017 |

Role shorthand: OACS = Owner/Admin/Chef/Staff; OAC = Owner/Admin/Chef. `RolesGuard` (`apps/api/src/auth/guards/roles.guard.ts:49`) is a flat `includes` with no hierarchy.

## Not confirmed
- Which web components subscribe to realtime events (out of mobile scope).
- Whether `WEB_ORIGIN` CORS on the gateway affects native Socket.IO clients — M009 must check.
