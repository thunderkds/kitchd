# TASK_GUIDE — T041: Low-stock threshold is unreachable from the Ingredient form
**Date**: 2026-07-28
**Complexity Level**: C1
**Risk Level**: Low
**Priority**: P1
**Assigned agent**: frontend-developer
**Agent guide**: `.claude/agents/frontend.md`

---

## Mandatory Startup (Do Not Skip)

Before writing any code:
1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/frontend.md`
5. Note the **Complexity Level** above (C1) and apply the matching process from `.claude/agents/general-agent-template.md`

---

## Mental Model (confirmed by user, 2026-07-28)

- **Observed**: `IngredientFormDialog` collects only name, unit, costPerUnit and category. `minThreshold` is never sent, so the column stays `null`. `AlertsService#lowStock` filters `where: { minThreshold: { not: null, gt: 0 } }`, so **every ingredient created through the UI is permanently excluded from low-stock alerting**. The edit path additionally drops `category`, making it uneditable after creation.
- **Expected**: creating or editing an ingredient captures its low-stock threshold, so `AlertsService#lowStock` can compare live ledger stock against it and surface the ingredient in `LowStockWidget` and — on a false→true crossing — a T016 notification.
- **Likely divergence point**: `apps/web/src/features/inventory/IngredientFormDialog.tsx` — the input list and the two `handleSubmit` payloads. **The backend needs no change**: `Ingredient.minThreshold Float?` exists in the schema, both `CreateIngredientDto` and `UpdateIngredientDto` already carry `@IsOptional() @IsNumber() minThreshold?`, and the frontend's own `CreateIngredientInput` / `UpdateIngredientInput` types already declare the field.
- **Recent context**: not a regression — an origin defect. `git log` shows T031 (`12a0c52`, 2026-07-19) built the Inventory page without the field, and T037 (`db3eee0`) only converted the form to the shared `Dialog` (presentation-only). The defect went unnoticed because `apps/api/prisma/seed.ts` hardcodes thresholds for all 5 demo ingredients (Flour 5, Tomato 3, Mozzarella 2, Olive Oil 1, Basil 4), so the feature always appears to work on seeded data.

### Verified before dispatch — do NOT rebuild these, they are already correct

The Supervisor read both consumers on 2026-07-28. They are complete and merely starved of data:

| Consumer | State |
|---|---|
| `AlertsService#lowStock` | Correctly compares `currentStock < minThreshold`, and drives the T016 false→true notification through `syncLowStockState`. No change needed. |
| `LowStockWidget` | Already renders `currentStock unit (min minThreshold)` and flags critical rows at `currentStock <= minThreshold / 2`. No change needed. |

Your job is to make the threshold **exist**, then prove it flows through both. Do not modify either consumer.

---

## Intake

- **Trigger**: Inventory page → "New Ingredient" (or "Edit" on an existing one) → observe there is no low-stock threshold input. Save, then check `GET /inventory/alerts/low-stock`; the new ingredient never appears regardless of how low its stock goes.
- **Severity**: P1 — a shipped feature (T007 low-stock alerts + T016 low-stock notifications) is inert for all real, non-seeded data. A workaround exists (set the value via the API or seed), so it is not P0.
- **Affected area**: `apps/web/src/features/inventory/` only.

---

## Complexity & Risk

- **Complexity**: C1 — single component plus its page and tests; no new module, no schema, no RBAC surface.
- **Risk**: Low — frontend-only, no auth/permission/migration surface touched.

---

## Requirement Refs

- FR-005 / T007: low-stock threshold flag and alerting
- T016: low-stock transition notification (consumes the same threshold)

---

## Dependencies & Reachability

**Depends on**: `None` — every backend and consumer dependency already exists and is merged.

