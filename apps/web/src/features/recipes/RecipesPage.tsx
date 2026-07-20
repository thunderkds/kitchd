import { useEffect, useState } from 'react';
import { createRecipe, getRecipe, listRecipes, updateRecipe } from './api';
import { listIngredients } from '../inventory/api';
import { getUser } from '../../routes/auth';
import { Dialog } from '../../components/Dialog/Dialog';
import { RecipeForm } from './RecipeForm';
import type { Ingredient } from '../inventory/types';
import type { Recipe, RecipeInput } from './types';

const WRITE_ROLES = ['OWNER', 'ADMIN', 'CHEF'];

type ViewMode = 'list' | 'detail';
type FormMode = 'create' | 'edit';

/**
 * Recipes page (T036, modal-converted in T037). Consumes T005's `/recipes`
 * endpoints.
 *
 * GET /recipes and GET /recipes/:id are open to any authenticated role
 * (view-only for Staff/Viewer). POST/PATCH are Owner/Admin/Chef-only
 * server-side (`WRITE_ROLES` in recipes.controller.ts) — this page mirrors
 * that by never attempting a write call for a non-writer caller, not just
 * hiding the controls (T028 pattern, same as GuidelinesPage/InventoryPage).
 * Create/edit now open the shared `Dialog` modal (wrapping the existing
 * RecipeForm) instead of replacing the page.
 */
export function RecipesPage() {
  const caller = getUser();
  const canWrite = caller ? WRITE_ROLES.includes(caller.role) : false;

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [mode, setMode] = useState<ViewMode>('list');
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const data = await listRecipes();
      setRecipes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // Ingredient list only needed for the create/edit picker, but fetching
    // it up front avoids a second loading state when a writer opens the form.
    if (canWrite) {
      listIngredients()
        .then(setIngredients)
        .catch(() => {
          // Non-fatal — the form shows its own empty state if this stays [].
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (recipe: Recipe) => {
    setError(null);
    try {
      const full = await getRecipe(recipe.id);
      setSelected(full);
      setMode('detail');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipe');
    }
  };

  const openCreate = () => {
    if (!canWrite) return;
    setEditing(null);
    setFormMode('create');
  };

  const openEdit = (recipe: Recipe) => {
    if (!canWrite) return;
    setEditing(recipe);
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode(null);
    setEditing(null);
  };

  const backToList = () => {
    setSelected(null);
    setError(null);
    setMode('list');
  };

  const handleCreate = async (input: RecipeInput) => {
    const created = await createRecipe(input);
    setRecipes((prev) => [created, ...prev]);
    closeForm();
  };

  const handleEdit = async (input: RecipeInput) => {
    if (!editing) return;
    const updated = await updateRecipe(editing.id, input);
    setRecipes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelected((prev) => (prev && prev.id === updated.id ? updated : prev));
    closeForm();
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-4">Recipes</h1>
        <p className="text-muted text-sm">Loading...</p>
      </div>
    );
  }

  const formDialog =
    canWrite && formMode ? (
      <Dialog titleId="recipe-form-dialog-title" onClose={closeForm}>
        <h2 id="recipe-form-dialog-title" className="text-lg font-semibold mb-4">
          {formMode === 'edit' ? 'Edit Recipe' : 'New Recipe'}
        </h2>
        <RecipeForm
          bare
          mode={formMode}
          initial={formMode === 'edit' ? editing : null}
          ingredients={ingredients}
          onSubmit={formMode === 'edit' ? handleEdit : handleCreate}
          onCancel={closeForm}
        />
      </Dialog>
    ) : null;

  if (mode === 'detail' && selected) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h1 className="text-xl font-semibold break-words">{selected.name}</h1>
          <div className="flex items-center gap-2 shrink-0">
            {canWrite && (
              <button
                type="button"
                className="text-sm px-3 py-1 border rounded"
                onClick={() => openEdit(selected)}
              >
                Edit
              </button>
            )}
            <button type="button" className="text-sm px-3 py-1 border rounded" onClick={backToList}>
              Back
            </button>
          </div>
        </div>
        {error && <p className="text-danger text-sm mb-3">{error}</p>}
        <p className="text-xs text-muted mb-4">
          {selected.servings != null ? `${selected.servings} servings · ` : ''}
          Cost: ${selected.costComputed.toFixed(2)}
        </p>

        <h2 className="text-sm font-medium mb-2">Steps</h2>
        {selected.steps.length === 0 ? (
          <p className="text-muted text-sm mb-4">No steps yet.</p>
        ) : (
          <ol className="flex flex-col gap-2 list-decimal list-inside mb-4" data-testid="recipe-steps">
            {selected.steps.map((step, idx) => (
              <li key={idx} className="border bg-surface-raised rounded p-3 break-words">
                {step}
              </li>
            ))}
          </ol>
        )}

        <h2 className="text-sm font-medium mb-2">Ingredients</h2>
        {selected.ingredients.length === 0 ? (
          <p className="text-muted text-sm">No ingredients yet.</p>
        ) : (
          <table className="w-full text-sm border" data-testid="recipe-ingredients">
            <thead>
              <tr className="border-b bg-surface-raised">
                <th className="text-left p-2">Ingredient</th>
                <th className="text-left p-2">Qty</th>
                <th className="text-left p-2">Unit</th>
                <th className="text-left p-2">Line cost</th>
              </tr>
            </thead>
            <tbody>
              {selected.ingredients.map((line) => (
                <tr key={line.ingredientId} className="border-b">
                  <td className="p-2">{line.name}</td>
                  <td className="p-2">{line.qty}</td>
                  <td className="p-2">{line.unit}</td>
                  <td className="p-2">${line.lineCost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-sm font-medium mt-3">Total cost: ${selected.costComputed.toFixed(2)}</p>
        {formDialog}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Recipes</h1>
        {canWrite && (
          <button
            type="button"
            className="self-start px-3 py-2 text-sm rounded bg-accent text-white"
            onClick={openCreate}
          >
            New Recipe
          </button>
        )}
      </div>

      {error && <p className="text-danger text-sm mb-3">{error}</p>}

      {recipes.length === 0 ? (
        <p className="text-muted text-sm">No recipes yet.</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="recipes-list">
          {recipes.map((recipe) => (
            <li
              key={recipe.id}
              className="border bg-surface-raised rounded p-3 flex items-center justify-between gap-3 flex-wrap cursor-pointer"
              data-testid={`recipe-${recipe.id}`}
              onClick={() => openDetail(recipe)}
            >
              <div className="min-w-0">
                <p className="font-medium break-words">{recipe.name}</p>
                <p className="text-xs text-muted">
                  {recipe.servings != null ? `${recipe.servings} servings · ` : ''}
                  Cost: ${recipe.costComputed.toFixed(2)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {formDialog}
    </div>
  );
}
