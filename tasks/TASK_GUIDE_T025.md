# TASK_GUIDE — T025: Backend theme-preference (User.themePreference enum + endpoint)
**Date**: 2026-07-14
**Complexity Level**: C1
**Risk Level**: Low
**Priority**: P1
**Assigned agent**: backend-developer
**Agent guide**: `.claude/agents/backend.md`

---

## Mandatory Startup (Do Not Skip)

Before writing any code:
1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/backend.md`
5. Note the **Complexity Level** above (C1) and apply the matching process from the Complexity matrix in `.claude/agents/general-agent-template.md`
6. C1 — `memory/codebase-map.md` read is optional; this task touches a small, well-known surface (`schema.prisma`, `auth`/`users` module)

Also read `docs/adr/0001-theme-system-token-architecture.md` — the architecture decision this task implements — and `BRAINSTORMING_LOG_theme-system.md` for full context.

---

## Requirement (Pillar 1 — Adapt the requirement)

User request: "implement a new theme, which can call the dark neon, allow to switch... for the css, notice about the reuse or define the color tempo to define any theme in the future." Grilled and locked: theme preference must be **account-synced** (DB-backed), not just browser-local, so it follows the user across devices.

**Restated intent** (Supervisor's interpretation):
> The backend must let an authenticated user read and update their own theme preference, persisted on their `User` record, so the frontend (T026) can initialize the correct theme on login from any device.

**Out of scope** (what this task explicitly does NOT do):
- No frontend code, no CSS, no `data-theme` wiring — that is T026.
- No admin ability to set another user's theme — self-service only (caller sets their own).
- No third theme beyond `simple`/`dark_neon` — the enum is deliberately closed for now; a future theme requires its own migration (ADR-0001).

**Requirement Refs** (FR/NFR/US IDs from `PRD.md` this task satisfies):
- FR-025: user-selectable UI theme, persisted per-user account.
- US-014: theme choice follows the user across devices.

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [ ] Restated intent confirmed to match the user's request (by Supervisor / user — not the implementing agent)
- [ ] Domain terms align with `PROJECT_SPEC.md` glossary — `themePreference`, `Theme` enum values `simple`/`dark_neon` (grill-with-docs already run, see PROJECT_SPEC.md Memory/Insights 2026-07-14)
- [ ] Every Acceptance Criterion below traces to a line in the Requirement
- [ ] All Requirement Refs exist in `PRD.md` and are fully covered by the Acceptance Criteria above

> An agent must NOT start implementing until this gate is checked. If anything here is unclear,
> STOP and ask the Supervisor (Karpathy: Think Before Coding).

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | `User` model has a `themePreference` field of a new Prisma enum `Theme { simple, dark_neon }`, `@default(simple)`, additive migration | FR-025, ADR-0001 |
| 2 | Auth "me" payload (whatever endpoint the frontend currently uses to get the logged-in user, e.g. login response / `GET /auth/me` if it exists — verify actual route name in code, don't assume) includes `themePreference` | US-014 |
| 3 | An authenticated endpoint lets the caller update **their own** `themePreference` to a valid `Theme` value and persists it | FR-025 |
| 4 | Updating with an invalid/unknown theme string is rejected with 400, not silently coerced or 500 | Edge case, ADR-0001 |
| 5 | Existing users created before this migration read back `themePreference: "simple"` (the Prisma default), not null/undefined | Edge case |
| 6 | Caller cannot set another user's `themePreference` (no `:userId` param — endpoint always acts on the authenticated caller only) | Security-adjacent correctness, mirrors kitchen-scoped-controller pattern in `memory/learnings.md` |

---

## Evaluation & Acceptance (How we know the agent worked correctly)

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Authenticated request updates own theme to `dark_neon` | 200, response reflects `dark_neon`, DB row updated | automated test |
| 2 | Authenticated request updates own theme to `"neon-purple"` (not a valid enum value) | 400, DB row unchanged | automated test |
| 3 | Unauthenticated request to the update endpoint | 401 | automated test |
| 4 | Login/auth payload for a pre-migration user (no explicit themePreference ever set) | Payload includes `themePreference: "simple"` | automated test |

### Verification Command (exact, runnable)

```bash
cd apps/api && npm test -- theme
```

> **Evidence is a required document, not a formality.** A task is not Done until every row below is
> filled with real, pasted output — not just checked. The `verify` row's first cell must be a bare
> `| verify |` (no backticks), and its Notes cell must contain the literal word "pass" (case-insensitive).

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/api/src/users/theme.e2e.spec.ts` — 5 tests covering AC2-6 + Success Criteria 1-3 |
| Verification command run | ☒ pass | `cd apps/api && npm test -- theme` → 5/5 passed, see `reports/evidence/T025/verify-session.md` |
| Negative cases hold | ☒ pass | invalid enum → 400, unauthenticated → 401, verified live via curl and in the e2e spec |
| verify | ☒ pass | Live API probes (curl) against a running scratch-port server confirmed signup default, valid update, invalid-value 400, unauthenticated 401 — archived at `reports/evidence/T025/verify-session.md` |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | Reviewed the 4 changed files + 3 new files (migration, DTO, e2e spec) only; migration-safety gate run separately (GO) |
| Full smoke suite still green (no regression) | ☒ pass | `npm test` → 24 suites / 186 tests passed, see `reports/evidence/T025/verify-session.md` |
| **UI: Visual regression** | ☒ N/A | pure-backend task |
| **UI: Design-system compliance** | ☒ N/A | pure-backend task |
| **UI: Responsiveness** | ☒ N/A | pure-backend task |

