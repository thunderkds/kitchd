import { useTheme } from '../../theme/ThemeProvider';
import type { ThemeId } from '../../theme/themeMapping';

const THEME_OPTIONS: { id: ThemeId; label: string; description: string }[] = [
  { id: 'simple', label: 'Simple', description: "KitchenOS's original light theme." },
  { id: 'dark-neon', label: 'Dark Neon', description: 'A high-contrast dark theme with a neon accent.' },
];

/**
 * T026 — Settings/profile page. No dedicated settings page existed before
 * this task (the /settings route rendered the generic SectionPage
 * placeholder); this is the minimal addition needed to host the theme
 * switcher, per the locked switcher-location decision (settings page only,
 * no topbar quick-toggle).
 */
export function SettingsPage() {
  const { theme, setTheme } = useTheme();

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
    </div>
  );
}
