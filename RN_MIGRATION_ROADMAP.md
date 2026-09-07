# RN_MIGRATION_ROADMAP.md
**Generated**: 2026-07-29

## Goal

Convert KitchenOS from a web-first app into a dual-target product with:
- `apps/web` kept alive
- `apps/mobile` added for React Native
- a shared core for contracts, API access, validation, theme tokens, and reusable logic

This is a full-feature parity migration, not a minimal mobile-only pilot.

## Decision

Use **shared core + separate shells**.

Why:
- The current web app is already browser-specific in routing, storage, and shell layout.
- Forcing one UI tree onto web and native would create brittle abstractions.
- Shared logic is still very achievable and gives most of the reuse value.

## Recommended Stack

### Keep
- TypeScript
- React Native + Expo
- Expo Router
- TanStack Query
- React Hook Form
- Zod
- Zustand for client/UI state only
- MMKV for fast non-secret persistence on native
- expo-secure-store for secrets
- FlashList
- expo-image
- react-native-reanimated

### Conditional
- NativeWind, but only after a quick spike confirms the exact version and ergonomics for this repo.

### Avoid
- Using global state as the server cache
- A single shared navigation layer for both platforms
- Putting secrets into MMKV
- Forcing web-only DOM behavior into shared components

## Architecture Boundary

### Shared
- DTOs
- Zod schemas
- API client and request helpers
- auth/session helpers
- theme tokens and color semantics
- server-state hooks
- low-level form primitives
- domain utilities

### Web only
- `react-router-dom`
- browser storage
- DOM shell/layout
- web-specific interactions like clipboard and hover behavior

### Mobile only
- Expo Router shell
- native storage adapters
- platform navigation
- keyboard and safe-area handling
- device-specific UX

## Migration Phases

### Phase 0 - Foundation
- Create `apps/mobile`
- Wire Expo + Expo Router into the monorepo
- Confirm workspace/build setup for shared packages
- Add shared API/request package boundary if needed
- Create storage adapters for web and native

Exit criteria:
- Web still builds
- Mobile app boots
- Shared packages compile

### Phase 1 - Shared Core
- Extract auth/session helpers
- Extract DTOs and Zod schemas
- Extract API client wrappers
- Extract theme token definitions
- Extract shared hooks for fetching and mutations

Exit criteria:
- Web and mobile both consume the same contracts
- No feature code depends directly on browser-only storage

### Phase 2 - Shells
- Keep `apps/web` on its current router and layout
- Build `apps/mobile` shell with platform-appropriate navigation
- Add auth gate and basic app navigation
- Introduce platform-safe global providers

Exit criteria:
- Both shells can log in and reach a post-auth landing screen

### Phase 3 - Feature Parity Waves
Port features in this order:
1. Auth
2. Dashboard
3. Tasks
4. Inventory
5. Recipes
6. Guidelines
7. Notes
8. Announcements
9. Team / roles
10. Settings
11. Comments and realtime polish
12. Remaining small utilities and edge screens

Rationale:
- Auth and session management unblock everything else.
- Tasks and dashboard are high-frequency workflows.
- Inventory, recipes, and guidelines cover the core operations domain.
- Notes, announcements, team, and settings complete operational parity.

### Phase 4 - Native Quality Pass
- Convert list-heavy screens to FlashList where it matters
- Add image handling via expo-image
- Tighten keyboard and safe-area behavior
- Add native motion via Reanimated only where it improves the UX
- Audit persistence and offline-ish behavior

Exit criteria:
- Full parity screens are usable on device without web assumptions leaking through

## First 3 Implementation Milestones

### Milestone 1
- Scaffold `apps/mobile`
- Verify monorepo imports into shared packages
- Boot a bare Expo screen
- Wire the shared auth/session boundary

### Milestone 2
- Port login and post-login landing navigation
- Prove shared DTOs and API client usage
- Replace browser-local auth storage with adapters

### Milestone 3
- Port one full feature slice end to end
- Keep web behavior unchanged
- Prove the shared core can support real UI and mutation flows

## Suggested Implementation Order

1. Auth
2. Dashboard
3. Tasks
4. Inventory
5. Recipes
6. Guidelines
7. Notes
8. Announcements
9. Team / roles
10. Settings
11. Comments / notifications / realtime polish

## Risks

- Shared UI abstractions may become too generic and slow both platforms down.
- Browser-only assumptions may hide in auth, theme, and navigation helpers.
- Large list screens may regress badly if FlashList is deferred too long.
- Realtime behavior may differ when the app backgrounds on mobile.
- The temptation to over-share UI is the main architecture trap.

## Working Rule

Share domain logic aggressively.
Share UI only where the abstraction survives both web and native without platform contortions.

