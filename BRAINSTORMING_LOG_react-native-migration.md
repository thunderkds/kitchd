# BRAINSTORMING_LOG_react-native-migration.md
**Generated**: 2026-07-29
**Task / Context**: React Native migration analysis for KitchenOS
**Skill**: `brainstorming` + `grill-with-docs`

---

## The Problem Space

KitchenOS is already a mature web app with browser-specific routing, storage, and shell assumptions. The current frontend depends on `react-router-dom`, `window.localStorage`, `document`, and DOM-centric layout components, so a shared web/mobile migration cannot be treated as a thin platform swap. The real goal is not "port the app" but "preserve the product logic while splitting the UI into web and native shells that can share core contracts, data fetching, validation, and theme tokens."

## Questions for the User

Resolved before this log:
- Keep both web and mobile as first-class targets.
- Prefer a shared core with separate web/mobile shells over a fully shared universal UI.

## Current Constraints

- Current app shell is browser-first: `react-router-dom` in [`apps/web/src/App.tsx`](apps/web/src/App.tsx) and DOM shell/layout in [`apps/web/src/layout/AppShell.tsx`](apps/web/src/layout/AppShell.tsx).
- Auth/session state currently lives in `window.localStorage` in [`apps/web/src/routes/auth.ts`](apps/web/src/routes/auth.ts).
- Feature pages blend navigation, data fetching, and UI in a way that is okay for web but not directly portable to native, especially [`apps/web/src/features/tasks/TasksPage.tsx`](apps/web/src/features/tasks/TasksPage.tsx).
- The repo is already a monorepo with `/apps/web`, `/apps/api`, and `/packages/shared`, which is the right shape for a staged Expo addition.

## Alternatives

| Option | Name | Summary | Reuse | Risk | Recommendation |
|---|---|---|---|---|---|
| A | Shared Core, Separate Shells | Keep web and native shells separate, share contracts, fetching, forms, tokens, and low-level primitives | High where it matters | Lowest migration risk | ✅ Recommended |
| B | Fully Shared Universal UI | One UI tree for web and native, with platform variants inside most components | Highest code reuse on paper | High abstraction risk | ⚠️ Only if maximizing reuse is worth slower delivery |
| C | Mobile Fork, Web Stabilized | Build mobile mostly independently and only share API contracts/types | Lowest upfront coupling | Lowest initial friction, highest long-term duplication | ❌ Not recommended unless web scope is frozen |

### Option A — Shared Core, Separate Shells
**Approach**: Add `apps/mobile` with Expo + Expo Router, keep `apps/web` intact, and move reusable logic into shared packages: API client, DTOs/Zod schemas, auth/session helpers, theme tokens, and form validation.

**Pros**:
- Matches the actual divergence already visible in the web codebase.
- Lets the team keep shipping web while mobile matures.
- Keeps platform-specific routing, storage, and shell concerns isolated.
- Makes testing simpler because each shell has fewer impossible-to-share assumptions.

**Cons**:
- Some UI duplication remains.
- Shared primitives still need careful boundaries so they do not become half-platform abstractions.

**Why this might fail**:
- If too much UI is forced into shared components too early, the abstraction will be awkward for one platform and brittle for both.
- If the shared-core boundary is vague, the migration becomes a file-by-file copy instead of a real architecture change.

### Option B — Fully Shared Universal UI
**Approach**: Build a single component tree that runs on web and native, using NativeWind and platform variants everywhere.

**Pros**:
- Maximum reuse if it works.
- One mental model for most screens.
- Attractive for a team that wants to minimize duplicated UI work.

**Cons**:
- The current app is already full of web-only assumptions.
- Navigation, auth storage, dialogs, keyboard behavior, hover, and back handling diverge fast.
- Shared UI usually means spending time designing around the least common denominator.

**Why this might fail**:
- Web-specific behavior leaks into native components anyway, so the codebase becomes more complex without becoming truly shared.
- The abstraction cost gets paid on every screen, not just the outliers.

### Option C — Mobile Fork, Web Stabilized
**Approach**: Build mobile almost independently, reusing only API contracts and a few utility packages.

**Pros**:
- Fast to get native screens moving.
- Minimal architectural compromise.

