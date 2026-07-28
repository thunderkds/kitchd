# TASK_GUIDE — T043: Invite acceptance — team onboarding is impossible today
**Date**: 2026-07-28
**Complexity Level**: C2
**Risk Level**: Medium
**Priority**: P0
**Assigned agent**: frontend-developer
**Agent guide**: `.claude/agents/frontend.md`

---

## Mandatory Startup (Do Not Skip)

Before writing any code:
1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/frontend.md`
5. Note the **Complexity Level** above (C2) and apply the matching process from `.claude/agents/general-agent-template.md`
6. **C2 — required**: read `memory/codebase-map.md`
7. Read `docs/audits/backend-frontend-coverage_2026-07-28.md` finding **F1** — this task is that finding

---

## Requirement (Pillar 1 — Adapt the requirement)

Origin: T042's backend↔frontend coverage audit, finding F1. Highest-severity item on the board.

**Restated intent** (Supervisor's interpretation, in the project's domain language):
> An Owner or Admin can invite someone to their kitchen and hand them a link. The invitee opens that
> link, sets a password, and lands **in the inviting kitchen with the granted role** — logged in and
> ready to work. Today this is impossible end to end, so every role beyond the founding Owner
> (Chef, Staff, Viewer) is unreachable in practice.

**The flow is broken at BOTH ends. Fixing only one leaves onboarding impossible.**

1. **The token never reaches the invitee.** There is **no mailer anywhere in this project** — no
   nodemailer, no SendGrid, no SMTP config. `UsersService.invite()` mints a 32-byte token and
   returns it to the Owner's browser; `TeamPage.handleInvite` discards it and shows
   `Invite sent to {email}`. **That message is false** — nothing was sent and nothing can be.
2. **The invitee has nowhere to land.** `POST /users/invite/accept` has no frontend caller and
   `App.tsx` declares no public invite route; `/login` is the only public route.

**The silent-harm case that makes this P0, not P1**: an invitee who receives an invite out-of-band
and does the obvious thing — go to the app and "sign up" — hits `LoginPage`'s signup mode, which
posts to `/auth/signup`. Per T001 that creates a **brand-new organization and kitchen**. They land
in their own empty tenant, see a working app, and believe they joined. No error is shown. Their
pending invite sits unused until it expires.

**Delivery decision (user, 2026-07-28)**: **copy-link, no email.** The Owner copies the link and
sends it themselves via Slack/WhatsApp/SMS. No mail infrastructure, no new env vars, no deploy
change. Real email delivery is explicitly **not** in scope and remains unbuilt.

**Out of scope**
- **No mailer, no SMTP/SendGrid integration, no email templates.** Out-of-band delivery is the decision.
- No change to `/auth/signup` semantics — creating a new org+kitchen is correct for a genuinely new customer. This task makes the *invite* path exist alongside it; it does not alter signup.
- No change to `roles.guard.ts`, `RolesGuard`, or any RBAC rule.
- No backend change at all — see the verified contract below.
- No password-reset or forgot-password flow. Adjacent and also missing, but a separate task.
- Do not attempt to fix the "deactivated user's JWT stays valid until expiry" gap tracked since T027.

**Requirement Refs**
- FR-018: role-based permissions — unreachable today for every role except the founding Owner
- US-015 / FR-026: team management (T027/T028 built the Owner's half; this is the invitee's half)

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [x] Restated intent confirmed to match the request (Supervisor — derived from the T042 audit and confirmed against live code on 2026-07-28)
- [x] Domain terms align with the glossary (Organization, Kitchen, User, Invite, Role)
- [x] Every Acceptance Criterion below traces to a line in the Requirement
- [x] All Requirement Refs exist in `PRD.md` and are covered by the Acceptance Criteria

---

## Dependencies & Reachability

**Depends on**: `None` — the backend has been complete since T002, with expiry added T003 and revocation T027.

**Entry point**: `/invite/accept`
> A public route in `App.tsx`, reached from the copyable link shown on `TeamPage`.

**Consumer**: `AcceptInvitePage` (invitee side) and the copy-link control on `TeamPage` (Owner side).
> Both halves are required for the feature to be reachable — see the two-ended break above.

---

## Verified backend contract (read 2026-07-28 — do NOT change any of this)

`POST /users/invite/accept` is **public**: it has no `@UseGuards`, correctly, since the invitee has no
account yet. `AcceptInviteDto` is exactly:

```ts
{ token: string;  password: string /* @MinLength(8) */ }
```

`UsersService.acceptInvite` already handles every edge case this page can hit:

| Condition | Backend behaviour |
|---|---|
| Token unknown, or status ≠ `PENDING` (already used / revoked) | `404 Invite not found or already used` |
| Token expired (`expiresAt` past) | **also** `404`, deliberately identical — do not surface a distinct "expired" message from the API response, it would leak whether an invite ever existed for that email |
| An account already exists for the invite's email | `409 An account already exists for this email` |
| Success | `AuthResult`: `{ accessToken, user: { id, email, organizationId, kitchenId, role, themePreference } }` — the user is created inside a transaction, already attached to the inviting kitchen with the granted role |

The response is the **same shape `LoginPage` already consumes**, so session establishment is a
copy of what that page does on success — see the Approach.

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | After inviting, the Owner sees a **copyable invite link** containing the token, and a copy control that puts it on the clipboard | "the token never reaches the invitee" |
| 2 | Each **pending** invite row on `TeamPage` also exposes its link, so an Owner can retrieve it later without re-inviting | Same — a one-shot message would be lost on reload |
| 3 | The success message no longer claims an email was sent; it states the link must be shared | The current message is false |
| 4 | `/invite/accept?token=…` is reachable **without being logged in** and is not intercepted by `AuthGuard` | "nowhere to land" |
| 5 | Submitting a valid token + password ≥8 chars logs the invitee in and lands them on the dashboard **in the inviting kitchen with the invited role** — verified against the API, not just the UI | Restated intent |
| 6 | An invalid, already-used, revoked or expired token shows a clear failure and does **not** create an account | Negative — backend returns 404 for all of these |
| 7 | An email that already has an account shows the 409 message and does not silently create a second account | Negative |
| 8 | A password under 8 characters is blocked client-side with no network call | Negative / boundary — mirrors `@MinLength(8)` |
| 9 | Visiting `/invite/accept` with **no** token, or an empty one, shows a sensible message rather than a blank page or a crash | Negative / boundary |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given | Expect | How it's checked |
|---|-------|--------|------------------|
| 1 | Owner invites `newchef@example.com` as CHEF | Link containing the token is rendered and copyable | automated test |
| 2 | Owner reloads TeamPage | The pending invite's link is still retrievable | automated test |
| 3 | Logged-out visitor opens the link | Accept form renders, no redirect to `/login` | automated test + **live** |
| 4 | Valid token, password `Password123!` | `POST /users/invite/accept` 200, session stored, redirect to dashboard | automated test + **live** |
| 5 | Same flow, then `GET /tasks` as that user | Returns the **inviting kitchen's** data with the granted role — proves correct tenant | **live verify (required)** |
| 6 | Reusing the same token a second time | 404 shown, no second account | automated test + **live** |
| 7 | Password `short` | Blocked client-side, zero network calls | automated test |
| 8 | `/invite/accept` with no token param | Clear message, no crash | automated test |

### Verification Command (exact, runnable)

```bash
cd apps/web && npx vitest run src/routes src/features/team && npm run build
```

> `apps/web` runs **vitest** (`apps/api` runs jest, but no backend change is in scope). `npm run build` is mandatory (`tsc -b`, T038 learning). Run it yourself — do not trust a reported pass (T016 learning).

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☐ pass / ☐ fail | [test file path(s) — required before Done] |
| Verification command run | ☐ pass / ☐ fail | [paste actual output] |
| Negative cases hold | ☐ pass / ☐ fail | [AC6 reused/expired token, AC7 duplicate email, AC8 short password, AC9 missing token] |
| Original symptom gone — onboarding possible end to end | ☐ pass / ☐ fail | [invitee reaches the INVITING kitchen, not a new tenant] |
| verify | ☐ pass / ☐ fail | [must literally state "pass" or "fail" in this Notes cell; the merge gate scans this column, not just the Result column. No literal pipe character in this cell.] |
| Review scope bounded to the change's blast radius | ☐ pass / ☐ fail | [what was reviewed vs. skipped, and why] |
| Full smoke suite still green (no regression) | ☐ pass / ☐ fail | [expect ≥ 187 frontend] |
| **UI: Visual regression (diff or verdict pasted)** | ☐ pass / ☐ fail | [accept page + TeamPage link control, BOTH themes — verify the theme actually switched, see below] |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☐ pass / ☐ fail | [method used + output] |
| **UI: Responsiveness at target viewports** | ☐ pass / ☐ fail | [viewports tested, any overflow findings] |

> ⚠️ **UI evidence warning, from T041 one day ago**: that task's "both themes" screenshots were two
> captures of the *same* theme, mislabelled, because `ThemeProvider` re-syncs from the account
> preference on mount and a pre-mount theme set silently reverts. Set `data-theme` on
> `document.documentElement` **after** mount, and assert the computed `--color-accent` inside the
> capture script (`#9333ea` simple, `#d51944` dark-neon). Do not judge the theme by eye.
>
> Note the accept page is reached **logged out**, so there is no account theme preference at all —
> state which theme it renders in for an anonymous visitor and confirm it is legible.

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| `AcceptInvitePage`, both themes | screenshot + computed-token assertion | Matches `LoginPage`'s visual language — this is the app's second first-impression surface |
| `TeamPage` invite-link control | screenshot | Link is readable and does not overflow its row; long tokens must not break the layout |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | computed style | Submit uses `bg-accent text-white` — **never** the undefined `bg-primary`/`text-on-primary` (T033's invisible-label bug) |
| Surfaces | CSS audit | Card/panel carries `bg-surface-raised` (T026 gap learning) |
| Form styling | code review | Reuses `LoginPage`'s input conventions rather than inventing new ones |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | screenshot | Form and the (long) link fit with no horizontal overflow — most invitees will open this on a phone |
| Tablet (768px) | screenshot | Centered, no overflow |
| Desktop (1024px+) | screenshot | Centered at max-width |

---

## Approach

Two halves. Either alone leaves the feature unreachable, so both are in scope.

### Half A — Owner side (`apps/web/src/features/team/`)

The `Invite` type **already carries `token`**, and both `POST /users/invite` and
`GET /users/invites` already return it — no API or type change needed.

1. Build the link as `${window.location.origin}/invite/accept?token=${invite.token}`.
2. After a successful invite, show that link with a copy control instead of the current
   `Invite sent to {email}`. Rewrite the message to state the truth: the link must be shared
   manually. **Do not leave a message claiming an email was sent** (AC3).
3. Show the same link on each **pending** invite row (AC2) — a one-shot success message is lost on
   reload, which would strand the Owner with an un-deliverable invite.
4. Use the Clipboard API with a graceful fallback (a selectable `<input readonly>` is fine) — it is
   unavailable in some browsers and on insecure origins. Never let a failed copy look like success.

### Half B — invitee side

1. `apps/web/src/routes/pages/AcceptInvitePage.tsx` — read `token` from the query string
   (`useSearchParams`), render a password field plus confirm, POST to `/users/invite/accept`.
2. Register it in `App.tsx` as a **public** route next to `/login`, i.e. **outside** the
   `AuthGuard`-wrapped block. Verify a logged-out visit actually renders it (AC4) — this is the
   single most likely thing to get wrong.
3. On success, establish the session exactly the way `LoginPage` does at lines 57-59 —
   `setToken(data.accessToken)`, then
   `setUser({ ...data.user, themePreference: apiThemeToId(data.user.themePreference) })`, then
   `navigate('/dashboard', { replace: true })`. **Reuse that mapping.** `themePreference` crosses the
   snake_case↔kebab-case boundary and `themeMapping.ts` is the only place allowed to translate it;
   skipping `apiThemeToId` here would store a malformed preference.
4. Surface the backend's messages for 404 and 409 rather than inventing your own wording, and do not
   try to distinguish expired from invalid — the backend collapses them deliberately.

---

## Edge Case Checklist

- [ ] Logged-out visit to `/invite/accept?token=…` renders the form — not an `AuthGuard` redirect to `/login`
- [ ] Visiting while **already logged in as someone else** — decide and test the behaviour; silently accepting into a second kitchen while a stale session is active is the exact confusion this task exists to remove
- [ ] Missing / empty / malformed `token` query param → clear message, no crash, no request
- [ ] Reused or revoked token → 404 surfaced, no account created
- [ ] Expired token → also 404; do **not** claim "expired", the backend deliberately does not distinguish
- [ ] Duplicate email → 409 surfaced clearly
- [ ] Password < 8 chars blocked client-side; confirm-password mismatch blocked
- [ ] Double-submit / rapid double-click does not fire two POSTs (the second would 404 and read as an error after a success)
- [ ] Clipboard API absent or blocked on an insecure origin → fallback works, no false "Copied!"
- [ ] Long token does not overflow the TeamPage row at 320px
- [ ] The token appears in a URL — do not additionally log it to the console or to any error report

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/routes/pages/AcceptInvitePage.tsx` | **New** — public accept form |
| `apps/web/src/App.tsx` | Register `/invite/accept` as a public route, outside `AuthGuard` |
| `apps/web/src/features/team/api.ts` | Add `acceptInvite(token, password)` via the existing `request<T>()` helper (T029 error wiring) |
| `apps/web/src/features/team/TeamPage.tsx` | Copyable link after invite + on each pending row; fix the false "Invite sent" message |
| `apps/web/src/routes/pages/AcceptInvitePage.test.tsx` | **New** — AC4–AC9 |
| `apps/web/src/features/team/TeamPage.test.tsx` | AC1–AC3 |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/**` | The backend contract is complete and verified; this task is frontend-only |
| `apps/web/src/routes/pages/LoginPage.tsx` | `/auth/signup` semantics are correct for a new customer and are out of scope |
| `apps/web/src/routes/AuthGuard.tsx` | Add the route *outside* the guard; do not weaken the guard itself |
| `apps/web/src/theme/themeMapping.ts` | Reuse `apiThemeToId`; it is the only casing-boundary translator |

---

## Test Plan

Component tests with the API module mocked for AC1–AC4 and AC6–AC9, asserting the exact POST body
and that a blocked case issues **zero** network calls.

**AC5 cannot be proven by mocked tests and is the whole point of the task.** Against the running
stack (postgres + API `:3000` + web `:8766`): as Owner, invite a fresh address; copy the link from
the UI; open it in a **logged-out** context; set a password; then confirm via the API that the new
user's `kitchenId` matches the **inviting** kitchen and their role is the invited one — not a new
tenant. Reproduce the broken path first for contrast: confirm that signing up through `/login`
instead lands the user in a *different* `kitchenId`, which is today's silent failure.

Archive screenshots and the API session to `reports/evidence/T043/` and commit them — a UI change is
not evidenced until those files are in the repo.

---

## Completion Checklist

- [ ] Implementation done — **both halves** (link on the Owner side, accept page on the invitee side)
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: `Skill({ skill: "security-review" })` run — **mandatory**, Medium risk: a public unauthenticated route that creates an account and issues a session
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence (Hard-Stop Gate 5)
- [ ] `npm run build` clean (T038 learning)
- [ ] `Skill({ skill: "verify" })` run — AC5 confirmed live, invitee lands in the INVITING kitchen
- [ ] Worktree changes actually **committed** — `git -C <worktree> log/status` checked (T027/T039 both reported done while uncommitted)
- [ ] Supervisor notified: ready for Stage 4 review