> **Evidence-archiving rule (required):** copy any external-tool artifacts into `reports/evidence/T025/` and commit — reference the repo-local path in Notes, not an external path.

---

## Approach

Per ADR-0001 (`docs/adr/0001-theme-system-token-architecture.md`):
1. Add `enum Theme { simple, dark_neon }` and `themePreference Theme @default(simple) @map("theme_preference")` to `User` in `apps/api/prisma/schema.prisma`. Run `Skill({ skill: "migration-safety" })` before merge — this is an additive column with a default, should be a trivial GO, but the gate is mandatory per Hard-Stop rules for any schema change.
2. Find the existing route that returns the logged-in user's profile (grep for the login/auth response shape actually used by the frontend — do not assume a `/auth/me` route exists; verify first) and include `themePreference` in it.
3. Add a small self-service update endpoint, e.g. `PATCH /users/me/theme` with body `{ theme: "simple" | "dark_neon" }`, validated via a DTO enum check (reuse the pattern already established for other enum query/body params — see `memory/learnings.md` "Enum query-param filters need explicit validation" from T006, same trap applies to body params).
4. No RBAC guard needed beyond "must be authenticated" — every role may set their own theme; this is not a kitchen-scoped or role-gated resource.

---

## Edge Case Checklist

- [ ] Migration is additive (`@default(simple)`) — no backfill needed, existing rows get the default automatically
- [ ] Invalid enum string in the update body is rejected with 400 via DTO validation, not an unhandled 500 (per T006 enum-validation learning)
- [ ] Endpoint never accepts a target user id — always operates on `req.user.id` from the JWT, never a caller-supplied id
- [ ] Auth/login response for a user whose row predates this migration still returns `"simple"` (verify the Prisma default actually backfills existing rows on migration, not just new rows)

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add `Theme` enum + `User.themePreference` field |
| `apps/api/prisma/migrations/<timestamp>_add_user_theme_preference/migration.sql` | Generated additive migration |
| Existing auth/user profile controller (verify actual path — likely `apps/api/src/auth/` or `apps/api/src/users/`) | Add `themePreference` to response payload; add `PATCH .../theme` endpoint |
| Corresponding DTO file | New enum-validated update DTO |
| Corresponding `*.spec.ts` | New tests per Acceptance Criteria |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| Any RBAC guard (`RolesGuard`, `@Roles` decorators) | This is not a role-gated resource — out of scope, do not add role restrictions |
| `apps/web/**` | Frontend is T026, blocked on this task's endpoint existing first |
| `RealtimeGateway` / Socket.IO handlers | No realtime dimension to a theme preference (per BRAINSTORMING_LOG_theme-system.md Surgical Scope) |

---

## Test Plan

Unit/integration tests (NestJS + existing test harness) covering all 4 Success Criteria rows above: valid update, invalid enum value, unauthenticated request, and pre-migration-default read. Run full `apps/api` suite after to confirm no regression.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] `Skill({ skill: "migration-safety" })` run — mandatory, this task adds a DB column
- [ ] Security review: not required (Low Risk) — skip per Stage 4 gating rules
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table (Hard-Stop Gate 5)
- [ ] `Skill({ skill: "verify" })` run — feature confirmed working via live API calls (curl/httpie), not just unit tests
- [ ] Any external-tool evidence copied into `reports/evidence/T025/` and committed
- [ ] `memory/MEMORY.md` updated (if new patterns or feedback learned)
- [ ] Supervisor notified: task ready for Stage 4 review
