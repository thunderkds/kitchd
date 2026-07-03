import { EmptyState } from './EmptyState';
import type { NavItem } from '../../layout/navigation';

/** Renders the empty-state page for a single nav section. */
export function SectionPage({ item }: { item: NavItem }) {
  return <EmptyState title={item.label} message={item.emptyMessage} />;
}