**Cons**:
- Duplicates design and business rules.
- Expands future maintenance burden.
- Creates drift between web and mobile UX and behavior.

**Why this might fail**:
- The same domain rules end up implemented twice, which is exactly the kind of duplication this repo has avoided by using shared contracts already.

## Stack Recommendation

### Adopt
- **Expo + Expo Router**: The repo is monorepo-shaped already, and Expo Router gives a pragmatic file-based navigation model for a universal app.
- **TanStack Query**: Best fit for server state. Keep API data out of client stores and let the cache handle retries, invalidation, refetching, and mutation lifecycles.
- **React Hook Form + Zod**: Good shared validation path for both shells. Existing schema-first validation can be reused cleanly.
- **Zustand**: Use for small client/UI/session state only.
- **MMKV**: Use as the fast persisted store for non-secret local state where native speed matters.
- **expo-secure-store**: Use for secrets and access tokens, not for broad app state.
- **FlashList**: Use for heavy list screens and feed-like views.
- **expo-image**: Use anywhere image loading/caching matters.
- **react-native-reanimated**: Add once the shell is stable and motion work is worth the extra complexity.

### Conditional
- **NativeWind**: Worth considering because the existing web app is already Tailwind-heavy, but the docs currently show v5 as pre-release. Spike it first and pin the exact version before locking it in as the default styling layer.

### Avoid
- **Global store as server cache**: That duplicates what TanStack Query already solves.
- **A shared navigation layer forced across platforms**: Web and native routing ergonomics are different enough to justify separate shells.
- **Using MMKV for secrets by default**: Keep secrets in SecureStore and non-secret persistence in MMKV.

## Adversarial Review

### Shared Core, Separate Shells
This is the best balance, but it can still fail if the shared package boundary is too loose. The main risk is a "platform-neutral" component library that secretly encodes web behavior, forcing native screens to fight it. The fix is to share domain logic aggressively and UI only where the abstraction is actually stable.

### Fully Shared Universal UI
This is the most tempting idea and the easiest way to overfit the architecture. It will look elegant on a slide and painful in implementation. If a screen depends on keyboard behavior, navigation affordances, hover, dense list performance, or browser storage, the shared abstraction starts leaking immediately.

### Mobile Fork, Web Stabilized
This is the lowest-friction way to ship one mobile app, but it leaves too much long-term duplication. It is also the most likely to create product drift, where bugs and fixes land on one shell but not the other.

## Surgical Scope

Files and areas that **should** be touched:
- New `apps/mobile` Expo app.
- `packages/shared` for DTOs, Zod schemas, enums, and shared types.
- A new shared API client package or shared request utilities.
- Shared theme tokens and platform-adapted styling primitives.
- Auth/session storage adapters for web vs native.
- Shared form and validation helpers.

Files and areas that **must not** be touched yet:
- `apps/api` business rules unless the mobile slice exposes a real API gap.
- `PRD.md` and `requirement.md`.
- Memory cold files directly.
- Existing web feature screens until their shared boundary is defined.

## Edge Case Checklist

- [ ] Auth token persistence differs between web storage and native secure storage.
- [ ] Theme persistence must not depend on `document.documentElement`.
- [ ] Back navigation and modal dismissal need native-safe behavior.
- [ ] Long lists need FlashList-friendly item keys and recycling-safe row components.
- [ ] Keyboard avoidance and small-screen layout must not assume browser viewport behavior.
- [ ] Socket/realtime sessions must survive app foreground/background transitions cleanly.
- [ ] Clipboard and link-sharing flows need native APIs or fallbacks.

## Recommended Path

**Option A — Shared Core, Separate Shells**

This is the best path for KitchenOS because the repo already has a clean API/shared-types foundation, but the current UI is still meaningfully web-specific. Shared core gives you reuse where it is durable. Separate shells keep you from turning routing, storage, and layout into a lowest-common-denominator problem.

## Next Actions

1. Create `apps/mobile` with Expo + Expo Router.
2. Extract shared API/request helpers and DTO/Zod schemas into a package boundary.
3. Define auth/session adapters for web and native.
4. Decide whether NativeWind is approved after a small spike against the current dependency set.
5. Port one vertical slice end to end, starting with auth and a low-complexity screen.
6. Add a shell-specific test matrix so web and native can diverge where they must.

