interface EmptyStateProps {
  title: string;
  message: string;
}

/** Shared empty-state pattern: icon + message. No real feature content yet. */
export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-4">
      <div
        aria-hidden="true"
        className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-2xl"
      >
        📭
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 max-w-sm">{message}</p>
    </div>
  );
}
