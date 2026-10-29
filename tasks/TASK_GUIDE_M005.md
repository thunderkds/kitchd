# TASK_GUIDE — M005: Forms + validation (React Hook Form + Zod) on mobile
**Date**: 2026-10-29
**Complexity Level**: C2
**Risk Level**: Low
**Priority**: P1
**Assigned agent**: mobile-developer
**Board**: `PROJECT_KANBAN_mobile.md`
**Linear**: HUN-99

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` (stack: React Hook Form + Zod)
2. Read the matching web form for each screen you change (e.g. `apps/web/src/features/inventory/IngredientFormDialog.tsx`) — **validation rules must match web**, incl. the T041/T049 low-stock threshold rules
3. Read this file completely

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> The mobile create/edit forms validate input client-side with React Hook Form + Zod, showing field-level errors and never sending a request the API would reject on shape, with rules identical to the web forms.

**In scope (create/edit forms with `TextInput`)**: `app/tasks.tsx` (create), `app/recipes.tsx`, `app/guidelines.tsx`, `app/notes.tsx`, `app/announcements.tsx`, `app/inventory.tsx` (ingredient + receive stock), `app/invites.tsx`, `app/invite/accept.tsx`, `app/index.tsx` (login/signup).

**Out of scope**: new fields not already present on mobile; changing API DTOs; task detail checklist editing UX.

---

## Dependencies & Reachability

**Depends on**: M004 (mutations live in `useMutation`; forms call those)
**Entry point**: each screen's create/edit form
**Consumer**: the user filling the form

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | `react-hook-form`, `zod`, `@hookform/resolvers` added; schemas live in `apps/mobile/src/schemas/*.ts`, one per resource | stack |
| 2 | Each schema mirrors the web form's rules (required fields, numeric > 0 where web requires it, email format for invites, password min length as the API DTO requires — check `apps/api/src/**/dto`) | parity |
| 3 | Low-stock threshold: blank → no key on create / `null` on edit; `0`, negative, non-numeric rejected (T041/T049 parity) | parity |
| 4 | Invalid submit shows a field-level error and makes **zero** API calls | "never sending a request the API would reject" |
| 5 | Unit tests per schema (valid + each invalid rule) and at least one form-level test proving no mutation fires on invalid input | test-first |
| 6 | mobile test + typecheck pass | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/mobile test && pnpm --filter @kitchenos/mobile typecheck
```
Device verification not available here (no simulator) — Stage 5 relies on tests, typecheck and the `expo export` bundle smoke.

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M005.md`.

---

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/web/**`, `apps/api/**`, `packages/shared/**` | out of scope |
