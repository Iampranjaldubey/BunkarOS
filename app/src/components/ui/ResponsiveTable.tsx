import type { ReactNode } from 'react';
import { useIsDesktop } from './useIsDesktop';
import { cn } from '../../lib/utils';

export interface ColumnDef<T> {
  /** Stable key for the column (used as React key + table cell key). */
  key: string;
  /** Header cell content. */
  header: ReactNode;
  /** Render the body cell for a row. */
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Extra classes applied to both the header and body cells. */
  className?: string;
}

export interface ResponsiveTableProps<T> {
  rows: T[];
  columns: ColumnDef<T>[];
  /** Stable React key per row. */
  rowKey: (row: T) => string;
  /** Clicking (or Enter/Space on) a row — e.g. open a detail page. */
  onRowClick?: (row: T) => void;
  /** The mobile card for a row (what the phone layout shows today). */
  renderCard: (row: T) => ReactNode;
  /** Shown when there are no rows (both layouts). */
  empty?: ReactNode;
  /** data-testid for the <table> (defaults to "data-table"). */
  testid?: string;
  className?: string;
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

/**
 * Phone-first list that upgrades to a real table on large screens.
 *  - Below lg: renders `renderCard(row)` for each row — exactly today's mobile
 *    cards, so the phone DOM/visuals are unchanged.
 *  - At lg+: a semantic `<table>` with zebra rows, ≥ 44 px row
 *    height, and (when `onRowClick` is set) keyboard-activatable rows.
 */
export function ResponsiveTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  renderCard,
  empty,
  testid = 'data-table',
  className,
}: ResponsiveTableProps<T>) {
  // Hooks first — an early return before a hook changes the hook count between renders.
  const desktop = useIsDesktop();
  if (rows.length === 0 && empty !== undefined) {
    return <>{empty}</>;
  }

  const clickable = Boolean(onRowClick);

  if (!desktop) {
    // Phone/small tablet: exactly today's mobile cards (the table is not built at all).
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        {rows.map((row) => (
          <div key={rowKey(row)}>{renderCard(row)}</div>
        ))}
      </div>
    );
  }

  return (
    <>

      {/* Desktop/tablet table. */}
      <div className={className}>
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
          <table
            data-testid={testid}
            className="w-full border-collapse text-base"
          >
            <thead>
              <tr className="bg-surface">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      'border-b border-line px-4 py-3 text-sm font-medium text-muted',
                      alignClass[col.align ?? 'left'],
                      col.className,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = rowKey(row);
                return (
                  <tr
                    key={key}
                    {...(clickable
                      ? {
                          role: 'button',
                          tabIndex: 0,
                          onClick: () => onRowClick?.(row),
                          onKeyDown: (e: React.KeyboardEvent) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onRowClick?.(row);
                            }
                          },
                        }
                      : {})}
                    className={cn(
                      'even:bg-bg/60',
                      clickable &&
                        'cursor-pointer hover:bg-primary/5 focus-visible:outline focus-visible:outline-3 focus-visible:-outline-offset-2 focus-visible:outline-accent-ink',
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'h-11 border-b border-line px-4 py-2 align-middle text-ink',
                          alignClass[col.align ?? 'left'],
                          col.className,
                        )}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
