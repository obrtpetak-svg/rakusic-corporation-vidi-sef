import React, { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';
import { useApp } from '../context/AppContext';
import { Icon, Field, Input } from './ui/SharedComponents';
import { C, styles, hashPin } from '../utils/helpers';

const MAX_ATTEMPTS = 5;
const BASE_LOCKOUT = 30; // seconds, doubles each lockout

const MODULES = ['Projekti', 'Radnici', 'Evidencija sati', 'Vozila', 'GPS Nadzor', 'Računi', 'Izvještaji', 'Obavijesti'];

export function AuthScreen(): React.JSX.Element {
    const { handleUserLogin, users } = useApp();
    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [lockoutEnd, setLockoutEnd] = useState(0);
    const [bootedCount, setBootedCount] = useState(0);
    const attemptsRef = useRef(0);
    const lockoutCountRef = useRef(0);

    // Staggered module boot animation
    useEffect(() => {
        if (bootedCount >= MODULES.length) return;
        const t = setTimeout(() => setBootedCount(c => c + 1), 200 + bootedCount * 120);
        return () => clearTimeout(t);
    }, [bootedCount]);

    const submit = async (): Promise<void> => {
        // Rate limiting check
        const now = Date.now();
        if (lockoutEnd > now) {
            const secs = Math.ceil((lockoutEnd - now) / 1000);
            setError(`⏳ Previše pokušaja. Pokušajte za ${secs}s.`);
            return;
        }

        if (!username || !pin) { setError('Unesite korisničko ime i PIN.'); return; }
        setLoading(true); setError('');
        if (!users || users.length === 0) { setError('Nema korisnika u sustavu.'); setLoading(false); return; }

        const hashedPin = await hashPin(pin);
        const user = users.find((u: Record<string, unknown>) => u.username === username.toLowerCase() && u.pin === hashedPin && u.active !== false);

        if (user) {
            attemptsRef.current = 0;
            handleUserLogin(user);
        } else {
            attemptsRef.current += 1;
            if (attemptsRef.current >= MAX_ATTEMPTS) {
                lockoutCountRef.current += 1;
                const lockSecs = BASE_LOCKOUT * Math.pow(2, lockoutCountRef.current - 1);
                setLockoutEnd(Date.now() + lockSecs * 1000);
                attemptsRef.current = 0;
                setError(`🔒 Zaključano na ${lockSecs}s zbog ${MAX_ATTEMPTS} neuspjelih pokušaja.`);
            } else {
                setError(`Pogrešno korisničko ime ili PIN. (${attemptsRef.current}/${MAX_ATTEMPTS})`);
            }
            setLoading(false);
        }
    };

    return (
        <div style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 420 }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <img src="/icon-192.png" alt="Rakušić Corporation" style={{ width: 72, height: 72, borderRadius: 20, marginBottom: 16 }} />
                    <div style={{ fontSize: 26, fontWeight: 900, color: C.text, letterSpacing: '0.02em' }}>RAKUŠIĆ corporation</div>
                    <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Operativni centar upravljanja</div>
                    <a href="https://vi-di-sef.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.accent, fontWeight: 600, textDecoration: 'none', marginTop: 8, display: 'inline-block' }}>powered by Vi-Di-Sef</a>
                </div>

                {/* Module boot sequence */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 10px', marginBottom: 24, minHeight: 28 }}>
                    {MODULES.map((m, i) => (
                        <div key={m} style={{
                            fontSize: 11, fontWeight: 600, color: i < bootedCount ? 'var(--green)' : 'var(--text-muted)',
                            opacity: i < bootedCount ? 1 : 0.3,
                            transform: i < bootedCount ? 'translateY(0)' : 'translateY(4px)',
                            transition: 'all 0.3s ease',
                            fontFamily: 'var(--font-mono)',
                        }}>
                            {i < bootedCount ? '✓' : '○'} {m}
                        </div>
                    ))}
                </div>

                <div style={styles.card}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20 }}>Prijava u sustav</div>
                    <Field label="Korisničko ime" required><Input placeholder="Unesite korisničko ime" value={username} onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && submit()} /></Field>
                    <Field label="PIN" required><Input type="password" placeholder="Unesite PIN" value={pin} onChange={(e: ChangeEvent<HTMLInputElement>) => setPin(e.target.value)} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && submit()} maxLength={10} /></Field>
                    {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 16, background: 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: 8 }}>{error}</div>}
                    <button onClick={submit} disabled={loading || lockoutEnd > Date.now()} style={{ ...styles.btn, width: '100%', justifyContent: 'center', opacity: loading ? 0.6 : 1 }}>{loading ? 'Prijava...' : '🔐 Prijavi se'}</button>
                </div>
                <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 12, marginTop: 20, lineHeight: 1.6 }}>
                    Za podatke i više informacija javite se na<br />
                    <a href="mailto:info@vi-di.me" style={{ color: C.accent, textDecoration: 'none' }}>info@vi-di.me</a>
                </div>
            </div>
        </div>
    );
}
