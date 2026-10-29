# TASK_GUIDE — M010: Native quality pass (FlashList, keyboard, safe area)
**Date**: 2026-10-29
**Complexity Level**: C2
**Risk Level**: Low
**Priority**: P2
**Assigned agent**: mobile-developer
**Board**: `PROJECT_KANBAN_mobile.md`
**Linear**: HUN-104

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> List-heavy screens (tasks, inventory, recipes, notes) render with FlashList; every screen respects the safe area; forms are not covered by the keyboard. Reanimated only where it earns it (i.e. not in this task unless a concrete jank is shown).

**Cut list (Simplicity First)**: `expo-image` is **cut** — no screen renders remote images today (verify with `grep -rn "<Image" apps/mobile/app`; if that finds images, add it for those only). Reanimated cut.

---

## Dependencies & Reachability

**Depends on**: M004 (screens are on `useQuery` — migrate the render layer on top), M005 (forms), Wave 2 (M006–M017; dashboard already got a `ScrollView` in the Wave 2 review fix)
**Entry point**: `app/{tasks,inventory,recipes,notes}.tsx`, `app/_layout.tsx` (SafeAreaProvider)
**Consumer**: every mobile user

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | `@shopify/flash-list` (Expo-compatible version via `expo install`) renders the 4 list screens **plus the Wave 2 lists that currently cannot scroll: `app/shift-logs.tsx`, `app/notifications.tsx`, `app/team.tsx` roster (Wave 2 review P2)**; `keyExtractor` uses entity ids; `estimatedItemSize` set where the installed version requires it | FlashList |
| 2 | `react-native-safe-area-context` `SafeAreaProvider` at the root (if Expo Router doesn't already provide it — check), screens use safe-area insets/`SafeAreaView` consistently | safe area |
| 3 | Screens with forms wrap content in `KeyboardAvoidingView` (behavior `padding` on iOS, `height` on Android) or a `ScrollView` with `keyboardShouldPersistTaps="handled"` | keyboard |
| 4 | Component tests: each migrated list renders its items and empty state from mocked query data (FlashList mocked if it can't measure under jest) | test-first |
| 5 | mobile test + typecheck pass; `expo export --platform ios` bundle smoke passes | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/mobile test && pnpm --filter @kitchenos/mobile typecheck
```
Device verification not available here (no simulator) — record as pending human device check.

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M010.md`.

---

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/web/**`, `apps/api/**`, `packages/shared/**` | out of scope |
