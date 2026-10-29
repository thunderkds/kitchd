# TASK_GUIDE — M006: Settings screen — theme preference + kitchen view/rename
**Date**: 2026-10-29
**Complexity Level**: C2
**Risk Level**: Low
**Priority**: P1
**Assigned agent**: mobile-developer
**Board**: `PROJECT_KANBAN_mobile.md`
**Linear**: HUN-100

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md` and this file completely
2. Read `docs/audits/backend-mobile-coverage_2026-10-29.md` (route table, roles)
3. Read the web reference implementation(s) for parity: `apps/web/src/pages/Settings/SettingsPage.tsx`, `apps/web/src/features/kitchens/api.ts`, `apps/web/src/theme/themeMapping.ts`
4. Read the API controller/DTO for every route you call: `apps/api/src/users/users.controller.ts` (`PATCH /users/me/theme`, `dto/update-theme.dto.ts`), `apps/api/src/kitchens/kitchens.controller.ts` (`GET/PATCH /kitchens/:id`, PATCH is `@Roles(Role.CHEF)` only)
5. Mobile conventions: server state via TanStack Query (`src/queryClient.ts`, `src/queryKeys.ts` — added by M004); fetch layer `src/api.ts`; forms per M005 (`src/schemas/`) if it has landed

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> A Settings screen on mobile lets the user pick their theme preference (persisted to the account via `PATCH /users/me/theme` and applied to the app), view their kitchen name, and — if CHEF — rename the kitchen.

**In scope**: `app/settings.tsx` linked from the dashboard; theme preference applied app-wide via a small `ThemeContext` with light/dark palettes (the stored `themePreference` from login, `src/session.ts`, finally gets used); kitchen name view + CHEF-only rename.

**Out of scope / cut**: reproducing the web's full CSS-token system — mobile gets a minimal palette (background, surface, text, muted, accent, danger) only. The rename button is hidden for non-CHEF roles (API is CHEF-only — product question recorded in T048, not changed here).

---

## Dependencies & Reachability

**Depends on**: M004 (TanStack Query)
**Entry point**: `apps/mobile/app/dashboard.tsx` → link to `/settings`
**Consumer**: every signed-in mobile user (theme); CHEF (rename)

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | `app/settings.tsx` exists and the dashboard links to it | M006 |
| 2 | Choosing a theme calls `PATCH /users/me/theme` with a value accepted by `update-theme.dto.ts`, updates the stored user, and re-renders screens with the new palette; failure shows an error and keeps the old value | M006 |
| 3 | `ThemeContext` maps the stored preference (incl. `system` → `useColorScheme()` if the DTO allows `system`) to a palette; at least dashboard + settings + one list screen use it | M006 |
| 4 | Kitchen name loads from `GET /kitchens/:id`; rename (CHEF only) calls `PATCH /kitchens/:id`, invalidates the kitchen query; non-CHEF sees no rename control | M006 |
| 5 | Tests: theme mapping, theme mutation success + failure, rename control hidden for non-CHEF, rename invalidates the query | test-first |
| 6 | mobile test (`exit=0`) + typecheck + export pass | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/mobile test; echo "exit=$?"; pnpm --filter @kitchenos/mobile typecheck && pnpm --filter @kitchenos/mobile exec expo export --platform ios --output-dir /tmp/m006-export
```
The test command MUST print `exit=0`. Device verification is not available here (no simulator) — record as a pending human device check. If the API is running locally (`:3000`), additionally exercise the routes with `curl` and paste the responses.

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M006.md`.

---

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/**`, `apps/web/**`, `packages/shared/**` | out of scope — mobile consumer only; if the API is missing something, STOP and report |

---

## Completion Checklist

- [ ] Tests first (paste failing output)
- [ ] Verification command passes (`exit=0`, typecheck, export)
- [ ] Supervisor notified: ready for Stage 4
