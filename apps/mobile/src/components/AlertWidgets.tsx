import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ExpiringSoonBatch, LowStockIngredient } from '../api';
import { queryErrorMessage, useExpiringSoon, useLowStock } from '../queries';
import { useTheme, type Palette } from '../theme';

// M015 — dashboard alert widgets (parity with web LowStockWidget / ExpiringSoonWidget). Each widget
// owns its query, so a failure in one renders only in that widget and never blanks the dashboard.

function formatExpiryDate(value: string | null): string {
  if (!value) return 'No expiry date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function useAlertStyles() {
  const { palette } = useTheme();
  return useMemo(() => createStyles(palette), [palette]);
}

type WidgetShellProps = {
  title: string;
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyText: string;
  children: ReactNode;
};

function WidgetShell({ title, loading, error, empty, emptyText, children }: WidgetShellProps) {
  const styles = useAlertStyles();
  return (
    <View style={styles.widget}>
      <Text style={styles.widgetTitle}>{title}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && loading ? <Text style={styles.muted}>Loading…</Text> : null}
      {!error && !loading && empty ? <Text style={styles.muted}>{emptyText}</Text> : null}
      {!error && !loading && !empty ? children : null}
    </View>
  );
}

export function LowStockWidget() {
  const router = useRouter();
  const styles = useAlertStyles();
  const query = useLowStock();
  const items: LowStockIngredient[] = query.data ?? [];

  return (
    <WidgetShell
      title="Low Stock"
      loading={query.isPending}
      error={queryErrorMessage(query.error, 'Failed to load low-stock items.')}
      empty={items.length === 0}
      emptyText="All ingredients are above their thresholds."
    >
      {items.map((ingredient) => {
        const critical = ingredient.minThreshold != null && ingredient.currentStock <= ingredient.minThreshold / 2;
        return (
          <Pressable
            key={ingredient.id}
            accessibilityRole="button"
            style={[styles.row, critical ? styles.rowCritical : styles.rowWarning]}
            onPress={() => router.push('/inventory')}
          >
            <Text style={[styles.rowName, critical ? styles.criticalText : styles.warningText]}>{ingredient.name}</Text>
            <Text style={[styles.rowDetail, critical ? styles.criticalText : styles.warningText]}>
              {`${ingredient.currentStock} ${ingredient.unit} (min ${ingredient.minThreshold})`}
            </Text>
          </Pressable>
        );
      })}
    </WidgetShell>
  );
}

export function ExpiringSoonWidget() {
  const router = useRouter();
  const styles = useAlertStyles();
  const query = useExpiringSoon();
  const batches: ExpiringSoonBatch[] = query.data ?? [];

  return (
    <WidgetShell
      title="Expiring Soon"
      loading={query.isPending}
      error={queryErrorMessage(query.error, 'Failed to load expiring batches.')}
      empty={batches.length === 0}
      emptyText="No batches are expiring soon."
    >
      {batches.map((batch) => (
        <Pressable
          key={batch.id}
          accessibilityRole="button"
          style={[styles.row, styles.rowWarning]}
          onPress={() => router.push('/inventory')}
        >
          <Text style={[styles.rowName, styles.warningText]}>
            {batch.location ? `${batch.ingredient.name} · ${batch.location}` : batch.ingredient.name}
          </Text>
          <Text style={[styles.rowDetail, styles.warningText]}>
            {`${batch.qty} ${batch.ingredient.unit} · ${formatExpiryDate(batch.expiryDate)}`}
          </Text>
        </Pressable>
      ))}
    </WidgetShell>
  );
}

export function AlertWidgets() {
  return (
    <>
      <LowStockWidget />
      <ExpiringSoonWidget />
    </>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
  widget: {
    gap: 8,
    borderRadius: 16,
    padding: 14,
    backgroundColor: palette.inputBackground,
    borderWidth: 1,
    borderColor: palette.inputBorder,
  },
  widgetTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  muted: {
    color: palette.muted,
    fontSize: 13,
  },
  error: {
    color: palette.danger,
    fontSize: 13,
  },
  row: {
    gap: 2,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rowWarning: {
    backgroundColor: 'rgba(255, 193, 77, 0.12)',
  },
  rowCritical: {
    backgroundColor: 'rgba(255, 99, 99, 0.14)',
  },
  rowName: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowDetail: {
    fontSize: 13,
  },
  warningText: {
    color: palette.warning,
  },
  criticalText: {
    color: palette.danger,
  },
});
