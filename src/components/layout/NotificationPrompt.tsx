import { C } from '../../utils/helpers';
import { Icon } from '../ui/SharedComponents';

interface NotifPromptProps {
    onEnable: () => void;
    onDismiss: () => void;
}

export function NotificationPrompt({ onEnable, onDismiss }: NotifPromptProps) {
    return (
        <div style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 1000, background: C.sidebar, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px', maxWidth: 320, boxShadow: '0 8px 30px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 28 }}><Icon name="bell" size={28} /></div>
            <div className="u-flex-1">
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Uključi obavijesti</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>Primaj obavijesti na mobitel u stvarnom vremenu</div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={onEnable} className="s-btn" style={{ fontSize: 12, padding: '6px 14px' }}>Aktiviraj</button>
                    <button onClick={onDismiss} className="s-btn-sec" style={{ fontSize: 12, padding: '6px 14px' }}>Ne sada</button>
                </div>
            </div>
        </div>
    );
}
