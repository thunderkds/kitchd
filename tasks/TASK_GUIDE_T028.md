# TASK_GUIDE — T028: Frontend Team & Roles page
**Date**: 2026-07-14
**Complexity Level**: C2
**Risk Level**: Medium
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
5. Note the **Complexity Level** above (C2) and apply the matching process from the Complexity matrix in `.claude/agents/general-agent-template.md`
6. C2 — read `memory/codebase-map.md` for directory layout before starting

Also read `BRAINSTORMING_LOG_team-roles.md` for full context. Confirm T027 is merged and read its actual endpoint shapes in code before starting — do not assume routes/payloads, verify.

---

## Requirement (Pillar 1 — Adapt the requirement)

User request: "implement the team & role, I see it clean for now" — the `/team` sidebar link renders the generic empty-state placeholder today.

**Restated intent** (Supervisor's interpretation):
> Replace the placeholder `/team` route with a real page: member list (with role shown), a role-change control per member, a remove action per member, an invite form, and a pending-invites list with revoke — all gated to Owner/Admin, consuming T027's endpoints.

**Out of scope** (what this task explicitly does NOT do):
- No backend work — T027 must already provide the 4 new endpoints plus the existing invite-creation endpoint; this task consumes them.
- No UI affordance to grant Owner/Admin via role-change (the dropdown/control must only offer Chef/Staff/Viewer) — matches T027's DTO-level restriction.
- No self-removal or Owner/Admin-removal UI — the remove action should not even render for the caller's own row or for Owner/Admin rows (defense in depth on top of T027's 400/403).
- Chef/Staff/Viewer should not see this page's management controls at all — page should render read-only or redirect for non-Owner/Admin (confirm actual UX with existing patterns, e.g. how other Owner/Admin-only surfaces in this codebase handle a non-privileged viewer).

**Requirement Refs** (FR/NFR/US IDs from `PRD.md` this task satisfies):
- FR-026: member roster, role-change UI, remove UI, pending-invite UI.
- US-015: Owner/Admin can actually administer team access via the UI, not just the API.

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [ ] Restated intent confirmed to match the user's request (by Supervisor / user — not the implementing agent)
- [ ] Domain terms align with `PROJECT_SPEC.md` glossary
- [ ] Every Acceptance Criterion below traces to a line in the Requirement
- [ ] All Requirement Refs exist in `PRD.md` and are fully covered by the Acceptance Criteria above
- [ ] Confirmed T027 is merged and its endpoint/payload shapes are verified in the actual code (not assumed) before starting

