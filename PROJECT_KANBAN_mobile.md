# PROJECT_KANBAN_mobile.md — React Native / Expo scope
**Last updated**: 2026-10-29
**Branch**: `feat/react-native-migration` (`5904b08`)

> Separate board per Hard-Stop Gate 4 — `apps/mobile` is a distinct tech scope (different runtime, different deploy target) from the `apps/web` board in `PROJECT_KANBAN.md`.
> Direction locked by `RN_MIGRATION_ROADMAP.md`: **shared core + separate shells**, full-parity migration.

---

## Board

> Task line format: **Mxxx** — [title] | [agent] | C[0–3] | Risk: Low/Med/High | P[0–2]

### Done
- [x] **M011** — Mobile↔backend coverage audit: **57** routes (T042's 58 was a miscount; grep's 59 includes 2 in a comment), 35 consumed, 15 new gaps → M014–M017 + M006 widened | Supervisor | C1 | Risk: Low | P2 | Report: `docs/audits/backend-mobile-coverage_2026-10-29.md` | Linear HUN-105 | Done: 2026-10-29
- [x] **M003** — Mobile test foundation: jest-expo runner (+ `@react-native/jest-preset` ~0.86.2, `jest.setup.js` fetch stub so jest exits 0), 50 tests over `storage.ts`/`session.ts`/shared session; mutation-checked (3 mutants killed); found hydration race → M012 AC7 | qa-expert | C2 | Risk: Medium | P0 | Review: `tasks/TASK_REVIEW_M003.md` | Linear HUN-97 | Done: 2026-10-29
- [x] **M002** — Retro code + security review of the RN migration: 0 P0, 0 P1, 6 P2 (→ M012/M003), 7 P3 (→ M013); 5 focus questions answered; security verdict PASS with follow-ups | Supervisor | C2 | Risk: High | P0 | Review: `tasks/TASK_REVIEW_M002.md` | Linear HUN-96 | Done: 2026-10-29
- [x] **M001** — Monorepo committed to pnpm workspaces; clean-tree `scripts/verify-build.sh` passes; Stage 4 found and fixed a P1 (ambient Prisma client stub disabled all API type checking, `35abcdd`) | common-infrastructure | C2 | Risk: High | P0 | Evidence: `tasks/TASK_GUIDE_M001.md` | Live Render deploy still blocked (below) | Linear HUN-95 | Done: 2026-10-29

### Done (landed pre-pipeline — code exists, but unreviewed and untested)
- [x] **M000** — Expo Router scaffold + 13 screens + `apps/mobile/src/{api,apiBase,session,storage}.ts` + `packages/shared/src/session.ts` shared session store; `apps/web` repointed at the shared package | unattributed | C3 | Risk: Medium | P0 | ⚠️ **No TASK_GUIDE, no tests, no code-review, no security-review** — the whole pipeline was bypassed. Verified post-push only: mobile `tsc --noEmit` clean, web `tsc -b` clean, 199/199 web tests green. | Commit `5904b08` | Done: 2026-08-10

### Todo

**Wave A — pay down the M000 debt (must clear before new features)**

**Wave B — close the stack gap**
- [ ] **M004** — Adopt the decided server-state stack: `apps/mobile/src/api.ts` is 478 lines of hand-rolled `fetch`; the roadmap locked TanStack Query. Decide keep-vs-adopt explicitly (DDR), then apply. | frontend-developer | C3 | Risk: Medium | P1 | ⚠️ guide not yet written
- [ ] **M005** — Forms + validation: React Hook Form + Zod on mobile create/edit screens (none present today). | frontend-developer | C2 | Risk: Low | P1 | ⚠️ guide not yet written

**Wave C — remaining parity screens**
- [ ] **M006** — Settings screen + theme switcher (`PATCH /users/me/theme`); mobile has no theme handling at all, so the T025/T026 theme system is web-only. | mobile-developer | C2 | Risk: Low | P1 | Guide: `tasks/TASK_GUIDE_M006.md` | Linear HUN-100
- [ ] **M007** — Comments + @mentions (T015) on mobile — no consumer exists. | mobile-developer | C2 | Risk: Low | P1 | Guide: `tasks/TASK_GUIDE_M007.md` | Linear HUN-101
- [ ] **M008** — Notification centre (T016 bell/unread/mark-read) on mobile — no consumer exists. | mobile-developer | C1 | Risk: Low | P1 | Guide: `tasks/TASK_GUIDE_M008.md` | Linear HUN-102
- [ ] **M009** — Socket.IO realtime (T017) on mobile, including background/foreground reconnect (flagged as a risk in the roadmap). | mobile-developer | C2 | Risk: Medium | P2 | Guide: `tasks/TASK_GUIDE_M009.md` | Linear HUN-103

**Wave D — native quality pass (Roadmap Phase 4)**
- [ ] **M010** — FlashList on list-heavy screens (tasks/inventory/recipes/notes), `expo-image`, keyboard + safe-area handling, Reanimated only where it earns it. | frontend-developer | C2 | Risk: Low | P2 | ⚠️ guide not yet written


**Wave E — gaps registered by the M011 audit (`docs/audits/backend-mobile-coverage_2026-10-29.md`)**
- [ ] **M012** — Session hardening: M002 P2 findings F1–F5 (401 clears session, `apiBase` https/dev-only fallback, robust sign-out, invite token field reset, drop `expo-env.d.ts` `any` stubs) | mobile-developer | C2 | Risk: Medium | P1 | Guide: `tasks/TASK_GUIDE_M012.md` | Linear HUN-107 | 🔄 In Progress
- [ ] **M013** — M002 P3 follow-ups F7–F13 (see `tasks/TASK_REVIEW_M002.md`) | mobile-developer | C1 | Risk: Low | P3 | backlog | Linear HUN-108
- [ ] **M014** — Shift Log screen (`GET/POST /shift-logs`) — M011 gap | mobile-developer | C1 | Risk: Low | P1 | Guide: `tasks/TASK_GUIDE_M014.md` | Linear HUN-109
- [ ] **M015** — Dashboard low-stock + expiring-soon widgets (`/inventory/alerts/*`) — M011 gap | mobile-developer | C1 | Risk: Low | P1 | Guide: `tasks/TASK_GUIDE_M015.md` | Linear HUN-110
- [ ] **M016** — Recipe version history (`GET /recipes/:id/versions`) — M011 gap | mobile-developer | C1 | Risk: Low | P2 | Guide: `tasks/TASK_GUIDE_M016.md` | Linear HUN-111
- [ ] **M017** — Team management (change role / remove member) + an "I have an invite" entry on the login screen — M011 gap + reachability | mobile-developer | C2 | Risk: Medium | P1 | Guide: `tasks/TASK_GUIDE_M017.md` | Linear HUN-112
> M006 scope widened by M011: Settings also shows/renames the kitchen (`GET/PATCH /kitchens/:id`, Chef-only). CSV export is web-only by design; detail-by-id GETs are headless by design.

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
| 4 Review | ✅ M002 retro pass done 2026-10-29 |
| 5 Integration & Verify | ⬜ Not started — branch pushed, no PR |
