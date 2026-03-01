import React, { useState } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { useApp } from '../context/AppContext';
import { Icon, Field, Input } from './ui/SharedComponents';
import { C, styles } from '../utils/helpers';

export function AppLogin() {
    const confirm = useConfirm();
    const { handleAppLogin } = useApp();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const submit = () => {
        if (username === 'Vi-Di.me' && password === '45654565Vm') handleAppLogin();
        else setError('Pogrešno korisničko ime ili lozinka');
    };

    const resetSetup = async () => {
        if (await confirm('Ovo će obrisati Firebase config i omogućiti čist početak. Nastavi?')) {
            localStorage.removeItem('vidime-firebase-config-v9');
            window.location.reload();
        }
    };

    return (
        <div style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 420 }}>
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <img src="/icon-192.png" alt="Vi-Di-Sef" style={{ width: 72, height: 72, borderRadius: 20, marginBottom: 16 }} />
                    <div style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: '-0.02em' }}>Vi-Di-Sef</div>
                    <a href="https://www.vi-di.me" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: C.accent, fontWeight: 600, textDecoration: 'none', marginTop: 6, display: 'inline-block' }}>www.Vi-Di.me</a>
                </div>
                <div style={styles.card}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20 }}>Pristup aplikaciji</div>
                    <Field label="Korisničko ime" required><Input placeholder="Unesite korisničko ime" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} /></Field>
                    <Field label="Lozinka" required><Input type="password" placeholder="Unesite lozinku" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} /></Field>
                    {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 16, background: 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: 8 }}>{error}</div>}
                    <button onClick={submit} style={{ ...styles.btn, width: '100%', justifyContent: 'center' }}>Prijavi se</button>
                    <button onClick={resetSetup} style={{ ...styles.btnSecondary, width: '100%', justifyContent: 'center', marginTop: 12 }}>🔄 Reset Setup (za novo testiranje)</button>
                </div>
                <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 12, marginTop: 20, lineHeight: 1.6 }}>
                    Za podatke i više informacija javite se na<br />
                    <a href="mailto:info@vi-di.me" style={{ color: C.accent, textDecoration: 'none' }}>info@vi-di.me</a>
                </div>
            </div>
        </div>
    );
}
