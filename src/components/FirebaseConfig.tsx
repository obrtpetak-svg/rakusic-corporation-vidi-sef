import React, { useState, useEffect, type ChangeEvent } from 'react';
import { useApp, initFirebase } from '../context/AppContext';
import { Icon, Field, Input } from './ui/SharedComponents';
import { C, styles } from '../utils/helpers';

interface FirebaseConfigState {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
}

export function FirebaseConfigScreen(): React.JSX.Element {
    const { handleFirebaseConfig, loadError } = useApp();
    const [config, setConfig] = useState<FirebaseConfigState>({ apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Reset loading state if AppContext reports an error
    useEffect(() => {
        if (loadError) {
            setLoading(false);
            setError('Firebase greška: ' + loadError);
        }
    }, [loadError]);

    const update = (k: keyof FirebaseConfigState, v: string): void => { setConfig(c => ({ ...c, [k]: v })); setError(''); };

    const validate = (): boolean => {
        if (!config.apiKey || !config.authDomain || !config.projectId) { setError('API Key, Auth Domain i Project ID su obavezni'); return false; }
        if (!config.apiKey.startsWith('AIza')) { setError("API Key nije valjan (mora početi sa 'AIza')"); return false; }
        if (!config.authDomain.includes('firebaseapp.com')) { setError("Auth Domain mora sadržavati 'firebaseapp.com'"); return false; }
        return true;
    };

    const submit = async (): Promise<void> => {
        if (!validate()) return;
        setLoading(true); setError('');
        try {
            localStorage.setItem('vidime-firebase-config-v9', JSON.stringify(config));
            if (!initFirebase(config)) { setError('Greška pri povezivanju sa Firebase. Provjeri config.'); setLoading(false); return; }
            handleFirebaseConfig(config);
        } catch (e) { setError('Greška: ' + (e as Error).message); setLoading(false); }
    };

    return (
        <div style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 700 }}>
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, background: C.accent, borderRadius: 20, marginBottom: 20 }}>
                        <Icon name="project" size={42} />
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: C.text }}>🔥 Firebase Konfiguracija</div>
                    <div style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6 }}>Poveži aplikaciju sa Firebase bazom podataka</div>
                </div>
                <div style={styles.card}>
                    {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: C.red, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="warning" size={16} />{error}</div>}
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>Firebase Configuration</div>
                    <Field label="API Key" required><Input value={config.apiKey} onChange={(e: ChangeEvent<HTMLInputElement>) => update('apiKey', e.target.value)} placeholder="AIzaSy..." /></Field>
                    <Field label="Auth Domain" required><Input value={config.authDomain} onChange={(e: ChangeEvent<HTMLInputElement>) => update('authDomain', e.target.value)} placeholder="tvoj-projekt.firebaseapp.com" /></Field>
                    <Field label="Project ID" required><Input value={config.projectId} onChange={(e: ChangeEvent<HTMLInputElement>) => update('projectId', e.target.value)} placeholder="tvoj-projekt" /></Field>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Field label="Storage Bucket"><Input value={config.storageBucket} onChange={(e: ChangeEvent<HTMLInputElement>) => update('storageBucket', e.target.value)} placeholder="tvoj-projekt.appspot.com" /></Field>
                        <Field label="Messaging Sender ID"><Input value={config.messagingSenderId} onChange={(e: ChangeEvent<HTMLInputElement>) => update('messagingSenderId', e.target.value)} placeholder="123456789" /></Field>
                    </div>
                    <Field label="App ID"><Input value={config.appId} onChange={(e: ChangeEvent<HTMLInputElement>) => update('appId', e.target.value)} placeholder="1:123456789:web:abc123" /></Field>
                    <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '12px 16px', marginTop: 16, fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
                        <div style={{ fontWeight: 700, color: C.blue, marginBottom: 6 }}>💡 Gdje naći Firebase config?</div>
                        1. Firebase Console → Project Settings<br />
                        2. Scroll down → Your apps → Web app<br />
                        3. Kopiraj firebaseConfig objekt
                    </div>
                    <button onClick={submit} disabled={loading} style={{ ...styles.btn, width: '100%', justifyContent: 'center', marginTop: 24, padding: '16px 24px', fontSize: 16, opacity: loading ? 0.6 : 1 }}>
                        {loading ? 'Povezujem...' : '🔥 Poveži Firebase i nastavi'}
                    </button>
                </div>
            </div>
        </div>
    );
}
