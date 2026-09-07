# BRAINSTORMING_LOG.md
**Generated**: 2026-09-07
**Task / Context**: T044 Shift Log page + sidebar entry
**Skill**: `Skill({ skill: "brainstorming" })`

---

## The Problem Space

The backend already exposes a kitchen-scoped Shift Log feed and a write endpoint, but the web app has no route or navigation surface that reaches either. The fix has to do two things at once: make the feed discoverable from the sidebar and present a small, readable page that lets non-Viewer users author shift handoffs without leaving the app shell.

Constraints that are non-negotiable:
- Keep the kitchen-scoped controller contract intact.
- Preserve the existing role split: Viewer reads only, everyone else may write.
- Avoid speculative filters, analytics, or a second page for the same feed.
- Reuse the app's existing list + modal form patterns rather than inventing a new shell.

## Questions for the User

None. The scope is sufficiently clear from the audit and existing backend contract.

## Alternative Paths

| Option | Name | Summary | Invasiveness | Code Volume | Regression Risk | Recommended? |
|--------|------|---------|-------------|------------|----------------|--------------|
| A | Inline list page | Add a bare Shift Logs page with a feed list and a modal create form, then wire nav + route. | Low | ~250 lines | Low | |
| B | Page + shared API/types | Add a dedicated page, typed API helpers, and a small shared form/list section with explicit viewer gating. | Medium | ~320 lines | Low | ✅ Yes |
| C | Generic activity shell | Build a reusable "activity feed" abstraction and plug Shift Logs into it for future reuse. | High | ~500+ lines | Medium | |

### Option A — Inline list page
**Approach**: Create a single page component that fetches `/shift-logs`, renders rows, and opens a dialog for POSTing new entries.
**Pros**:
- Smallest useful surface.
- Easy to test.
- Matches existing page patterns.
**Cons**:
- The page ends up carrying all shift-log-specific fetch and formatting logic inline.
- Harder to reuse if a future task needs the same data shape.
**Why it might fail**:
- It can drift into a one-off tangle if the list and create logic grow separately.

### Option B — Page + shared API/types
**Approach**: Add `api.ts` + `types.ts`, then a dedicated `ShiftLogsPage` that owns fetch/render/create state and uses the shared `Dialog` modal pattern.
**Pros**:
- Keeps the backend contract explicit.
- Easy to test and reason about.
- Clean separation between data shape and UI.
**Cons**:
- A bit more code than the bare inline version.
- Requires touching navigation and route wiring too.
**Why it might fail**:
- If the page tries to solve filtering/history/reply threads all at once, it will outgrow the task quickly.

### Option C — Generic activity shell
**Approach**: Build a reusable feed abstraction and plug Shift Logs into it as the first consumer.
**Pros**:
- Potential future reuse.
- Could reduce duplication if more feed-style screens arrive.
**Cons**:
- Highest code volume.
- Introduces an abstraction before there is a second real consumer.
**Why it might fail**:
- This would almost certainly overfit to future unknowns and slow the current task down.

## 50% Rule Check

The same business goal can be reached with roughly half the code by skipping the abstraction layer entirely:
- one `ShiftLogsPage`
- one `api.ts`
- one `types.ts`
- one nav entry
- one route mapping

That is enough to make the feature reachable and shippable without inventing a shared feed framework.

## Recommended Path

**Option B — Page + shared API/types**

This is the safest path because it keeps the UI small, keeps the API contract typed, and avoids over-abstracting the first shift-log consumer.

## Surgical Scope

Files that **should** be touched:
- `apps/web/src/features/shift-logs/api.ts` - authenticated list/create helpers
- `apps/web/src/features/shift-logs/types.ts` - ShiftLog type
- `apps/web/src/features/shift-logs/ShiftLogsPage.tsx` - page UI
- `apps/web/src/features/shift-logs/ShiftLogsPage.test.tsx` - list/create/viewer gating
- `apps/web/src/features/shift-logs/api.test.tsx` - helper behavior
- `apps/web/src/layout/navigation.ts` - add nav item
- `apps/web/src/App.tsx` - add route
- `apps/web/src/layout/navigation.test.tsx` - confirm nav entry

Files that **must not** be touched:
- `apps/api/src/shift-logs/*` - backend contract is already complete
- `PRD.md` - protected source-of-truth

## Edge Case Checklist for TASK_GUIDE

- [ ] Empty feed renders a clean empty state.
- [ ] Viewer sees the page but no create control.
- [ ] POST rejects missing/invalid shift values client-side before any network call.
- [ ] New entries appear newest-first without a reload.

## Next Actions

1. Add the task guide and mark T044 in progress on the board.
2. Write the API/page/navigation tests first, then implement the page and route wiring.

## User Selection

> **Approved direction**: Option B — Page + shared API/types
> Approved by user on 2026-09-07.
