# TASK_GUIDE — T051: Web dev server renders a blank page (`@kitchenos/shared` is CommonJS)
**Date**: 2026-10-29
**Complexity Level**: C1
**Risk Level**: Low
**Priority**: P0 (local dev of `apps/web` is impossible)
**Type**: Bug
**Assigned agent**: frontend-developer
**Agent guide**: `agents/frontend-implementer.md`
**Linear**: see KANBAN row

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md` + `memory/MEMORY.md` are its equivalent.)

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md` (entries: "REVERSED: `apps/web` depends on `@kitchenos/shared` again", "A green typecheck + green tests can't prove a dependency is declared", "Decided: monorepo commits to pnpm workspaces")
3. Read this file completely

---

## Requirement (Bug report)

**Restated intent**:
> `pnpm dev:web` must serve a working app again: an authenticated user loading any route sees the app shell, as they did before `5904b08`.

Found by the Supervisor during T044–T049 Stage 5 live verify (2026-10-29).

**Symptom**: `vite` dev server serves `index.html`, but the app never mounts — blank page. Vite log:

```
[vite] (client) [Unhandled error] SyntaxError: The requested module '/@fs/.../packages/shared/dist/index.js' does not provide an export named 'createSessionStore'
```

**Root cause (Supervisor diagnosis, to be confirmed)**: `packages/shared/tsconfig.json` compiles with `"module": "commonjs"`. Since `5904b08`, `apps/web/src/routes/auth.ts` imports `createSessionStore` from `@kitchenos/shared` at **runtime** (before, web only imported types). Vite dev serves a linked workspace package as source over `/@fs/` without pre-bundling, so the browser loads CJS as ESM and named imports fail. `vite build` (Rollup commonjs plugin) and vitest (Node) both cope, so CI, the build and all 228 web tests stay green — which is why nothing caught it.

**Out of scope**:
- Switching `packages/shared` to ESM output (the API, a Nest CJS app, consumes the same `dist`) — only do it if the vital-slice fix below proves impossible, and stop and report first.
- Mobile (Metro handles CJS).

---

## Dependencies & Reachability

**Depends on**: none
**Entry point**: `apps/web/vite.config.ts`
**Consumer**: `pnpm dev:web` / every developer and the UI-verify harness

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | With API on :3000, `vite` dev serves the app and an authenticated `/dashboard` renders the app shell (sidebar nav visible); the browser console has no `does not provide an export named` error | Symptom |
| 2 | `pnpm --filter @kitchenos/web run build` still passes and `dist` still works (`vite preview` renders the shell) | no regression |
| 3 | Full web vitest suite still passes (228) | no regression |
| 4 | A committed regression check exists that fails on the broken config: `scripts/smoke-web-dev.mjs` (or similar) starts vite dev on a free port, loads the shared session module through the dev server the way the browser does, and exits non-zero if the named export is missing. It must be shown failing on the pre-fix config and passing after | "nothing caught it" |

---

## Approach

**Vital slice**: in `apps/web/vite.config.ts`, make Vite pre-bundle the linked CJS package for dev: `optimizeDeps: { include: ['@kitchenos/shared'] }` (esbuild converts CJS→ESM). Alternative if that fails: `resolve.alias` `@kitchenos/shared` → `../../packages/shared/src/index.ts` (the same move `apps/mobile/jest.config.js` makes). Prefer the one-liner that works; record which and why.

For AC4, the cheapest real check: start `vite` programmatically (`createServer` from `vite`), request the transformed `/src/routes/auth.ts` module and the module it imports for `@kitchenos/shared`, and import it via the browser-equivalent path — or simply launch the dev server and use `fetch` on the resolved shared module URL and check it is ESM with an `export` of `createSessionStore`. Keep it a single small script; wire it as `"smoke:dev"` in `apps/web/package.json`. Don't add it to CI in this task.

**Cut list**: no ESM migration of shared, no CI change.

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/vite.config.ts` | `optimizeDeps.include` (or alias) |
| `apps/web/scripts/smoke-dev.mjs` (or `scripts/`) | regression check |
| `apps/web/package.json` | `smoke:dev` script |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `packages/shared/tsconfig.json`, `packages/shared/package.json` | API consumes the CJS build |
| `apps/api/**` | unrelated |

---

## Verification Command (exact, runnable)

```bash
pnpm --filter @kitchenos/shared run build && pnpm --filter @kitchenos/web run smoke:dev && pnpm --filter @kitchenos/web exec vitest run && pnpm --filter @kitchenos/web run build
```

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_T051.md`.

---

## Completion Checklist

- [ ] Regression check shown failing before the fix, passing after
- [ ] Implementation done
- [ ] Tests + build pass
- [ ] Supervisor notified: ready for Stage 4
