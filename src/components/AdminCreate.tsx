import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Icon, Field, Input } from './ui/SharedComponents';
import { C, styles, hashPin } from '../utils/helpers';

export function AdminCreateScreen() {
    const { handleAdminCreate } = useApp();
    const [data, setData] = useState({ name: '', username: '', pin: '', confirmPin: '' });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const update = (k, v) => { setData(d => ({ ...d, [k]: v })); setError(''); };

    const submit = async () => {
        if (!data.name.trim()) { setError('Ime je obavezno'); return; }
        if (!data.username.trim() || data.username.length < 3) { setError('Korisničko ime mora imati najmanje 3 znaka'); return; }
        if (!data.pin || data.pin.length < 4) { setError('PIN mora imati najmanje 4 znaka'); return; }
        if (data.pin !== data.confirmPin) { setError('PIN-ovi se ne podudaraju'); return; }
        setSaving(true);
        try {
            const hashedPin = await hashPin(data.pin);
            const admin = { id: 'admin_' + Date.now(), name: data.name, username: data.username.toLowerCase(), pin: hashedPin, role: 'admin', active: true, createdAt: new Date().toISOString() };
            await handleAdminCreate(admin);
        } catch (e) { setError('Greška: ' + e.message); setSaving(false); }
    };

    return (
        <div style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 500 }}>
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, background: C.accent, borderRadius: 20, marginBottom: 20 }}>
                        <Icon name="user" size={42} />
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: C.text }}>Kreiraj Admin Račun</div>
                    <div style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6 }}>Postavi korisničko ime i PIN za pristup aplikaciji</div>
                </div>
                <div style={styles.card}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}><Icon name="user" size={20} /> Administrator podaci</div>
                    {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: C.red, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="warning" size={16} />{error}</div>}
                    <Field label="Ime i prezime" required><Input value={data.name} onChange={e => update('name', e.target.value)} placeholder="Ivan Horvat" autoFocus /></Field>
                    <Field label="Korisničko ime" required><Input value={data.username} onChange={e => update('username', e.target.value.toLowerCase())} placeholder="admin (min. 3 znaka)" maxLength={20} /></Field>
                    <Field label="PIN" required><Input type="password" value={data.pin} onChange={e => update('pin', e.target.value)} placeholder="Unesi PIN (min. 4 znaka)" maxLength={10} /></Field>
                    <Field label="Potvrdi PIN" required><Input type="password" value={data.confirmPin} onChange={e => update('confirmPin', e.target.value)} placeholder="Ponovi PIN" maxLength={10} /></Field>
                    <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '12px 16px', marginTop: 16, fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
                        <div style={{ fontWeight: 700, color: C.blue, marginBottom: 6 }}>Savjet za sigurnost</div>
                        • Koristi jedinstveno korisničko ime<br />• PIN barem 4 znaka (preporučeno 6)<br />• Zapiši podatke na sigurno mjesto
                    </div>
                    <button onClick={submit} disabled={saving || !data.name.trim() || !data.username.trim() || !data.pin} style={{ ...styles.btn, width: '100%', justifyContent: 'center', marginTop: 24, padding: '16px 24px', fontSize: 16, opacity: saving || !data.name.trim() || !data.username.trim() || !data.pin ? 0.5 : 1 }}>
                        {saving ? 'Spremam...' : 'Kreiraj admin račun'}
                    </button>
                </div>
            </div>
        </div>
    );
}
