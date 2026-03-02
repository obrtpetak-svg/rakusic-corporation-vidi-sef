import React, { useState, useRef, useEffect } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { useApp, setDoc, clearCollection, batchSet, update as updateDoc, restoreItem, permanentDelete } from '../context/AppContext';
import { Icon, Modal, Field, Input, Textarea, useIsMobile } from './ui/SharedComponents';
import { C, styles, genId, fmtDateTime, hashPin } from '../utils/helpers';

export function SettingsPage({ workerFilterId }) {
    const confirm = useConfirm();
    const { companyProfile, currentUser, auditLog, addAuditLog, loadAuditLog, handleResetFirebase,
        projects, workers, users, timesheets, invoices, otpremnice, vehicles, smjestaj, obaveze, dailyLogs,
        sessionConfig, forceLogoutAll, updateSessionDuration, updateSyncMode, lastSync,
        loadDeletedItems, cleanupOldDeleted, changePassword, exportUserData } = useApp();
    const [editing, setEditing] = useState(false);
    const [trashItems, setTrashItems] = useState(null);
    const [trashLoading, setTrashLoading] = useState(false);
    const [form, setForm] = useState({});
    const [showAudit, setShowAudit] = useState(false);
    const [backupStatus, setBackupStatus] = useState('');
    const [restoreStatus, setRestoreStatus] = useState('');
    const fileRef = useRef(null);
    useEffect(() => { loadAuditLog?.(); }, [loadAuditLog]);
    const isMobile = useIsMobile();
    const isWorker = !!workerFilterId;

    // PIN change state
    const [pinForm, setPinForm] = useState({ currentPin: '', newPin: '', confirmPin: '' });
    const [pinMsg, setPinMsg] = useState('');

    // Password change state (Firebase Auth)
    const [pwForm, setPwForm] = useState({ currentPw: '', newPw: '', confirmPw: '' });
    const [pwMsg, setPwMsg] = useState('');
    const [pwLoading, setPwLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [exportMsg, setExportMsg] = useState('');

    const doChangePassword = async () => {
        setPwMsg(''); setPwLoading(true);
        if (!pwForm.currentPw || !pwForm.newPw) { setPwMsg('❌ Unesite trenutnu i novu lozinku'); setPwLoading(false); return; }
        if (pwForm.newPw !== pwForm.confirmPw) { setPwMsg('❌ Nove lozinke se ne podudaraju'); setPwLoading(false); return; }
        try {
            await changePassword(pwForm.currentPw, pwForm.newPw);
            setPwForm({ currentPw: '', newPw: '', confirmPw: '' });
            setPwMsg('✅ Lozinka uspješno promijenjena!');
        } catch (e) {
            setPwMsg('❌ ' + (e.message || 'Greška pri promjeni lozinke'));
        }
        setPwLoading(false);
    };

    const doExportData = async () => {
        setExportLoading(true); setExportMsg('');
        try {
            await exportUserData();
            setExportMsg('✅ Podatci preuzeti!');
        } catch (e) {
            setExportMsg('❌ ' + e.message);
        }
        setExportLoading(false);
        setTimeout(() => setExportMsg(''), 4000);
    };

    const startEdit = () => {
        setForm({
            companyName: companyProfile?.companyName || '',
            oib: companyProfile?.oib || '',
            email: companyProfile?.email || '',
            phone: companyProfile?.phone || '',
            address: companyProfile?.address || '',
            city: companyProfile?.city || '',
            country: companyProfile?.country || 'Hrvatska',
            currency: companyProfile?.currency || 'EUR',
            defaultBreak: companyProfile?.defaultBreak || 30,
            notes: companyProfile?.notes || ''
        });
        setEditing(true);
    };

    const doSave = async () => {
        const updated = { ...companyProfile, ...form, updatedAt: new Date().toISOString() };
        await setDoc('config', 'companyProfile', updated);
        setEditing(false);
        await addAuditLog('SETTINGS_UPDATED', 'Postavke tvrtke ažurirane');
    };

    const resetFirebase = async () => {
        if (!(await confirm('⚠️ Ovo će resetirati Firebase konfiguraciju. Morat ćete ponovo unijeti podatke. Nastaviti?'))) return;
        handleResetFirebase();
    };

    const resetApp = () => {
        const conf = prompt('Upišite "RESET" za potpuni reset aplikacije:');
        if (conf !== 'RESET') return;
        localStorage.clear();
        window.location.reload();
    };

    const clearAuditLog = async () => {
        if (!(await confirm('Obrisati cijeli audit log?'))) return;
        await clearCollection('auditLog');
    };

    // ── FULL BACKUP ──────────────────────────────────────
    const doFullBackup = async () => {
        try {
            setBackupStatus('Pripremam backup...');
            const firebaseConfig = JSON.parse(localStorage.getItem('vidime-firebase-config-v9') || '{}');
            const backup = {
                version: '3.0.0',
                createdAt: new Date().toISOString(),
                firebaseConfig,
                companyProfile: companyProfile || {},
                projects: projects || [],
                workers: workers || [],
                users: users || [],
                timesheets: timesheets || [],
                invoices: invoices || [],
                otpremnice: otpremnice || [],
                vehicles: vehicles || [],
                smjestaj: smjestaj || [],
                obaveze: obaveze || [],
                auditLog: auditLog || [],
                dailyLogs: dailyLogs || [],
            };
            const json = JSON.stringify(backup, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const date = new Date().toISOString().slice(0, 10);
            a.href = url;
            a.download = `ViDiSef-backup-${date}.json`;
            a.click();
            URL.revokeObjectURL(url);
            setBackupStatus('✅ Backup preuzet!');
            await addAuditLog('BACKUP_CREATED', `Full backup kreiran (${(json.length / 1024).toFixed(0)} KB)`);
            setTimeout(() => setBackupStatus(''), 4000);
        } catch (e) {
            setBackupStatus('❌ Greška: ' + e.message);
        }
    };

    // ── RESTORE FROM BACKUP ──────────────────────────────
    const doRestore = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!(await confirm('⚠️ Ovo će ZAMIJENITI sve trenutne podatke podacima iz backupa! Jeste li sigurni?'))) {
            e.target.value = '';
            return;
        }

        try {
            setRestoreStatus('Čitam datoteku...');
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.version) {
                setRestoreStatus('❌ Nevažeća backup datoteka');
                return;
            }

            // Restore Firebase config
            if (data.firebaseConfig && data.firebaseConfig.projectId) {
                setRestoreStatus('Vraćam Firebase konfiguraciju...');
                localStorage.setItem('vidime-firebase-config-v9', JSON.stringify(data.firebaseConfig));
            }

            // Restore company profile
            if (data.companyProfile && Object.keys(data.companyProfile).length > 0) {
                setRestoreStatus('Vraćam podatke tvrtke...');
                await setDoc('config', 'companyProfile', data.companyProfile);
            }

            // Restore collections
            const collections = [
                ['users', data.users],
                ['projects', data.projects],
                ['workers', data.workers],
                ['timesheets', data.timesheets],
                ['invoices', data.invoices],
                ['otpremnice', data.otpremnice],
                ['vehicles', data.vehicles],
                ['smjestaj', data.smjestaj],
                ['obaveze', data.obaveze],
                ['auditLog', data.auditLog],
                ['dailyLogs', data.dailyLogs],
            ];

            for (const [name, items] of collections) {
                if (items && items.length > 0) {
                    setRestoreStatus(`Vraćam ${name} (${items.length})...`);
                    await clearCollection(name);
                    await batchSet(name, items);
                }
            }

            setRestoreStatus('✅ Restore završen! Osvježavam...');
            await addAuditLog('BACKUP_RESTORED', `Restore iz ${file.name} (${(text.length / 1024).toFixed(0)} KB)`);
            setTimeout(() => window.location.reload(), 2000);
        } catch (err) {
            setRestoreStatus('❌ Greška: ' + err.message);
        }
        e.target.value = '';
    };

    // ── PIN CHANGE ───────────────────────────────────────────────
    const changePin = async () => {
        setPinMsg('');
        if (!pinForm.currentPin) { setPinMsg('❌ Unesite trenutni PIN'); return; }
        if (!pinForm.newPin || pinForm.newPin.length < 4) { setPinMsg('❌ Novi PIN mora imati najmanje 4 znaka'); return; }
        if (pinForm.newPin !== pinForm.confirmPin) { setPinMsg('❌ Novi PIN-ovi se ne podudaraju'); return; }

        const userId = currentUser?.id;
        const userDoc = users.find(u => u.id === userId);
        if (!userDoc) { setPinMsg('❌ Korisnik nije pronađen'); return; }

        const hashedCurrentPin = await hashPin(pinForm.currentPin);
        if (userDoc.pin !== hashedCurrentPin) { setPinMsg('❌ Trenutni PIN nije točan'); return; }

        try {
            const hashedNewPin = await hashPin(pinForm.newPin);
            await updateDoc('users', userId, { pin: hashedNewPin });
            setPinForm({ currentPin: '', newPin: '', confirmPin: '' });
            setPinMsg('✅ PIN uspješno promijenjen!');
            await addAuditLog('PIN_CHANGED', `${currentUser?.name} promijenio/la PIN`);
        } catch (e) {
            setPinMsg('❌ Greška: ' + e.message);
        }
    };

    // ── WORKER SETTINGS PAGE ─────────────────────────────────────
    if (isWorker) {
        return (
            <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 24 }}> Postavke</div>

                {/* PIN change for worker */}
                <div style={styles.card}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>🔑 Promjena PIN-a</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>Promijenite PIN za pristup aplikaciji. PIN mora imati najmanje 4 znaka.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12, maxWidth: 600 }}>
                        <Field label="Trenutni PIN" required><Input type="password" value={pinForm.currentPin} onChange={e => setPinForm(f => ({ ...f, currentPin: e.target.value }))} placeholder="Unesite trenutni PIN" maxLength={10} /></Field>
                        <Field label="Novi PIN" required><Input type="password" value={pinForm.newPin} onChange={e => setPinForm(f => ({ ...f, newPin: e.target.value }))} placeholder="Novi PIN (min. 4)" maxLength={10} /></Field>
                        <Field label="Potvrdi novi PIN" required><Input type="password" value={pinForm.confirmPin} onChange={e => setPinForm(f => ({ ...f, confirmPin: e.target.value }))} placeholder="Ponovi novi PIN" maxLength={10} /></Field>
                    </div>
                    {pinMsg && <div style={{ fontSize: 13, fontWeight: 600, color: pinMsg.startsWith('✅') ? C.green : C.red, marginTop: 12 }}>{pinMsg}</div>}
                    <button onClick={changePin} disabled={!pinForm.currentPin || !pinForm.newPin} style={{ ...styles.btn, marginTop: 16, opacity: !pinForm.currentPin || !pinForm.newPin ? 0.5 : 1 }}>🔑 Promijeni PIN</button>
                </div>

                {/* Password change (Firebase Auth) */}
                <div style={{ ...styles.card, marginTop: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>🔐 Promjena lozinke (Firebase Auth)</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>Lozinka za prijavu u sustav. Pravila: najmanje 8 znakova, 1 veliko slovo, 1 broj.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12, maxWidth: 600 }}>
                        <Field label="Trenutna lozinka" required><Input type="password" value={pwForm.currentPw} onChange={e => setPwForm(f => ({ ...f, currentPw: e.target.value }))} placeholder="Unesite trenutnu" /></Field>
                        <Field label="Nova lozinka" required><Input type="password" value={pwForm.newPw} onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} placeholder="Min 8, 1 veliko, 1 broj" /></Field>
                        <Field label="Potvrdi novu" required><Input type="password" value={pwForm.confirmPw} onChange={e => setPwForm(f => ({ ...f, confirmPw: e.target.value }))} placeholder="Ponovi novu lozinku" /></Field>
                    </div>
                    {pwMsg && <div style={{ fontSize: 13, fontWeight: 600, color: pwMsg.startsWith('✅') ? C.green : C.red, marginTop: 12 }}>{pwMsg}</div>}
                    <button onClick={doChangePassword} disabled={pwLoading || !pwForm.currentPw || !pwForm.newPw} style={{ ...styles.btn, marginTop: 16, opacity: pwLoading ? 0.5 : 1 }}>
                        {pwLoading ? '⏳ Mijenjam...' : '🔐 Promijeni lozinku'}
                    </button>
                </div>

                {/* GDPR Data Export */}
                <div style={{ ...styles.card, marginTop: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>📦 Preuzmi moje podatke</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>GDPR — preuzmite sve svoje osobne podatke u JSON formatu (evidencija sati, dnevni logovi, zahtjevi za dopust).</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button onClick={doExportData} disabled={exportLoading} style={{ ...styles.btn, opacity: exportLoading ? 0.5 : 1 }}>
                            {exportLoading ? '⏳ Pripremam...' : '📦 Preuzmi moje podatke'}
                        </button>
                        {exportMsg && <span style={{ fontSize: 13, fontWeight: 600, color: exportMsg.startsWith('✅') ? C.green : C.red }}>{exportMsg}</span>}
                    </div>
                </div>

                {/* App info */}
                <div style={{ ...styles.card, marginTop: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>ℹ️ Aplikacija</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div><span style={styles.label}>Verzija</span><div style={{ fontSize: 14, fontWeight: 600, color: C.accent }}>3.0.0</div></div>
                        <div><span style={styles.label}>Korisnik</span><div style={{ fontSize: 14, fontWeight: 600 }}>{currentUser?.name}</div></div>
                        <div><span style={styles.label}>Uloga</span><div style={{ fontSize: 14, fontWeight: 600 }}>Radnik</div></div>
                        <div><span style={styles.label}>Korisničko ime</span><div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>{currentUser?.username || '—'}</div></div>
                    </div>
                </div>
            </div>
        );
    }

    // ── ADMIN SETTINGS PAGE ─────────────────────────────────────
    return (
        <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 24 }}> Postavke</div>

            {/* Company info */}
            <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>🏢 Podaci tvrtke</div>
                    <button onClick={startEdit} style={styles.btnSmall}><Icon name="edit" size={12} /> Uredi</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                    {[
                        ['Naziv', companyProfile?.companyName],
                        ['OIB', companyProfile?.oib],
                        ['Email', companyProfile?.email],
                        ['Telefon', companyProfile?.phone],
                        ['Adresa', companyProfile?.address],
                        ['Grad', companyProfile?.city],
                        ['Država', companyProfile?.country || 'Hrvatska'],
                        ['Valuta', companyProfile?.currency || 'EUR'],
                        ['Default pauza', `${companyProfile?.defaultBreak || 30} min`],
                    ].map(([label, value]) => (
                        <div key={label}><span style={styles.label}>{label}</span><div style={{ fontSize: 14, fontWeight: 600, color: C.textDim }}>{value || '—'}</div></div>
                    ))}
                </div>
            </div>

            {/* Firebase */}
            <div style={{ ...styles.card, marginTop: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>🔥 Firebase konfiguracija</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                    {(() => {
                        const cfg = JSON.parse(localStorage.getItem('vidime-firebase-config-v9') || '{}');
                        return [['Project ID', cfg.projectId], ['API Key', cfg.apiKey ? cfg.apiKey.slice(0, 8) + '...' : '—']].map(([l, v]) => (
                            <div key={l}><span style={styles.label}>{l}</span><div style={{ fontSize: 13, color: C.textDim, fontFamily: 'monospace' }}>{v || '—'}</div></div>
                        ));
                    })()}
                </div>
                <button onClick={resetFirebase} style={{ ...styles.btnSecondary, marginTop: 12, color: C.yellow }}>🔄 Resetiraj Firebase</button>
            </div>

            {/* ── BACKUP / RESTORE ────────────────────────── */}
            <div style={{ ...styles.card, marginTop: 16, borderColor: 'rgba(4,120,87,0.3)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>💾 Backup i Restore</div>

                {/* Full Backup */}
                <div style={{ background: C.bg, borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 4 }}>💾 Full Backup</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
                        Preuzmi kompletni backup koji uključuje: Firebase konfiguraciju, podatke o tvrtki, sve projekte, radnike, sate, račune, otpremnice, vozila, smještaj, obaveze
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <button onClick={doFullBackup} style={{ ...styles.btn, background: C.green }}>
                            💾 Preuzmi Full Backup
                        </button>
                        {backupStatus && <span style={{ fontSize: 13, fontWeight: 600, color: backupStatus.startsWith('❌') ? C.red : C.green }}>{backupStatus}</span>}
                    </div>
                </div>

                {/* Restore */}
                <div style={{ background: 'rgba(220,38,38,0.04)', borderRadius: 10, padding: 16, border: '1px dashed rgba(220,38,38,0.2)' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 4 }}>📥 Restore iz Backupa</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
                        Vrati SVE podatke iz backup datoteke. ⚠️ Ovo će zamijeniti trenutne podatke!
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <input ref={fileRef} type="file" accept=".json" onChange={doRestore} style={{ display: 'none' }} />
                        <button onClick={() => fileRef.current?.click()} style={{ ...styles.btn, background: C.yellow }}>
                            📥 Vrati SVE iz Backupa
                        </button>
                        {restoreStatus && <span style={{ fontSize: 13, fontWeight: 600, color: restoreStatus.startsWith('❌') ? C.red : C.green }}>{restoreStatus}</span>}
                    </div>
                </div>
            </div>

            {/* Audit Log */}
            <div style={{ ...styles.card, marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>📝 Audit log ({auditLog.length})</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setShowAudit(!showAudit)} style={styles.btnSmall}>{showAudit ? 'Sakrij' : 'Prikaži'}</button>
                        <button onClick={clearAuditLog} style={styles.btnDanger}><Icon name="trash" size={12} /> Obriši</button>
                    </div>
                </div>
                {showAudit && (
                    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                        {auditLog.slice().reverse().slice(0, 100).map(l => (
                            <div key={l.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}7A`, fontSize: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                    <span style={{ fontWeight: 600, color: C.textDim }}>{l.action}</span>
                                    <span style={{ color: C.textMuted }}>{fmtDateTime(l.timestamp)}</span>
                                </div>
                                <div style={{ color: C.textMuted }}>{l.user} — {l.details}</div>
                            </div>
                        ))}
                        {auditLog.length === 0 && <div style={{ color: C.textMuted, padding: 12 }}>Nema zapisa</div>}
                    </div>
                )}
            </div>

            {/* App info */}
            <div style={{ ...styles.card, marginTop: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}> Aplikacija</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div><span style={styles.label}>Verzija</span><div style={{ fontSize: 14, fontWeight: 600, color: C.accent }}>3.0.0</div></div>
                    <div><span style={styles.label}>Korisnik</span><div style={{ fontSize: 14, fontWeight: 600 }}>{currentUser?.name}</div></div>
                    <div><span style={styles.label}>Uloga</span><div style={{ fontSize: 14, fontWeight: 600 }}>{currentUser?.role === 'admin' ? 'Administrator' : 'Radnik'}</div></div>
                </div>
            </div>

            {/* Session & Security */}
            {!isWorker && (
                <div style={{ ...styles.card, marginTop: 16, borderColor: 'rgba(99,102,241,0.2)' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>🔐 Sesija i sigurnost</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>Trajanje sesije određuje koliko dugo korisnici ostaju prijavljeni bez ponovnog unosa PIN-a.</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                        {[15, 30, 60, 120, 480].map(min => (
                            <button key={min} onClick={() => updateSessionDuration(min)} style={{
                                padding: '8px 16px', borderRadius: 10, border: `2px solid ${(sessionConfig?.sessionDuration || 60) === min ? '#6366F1' : C.border}`,
                                background: (sessionConfig?.sessionDuration || 60) === min ? 'rgba(99,102,241,0.08)' : '#fff',
                                color: (sessionConfig?.sessionDuration || 60) === min ? '#6366F1' : C.textDim,
                                fontWeight: (sessionConfig?.sessionDuration || 60) === min ? 700 : 500, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                            }}>
                                {min < 60 ? `${min} min` : `${min / 60}h`}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>🚪 Odjavi sve korisnike</div>
                            <div style={{ fontSize: 11, color: C.textMuted }}>Svi aktivni korisnici bit će odmah odjavljeni iz aplikacije.</div>
                        </div>
                        <button onClick={async () => { if (await confirm('Sigurno želite odjaviti SVE korisnike?')) { await forceLogoutAll(); await addAuditLog('FORCE_LOGOUT_ALL', 'Admin je odijavio sve korisnike'); } }} style={{ ...styles.btnSmall, color: C.red, borderColor: 'rgba(239,68,68,0.3)', padding: '8px 14px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            Odjavi sve
                        </button>
                    </div>

                    {/* Sync Mode */}
                    <div style={{ marginTop: 20, padding: '16px', borderRadius: 10, background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.12)' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>🔄 Način sinkronizacije</div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>
                            Realtime = instant promjene. Polling = osvježava podatke u intervalu (štedni mod).
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {[
                                { val: 0, label: '⚡ Realtime' },
                                { val: 5, label: '5 min' },
                                { val: 30, label: '30 min' },
                                { val: 60, label: '60 min' },
                            ].map(opt => (
                                <button key={opt.val} onClick={() => updateSyncMode(opt.val)} style={{
                                    padding: '8px 16px', borderRadius: 10,
                                    border: `2px solid ${(sessionConfig?.syncMode || 0) === opt.val ? '#6366F1' : C.border}`,
                                    background: (sessionConfig?.syncMode || 0) === opt.val ? 'rgba(99,102,241,0.08)' : '#fff',
                                    color: (sessionConfig?.syncMode || 0) === opt.val ? '#6366F1' : C.textDim,
                                    fontWeight: (sessionConfig?.syncMode || 0) === opt.val ? 700 : 500,
                                    fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                                }}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        {lastSync && (sessionConfig?.syncMode || 0) > 0 && (
                            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>
                                ⏱️ Zadnji sync: {lastSync.toLocaleTimeString('hr')} — sljedeći za {sessionConfig.syncMode} min
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Danger zone */}
            <div style={{ ...styles.card, marginTop: 16, borderColor: 'rgba(239,68,68,0.3)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.red, marginBottom: 8 }}>⚠️ Opasna zona</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>Potpuni reset aplikacije: briše sve lokalne podatke i resetira Firebase konfiguraciju.</div>
                <button onClick={resetApp} style={{ ...styles.btn, background: C.red }}>🗑️ Potpuni reset aplikacije</button>
            </div>

            {/* Password change (Firebase Auth) — Admin */}
            <div style={{ ...styles.card, marginTop: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>🔐 Promjena lozinke (Firebase Auth)</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>Lozinka za prijavu u sustav. Pravila: najmanje 8 znakova, 1 veliko slovo, 1 broj.</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12, maxWidth: 600 }}>
                    <Field label="Trenutna lozinka" required><Input type="password" value={pwForm.currentPw} onChange={e => setPwForm(f => ({ ...f, currentPw: e.target.value }))} placeholder="Unesite trenutnu" /></Field>
                    <Field label="Nova lozinka" required><Input type="password" value={pwForm.newPw} onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} placeholder="Min 8, 1 veliko, 1 broj" /></Field>
                    <Field label="Potvrdi novu" required><Input type="password" value={pwForm.confirmPw} onChange={e => setPwForm(f => ({ ...f, confirmPw: e.target.value }))} placeholder="Ponovi novu lozinku" /></Field>
                </div>
                {pwMsg && <div style={{ fontSize: 13, fontWeight: 600, color: pwMsg.startsWith('✅') ? C.green : C.red, marginTop: 12 }}>{pwMsg}</div>}
                <button onClick={doChangePassword} disabled={pwLoading || !pwForm.currentPw || !pwForm.newPw} style={{ ...styles.btn, marginTop: 16, opacity: pwLoading ? 0.5 : 1 }}>
                    {pwLoading ? '⏳ Mijenjam...' : '🔐 Promijeni lozinku'}
                </button>
            </div>

            {/* PIN change for admin */}
            <div style={{ ...styles.card, marginTop: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>🔑 Promjena PIN-a</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>Promijenite PIN za pristup admin računu.</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12, maxWidth: 600 }}>
                    <Field label="Trenutni PIN" required><Input type="password" value={pinForm.currentPin} onChange={e => setPinForm(f => ({ ...f, currentPin: e.target.value }))} placeholder="Unesite trenutni PIN" maxLength={10} /></Field>
                    <Field label="Novi PIN" required><Input type="password" value={pinForm.newPin} onChange={e => setPinForm(f => ({ ...f, newPin: e.target.value }))} placeholder="Novi PIN (min. 4)" maxLength={10} /></Field>
                    <Field label="Potvrdi novi PIN" required><Input type="password" value={pinForm.confirmPin} onChange={e => setPinForm(f => ({ ...f, confirmPin: e.target.value }))} placeholder="Ponovi novi PIN" maxLength={10} /></Field>
                </div>
                {pinMsg && <div style={{ fontSize: 13, fontWeight: 600, color: pinMsg.startsWith('✅') ? C.green : C.red, marginTop: 12 }}>{pinMsg}</div>}
                <button onClick={changePin} disabled={!pinForm.currentPin || !pinForm.newPin} style={{ ...styles.btn, marginTop: 16, opacity: !pinForm.currentPin || !pinForm.newPin ? 0.5 : 1 }}> Promijeni PIN</button>
            </div>

            {/* Edit modal */}
            {editing && (
                <Modal title="Uredi podatke tvrtke" onClose={() => setEditing(false)} wide>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                        <Field label="Naziv tvrtke"><Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} /></Field>
                        <Field label="OIB"><Input value={form.oib} onChange={e => setForm(f => ({ ...f, oib: e.target.value }))} /></Field>
                        <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
                        <Field label="Telefon"><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></Field>
                        <Field label="Adresa"><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></Field>
                        <Field label="Grad"><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></Field>
                        <Field label="Država"><Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></Field>
                        <Field label="Valuta"><Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} /></Field>
                        <Field label="Default pauza (min)"><Input type="number" value={form.defaultBreak} onChange={e => setForm(f => ({ ...f, defaultBreak: parseInt(e.target.value) || 0 }))} /></Field>
                    </div>
                    <Field label="Napomene"><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></Field>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                        <button onClick={() => setEditing(false)} style={styles.btnSecondary}>Odustani</button>
                        <button onClick={doSave} style={styles.btn}><Icon name="check" size={16} /> Spremi</button>
                    </div>
                </Modal>
            )}
            {/* Trash / Koš za smeće */}
            {!isWorker && (
                <div style={styles.card}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>🗑️ Koš za smeće</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={async () => { setTrashLoading(true); setTrashItems(await loadDeletedItems()); setTrashLoading(false); }} style={styles.btnSmall}>
                                {trashLoading ? '⏳' : '🔄'} Učitaj
                            </button>
                            <button onClick={async () => { const n = await cleanupOldDeleted(); alert(`Obrisano ${n} stavki starijih od 30 dana`); setTrashItems(await loadDeletedItems()); }} style={{ ...styles.btnSmall, color: C.red, borderColor: 'rgba(239,68,68,0.3)' }}>
                                🧹 Očisti stare (30d+)
                            </button>
                        </div>
                    </div>
                    {trashItems === null && <div style={{ fontSize: 13, color: C.textMuted }}>Klikni "Učitaj" za prikaz obrisanih stavki</div>}
                    {trashItems && trashItems.length === 0 && <div style={{ fontSize: 13, color: C.green }}>✅ Koš je prazan</div>}
                    {trashItems && trashItems.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                            {trashItems.map(item => (
                                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--input-bg)', borderRadius: 8, fontSize: 13 }}>
                                    <span style={{ flex: 1, color: C.text }}>{item.name || item.title || item.description || item.id}</span>
                                    <span style={{ color: C.textMuted, fontSize: 11 }}>{item._collection}</span>
                                    <span style={{ color: C.textMuted, fontSize: 11 }}>{item.deletedAt?.slice(0, 10)}</span>
                                    <button onClick={async () => { await restoreItem(item._collection, item.id); setTrashItems(prev => prev.filter(t => t.id !== item.id)); }} style={{ ...styles.btnSmall, padding: '4px 10px' }}>↩ Vrati</button>
                                    <button onClick={async () => { if (!(await confirm('Trajno obrisati?'))) return; await permanentDelete(item._collection, item.id); setTrashItems(prev => prev.filter(t => t.id !== item.id)); }} style={{ ...styles.btnSmall, color: C.red, borderColor: 'rgba(239,68,68,0.3)', padding: '4px 10px' }}>✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
