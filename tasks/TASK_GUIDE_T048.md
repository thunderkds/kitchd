# TASK_GUIDE — T048: Kitchen rename in Settings
**Date**: 2026-09-07
**Complexity Level**: C0
**Risk Level**: Low
**Priority**: P2
**Assigned agent**: frontend-developer
**Agent guide**: `.claude/agents/frontend.md`

---

## Mandatory Startup (Do Not Skip)

Before writing any code:
1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/frontend.md`
5. Note the **Complexity Level** above and apply the matching process from the role guide
6. This task is C0 and touches a single known UI surface, so `memory/codebase-map.md` is optional

---

## Requirement (Pillar 1 - Adapt the requirement)

Origin: `docs/audits/backend-frontend-coverage_2026-07-28.md`, finding F6.

**Restated intent**:
> An authenticated user can open Settings, see the current kitchen name, and rename the kitchen from that page using the existing `GET /kitchens/:id` and `PATCH /kitchens/:id` backend contract.

**Out of scope**:
- No kitchen creation flow
- No organization rename
- No backend contract changes unless a build/test failure proves the current frontend assumption wrong

**Requirement Refs**:
- Audit F6: kitchen rename has no UI

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [x] Restated intent confirmed to match the request
- [x] Domain terms align with `PROJECT_SPEC.md`
- [x] Every Acceptance Criterion below traces to the Requirement
- [x] All Requirement Refs exist in the audit and are covered by the Acceptance Criteria below

---

## Dependencies & Reachability

**Depends on**: None

**Entry point**: `/settings`

**Consumer**: `SettingsPage` kitchen-name card and save control

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Settings loads the current kitchen name from `GET /kitchens/:id` and renders it in the kitchen section | "see the current kitchen name" |
| 2 | A role-allowed caller can edit the name and save it through `PATCH /kitchens/:id`, and the displayed value updates on success | "rename the kitchen from that page" |
| 3 | A non-editable state does not send a rename request, and an empty name is blocked client-side | avoid broken or unsafe edits |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Logged-in user opens `/settings` | Current kitchen name appears after the fetch resolves | automated test |
| 2 | Editable caller changes the kitchen name and submits | `PATCH /kitchens/:id` is called and the UI shows the updated name | automated test |
| 3 | Empty name or read-only caller | No rename request is sent | automated test |

### Verification Command (exact, runnable)

```bash
pnpm --filter @kitchenos/web exec vitest run src/pages/Settings/SettingsPage.test.tsx && pnpm --filter @kitchenos/web run build
```

### Evidence (filled by reviewer at Stage 4/5)

> Moved.

---

## Demonstration

> Moved. See `tasks/TASK_REVIEW_T048.md`.

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| `SettingsPage` kitchen section | screenshot / browser check | Current name, edit control, and save state render cleanly beside the theme section |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | code review + screenshot | Uses existing semantic tokens (`bg-surface-raised`, `text-primary`, `text-muted`, `bg-accent`) |
| Typography matches spec | screenshot | Reuses the existing Settings page text scale and weight conventions |
| Spacing / layout matches spec | screenshot | Card and form spacing match the repo's existing form sections |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320-480px) | screenshot | Kitchen name card stacks without horizontal overflow |
| Tablet (768px) | screenshot | Section remains centered and readable |
| Desktop (1024px+) | screenshot | Settings page keeps a compact max-width card layout |

---

## Approach

**Pattern reference**: `apps/web/src/pages/Settings/SettingsPage.tsx` and `apps/web/src/features/team/TeamPage.tsx`

**Vital slice**: current kitchen load + rename submit on the Settings page

**Cut list**:
- No organization rename
- No new settings tabs
- No backend schema or role-policy changes

Use the same API request shape as the existing feature clients: authenticated JSON fetch, shared error dialog on request failure, and optimistic UI only where it does not hide an error.

---

## Edge Case Checklist

- [ ] Kitchen fetch fails
- [ ] Kitchen name is empty or whitespace
- [ ] Read-only caller cannot submit a rename
- [ ] Save fails and the previous name is restored

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/pages/Settings/SettingsPage.tsx` | Add kitchen-name load/edit UI |
| `apps/web/src/pages/Settings/SettingsPage.test.tsx` | Cover load, edit, and blocked-submit cases |
| `apps/web/src/features/kitchens/api.ts` | Add `GET`/`PATCH` helpers for the kitchen endpoint |
| `PROJECT_KANBAN.md` | Move T048 into In Progress |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/src/kitchens/*` | Backend contract already exists and is out of scope |
| `PRD.md` | Protected source-of-truth product doc |

---

## Test Plan

1. Run the targeted SettingsPage vitest file.
2. Run the web build to catch TS or bundling regressions.
3. If the browser harness is available, open `/settings` and confirm the kitchen card renders cleanly.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Tests written AND pass
- [ ] `npm run build` / web build passes
- [ ] Supervisor notified: task ready for Stage 4 review