**Entry point**: `IngredientFormDialog`
> Reached from the "New Ingredient" button and each row's "Edit" control on `InventoryPage`.

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | The **create** dialog renders a low-stock threshold input, **pre-filled with `5`** and freely editable, and sends `minThreshold` in the create payload | User decision 2026-07-28 |
| 2 | The **edit** dialog renders the same input pre-filled with the ingredient's **current** `minThreshold`, and sends the changed value | Mental model — Expected |
| 3 | The **edit** payload also includes `category`, which it currently drops — editing an ingredient no longer freezes its category | Mental model — Observed |
| 4 | **End-to-end through the alert service**: an ingredient created purely through the UI, then given stock below its threshold, appears in `GET /inventory/alerts/low-stock` | User: "it should use for alert service" |
| 5 | **End-to-end through the dashboard**: that same ingredient appears in `LowStockWidget` on the Dashboard, showing `currentStock unit (min N)` | User: "and the dashboard also" |
| 6 | The Inventory list row displays the threshold alongside stock and cost, so the value is visible on the page where it is set | Supervisor finding — the set value was invisible |
| 7 | A cleared/blank threshold input is sent as **no** `minThreshold` rather than `0` or `NaN` — `0` would be silently excluded by the alert service's `gt: 0` filter, which is the same invisibility bug in a new disguise | Negative / boundary |
| 8 | A negative or non-numeric threshold is rejected client-side and no request is issued | Negative / boundary |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Open New Ingredient | Threshold input present, value `5` | automated test |
| 2 | Create with threshold left at 5 | POST body contains `minThreshold: 5` | automated test |
| 3 | Edit an ingredient with `minThreshold: 3` | Input shows `3`; changing to `7` PATCHes `minThreshold: 7` | automated test |
| 4 | Edit an ingredient that has a category | PATCH body includes `category`, value preserved | automated test |
| 5 | UI-created ingredient, stock received below threshold | Appears in `GET /inventory/alerts/low-stock` | **live verify** |
| 6 | Same ingredient, Dashboard loaded | Visible in `LowStockWidget` with `min N` | **live verify** |
| 7 | Threshold input cleared to `""`, save | Payload omits `minThreshold` entirely — not `0`, not `NaN` | automated test |
| 8 | Threshold `-2` or `abc`, save | Blocked client-side, zero network calls | automated test |

### Verification Command (exact, runnable)

```bash
cd apps/web && npx vitest run src/features/inventory && npm run build
```

