# TASK_REVIEW — M010: Native quality pass (FlashList, keyboard, safe area)

> Sibling of `tasks/TASK_GUIDE_M010.md`. Filled by the Supervisor, 2026-10-29. Commits `c7b1811` (task/M010), merge of feat `7a19917`, review fixes `194d55e`. Reviewer: independent qa-expert (mutations run in `git archive` copies).

## Decisions (normal mode — user granted merge/push authority; not `[auto]`)

1. No `extraData` on the tasks/inventory/notes rows — FACT: FlashList 2.0.2 `ViewHolder` memo compares `renderItem` identity (`dist/recyclerview/ViewHolder.js:64-77`); inline `renderItem` re-renders visible rows on every parent render (runtime-verified by reviewer)
2. List header is a stable JSX element (`ListHeaderComponent={header}`), not a component — FACT: `getValidComponent` passes elements through; mutation `() => header` now caught on all 7 screens
3. `SafeAreaProvider` not added — FACT: Expo Router's `ExpoRoot` provides it; root `Stack` has `headerShown:false`, so no double inset
4. `react-native-safe-area-context ~5.7.0`, `@shopify/flash-list 2.0.2` — FACT: both match `expo/bundledNativeModules.json` (expo 57.0.10)
5. Rounded card removed from list screens (flat, 24px padding) — SAFER OPTION: a card wrapper around a virtualised list would clip/nest scroll ⚠ decided for you — please review on device
6. `expo-image`, Reanimated cut — RULE: guide Cut list (no remote images; no shown jank)
Checks: review — pass (0 P0/P1; 2 P2 + 2 P3 fixed in `194d55e`); mutations: header remount ×7 caught, key-by-index caught, KAV `behavior` removal caught
Not done: device check (keyboard on Android edge-to-edge `height`, insets, recycling, flat look); process note — fix agent listed `agents/` but did not read the `mobile-developer.md` body (test-only change, no impact)

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/mobile/src/{tasksScreen,inventoryScreen,recipeVersions,notesScreen,shiftLogsScreen,notificationsScreen,teamScreen,screenFrame}.test.tsx` — pass |
| Verification command run | ☒ pass | `194d55e`: mobile 46 suites / 447 tests exit 0; typecheck exit 0; `expo export --platform ios` exit 0 (1368 modules, 3.8 MB hbc) — pass |
| Negative cases hold | ☒ pass | empty state per list; header-remount, index-key and KAV mutants killed — pass |
| verify | ☒ pass | No simulator: tests + typecheck + bundle export; device check pending — pass |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | 7 list screens, `ScreenFrame.tsx`, `jest.setup.js`, lockfile; M004/M005/M007/M015/M016/M017 behaviour confirmed preserved — pass |
| Full smoke suite still green (no regression) | ☒ pass | mobile 447/447; API jest spot-check after lockfile change pass — pass |
| **Companion score (easy-verifier)** | ☑ N/A | not run — N/A |
| **UI: Visual regression (diff or verdict pasted)** | ☒ pass | strings unchanged; card container removed on list screens (Decision 5, device confirm) — pass |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☑ N/A | no palette change — N/A |
| **UI: Responsiveness at target viewports** | ☑ N/A | no device — N/A |

## Demonstration

**BEFORE**: Lists rendered with `.map` inside a ScrollView or a bare View (shift-logs, notifications, team could not scroll); no safe-area handling; keyboard covered forms.

**AFTER**: 7 lists on FlashList keyed by entity id; every screen in `ScreenFrame` (SafeAreaView + KeyboardAvoidingView, iOS padding / Android height); forms live in a stable list header.

**DELTA**: Long lists virtualise and scroll on every list screen; content respects notches and the keyboard.

**WITNESS**: Supervisor (main session), 2026-10-29.
