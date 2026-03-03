import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { C, styles } from '../utils/helpers';

const MODULES = ['Projekti', 'Radnici', 'Evidencija sati', 'Vozila', 'Otpremnice', 'Računi', 'Izvještaji', 'Obavijesti'];
const MAX_ATTEMPTS = 5;
const BASE_LOCKOUT = 30; // seconds, doubles each lockout

export function AppLogin() {
    const { handleFirebaseLogin } = useApp();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [bootedCount, setBootedCount] = useState(0);
    const [lockoutEnd, setLockoutEnd] = useState(0);
    const [lockoutDisplay, setLockoutDisplay] = useState(0);
    const attemptsRef = useRef(0);
    const lockoutCountRef = useRef(0);

    // Staggered module boot animation
    useEffect(() => {
        if (bootedCount >= MODULES.length) return;
        const t = setTimeout(() => setBootedCount(c => c + 1), 200 + bootedCount * 120);
        return () => clearTimeout(t);
    }, [bootedCount]);

    // Lockout countdown timer
    useEffect(() => {
        if (lockoutEnd <= Date.now()) { setLockoutDisplay(0); return; }
        const tick = setInterval(() => {
            const remaining = Math.ceil((lockoutEnd - Date.now()) / 1000);
            if (remaining <= 0) { setLockoutDisplay(0); setLockoutEnd(0); clearInterval(tick); }
            else setLockoutDisplay(remaining);
        }, 500);
        return () => clearInterval(tick);
    }, [lockoutEnd]);

    const submit = async () => {
        // Rate limiting check
        if (lockoutEnd > Date.now()) {
            setError(`🔒 Zaključano na ${lockoutDisplay}s zbog previše neuspjelih pokušaja.`);
            return;
        }
        if (!username.trim() || !password.trim()) { setError('Unesite korisničko ime i lozinku.'); return; }
        if (password.trim().length < 6) { setError('Lozinka mora imati najmanje 6 znakova.'); return; }
        setLoading(true); setError('');
        try {
            const result = await handleFirebaseLogin(username.trim(), password.trim());
            if (result) {
                attemptsRef.current = 0; // Reset on success
            } else {
                attemptsRef.current += 1;
                if (attemptsRef.current >= MAX_ATTEMPTS) {
                    lockoutCountRef.current += 1;
                    const lockSecs = BASE_LOCKOUT * Math.pow(2, lockoutCountRef.current - 1);
                    setLockoutEnd(Date.now() + lockSecs * 1000);
                    attemptsRef.current = 0;
                    setError(`🔒 Zaključano na ${lockSecs}s nakon ${MAX_ATTEMPTS} neuspjelih pokušaja.`);
                } else {
                    setError(`Pogrešno korisničko ime ili lozinka. (${attemptsRef.current}/${MAX_ATTEMPTS})`);
                }
            }
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code || '';
            const msg = (err as { message?: string })?.message || '';
            console.error('[Login] Error:', code, msg);

            // Track attempts for credential errors
            const isCredentialError = code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential';
            if (isCredentialError) {
                attemptsRef.current += 1;
                if (attemptsRef.current >= MAX_ATTEMPTS) {
                    lockoutCountRef.current += 1;
                    const lockSecs = BASE_LOCKOUT * Math.pow(2, lockoutCountRef.current - 1);
                    setLockoutEnd(Date.now() + lockSecs * 1000);
                    attemptsRef.current = 0;
                    setError(`🔒 Zaključano na ${lockSecs}s nakon ${MAX_ATTEMPTS} neuspjelih pokušaja.`);
                } else {
                    setError(`Pogrešno korisničko ime ili lozinka. (${attemptsRef.current}/${MAX_ATTEMPTS})`);
                }
            } else if (code === 'auth/too-many-requests') {
                setError('Previše pokušaja prijave. Pričekajte 5 minuta pa pokušajte ponovno.');
            } else if (code === 'auth/network-request-failed') {
                setError('Nema internetske veze. Provjerite mrežu.');
            } else {
                setError(`Firebase greška: ${code || msg || 'Nepoznata greška'}`);
            }
            // 🔒 Audit: failed login attempt (modular SDK)
            try {
                const { getDb } = await import('../context/firebaseCore');
                const { addDoc: fbAdd, collection: fbCol } = await import('firebase/firestore');
                const db = getDb();
                if (db) {
                    fbAdd(fbCol(db, 'auditLog'), {
                        action: 'LOGIN_FAILED', user: username.trim(), reason: code || 'unknown',
                        timestamp: new Date().toISOString(), userAgent: navigator.userAgent.slice(0, 200),
                    });
                }
            } catch (e) { /* ignore */ }
        }
        setLoading(false);
    };

    return (
        <div style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A', minHeight: '100vh' }}>
            <div style={{ width: '100%', maxWidth: 420, padding: '0 16px' }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#F1F5F9', letterSpacing: '0.02em' }}>RAKUŠIĆ corporation</div>
                    <img src="/icon-192.png" alt="Rakušić Corporation" style={{ width: 72, height: 72, borderRadius: 20, marginTop: 16, marginBottom: 8 }} />
                    <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>Operativni centar upravljanja</div>
                    <a href="https://vi-di-sef.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.accent, fontWeight: 600, textDecoration: 'none', marginTop: 8, display: 'inline-block' }}>powered by Vi-Di-Sef</a>
                </div>

                {/* Module boot sequence animation */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 10px', marginBottom: 24, minHeight: 28 }}>
                    {MODULES.map((m, i) => (
                        <div key={m} style={{
                            fontSize: 11, fontWeight: 600,
                            color: i < bootedCount ? C.accent : '#94A3B8',
                            opacity: i < bootedCount ? 1 : 0.3,
                            transform: i < bootedCount ? 'translateY(0)' : 'translateY(4px)',
                            transition: 'all 0.3s ease',
                            fontFamily: 'var(--font-mono)',
                        }}>
                            {i < bootedCount ? '✓' : '○'} {m}
                        </div>
                    ))}
                </div>

                <div style={{ background: '#1E293B', borderRadius: 16, padding: '24px 20px', border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>Sigurna prijava</div>
                        <div style={{ fontSize: 10, color: '#94A3B8', marginLeft: 'auto', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>🔒 Firebase Auth</div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>Korisničko ime *</label>
                        <input placeholder="npr. admin.josip" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #334155', background: '#0F172A', color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>Lozinka *</label>
                        <input type="password" placeholder="Unesite lozinku" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #334155', background: '#0F172A', color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    {error && <div style={{ color: '#EF4444', fontSize: 13, marginBottom: 16, background: 'rgba(239,68,68,0.15)', padding: '10px 14px', borderRadius: 8 }}>{error}</div>}
                    <button onClick={submit} disabled={loading || lockoutEnd > Date.now()} style={{ ...styles.btn, width: '100%', justifyContent: 'center', opacity: (loading || lockoutEnd > Date.now()) ? 0.6 : 1 }}>
                        {loading ? 'Prijava...' : lockoutDisplay > 0 ? `🔒 Zaključano (${lockoutDisplay}s)` : '🔐 Prijavi se'}
                    </button>
                </div>
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <button onClick={() => {
                        try {
                            localStorage.clear();
                            sessionStorage.clear();
                            // Clear all IndexedDB databases (Firebase offline cache)
                            if (window.indexedDB) {
                                indexedDB.databases?.().then(dbs => dbs.forEach(db => { if (db.name) indexedDB.deleteDatabase(db.name); }));
                                // Fallback for browsers without databases()
                                ['firebaseLocalStorageDb', 'firestore/[DEFAULT]/rakusic-corporation-vidi-sef/main'].forEach(name => {
                                    try { indexedDB.deleteDatabase(name); } catch { }
                                });
                            }
                            // Clear service worker caches
                            if ('caches' in window) { caches.keys().then(names => names.forEach(n => caches.delete(n))); }
                            setTimeout(() => window.location.reload(), 300);
                        } catch { window.location.reload(); }
                    }} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 11, cursor: 'pointer', padding: '6px 12px', textDecoration: 'underline' }}>
                        ⚠️ Problemi s prijavom? Obriši cache
                    </button>
                </div>
                <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>
                    Za podatke i više informacija javite se na<br />
                    <a href="mailto:info@vi-di.me" style={{ color: C.accent, textDecoration: 'none' }}>info@vi-di.me</a>
                </div>
            </div>
        </div>
    );
}
