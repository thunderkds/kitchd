# glossary.md — Cold Tier: Domain Terms & Domain Models

> **Rules**: Supervisor-only writes. One canonical definition per term — update in place, never duplicate. Domain Models section is populated at Stage 1 step 7 (Core Domain Models scan) and confirmed by the user.

## Domain Terms

- **Kitchen**: A single operational unit under an Organization (e.g. one restaurant/bakery location). MVP ships one Kitchen per Organization, but the model supports many.
- **Guideline**: A non-recipe SOP (e.g. "Opening Checklist", "Sanitation Procedure") — structurally similar to a Recipe but without ingredients/cost.
- **StockMovement**: An immutable ledger entry (receive/consume/waste/adjust) against an Ingredient — the audit trail for stock changes, distinct from the current StockBatch snapshot.

## Domain Models

Confirmed 2026-07-02, user-approved. Source: `requirement.md` §6, `PRD.md`.

- **Organization**: top-level tenant. Has many Kitchens.
- **Kitchen**: belongs to Organization. Has many Users (via role), Recipes, Guidelines, Tasks, Notes, Announcements, ShiftLogs.
- **User**: id, org_id, kitchen_ids[], name, email, role, avatar.
- **Recipe**: id, kitchen_id, name, category, yield, prep_time, cook_time, steps[], photo_url, allergens[], version, cost_computed, created_by. Has many RecipeIngredient.
- **RecipeIngredient**: recipe_id, ingredient_id, qty, unit. Join entity between Recipe and Ingredient.
- **Ingredient**: id, kitchen_id, name, unit, cost_per_unit, category, allergens[], supplier_id, min_threshold. Has many StockBatch, StockMovement.
- **StockBatch**: id, ingredient_id, qty, expiry_date, location, received_at.
- **StockMovement**: id, ingredient_id, type(receive/consume/waste/adjust), qty, reason, actor_id, created_at.
- **Guideline**: id, kitchen_id, title, type(SOP/checklist), steps[], attachments[].
- **Task**: id, kitchen_id, title, status, assignee_id, due_at, recurrence_rule, source_recipe_id/nullable, source_guideline_id/nullable (added T009, mutually exclusive with source_recipe_id — set by "generate task" from a Recipe or Guideline respectively), checklist_items[].
- **Note**: id, kitchen_id, author_id, title (nullable), body (plain text, not `body_md` as originally planned — no markdown rendering built in T012), tags[] (plain strings, stored exactly as submitted e.g. `#prep` — tag search is an exact array-element match via Prisma's `has`, not full-text/substring), pinned, linked_entity_type/linked_entity_id (nullable pair, no FK — matches `Task.sourceRecipeId` pattern, so a link to a since-deleted entity never crashes on load). Built T012.
- **Announcement**: id, kitchen_id, author_id, title, body, read_by[].
- **ShiftLog**: id, kitchen_id, author_id, shift(morning/evening), body, created_at.
- **Comment**: id, entity_type, entity_id, author_id, body, mentions[], created_at. Polymorphic — attaches to Recipe/Task/Ingredient.
- **Notification**: id, kitchen_id, recipient_id, type(MENTION/LOW_STOCK/TASK_ASSIGNED — only MENTION and LOW_STOCK are wired up, TASK_ASSIGNED is reserved for future use), body, read, created_at. Not part of the original 14 confirmed domain models — added T016 as the aggregation point for @mention (T015) and low-stock (T007) events.
