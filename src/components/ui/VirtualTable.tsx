import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { C } from '../../utils/helpers';

// ── Types ────────────────────────────────────────────────────────────────

interface VirtualTableRow {
    id: string;
    [key: string]: unknown;
}

interface VirtualTableColumn<T extends VirtualTableRow> {
    key: string;
    label: string;
    width?: string | number;
    render: (row: T, index: number) => React.ReactNode;
    headerStyle?: React.CSSProperties;
    cellStyle?: React.CSSProperties;
}

interface VirtualTableProps<T extends VirtualTableRow> {
    rows: T[];
    columns: VirtualTableColumn<T>[];
    rowHeight?: number;
    height?: number;
    overscanCount?: number;
    onRowClick?: (row: T) => void;
    emptyMessage?: string;
    selectedIds?: Set<string>;
    onSelectRow?: (id: string) => void;
    stickyHeader?: boolean;
    rowStyle?: (row: T) => React.CSSProperties | undefined;
}

// ── Component ────────────────────────────────────────────────────────────

export function VirtualTable<T extends VirtualTableRow>({
    rows,
    columns,
    rowHeight = 48,
    height = 600,
    overscanCount = 10,
    onRowClick,
    emptyMessage = 'Nema podataka',
    selectedIds,
    onSelectRow,
    stickyHeader = true,
    rowStyle,
}: VirtualTableProps<T>): React.JSX.Element {
    const parentRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => rowHeight,
        overscan: overscanCount,
    });

    if (rows.length === 0) {
        return (
            <div style={{
                padding: 40, textAlign: 'center',
                color: C.textMuted, fontSize: 14,
            }}>
                {emptyMessage}
            </div>
        );
    }

    return (
        <div style={{ width: '100%' }}>
            {/* Sticky header */}
            {stickyHeader && (
                <div style={{
                    display: 'flex', position: 'sticky', top: 0,
                    zIndex: 2, background: 'var(--bg)',
                    borderBottom: '1px solid var(--border)',
                }}>
                    {onSelectRow && (
                        <div style={{ width: 40, flexShrink: 0, padding: '10px 8px' }} />
                    )}
                    {columns.map(col => (
                        <div key={col.key} style={{
                            flex: col.width ? `0 0 ${typeof col.width === 'number' ? col.width + 'px' : col.width}` : '1',
                            padding: '10px 16px',
                            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.05em', color: C.textSecondary,
                            ...col.headerStyle,
                        }}>
                            {col.label}
                        </div>
                    ))}
                </div>
            )}

            {/* Virtual scrollable body */}
            <div
                ref={parentRef}
                style={{ height, overflow: 'auto', contain: 'strict' }}
            >
                <div style={{
                    height: virtualizer.getTotalSize(),
                    width: '100%',
                    position: 'relative',
                }}>
                    {virtualizer.getVirtualItems().map(virtualRow => {
                        const row = rows[virtualRow.index];
                        const isSelected = selectedIds?.has(row.id);

                        return (
                            <div
                                key={row.id}
                                data-index={virtualRow.index}
                                ref={virtualizer.measureElement}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: rowHeight,
                                    transform: `translateY(${virtualRow.start}px)`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    borderBottom: '1px solid var(--divider)',
                                    cursor: onRowClick ? 'pointer' : 'default',
                                    background: isSelected ? 'var(--accent-light)' : 'transparent',
                                    transition: 'background 0.1s',
                                    ...(rowStyle?.(row)),
                                }}
                                onClick={() => onRowClick?.(row)}
                            >
                                {onSelectRow && (
                                    <div style={{ width: 40, flexShrink: 0, padding: '0 8px', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected || false}
                                            onChange={() => onSelectRow(row.id)}
                                            onClick={e => e.stopPropagation()}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    </div>
                                )}
                                {columns.map(col => (
                                    <div key={col.key} style={{
                                        flex: col.width ? `0 0 ${typeof col.width === 'number' ? col.width + 'px' : col.width}` : '1',
                                        padding: '12px 16px',
                                        fontSize: 14, color: C.text,
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        ...col.cellStyle,
                                    }}>
                                        {col.render(row, virtualRow.index)}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export type { VirtualTableRow, VirtualTableColumn, VirtualTableProps };
