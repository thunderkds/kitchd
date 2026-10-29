# TASK_GUIDE — M007: Comments + @mentions on task detail
**Date**: 2026-10-29
**Complexity Level**: C2
**Risk Level**: Low
**Priority**: P1
**Assigned agent**: mobile-developer
**Board**: `PROJECT_KANBAN_mobile.md`
**Linear**: HUN-101

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md` and this file completely
2. Read `docs/audits/backend-mobile-coverage_2026-10-29.md` (route table, roles)
3. Read the web reference implementation(s) for parity: `apps/web/src/components/Comments/Comments.tsx`, `apps/web/src/components/Comments/api.ts`
4. Read the API controller/DTO for every route you call: `apps/api/src/comments/comments.controller.ts`, `dto/create-comment.dto.ts`, `entity-type.ts`
5. Mobile conventions: server state via TanStack Query (`src/queryClient.ts`, `src/queryKeys.ts` — added by M004); fetch layer `src/api.ts`; forms per M005 (`src/schemas/`) if it has landed

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> On the mobile task detail screen, users see the comment thread, post a comment (with `@localpart` mentions resolved server-side), and delete their own comments — parity with the web Comments component.

**In scope**: task detail (`app/task/[taskId].tsx`) only, since that is where web shows comments for tasks. Check `entity-type.ts`: if web also shows comments on another entity that mobile has a detail view for, add it there too.

**Out of scope**: mention autocomplete (web has none — verify), threading beyond what the API supports (single level).

---

## Dependencies & Reachability

**Depends on**: M004
**Entry point**: `apps/mobile/app/task/[taskId].tsx` (comment section)
**Consumer**: any role except Viewer may post (OACS); everyone reads

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | Task detail lists comments from `GET /comments` with the correct entity query params, newest order matching web | M007 |
| 2 | Posting calls `POST /comments`, clears the input, refreshes the list; empty/whitespace body is blocked client-side | M007 |
| 3 | Delete shown only on the caller's own comments (match web's rule) and calls `DELETE /comments/:id` | M007 |
| 4 | VIEWER sees no composer (RBAC parity with the controller's `@Roles`) | M007 |
| 5 | Tests: list render, post success + empty-body block, delete visibility rule, viewer has no composer | test-first |
| 6 | mobile test (`exit=0`) + typecheck + export pass | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/mobile test; echo "exit=$?"; pnpm --filter @kitchenos/mobile typecheck && pnpm --filter @kitchenos/mobile exec expo export --platform ios --output-dir /tmp/m007-export
```
The test command MUST print `exit=0`. Device verification is not available here (no simulator) — record as a pending human device check. If the API is running locally (`:3000`), additionally exercise the routes with `curl` and paste the responses.

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M007.md`.

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
