import { useEffect, useState } from 'react';
import { Dialog } from '../../components/Dialog/Dialog';
import { getUser } from '../../routes/auth';
import { createShiftLog, listShiftLogs } from './api';
import type { Shift, ShiftLog } from './types';

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function labelShift(shift: Shift): string {
  return shift.charAt(0) + shift.slice(1).toLowerCase();
}

export function ShiftLogsPage() {
  const caller = getUser();
  const canWrite = caller?.role !== 'VIEWER';

  const [logs, setLogs] = useState<ShiftLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [shift, setShift] = useState<Shift>('MORNING');
  const [body, setBody] = useState('');

  const refresh = async () => {
    try {
      const data = await listShiftLogs();
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shift logs');
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openForm = () => {
    if (!canWrite) return;
    setShift('MORNING');
    setBody('');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setShift('MORNING');
    setBody('');
  };

  const handleCreate = async () => {
    if (!canWrite) return;
    if (!body.trim()) {
      setError('Shift log body is required.');
      return;
    }
    try {
      const created = await createShiftLog({ shift, body: body.trim() });
      setLogs((prev) => [created, ...(prev ?? [])]);
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create shift log');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Shift Log</h1>
        {canWrite && (
          <button
            type="button"
            className="px-3 py-2 text-sm rounded bg-accent text-white"
            onClick={openForm}
          >
            New Shift Log
          </button>
        )}
      </div>

      {error && (
        <p className="text-danger text-sm mb-3" role="alert">
          {error}
        </p>
      )}

      {formOpen && canWrite && (
        <Dialog titleId="shift-log-dialog-title" onClose={closeForm}>
          <h2 id="shift-log-dialog-title" className="text-lg font-semibold mb-4">
            New Shift Log
          </h2>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Shift
              <select
                className="border rounded px-2 py-2 text-sm"
                value={shift}
                onChange={(e) => setShift(e.target.value as Shift)}
                aria-label="Shift"
              >
                <option value="MORNING">Morning</option>
                <option value="EVENING">Evening</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Body
              <textarea
                className="border rounded px-2 py-2 text-sm min-h-28"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                aria-label="Shift log body"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button
              type="button"
              className="text-sm px-3 py-2 min-h-[44px] min-w-[44px] rounded border bg-surface hover:opacity-80"
              onClick={closeForm}
            >
              Cancel
            </button>
            <button
              type="button"
              className="text-sm px-3 py-2 min-h-[44px] min-w-[44px] rounded bg-accent text-white hover:opacity-90"
              onClick={handleCreate}
            >
              Add Shift Log
            </button>
          </div>
        </Dialog>
      )}

      {!error && logs === null && <p className="text-sm text-muted">Loading…</p>}

      {!error && logs !== null && logs.length === 0 && (
        <p className="text-sm text-muted" data-testid="shift-logs-empty">
          No shift logs yet.
        </p>
      )}

      {!error && logs !== null && logs.length > 0 && (
        <ul className="flex flex-col gap-3" data-testid="shift-logs-list">
          {logs.map((log) => (
            <li
              key={log.id}
              data-testid="shift-log-row"
              className="border bg-surface-raised rounded p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{labelShift(log.shift)}</p>
                  <p className="text-sm whitespace-pre-wrap break-words">{log.body}</p>
                </div>
                <p className="text-xs text-muted shrink-0 whitespace-nowrap">
                  {formatCreatedAt(log.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
