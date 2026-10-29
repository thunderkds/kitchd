# Security review — `feat/m001-pnpm-workspace` vs `develop` (2026-10-29)

Skill: `security-review` (Supervisor-invoked; independent read-only reviewer sub-task). Scope: `git diff develop...HEAD`, 70 files (lockfile/docs/reports excluded). Covers M001 (High), M002 (High), T050 (Medium) and T044–T051.

**Result: No findings** at the ≥8/10 confidence bar.

Hardening notes (below the bar, not vulnerabilities): `apps/api/scripts/prisma-generate.cjs` copies the Prisma cache into a shared `/tmp/.cache/prisma` (prefer `fs.mkdtemp`); `apps/mobile/src/apiBase.ts` dev fallback → tracked as M012/F2.

Areas checked: CI (`pull_request`, no untrusted interpolation), deploy-staging (push-to-staging + ref guard), render.yaml/verify-build.sh, prisma-generate.cjs (fixed argv, no shell), bcrypt test mock (Jest-only), shared session store (behaviour-preserving move), mobile storage (SecureStore, no token logging, full logout clear), mobile api.ts (token only to API_BASE, URLSearchParams), invite deep link (prefill only), web features (React-rendered, server-side RBAC), CSV Blob download.