> An agent must NOT start implementing until this gate is checked. If anything here is unclear,
> STOP and ask the Supervisor (Karpathy: Think Before Coding).

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | `/team` renders a real `TeamPage` (not the generic `SectionPage` placeholder) showing the kitchen's active members with email + role | FR-026 |
| 2 | Each member row (except the caller's own row and Owner/Admin rows) has a role-change control offering only Chef/Staff/Viewer | FR-026, locked scope decision |
| 3 | Each member row (except the caller's own row and Owner/Admin rows) has a Remove action that calls T027's `DELETE /users/:id` and removes the row from the list on success | FR-026, locked scope decision |
| 4 | An invite form (email + role, Chef/Staff/Viewer only) calls the existing `POST /users/invite` and shows a success/error state | FR-026 |
| 5 | A pending-invites list shows outstanding invites with a Revoke action calling T027's `DELETE /users/invites/:id` | FR-026 |
| 6 | A non-Owner/Admin visiting `/team` does not see any management controls (read-only or appropriately restricted view) | FR-018 pattern, locked scope decision |
| 7 | Theme-token compliance: page uses semantic tokens (`bg-surface-raised`, `text-primary`, etc.) per ADR-0001 — no raw Tailwind palette classes (this page is new, built after T026, must follow the established convention from day one) | ADR-0001 (theme-system architecture) |

---

## Evaluation & Acceptance (How we know the agent worked correctly)

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Owner visits `/team` | Sees member list with roles | live browser verify |
| 2 | Owner changes a Staff member's role to Chef | UI updates, backend call fires with correct payload | live browser verify |
| 3 | Owner removes a Staff member | Row disappears, backend call fires | live browser verify |
| 4 | Owner sends an invite | Success feedback shown, invite appears in pending list | live browser verify |
| 5 | Owner revokes a pending invite | Invite disappears from pending list | live browser verify |
| 6 | Staff (non-Owner/Admin) visits `/team` | No management controls visible | live browser verify |
| 7 | Grep for raw Tailwind palette classes in the new `features/team/**` files | Zero matches | automated grep check |

### Verification Command (exact, runnable)

```bash
cd apps/web && npm test -- team && grep -rEn "bg-(slate|gray|indigo|zinc|neutral|amber|orange)-[0-9]+|text-(slate|gray|indigo|zinc|neutral|amber|orange)-[0-9]+" src/features/team --include=*.tsx
```

> **Evidence is a required document, not a formality.** A task is not Done until every row below is
> filled with real, pasted output — not just checked. The `verify` row's first cell must be a bare
> `| verify |` (no backticks), and its Notes cell must contain the literal word "pass" (case-insensitive)
> — in the **Notes cell itself**, not only the Result cell (see `memory/learnings.md` 2026-07-14 T025 entry).

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☐ pass / ☐ fail | |
| Verification command run | ☐ pass / ☐ fail | |
| Negative cases hold | ☐ pass / ☐ fail | |
| verify | ☐ pass / ☐ fail | |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☐ pass / ☐ fail | |
| Full smoke suite still green (no regression) | ☐ pass / ☐ fail | |
| **UI: Visual regression (diff or verdict pasted)** | ☐ pass / ☐ fail / ☐ N/A | |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☐ pass / ☐ fail / ☐ N/A | |
| **UI: Responsiveness at target viewports** | ☐ pass / ☐ fail / ☐ N/A | |

> **Evidence-archiving rule (required):** copy any external-tool artifacts (screenshots/session reports) into `reports/evidence/T028/` and commit — reference the repo-local path in Notes, not an external path. Note: easy-ui-mcp has been confirmed absent from this environment (2026-07-14) — use Playwright directly as the substitute, per the established pattern from T026.

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| `/team` — Owner view, Simple + Dark Neon | Playwright screenshot | Member list, invite form, pending invites all render with semantic tokens, no raw color classes |
| `/team` — non-Owner/Admin view | Playwright screenshot | No management controls visible |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | grep + visual | Zero raw-palette-class matches in `src/features/team/**` |
| Typography/spacing matches existing pages | Visual comparison to Notes/Tasks pages | Consistent with established page patterns |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | Playwright screenshot / DOM assertion | No overflow |
| Tablet (768px) | Playwright screenshot / DOM assertion | No overflow |
| Desktop (1024px+) | Playwright screenshot | No overflow |

---

## Approach

1. Verify T027's actual endpoint shapes in code first (`GET /users`, `PATCH /users/:id/role`, `DELETE /users/:id`, `GET /users/invites`, `DELETE /users/invites/:id`, plus the existing `POST /users/invite`).
2. Build `apps/web/src/features/team/TeamPage.tsx` — fetch member list + pending invites on mount, gate management controls on the caller's own role (read from `getUser()`, same pattern as `TasksWidget`'s `showAll` scoping).
3. Wire `/team` in `App.tsx` to `TeamPage` instead of the generic `SectionPage`.
4. Use semantic tokens throughout (`bg-surface-raised`, `text-primary`, `text-muted`, `bg-accent`, `text-danger` for remove/revoke actions) per the established T026 convention — this page is new, so there's no migration needed, just build it correctly from the start.

---

## Edge Case Checklist

- [ ] Role-change dropdown/control never offers Owner/Admin as an option
- [ ] Remove action never renders for the caller's own row or an Owner/Admin row
- [ ] Non-Owner/Admin sees no management controls (verify both role-change and remove are absent, not just disabled)
- [ ] Empty states: zero members-besides-self, zero pending invites — both render sensibly, not broken/blank
- [ ] Invite form validation: invalid email, role restricted to Chef/Staff/Viewer only in the form control
- [ ] Failed role-change/remove/revoke (e.g. network error) shows an error state, doesn't silently no-op

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/features/team/TeamPage.tsx` (new) | Main page |
| `apps/web/src/features/team/*.test.tsx` (new) | Tests |
| `apps/web/src/App.tsx` | Wire `/team` to `TeamPage` |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/**` | Backend is T027's scope, already merged — do not modify |
| Other feature pages | Purely additive new page — no refactor of existing pages needed |

---

## Test Plan

Component tests for `TeamPage` covering role-gating (Owner/Admin sees controls, others don't), the 4 management actions, and empty states. Live browser verify (Playwright) for the full flow per the UI Evidence rows above.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: not required directly (Medium Risk, no new backend surface) — but confirm no client-side-only enforcement gap (server already enforces via T027, this is defense-in-depth UI only)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table (Hard-Stop Gate 5)
- [ ] `Skill({ skill: "verify" })` run — feature confirmed working in running app
- [ ] All three UI Evidence rows filled with pasted evidence (Hard-Stop Gate 6)
- [ ] Any external-tool evidence copied into `reports/evidence/T028/` and committed
- [ ] `memory/MEMORY.md` updated (if new patterns or feedback learned)
- [ ] Supervisor notified: task ready for Stage 4 review
