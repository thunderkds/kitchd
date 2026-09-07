import { useEffect, useState, type FormEvent } from 'react';
import { getUser } from '../../routes/auth';
import { useTheme } from '../../theme/ThemeProvider';
import type { ThemeId } from '../../theme/themeMapping';
import { getKitchen, renameKitchen } from '../../features/kitchens/api';

const THEME_OPTIONS: { id: ThemeId; label: string; description: string }[] = [
  { id: 'simple', label: 'Simple', description: "KitchenOS's original light theme." },
  { id: 'dark-neon', label: 'Dark Neon', description: 'A high-contrast dark theme with a neon accent.' },
];

/**
 * T026/T048 — Settings/profile page. No dedicated settings page existed
 * before T026 (the /settings route rendered the generic SectionPage
 * placeholder); this is the minimal addition needed to host the theme
 * switcher and the kitchen rename card, per the locked switcher-location
 * decision (settings page only, no topbar quick-toggle).
 */
export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const caller = getUser();
  const canRenameKitchen = caller?.role === 'CHEF';

  const [kitchenName, setKitchenName] = useState('');
  const [savedKitchenName, setSavedKitchenName] = useState('');
  const [kitchenLoading, setKitchenLoading] = useState(true);
  const [kitchenError, setKitchenError] = useState<string | null>(null);
  const [kitchenStatus, setKitchenStatus] = useState<string | null>(null);
  const [savingKitchen, setSavingKitchen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadKitchen = async () => {
      const kitchenId = caller?.kitchenId;
      if (!kitchenId) {
        if (!cancelled) {
          setKitchenError('Kitchen not found.');
          setKitchenLoading(false);
        }
        return;
      }

      setKitchenLoading(true);
      try {
        const kitchen = await getKitchen(kitchenId);
        if (cancelled) return;
        setKitchenName(kitchen.name);
        setSavedKitchenName(kitchen.name);
        setKitchenError(null);
      } catch (err) {
        if (!cancelled) {
          setKitchenError(err instanceof Error ? err.message : 'Failed to load kitchen');
        }
      } finally {
        if (!cancelled) setKitchenLoading(false);
      }
    };

    loadKitchen();

    return () => {
      cancelled = true;
    };
  }, [caller?.kitchenId]);

  const handleKitchenSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canRenameKitchen || savingKitchen || kitchenLoading) return;

    const next = kitchenName.trim();
    if (!next) {
      setKitchenError('Kitchen name is required.');
      return;
    }

    if (next === savedKitchenName) {
      setKitchenStatus('Kitchen name is unchanged.');
      return;
    }

    setSavingKitchen(true);
    setKitchenError(null);
    setKitchenStatus(null);

    try {
      const updated = await renameKitchen(caller!.kitchenId, next);
      setKitchenName(updated.name);
      setSavedKitchenName(updated.name);
      setKitchenStatus('Kitchen renamed successfully.');
    } catch (err) {
      setKitchenError(err instanceof Error ? err.message : 'Failed to rename kitchen');
      setKitchenName(savedKitchenName);
    } finally {
      setSavingKitchen(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Settings</h1>

      <section className="max-w-md" aria-labelledby="theme-section-heading">
        <h2 id="theme-section-heading" className="text-sm font-semibold text-primary mb-1">
          Theme
        </h2>
        <p className="text-sm text-muted mb-3">
          Choose how KitchenOS looks. Your choice is saved to your account and
          follows you across devices.
        </p>

        <div role="radiogroup" aria-labelledby="theme-section-heading" className="flex flex-col gap-2">
          {THEME_OPTIONS.map((option) => {
            const selected = theme === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`theme-option-${option.id}`}
                onClick={() => setTheme(option.id)}
                className={`text-left rounded-lg border p-3 transition-colors ${
                  selected ? 'border-accent bg-accent/10' : 'border-border bg-surface-raised'
                }`}
              >
                <span className="block text-sm font-medium text-primary">{option.label}</span>
                <span className="block text-xs text-muted mt-0.5">{option.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="max-w-md mt-8" aria-labelledby="kitchen-section-heading">
        <h2 id="kitchen-section-heading" className="text-sm font-semibold text-primary mb-1">
          Kitchen
        </h2>
        <p className="text-sm text-muted mb-3">
          Rename the kitchen shown to your team. The name is fetched from the current kitchen
          record and saved with the existing kitchen endpoint.
        </p>

        <form className="rounded-lg border bg-surface-raised p-4" onSubmit={handleKitchenSubmit}>
          <label htmlFor="kitchen-name" className="block text-sm font-medium text-primary mb-2">
            Kitchen name
          </label>

          {kitchenLoading ? (
            <p className="text-sm text-muted">Loading kitchen name…</p>
          ) : (
            <>
              <input
                id="kitchen-name"
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-primary disabled:opacity-70"
                type="text"
                value={kitchenName}
                onChange={(event) => {
                  setKitchenName(event.target.value);
                  setKitchenError(null);
                  setKitchenStatus(null);
                }}
                readOnly={!canRenameKitchen}
                disabled={savingKitchen}
                aria-describedby="kitchen-name-help"
              />
              <p id="kitchen-name-help" className="mt-2 text-xs text-muted">
                {canRenameKitchen
                  ? 'Save changes to update the kitchen name for everyone in your kitchen.'
                  : 'Your current role can view the kitchen name but cannot rename it.'}
              </p>

              {canRenameKitchen ? (
                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    className="px-3 py-2 text-sm rounded bg-accent text-white disabled:opacity-50"
                    disabled={savingKitchen || !kitchenName.trim() || kitchenName.trim() === savedKitchenName}
                  >
                    {savingKitchen ? 'Saving…' : 'Save name'}
                  </button>
                </div>
              ) : null}
            </>
          )}

          {kitchenError && (
            <p className="text-sm text-danger mt-3" role="alert">
              {kitchenError}
            </p>
          )}
          {kitchenStatus && <p className="text-sm text-success mt-3">{kitchenStatus}</p>}
        </form>
      </section>
    </div>
  );
}
