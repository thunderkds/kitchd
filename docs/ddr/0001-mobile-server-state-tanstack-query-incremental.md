# 0001. Mobile server state: adopt TanStack Query incrementally over the existing `api.ts`

**Status**: Accepted (decided by the Supervisor in auto mode, 2026-10-29 — ⚠ please review)
**Date**: 2026-10-29
**Deciders**: Supervisor (auto mode, user-delegated "automatic all")
**Related**: M004 · `RN_MIGRATION_ROADMAP.md` (stack: TanStack Query) · M008, M009 (consumers of cache invalidation)

---

## Context

`RN_MIGRATION_ROADMAP.md` locked TanStack Query for server state, but the landed mobile app (`5904b08`) hand-rolls everything: `apps/mobile/src/api.ts` (~480 lines of typed `request<T>()` helpers) and each of the 13 screens does its own `useEffect` + `useState` loading/error/refresh. M004 asks to decide keep-vs-adopt explicitly.

Gate: (2) surprising without context — the roadmap says one thing and the code another; (3) genuine trade-off — both options are viable. Not (1): an incremental adoption is easy to reverse screen by screen. 2-of-3 → DDR.

Mobile-specific forces: refetch on app foreground and on network regain matter far more on a phone than in a web tab; M008 (notifications) and M009 (Socket.IO realtime) both need a shared cache to invalidate, which screen-local `useState` can't offer; the web app deliberately keeps hand-rolled helpers (memory: "7 duplicated `request<T>()` helpers deliberately left un-consolidated"), so nothing forces parity.

## Decision

We will adopt `@tanstack/react-query` in `apps/mobile` **incrementally, keeping `api.ts` as the fetch layer**: `api.ts` functions become the `queryFn`/`mutationFn`s unchanged. M004 installs the client + provider (with `focusManager` wired to `AppState` and `onlineManager` left at default), introduces a `queryKeys` module, and migrates the **read paths** of the list screens (tasks, recipes, guidelines, announcements, notes, inventory, team, invites). Mutations move to `useMutation` + `invalidateQueries` on the same screens. Screens not touched keep working as they are; no big-bang rewrite.

## Alternatives Considered

| Alternative | Pros | Cons | Why not chosen |
|-------------|------|------|----------------|
| Incremental TanStack Query over existing `api.ts` | matches roadmap; foreground refetch; shared cache for M008/M009; `api.ts` untouched | new dependency; two styles coexist during migration | **Selected** |
| Keep hand-rolled `useEffect` fetching | zero new deps; matches web | no foreground refetch, no shared cache — M009 would need a bespoke event bus; contradicts the roadmap | loses the two capabilities mobile most needs |
| Full rewrite: generated hooks for every endpoint, delete `api.ts` | one style | C3 rewrite of untested, device-unverified screens in one go | too much blast radius with no device to verify on |

## Consequences

### Positive
- App foreground → stale queries refetch; M008/M009 can `invalidateQueries` instead of plumbing callbacks.
- `api.ts` and its future tests stay the single fetch layer.

### Negative (accepted trade-offs)
- Mobile and web now differ in data-fetching style; shared "server-state hooks" (roadmap) are not attempted.
- Until every screen migrates, two patterns coexist.

### Follow-up
- [ ] M004 — install + provider + read/mutation migration of the list screens
- [ ] Revisit sharing query keys/hooks with web only if web adopts TanStack Query
