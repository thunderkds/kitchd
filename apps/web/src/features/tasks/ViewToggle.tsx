export function ViewToggle({
  view,
  onChange,
}: {
  view: 'kanban' | 'list';
  onChange: (view: 'kanban' | 'list') => void;
}) {
  return (
    <div className="flex rounded overflow-hidden border w-fit">
      <button
        type="button"
        className={`px-3 py-2 text-sm ${view === 'kanban' ? 'bg-accent text-white' : 'bg-surface-raised'}`}
        onClick={() => onChange('kanban')}
        aria-pressed={view === 'kanban'}
      >
        Kanban
      </button>
      <button
        type="button"
        className={`px-3 py-2 text-sm ${view === 'list' ? 'bg-accent text-white' : 'bg-surface-raised'}`}
        onClick={() => onChange('list')}
        aria-pressed={view === 'list'}
      >
        List
      </button>
    </div>
  );
}