> `apps/web` runs **vitest**; `apps/api` runs jest — but this task is frontend-only, so only vitest applies. `npm run build` is mandatory (`tsc -b`, T038 learning). Run it yourself; do not trust a reported pass (T016 learning).

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☐ pass / ☐ fail | [test file path(s) — required before Done] |
| Verification command run | ☐ pass / ☐ fail | [paste actual output] |
| Negative cases hold | ☐ pass / ☐ fail | [AC7 blank-not-zero, AC8 negative/non-numeric] |
| Repro loop — original symptom gone | ☐ pass / ☐ fail | [UI-created ingredient now reaches the alert endpoint] |
| verify | ☐ pass / ☐ fail | [must literally state "pass" or "fail" in this Notes cell; the merge gate scans this column, not just the Result column. No literal pipe character in this cell.] |
| Review scope bounded to the change's blast radius | ☐ pass / ☐ fail | [what was reviewed vs. skipped, and why] |
| Full smoke suite still green (no regression) | ☐ pass / ☐ fail | [expect ≥ 181 frontend] |
| **UI: Visual regression (diff or verdict pasted)** | ☐ pass / ☐ fail | [screenshot path or verdict, both themes] |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☐ pass / ☐ fail | [method used + output] |
| **UI: Responsiveness at target viewports** | ☐ pass / ☐ fail | [viewports tested, any overflow findings] |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| `IngredientFormDialog`, create and edit, both themes | screenshot + vision verdict | Threshold input matches the existing inputs' styling; label makes the unit relationship clear (it is a quantity in the ingredient's own unit) |
| `InventoryPage` row with threshold shown | screenshot | Threshold reads naturally alongside stock and cost, no wrapping mess |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Input styling | code review + computed style | Reuses the same `border rounded px-2 py-2 text-sm` pattern as the sibling inputs — no bespoke styling |
| Button colors | computed style | Any control uses `bg-accent text-white`; **never** the undefined `bg-primary` / `text-on-primary` (T033's invisible-label bug) |
| Surfaces | CSS audit | Dialog panel keeps `bg-surface-raised` from the shared `Dialog` primitive |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | screenshot | Dialog and the extended inventory row fit, no horizontal overflow |
| Tablet (768px) | screenshot | Centered, no overflow |
| Desktop (1024px+) | screenshot | Centered at max-width |

---

## Approach

Mirror the existing inputs in the same file — this is a fill-in-the-gap task, not a redesign.

1. Add a `minThreshold` state to `IngredientFormDialog`, initialised to `ingredient?.minThreshold ?? 5` so create pre-fills `5` (the user's chosen default) and edit pre-fills the stored value.
2. Render one more input in the existing `flex flex-col gap-3` stack, styled exactly like its siblings, with an `aria-label` following the file's convention (e.g. `Low stock threshold`).
3. Include `minThreshold` in **both** `handleSubmit` payloads, and add the missing `category` to the **edit** payload.
4. Add the threshold to the `InventoryPage` list row next to stock and cost.

**The default lives in the form, not the DTO.** Prefilling client-side keeps the value visible and editable at the moment of creation, requires no backend change, and avoids silently stamping `5` onto ingredients created by any other API caller. Do not add a default to `CreateIngredientDto`.

### The trap in this task (read before coding)

`Number('')` is `0`, and `AlertsService#lowStock` filters `minThreshold: { not: null, gt: 0 }` — so a blank input naively converted with `Number()` would store `0` and produce an ingredient that is *still* invisible to alerting, i.e. exactly the bug you were sent to fix, now harder to spot. Send `undefined` for a blank input, never `0`. AC7 exists to pin this down.

---

## Edge Case Checklist

- [ ] Blank threshold → payload omits the key entirely (not `0`, not `NaN`, not `null`)
- [ ] `0` typed explicitly → treat as the same "no meaningful threshold" case, or block it; do not silently store an alert-invisible value
- [ ] Negative and non-numeric input blocked client-side (backend has `@IsNumber` but no `@IsPositive` on `minThreshold`, so the client is the only guard against a negative)
- [ ] Decimal thresholds accepted — the column is `Float`, and `0.5 L` is legitimate
- [ ] Editing an ingredient whose threshold is currently `null` → input starts blank, not `5`, so a save doesn't silently invent a threshold the user never chose
- [ ] Editing preserves `category` (AC3) and does not clobber `allergens` / `supplierId`, which this form does not manage
- [ ] Threshold displays in the ingredient's own unit — 5 kg and 5 bunches are different things

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/features/inventory/IngredientFormDialog.tsx` | Add threshold state, input, and both payload fields; add missing `category` to the edit payload |
| `apps/web/src/features/inventory/InventoryPage.tsx` | Show the threshold in the list row |
| `apps/web/src/features/inventory/InventoryPage.test.tsx` | Tests for AC1–AC3, AC6–AC8 |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/**` | Schema, both DTOs, and the alert service already support this end-to-end — verified 2026-07-28 |
| `apps/api/prisma/schema.prisma` | No schema change, no migration in scope |
| `apps/api/src/inventory/alerts/alerts.service.ts` | Already correct; it is starved of data, not broken |
| `apps/web/src/components/LowStockWidget/**` | Already renders `min` correctly; consuming the fixed data requires no change |
| `apps/api/prisma/seed.ts` | Seeded thresholds masked this bug, but rewriting the seed is not the fix |

---

## Test Plan

Component tests in `InventoryPage.test.tsx` with the API module mocked, asserting the **exact** create and edit payloads — that is where the bug lives, so payload assertions are the oracle, not "the input renders".

AC4 and AC5 cannot be proven by mocked component tests: they are the whole point of the fix and must be checked live. Against the running stack (postgres + API `:3000` + web `:8766`), create an ingredient **entirely through the UI**, receive stock below its threshold, then confirm it appears in `GET /inventory/alerts/low-stock` and in the Dashboard's `LowStockWidget`. Reproduce the original symptom first on an ingredient created before the fix, so the before/after contrast is on record.

`easy-ui-mcp` is available again as of 2026-07-24 — check with `ToolSearch` first. Note `ui_assert` takes a JS expression, not prose, and a session status of "failed" may reflect harness/selector errors only, so enumerate `actions[]` before calling anything a product failure. Implementer sub-agents typically cannot reach it; Playwright with DOM assertions is the accepted substitute. Archive screenshots to `reports/evidence/T041/` and commit them — a UI change is not evidenced until those files are in the repo.

---

## Cleanup Checklist (Pillar 3)

- [ ] All `[DEBUG-...]` instrumentation removed (grep verified)
- [ ] Correct root cause stated in the commit message
- [ ] Post-mortem: what would have prevented this? (see below)

**Post-mortem seed for the reviewer**: T031's TASK_GUIDE described the Inventory page in terms of "ingredient CRUD", and no acceptance criterion tied the form's field list back to the fields T007's alert service actually consumes. A feature can be fully built on both sides and still be dead because one field never crossed the gap. Consider whether guides for a form should be required to enumerate the consumer fields the form must populate.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: not required — Risk is Low, no auth/permission/data surface touched
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table (Hard-Stop Gate 5)
- [ ] `npm run build` clean (T038 learning)
- [ ] `Skill({ skill: "verify" })` run — original symptom confirmed gone, AC4 and AC5 checked live
- [ ] Worktree changes actually **committed** — `git -C <worktree> log/status` checked (T027/T039: implementations have twice sat uncommitted while reported done)
- [ ] Supervisor notified: task ready for Stage 4 review
