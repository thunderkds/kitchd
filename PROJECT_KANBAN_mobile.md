# PROJECT_KANBAN_mobile.md — React Native / Expo scope
**Last updated**: 2026-08-10
**Branch**: `feat/react-native-migration` (`5904b08`)

> Separate board per Hard-Stop Gate 4 — `apps/mobile` is a distinct tech scope (different runtime, different deploy target) from the `apps/web` board in `PROJECT_KANBAN.md`.
> Direction locked by `RN_MIGRATION_ROADMAP.md`: **shared core + separate shells**, full-parity migration.

---

## Board

> Task line format: **Mxxx** — [title] | [agent] | C[0–3] | Risk: Low/Med/High | P[0–2]

### Done (landed pre-pipeline — code exists, but unreviewed and untested)
- [x] **M000** — Expo Router scaffold + 13 screens + `apps/mobile/src/{api,apiBase,session,storage}.ts` + `packages/shared/src/session.ts` shared session store; `apps/web` repointed at the shared package | unattributed | C3 | Risk: Medium | P0 | ⚠️ **No TASK_GUIDE, no tests, no code-review, no security-review** — the whole pipeline was bypassed. Verified post-push only: mobile `tsc --noEmit` clean, web `tsc -b` clean, 199/199 web tests green. | Commit `5904b08` | Done: 2026-08-10

### Todo

**Wave A — pay down the M000 debt (must clear before new features)**
- [ ] **M001** — Deploy-regression fix: `apps/web` now depends on `@kitchenos/shared` again (reversing the 2026-07-06 standalone-deploy decision) and `npm install --include=dev` was dropped from both `apps/api` and `apps/web` build scripts (that flag was the fix for Render deploy failure #1). Restore a working Render build for both services, or formally re-decide the deploy model. | common-infrastructure | C2 | Risk: **High** | **P0** | ⚠️ guide not yet written
- [ ] **M002** — Retro code-review + security-review of the whole `5904b08` diff, with the auth/session boundary as the focus (token now in `expo-secure-store` with an in-memory cache; `sessionReady` hydration race on cold start). | Supervisor | C2 | Risk: **High** | **P0** | ⚠️ guide not yet written
- [ ] **M003** — Test foundation for `apps/mobile`: pick and wire a runner (jest-expo vs vitest — `apps/api` is jest, `apps/web` is vitest, so neither default is automatic), then cover `src/session.ts`, `src/storage.ts`, and `packages/shared/src/session.ts`. Zero tests exist in `apps/mobile` today. | qa-expert | C2 | Risk: Medium | P0 | ⚠️ guide not yet written

**Wave B — close the stack gap**
- [ ] **M004** — Adopt the decided server-state stack: `apps/mobile/src/api.ts` is 478 lines of hand-rolled `fetch`; the roadmap locked TanStack Query. Decide keep-vs-adopt explicitly (DDR), then apply. | frontend-developer | C3 | Risk: Medium | P1 | ⚠️ guide not yet written
- [ ] **M005** — Forms + validation: React Hook Form + Zod on mobile create/edit screens (none present today). | frontend-developer | C2 | Risk: Low | P1 | ⚠️ guide not yet written

**Wave C — remaining parity screens**
- [ ] **M006** — Settings screen + theme switcher (`PATCH /users/me/theme`); mobile has no theme handling at all, so the T025/T026 theme system is web-only. | frontend-developer | C2 | Risk: Low | P1 | ⚠️ guide not yet written
- [ ] **M007** — Comments + @mentions (T015) on mobile — no consumer exists. | frontend-developer | C2 | Risk: Low | P1 | ⚠️ guide not yet written
- [ ] **M008** — Notification centre (T016 bell/unread/mark-read) on mobile — no consumer exists. | frontend-developer | C1 | Risk: Low | P1 | ⚠️ guide not yet written
- [ ] **M009** — Socket.IO realtime (T017) on mobile, including background/foreground reconnect (flagged as a risk in the roadmap). | frontend-developer | C2 | Risk: Medium | P2 | ⚠️ guide not yet written

**Wave D — native quality pass (Roadmap Phase 4)**
- [ ] **M010** — FlashList on list-heavy screens (tasks/inventory/recipes/notes), `expo-image`, keyboard + safe-area handling, Reanimated only where it earns it. | frontend-developer | C2 | Risk: Low | P2 | ⚠️ guide not yet written
- [ ] **M011** — Mobile↔backend coverage audit, the `apps/mobile` equivalent of T042: enumerate all 58 backend routes against mobile consumers. | Supervisor | C1 | Risk: Low | P2 | ⚠️ guide not yet written

### In Progress

### Ready for Review

---

## Blocked

| Task | Reason | Waiting on |
|------|--------|-----------|
| M001 verification | Cannot confirm the deploy model is actually fixed without a real Render build | Human: the same Render service/secret setup still blocking T023 on the web board |

---

## Stage Tracker

| Stage | Status |
|-------|--------|
| 0.5 Brainstorming | ✅ Done — `BRAINSTORMING_LOG_react-native-migration.md`, direction locked in `RN_MIGRATION_ROADMAP.md` |
| 1 Environment Setup | ⚠️ Partial — pnpm workspace wired, Expo boots; no mobile test runner, no `memory/codebase-map.md` |
| 1.5 Sub-Agent Architecture | ⬜ Not started — no mobile-specific agent exists; base team may suffice |
| 2 Planning (/plan) | 🔄 In Progress — this board is the first pass; no TASK_GUIDEs written yet |
| 3 Execution | ⚠️ Out of order — M000 shipped code before Stages 2–4 ran |
| 4 Review | ⬜ Not started — M002 is the retro pass |
| 5 Integration & Verify | ⬜ Not started — branch pushed, no PR |
