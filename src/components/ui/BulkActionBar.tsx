import { useConfirm } from './ConfirmModal';
import { Icon } from './SharedComponents';

/**
 * BulkActionBar — sticky bottom bar for bulk operations on selected table rows.
 * Appears when ≥1 row is selected. Positioned above mobile tab bar.
 */
export function BulkActionBar({ count, actions = [], onClear }) {
    const confirm = useConfirm();
    if (count === 0) return null;
    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 150,
            background: 'var(--bg-elevated)',
            borderTop: '1px solid var(--border)',
            padding: '10px 20px',
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
            animation: 'slideUp 0.2s cubic-bezier(0.16,1,0.3,1)'
        }}>
            {/* Count badge */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, fontWeight: 700, color: 'var(--text)',
                flexShrink: 0
            }}>
                <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: 'var(--accent)', color: 'var(--text-on-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums'
                }}>
                    {count}
                </div>
                <span className="hide-mobile">odabrano</span>
            </div>

            {/* Spacer */}
            <div className="u-flex-1" />

            {/* Actions */}
            {actions.map((action, i) => (
                <button
                    key={i}
                    onClick={async () => {
                        if (action.confirm && !(await confirm(`Jeste li sigurni? (${count} stavki)`))) return;
                        action.onClick();
                    }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 8,
                        fontSize: 12, fontWeight: 700,
                        cursor: 'pointer',
                        border: `1px solid ${action.color === 'red' ? 'var(--red)' : action.color === 'green' ? 'var(--green)' : 'var(--border)'}`,
                        background: action.color === 'red' ? 'var(--red-light)' : action.color === 'green' ? 'var(--green-light)' : 'var(--card)',
                        color: action.color === 'red' ? 'var(--red)' : action.color === 'green' ? 'var(--green)' : 'var(--text)',
                        transition: 'all 0.15s ease'
                    }}
                >
                    {action.icon && <Icon name={action.icon} size={14} />}
                    {action.label}
                </button>
            ))}

            {/* Clear */}
            <button onClick={onClear} style={{
                background: 'none', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer',
                padding: 6, fontSize: 16, lineHeight: 1,
                display: 'flex', alignItems: 'center'
            }} title="Poništi odabir">
                <Icon name="close" size={16} />
            </button>
        </div>
    );
}
