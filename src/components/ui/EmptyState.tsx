import { Icon } from './SharedComponents';
import { styles } from '../../utils/helpers';

/**
 * EmptyState — contextual empty state with icon, title, description, and optional CTA.
 * Usage:
 *   <EmptyState icon="clock" title="Nema radnih sati" description="Dodajte prvi unos" action={{ label: "Dodaj sate", onClick: fn }} />
 */
export function EmptyState({ icon, emoji, title, description, action, compact = false }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: compact ? '24px 16px' : '48px 24px',
            textAlign: 'center',
            animation: 'fadeIn 0.4s ease'
        }}>
            {emoji ? (
                <div style={{ fontSize: compact ? 32 : 48, marginBottom: compact ? 8 : 16, lineHeight: 1 }}>{emoji}</div>
            ) : icon ? (
                <div style={{
                    width: compact ? 48 : 64, height: compact ? 48 : 64,
                    borderRadius: compact ? 14 : 18,
                    background: 'var(--accent-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: compact ? 8 : 16,
                    color: 'var(--accent)'
                }}>
                    <Icon name={icon} size={compact ? 22 : 28} />
                </div>
            ) : null}
            <div style={{
                fontSize: compact ? 14 : 16,
                fontWeight: 700,
                color: 'var(--text-secondary)',
                marginBottom: 4,
                letterSpacing: '-0.2px'
            }}>
                {title}
            </div>
            {description && (
                <div style={{
                    fontSize: compact ? 12 : 13,
                    color: 'var(--text-muted)',
                    maxWidth: 280,
                    lineHeight: 1.5
                }}>
                    {description}
                </div>
            )}
            {action && (
                <button onClick={action.onClick} style={{
                    ...styles.btn,
                    marginTop: compact ? 12 : 20,
                    fontSize: 13,
                    padding: '8px 18px',
                    borderRadius: 10,
                    gap: 6
                }}>
                    {action.icon && <Icon name={action.icon} size={14} />}
                    {action.label}
                </button>
            )}
        </div>
    );
}
