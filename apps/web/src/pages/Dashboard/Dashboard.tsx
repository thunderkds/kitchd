import { LowStockWidget } from '../../components/LowStockWidget/LowStockWidget';
import { AnnouncementsWidget } from '../../components/AnnouncementsWidget/AnnouncementsWidget';
import { PinnedNotesWidget } from '../../components/PinnedNotesWidget/PinnedNotesWidget';
import { TasksWidget } from './TasksWidget';

/**
 * T018 — Home dashboard (FR-020, US-012, NFR-001). Composes Tasks (T008),
 * Low Stock (T007), Announcements (T013) and Pinned Notes (T012) into one
 * role-aware landing page.
 *
 * Each widget below performs its own independent GET on mount (see
 * TasksWidget / LowStockWidget / AnnouncementsWidget / PinnedNotesWidget) —
 * there is no parent-level fetch and no widget awaits another, so the four
 * requests fire in parallel rather than waterfalling, which is what keeps
 * this page under the 1.5s p95 load target (NFR-001). Verified structurally
 * here (four independent effects, no data dependency between them); confirm
 * with the browser Network tab in a live session for the timing evidence.
 */
export function Dashboard() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Dashboard</h1>
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        data-testid="dashboard-grid"
      >
        <TasksWidget />
        <LowStockWidget />
        <AnnouncementsWidget />
        <PinnedNotesWidget />
      </div>
    </div>
  );
}
