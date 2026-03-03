import { useState, useRef, useEffect } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { useApp, setDoc, clearCollection, batchSet, update as updateDoc, restoreItem, permanentDelete, add, remove } from '../context/AppContext';
import { Icon, Modal, Field, Input, Textarea, useIsMobile } from './ui/SharedComponents';
import { C, styles, genId, fmtDateTime } from '../utils/helpers';
import { warn } from '../utils/logger';
import './settings.css';

export function SettingsPage({ workerFilterId }) {
    const confirm = useConfirm();
    const { companyProfile, currentUser, auditLog, addAuditLog, loadAuditLog, handleResetFirebase,
        projects, workers, users, timesheets, invoices, otpremnice, vehicles, smjestaj, obaveze, dailyLogs,
        sessionConfig, forceLogoutAll, updateSessionDuration, updateSyncMode, lastSync,
        loadDeletedItems, cleanupOldDeleted, changePassword, exportUserData } = useApp();
    const [editing, setEditing] = useState(false);
    const [trashItems, setTrashItems] = useState(null);
    const [provisionStatus, setProvisionStatus] = useState('');
    const [provisionLoading, setProvisionLoading] = useState(false);
    const [trashLoading, setTrashLoading] = useState(false);
    // User management state
    const [showAddUser, setShowAddUser] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [userForm, setUserForm] = useState({ name: '', username: '', role: 'radnik', password: '' });
    const [userMsg, setUserMsg] = useState('');
    const [form, setForm] = useState({});
    const [showAudit, setShowAudit] = useState(false);
    const [backupStatus, setBackupStatus] = useState('');
    const [restoreStatus, setRestoreStatus] = useState('');
    const fileRef = useRef(null);
    useEffect(() => { loadAuditLog?.(); }, [loadAuditLog]);
    const isMobile = useIsMobile();
    const isWorker = !!workerFilterId;

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


    // ── WORKER SETTINGS PAGE ─────────────────────────────────────
    if (isWorker) {
        return (
            <div>
                <div className="settings__title"> Postavke</div>


                {/* Password change (Firebase Auth) */}
                <div className="s-card" className="settings__section">
                    <div className="settings__section-title">🔐 Promjena lozinke (Firebase Auth)</div>
                    <div className="settings__section-desc">Lozinka za prijavu u sustav. Pravila: najmanje 8 znakova, 1 veliko slovo, 1 broj.</div>
                    <div className={`settings__grid-3 ${isMobile ? 'settings__grid-3--mobile' : 'settings__grid-3--desktop'}`}>
                        <Field label="Trenutna lozinka" required><Input type="password" value={pwForm.currentPw} onChange={e => setPwForm(f => ({ ...f, currentPw: e.target.value }))} placeholder="Unesite trenutnu" /></Field>
                        <Field label="Nova lozinka" required><Input type="password" value={pwForm.newPw} onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} placeholder="Min 8, 1 veliko, 1 broj" /></Field>
                        <Field label="Potvrdi novu" required><Input type="password" value={pwForm.confirmPw} onChange={e => setPwForm(f => ({ ...f, confirmPw: e.target.value }))} placeholder="Ponovi novu lozinku" /></Field>
                    </div>
                    {pwMsg && <div className={`settings__status ${pwMsg.startsWith('✅') ? 'settings__status--success' : 'settings__status--error'}`} className="u-mt-12">{pwMsg}</div>}
                    <button onClick={doChangePassword} disabled={pwLoading || !pwForm.currentPw || !pwForm.newPw} className="s-btn" style={{ marginTop: 16, opacity: pwLoading ? 0.5 : 1 }}>
                        {pwLoading ? '⏳ Mijenjam...' : '🔐 Promijeni lozinku'}
                    </button>
                </div>

                {/* GDPR Data Export */}
                <div className="s-card" className="settings__section">
                    <div className="settings__section-title">📦 Preuzmi moje podatke</div>
                    <div className="settings__section-desc">GDPR — preuzmite sve svoje osobne podatke u JSON formatu (evidencija sati, dnevni logovi, zahtjevi za dopust).</div>
                    <div className="u-flex-center u-gap-12">
                        <button onClick={doExportData} disabled={exportLoading} className="s-btn" style={{ opacity: exportLoading ? 0.5 : 1 }}>
                            {exportLoading ? '⏳ Pripremam...' : '📦 Preuzmi moje podatke'}
                        </button>
                        {exportMsg && <span className={`settings__status ${exportMsg.startsWith('✅') ? 'settings__status--success' : 'settings__status--error'}`}>{exportMsg}</span>}
                    </div>
                </div>

                {/* App info */}
                <div className="s-card" className="settings__section">
                    <div className="u-section-title u-mb-12">ℹ️ Aplikacija</div>
                    <div className="settings__grid-2--static">
                        <div><span className="s-label">Verzija</span><div className="settings__field-value settings__field-value--accent">3.0.0</div></div>
                        <div><span className="s-label">Korisnik</span><div className="settings__field-value">{currentUser?.name}</div></div>
                        <div><span className="s-label">Uloga</span><div className="settings__field-value">Radnik</div></div>
                        <div><span className="s-label">Korisničko ime</span><div className="settings__field-value settings__field-value--mono">{currentUser?.username || '—'}</div></div>
                    </div>
                </div>
            </div>
        );
    }

    // ── ADMIN SETTINGS PAGE ─────────────────────────────────────
    return (
        <div>
            <div className="settings__title"> Postavke</div>

            {/* Company info */}
            <div className="s-card">
                <div className="u-flex-between u-mb-16">
                    <div className="u-section-title">🏢 Podaci tvrtke</div>
                    <button onClick={startEdit} className="s-btn-sm"><Icon name="edit" size={12} /> Uredi</button>
                </div>
                <div className={`settings__grid-2 ${isMobile ? 'settings__grid-2--mobile' : 'settings__grid-2--desktop'}`}>
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
                        <div key={label}><span className="s-label">{label}</span><div className="settings__field-value">{value || '—'}</div></div>
                    ))}
                </div>
            </div>

            {/* Firebase */}
            <div className="s-card" className="settings__section">
                <div className="u-section-title u-mb-12">🔥 Firebase konfiguracija</div>
                <div className={`settings__grid-2 ${isMobile ? 'settings__grid-2--mobile' : 'settings__grid-2--desktop'}`}>
                    {(() => {
                        const cfg = JSON.parse(localStorage.getItem('vidime-firebase-config-v9') || '{}');
                        return [['Project ID', cfg.projectId], ['API Key', cfg.apiKey ? cfg.apiKey.slice(0, 8) + '...' : '—']].map(([l, v]) => (
                            <div key={l}><span className="s-label">{l}</span><div className="settings__field-mono">{v || '—'}</div></div>
                        ));
                    })()}
                </div>
                <button onClick={resetFirebase} className="s-btn-sec" style={{ marginTop: 12, color: C.yellow }}>🔄 Resetiraj Firebase</button>
            </div>

            {/* ── BACKUP / RESTORE ────────────────────────── */}
            <div className="s-card" className="settings__section settings__section--backup">
                <div className="u-section-title u-mb-16">💾 Backup i Restore</div>

                {/* Full Backup */}
                <div className="settings__backup-panel">
                    <div className="settings__section-sub">💾 Full Backup</div>
                    <div className="settings__section-note">
                        Preuzmi kompletni backup koji uključuje: Firebase konfiguraciju, podatke o tvrtki, sve projekte, radnike, sate, račune, otpremnice, vozila, smještaj, obaveze
                    </div>
                    <div className="settings__action-row">
                        <button onClick={doFullBackup} className="s-btn" style={{ background: C.green }}>
                            💾 Preuzmi Full Backup
                        </button>
                        {backupStatus && <span className={`settings__status ${backupStatus.startsWith('❌') ? 'settings__status--error' : 'settings__status--success'}`}>{backupStatus}</span>}
                    </div>
                </div>

                {/* Restore */}
                <div className="settings__restore-panel">
                    <div className="settings__section-sub">📥 Restore iz Backupa</div>
                    <div className="settings__section-note">
                        Vrati SVE podatke iz backup datoteke. ⚠️ Ovo će zamijeniti trenutne podatke!
                    </div>
                    <div className="settings__action-row">
                        <input ref={fileRef} type="file" accept=".json" onChange={doRestore} className="u-hidden" />
                        <button onClick={() => fileRef.current?.click()} className="s-btn" style={{ background: C.yellow }}>
                            📥 Vrati SVE iz Backupa
                        </button>
                        {restoreStatus && <span className={`settings__status ${restoreStatus.startsWith('❌') ? 'settings__status--error' : 'settings__status--success'}`}>{restoreStatus}</span>}
                    </div>
                </div>
            </div>

            {/* Audit Log */}
            <div className="s-card" style={{ marginTop: 16 }}>
                <div className="u-card-header">
                    <div className="u-section-title">📝 Audit log ({auditLog.length})</div>
                    <div className="u-flex-gap-8">
                        <button onClick={() => setShowAudit(!showAudit)} className="s-btn-sm">{showAudit ? 'Sakrij' : 'Prikaži'}</button>
                        <button onClick={clearAuditLog} className="s-btn-danger"><Icon name="trash" size={12} /> Obriši</button>
                    </div>
                </div>
                {showAudit && (
                    <div className="settings__audit-scroll">
                        {auditLog.slice().reverse().slice(0, 100).map(l => (
                            <div key={l.id} className="settings__audit-item">
                                <div className="settings__audit-row">
                                    <span className="settings__audit-action">{l.action}</span>
                                    <span className="u-text-muted">{fmtDateTime(l.timestamp)}</span>
                                </div>
                                <div className="u-text-muted">{l.user} — {l.details}</div>
                            </div>
                        ))}
                        {auditLog.length === 0 && <div style={{ color: C.textMuted, padding: 12 }}>Nema zapisa</div>}
                    </div>
                )}
            </div>

            {/* App info */}
            <div className="s-card" className="settings__section">
                <div className="u-section-title u-mb-12"> Aplikacija</div>
                <div className="settings__grid-2--static">
                    <div><span className="s-label">Verzija</span><div className="settings__field-value settings__field-value--accent">3.0.0</div></div>
                    <div><span className="s-label">Korisnik</span><div className="settings__field-value">{currentUser?.name}</div></div>
                    <div><span className="s-label">Uloga</span><div className="settings__field-value">{currentUser?.role === 'admin' ? 'Administrator' : 'Radnik'}</div></div>
                </div>
            </div>

            {/* Session & Security */}
            {!isWorker && (
                <div className="s-card" className="settings__section settings__section--bordered">
                    <div className="settings__section-title">🔐 Sesija i sigurnost</div>
                    <div className="settings__section-desc">Trajanje sesije određuje koliko dugo korisnici ostaju prijavljeni bez ponovnog unosa PIN-a.</div>
                    <div className="settings__toggle-wrap">
                        {[15, 30, 60, 120, 480].map(min => (
                            <button key={min} onClick={() => updateSessionDuration(min)} className={`settings__toggle-btn ${(sessionConfig?.sessionDuration || 60) === min ? 'settings__toggle-btn--active' : 'settings__toggle-btn--inactive'}`}>
                                {min < 60 ? `${min} min` : `${min / 60}h`}
                            </button>
                        ))}
                    </div>
                    <div className="settings__security-row settings__security-row--danger">
                        <div className="u-flex-1">
                            <div className="settings__section-sub">🚪 Odjavi sve korisnike</div>
                            <div className="u-fs-11 u-text-muted">Svi aktivni korisnici bit će odmah odjavljeni iz aplikacije.</div>
                        </div>
                        <button onClick={async () => { if (await confirm('Sigurno želite odjaviti SVE korisnike?')) { await forceLogoutAll(); await addAuditLog('FORCE_LOGOUT_ALL', 'Admin je odijavio sve korisnike'); } }} className="s-btn-sm" style={{ color: C.red, borderColor: 'rgba(239,68,68,0.3)', padding: '8px 14px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            Odjavi sve
                        </button>
                    </div>

                    {/* Bulk Provision Firebase Auth – v2 */}
                    <div className="settings__security-row settings__security-row--success">
                        <div className="u-flex-1">
                            <div className="settings__section-sub">👥 Aktiviraj prijavu za sve radnike</div>
                            <div className="u-fs-11 u-text-muted">Kreira Firebase Auth račune za sve radnike koji ih nemaju (ista lozinka za sve).</div>
                        </div>
                        <button onClick={async () => {
                            if (!(await confirm('Kreirati Firebase Auth račune za sve radnike s lozinkom RakusicCorp2026.! ?'))) return;
                            setProvisionLoading(true); setProvisionStatus('');
                            try {
                                const { getAuth: ga } = await import('../context/firebaseCore');
                                const auth = ga();
                                if (!auth?.currentUser) throw new Error('Niste prijavljeni');
                                const token = await auth.currentUser.getIdToken();
                                const resp = await fetch('/api/admin', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                    body: JSON.stringify({ action: 'bulk-provision', defaultPassword: 'RakusicCorp2026.!' }),
                                });
                                const data = await resp.json();
                                if (resp.ok) {
                                    setProvisionStatus(`✅ ${data.summary}`);
                                    await addAuditLog('BULK_PROVISION', data.summary);
                                } else {
                                    setProvisionStatus(`❌ ${data.error}`);
                                }
                            } catch (e: any) {
                                setProvisionStatus(`❌ ${e.message}`);
                            }
                            setProvisionLoading(false);
                        }} disabled={provisionLoading} className="s-btn-sm" style={{ color: C.green, borderColor: 'rgba(16,185,129,0.3)', padding: '8px 14px', fontWeight: 700, whiteSpace: 'nowrap', opacity: provisionLoading ? 0.5 : 1 }}>
                            {provisionLoading ? '⏳ Kreiram...' : '🔑 Aktiviraj sve'}
                        </button>
                    </div>
                    {provisionStatus && <div className={`settings__provision-msg ${provisionStatus.startsWith('✅') ? 'settings__provision-msg--success' : 'settings__provision-msg--error'}`}>{provisionStatus}</div>}

                    {/* Sync Mode */}
                    <div className="settings__security-row--sync">
                        <div className="settings__section-sub">🔄 Način sinkronizacije</div>
                        <div className="settings__section-note">
                            Realtime = instant promjene. Polling = osvježava podatke u intervalu (štedni mod).
                        </div>
                        <div className="settings__toggle-wrap">
                            {[
                                { val: 0, label: '⚡ Realtime' },
                                { val: 5, label: '5 min' },
                                { val: 30, label: '30 min' },
                                { val: 60, label: '60 min' },
                            ].map(opt => (
                                <button key={opt.val} onClick={() => updateSyncMode(opt.val)} className={`settings__toggle-btn ${(sessionConfig?.syncMode || 0) === opt.val ? 'settings__toggle-btn--active' : 'settings__toggle-btn--inactive'}`}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        {lastSync && (sessionConfig?.syncMode || 0) > 0 && (
                            <div className="settings__sync-info">
                                ⏱️ Zadnji sync: {lastSync.toLocaleTimeString('hr')} — sljedeći za {sessionConfig.syncMode} min
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Danger zone */}
            <div className="s-card" className="settings__section settings__section--danger">
                <div className="settings__danger-title">⚠️ Opasna zona</div>
                <div className="settings__danger-desc">Potpuni reset aplikacije: briše sve lokalne podatke i resetira Firebase konfiguraciju.</div>
                <button onClick={resetApp} className="s-btn" style={{ background: C.red }}>🗑️ Potpuni reset aplikacije</button>
            </div>

            {/* ── KORISNICI (User Management) ──────────────── */}
            <div className="s-card" className="settings__section settings__section--users">
                <div className="u-flex-between u-mb-16">
                    <div>
                        <div className="u-section-title">👥 Korisnici sustava</div>
                        <div className="u-fs-12 u-text-muted" className="u-mt-2">Upravljanje korisnicima koji se mogu prijaviti u aplikaciju ({users?.length || 0})</div>
                    </div>
                    <button onClick={() => { setShowAddUser(true); setUserForm({ name: '', username: '', role: 'radnik', password: '' }); setUserMsg(''); setEditingUser(null); }} className="s-btn" style={{ fontSize: 12, padding: '8px 16px' }}>+ Dodaj korisnika</button>
                </div>

                {/* User list */}
                <div className="settings__user-list">
                    {(users || []).map(u => (
                        <div key={u.id} className="settings__user-card">
                            <div className="settings__user-info">
                                <div className={`settings__user-avatar ${u.role === 'admin' ? 'settings__user-avatar--admin' : u.role === 'leader' ? 'settings__user-avatar--leader' : 'settings__user-avatar--worker'}`}>
                                    {u.role === 'admin' ? '👑' : u.role === 'leader' ? '⭐' : '👷'}
                                </div>
                                <div>
                                    <div className="settings__user-name">{u.name || u.username}</div>
                                    <div className="u-fs-11 u-text-muted">{u.username} · <span style={{ fontWeight: 600, color: u.role === 'admin' ? C.red : u.role === 'leader' ? '#F59E0B' : '#6366F1' }}>{u.role || 'radnik'}</span></div>
                                </div>
                            </div>
                            <div className="settings__user-actions">
                                <button onClick={() => { setEditingUser(u); setUserForm({ name: u.name || '', username: u.username || '', role: u.role || 'radnik', password: '' }); setShowAddUser(true); setUserMsg(''); }} className="s-btn-sec" style={{ fontSize: 11, padding: '6px 10px' }}>✏️</button>
                                {u.id !== currentUser?.id && <button onClick={async () => {
                                    if (await confirm('Obrisati korisnika ' + (u.name || u.username) + '?')) {
                                        await remove('users', u.id);
                                        await addAuditLog('USER_DELETED', `${currentUser?.name} obrisao korisnika ${u.name}`);
                                    }
                                }} className="s-btn-sec" style={{ fontSize: 11, padding: '6px 10px', color: C.red }}>🗑️</button>}
                            </div>
                        </div>
                    ))}
                    {(!users || users.length === 0) && <div className="settings__users-empty">Nema korisnika</div>}
                </div>
                {userMsg && <div className={`settings__status ${userMsg.startsWith('✅') ? 'settings__status--success' : 'settings__status--error'}`} style={{ marginTop: 12, textAlign: 'center' }}>{userMsg}</div>}
            </div>

            {/* Add/Edit User Modal */}
            {showAddUser && (
                <Modal title={editingUser ? '✏️ Uredi korisnika' : '👤 Novi korisnik'} onClose={() => setShowAddUser(false)} wide>
                    <div className={`settings__form-grid ${isMobile ? 'settings__form-grid--mobile' : 'settings__form-grid--desktop'} u-gap-16`}>
                        <Field label="Ime i prezime" required><Input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} placeholder="npr. Ivan Horvat" /></Field>
                        <Field label="Korisničko ime" required><Input value={userForm.username} onChange={e => setUserForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s+/g, '.') }))} placeholder="npr. ivan.horvat" disabled={!!editingUser} /></Field>
                        <Field label="Uloga" required>
                            <select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))} className="settings__form-select">
                                <option value="radnik">👷 Radnik</option>
                                <option value="leader">⭐ Voditelj</option>
                                <option value="admin">👑 Admin</option>
                            </select>
                        </Field>
                        {!editingUser && <Field label="Lozinka" required><Input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8, 1 veliko, 1 broj" /></Field>}
                    </div>
                    {userMsg && <div className={`settings__status ${userMsg.startsWith('✅') ? 'settings__status--success' : 'settings__status--error'}`} className="u-mt-12">{userMsg}</div>}
                    <div className="settings__form-footer">
                        <button onClick={() => setShowAddUser(false)} className="s-btn-sec">Odustani</button>
                        <button onClick={async () => {
                            setUserMsg('');
                            if (!userForm.name.trim() || !userForm.username.trim()) { setUserMsg('❌ Ime i korisničko ime su obavezni'); return; }
                            try {
                                if (editingUser) {
                                    // Update existing user
                                    await updateDoc('users', editingUser.id, { name: userForm.name.trim(), role: userForm.role });
                                    await addAuditLog('USER_UPDATED', `${currentUser?.name} ažurirao korisnika ${userForm.name} (${userForm.role})`);
                                    setUserMsg('✅ Korisnik ažuriran!');
                                } else {
                                    // Create new user
                                    if (!userForm.password || userForm.password.length < 8) { setUserMsg('❌ Lozinka mora imati min 8 znakova'); return; }
                                    if (!/[A-Z]/.test(userForm.password)) { setUserMsg('❌ Lozinka mora sadržavati barem 1 veliko slovo'); return; }
                                    if (!/[0-9]/.test(userForm.password)) { setUserMsg('❌ Lozinka mora sadržavati barem 1 broj'); return; }
                                    // Check duplicate username
                                    if (users?.some(u => u.username === userForm.username.trim())) { setUserMsg('❌ Korisničko ime već postoji'); return; }
                                    // Create Firebase Auth account via API
                                    try {
                                        const { getAuth: ga } = await import('../context/firebaseCore');
                                        const authObj = ga();
                                        if (authObj?.currentUser) {
                                            const tok = await authObj.currentUser.getIdToken();
                                            await fetch('/api/admin', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tok}` },
                                                body: JSON.stringify({ action: 'create-user', username: userForm.username.trim(), password: userForm.password, displayName: userForm.name.trim() }),
                                            });
                                        }
                                    } catch (authErr: any) {
                                        warn('[Settings] Firebase Auth provision error:', authErr);
                                    }
                                    const newUser = { id: genId(), name: userForm.name.trim(), username: userForm.username.trim(), role: userForm.role, createdAt: new Date().toISOString(), createdBy: currentUser?.name || 'admin' };
                                    await add('users', newUser);
                                    await addAuditLog('USER_CREATED', `${currentUser?.name} kreirao korisnika ${userForm.name} (${userForm.role})`);
                                    setUserMsg('✅ Korisnik kreiran!');
                                }
                                setTimeout(() => setShowAddUser(false), 1000);
                            } catch (e: any) {
                                setUserMsg('❌ ' + (e.message || 'Greška'));
                            }
                        }} className="s-btn" style={{ minWidth: 140 }} disabled={!userForm.name.trim() || !userForm.username.trim()}>{editingUser ? '💾 Spremi' : '✅ Kreiraj'}</button>
                    </div>
                </Modal>
            )}

            {/* Password change (Firebase Auth) — Admin */}
            <div className="s-card" className="settings__section">
                <div className="settings__section-title">🔐 Promjena lozinke (Firebase Auth)</div>
                <div className="settings__section-desc">Lozinka za prijavu u sustav. Pravila: najmanje 8 znakova, 1 veliko slovo, 1 broj.</div>
                <div className={`settings__grid-3 ${isMobile ? 'settings__grid-3--mobile' : 'settings__grid-3--desktop'}`}>
                    <Field label="Trenutna lozinka" required><Input type="password" value={pwForm.currentPw} onChange={e => setPwForm(f => ({ ...f, currentPw: e.target.value }))} placeholder="Unesite trenutnu" /></Field>
                    <Field label="Nova lozinka" required><Input type="password" value={pwForm.newPw} onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} placeholder="Min 8, 1 veliko, 1 broj" /></Field>
                    <Field label="Potvrdi novu" required><Input type="password" value={pwForm.confirmPw} onChange={e => setPwForm(f => ({ ...f, confirmPw: e.target.value }))} placeholder="Ponovi novu lozinku" /></Field>
                </div>
                {pwMsg && <div className={`settings__status ${pwMsg.startsWith('✅') ? 'settings__status--success' : 'settings__status--error'}`} className="u-mt-12">{pwMsg}</div>}
                <button onClick={doChangePassword} disabled={pwLoading || !pwForm.currentPw || !pwForm.newPw} className="s-btn" style={{ marginTop: 16, opacity: pwLoading ? 0.5 : 1 }}>
                    {pwLoading ? '⏳ Mijenjam...' : '🔐 Promijeni lozinku'}
                </button>
            </div>

            {/* Edit modal */}
            {editing && (
                <Modal title="Uredi podatke tvrtke" onClose={() => setEditing(false)} wide>
                    <div className={`settings__form-grid ${isMobile ? 'settings__form-grid--mobile' : 'settings__form-grid--desktop'} u-gap-16`}>
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
                    <div className="u-flex-end">
                        <button onClick={() => setEditing(false)} className="s-btn-sec">Odustani</button>
                        <button onClick={doSave} className="s-btn"><Icon name="check" size={16} /> Spremi</button>
                    </div>
                </Modal>
            )}
            {/* Trash / Koš za smeće */}
            {!isWorker && (
                <div className="s-card">
                    <div className="settings__trash-header">
                        <div className="settings__trash-title">🗑️ Koš za smeće</div>
                        <div className="u-flex-gap-8">
                            <button onClick={async () => { setTrashLoading(true); setTrashItems(await loadDeletedItems()); setTrashLoading(false); }} className="s-btn-sm">
                                {trashLoading ? '⏳' : '🔄'} Učitaj
                            </button>
                            <button onClick={async () => { const n = await cleanupOldDeleted(); alert(`Obrisano ${n} stavki starijih od 30 dana`); setTrashItems(await loadDeletedItems()); }} className="s-btn-sm" style={{ color: C.red, borderColor: 'rgba(239,68,68,0.3)' }}>
                                🧹 Očisti stare (30d+)
                            </button>
                        </div>
                    </div>
                    {trashItems === null && <div className="u-fs-13 u-text-muted">Klikni "Učitaj" za prikaz obrisanih stavki</div>}
                    {trashItems && trashItems.length === 0 && <div className="settings__trash-empty">✅ Koš je prazan</div>}
                    {trashItems && trashItems.length > 0 && (
                        <div className="settings__trash-list">
                            {trashItems.map(item => (
                                <div key={item.id} className="settings__trash-item">
                                    <span className="settings__trash-item-name">{item.name || item.title || item.description || item.id}</span>
                                    <span className="settings__trash-item-meta">{item._collection}</span>
                                    <span className="settings__trash-item-meta">{item.deletedAt?.slice(0, 10)}</span>
                                    <button onClick={async () => { await restoreItem(item._collection, item.id); setTrashItems(prev => prev.filter(t => t.id !== item.id)); }} className="s-btn-sm" style={{ padding: '4px 10px' }}>↩ Vrati</button>
                                    <button onClick={async () => { if (!(await confirm('Trajno obrisati?'))) return; await permanentDelete(item._collection, item.id); setTrashItems(prev => prev.filter(t => t.id !== item.id)); }} className="s-btn-sm" style={{ color: C.red, borderColor: 'rgba(239,68,68,0.3)', padding: '4px 10px' }}>✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
