// ═══════════════════════════════════════════════════════
// GPS Settings Tab — Company/project/worker GPS settings
// ═══════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import { C, styles } from '../../utils/helpers';
import { error } from '../../utils/logger';
import { Field } from '../ui/SharedComponents';
import {
    GPS_DEFAULTS, GPS_MODE_OPTIONS,
    DISTANCE_OPTIONS, INTERVAL_OPTIONS, KEEPALIVE_OPTIONS,
    RADIUS_OPTIONS, DEBOUNCE_OPTIONS,
} from '../../services/GpsSettingsManager';

// ── Local UI helpers ──
function SettingSection({ title, children }) {
    return (
        <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.border}40` }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                {title}
            </div>
            {children}
        </div>
    );
}

function ToggleSwitch({ value, onChange, size = 'md' }) {
    const w = size === 'sm' ? 36 : 44;
    const h = size === 'sm' ? 20 : 24;
    const dot = size === 'sm' ? 16 : 20;
    return (
        <button
            onClick={() => onChange(!value)}
            style={{
                width: w, height: h, borderRadius: h,
                background: value ? '#10B981' : '#CBD5E1',
                border: 'none', cursor: 'pointer',
                position: 'relative', transition: 'background 0.2s',
                flexShrink: 0,
            }}
        >
            <div style={{
                width: dot, height: dot, borderRadius: '50%',
                background: 'white',
                position: 'absolute', top: (h - dot) / 2,
                left: value ? w - dot - 2 : 2,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
        </button>
    );
}

export default function GpsSettingsTab({
    companySettings, projectSettings, workerSettings,
    projects, workers, onSaveCompany, onSaveProject, onSaveWorker,
    getProjectName, getWorkerName, isMobile
}) {
    const [settingsLevel, setSettingsLevel] = useState('company');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [form, setForm] = useState({ ...GPS_DEFAULTS, ...companySettings });
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');

    // Update form when switching levels
    useEffect(() => {
        if (settingsLevel === 'company') {
            setForm({ ...GPS_DEFAULTS, ...companySettings });
        } else if (settingsLevel === 'project' && selectedProjectId) {
            const ps = projectSettings.find(p => p.id === selectedProjectId) || {};
            setForm({ ...GPS_DEFAULTS, ...companySettings, ...ps });
        } else if (settingsLevel === 'worker' && selectedWorkerId) {
            const ws = workerSettings.find(w => w.id === selectedWorkerId) || {};
            setForm({ ...GPS_DEFAULTS, ...companySettings, ...ws });
        }
    }, [settingsLevel, selectedProjectId, selectedWorkerId, companySettings, projectSettings, workerSettings]);

    const updateField = (key, value) => setForm(f => ({ ...f, [key]: value }));

    const handleSave = async () => {
        setSaving(true);
        try {
            if (settingsLevel === 'company') {
                await onSaveCompany(form);
            } else if (settingsLevel === 'project' && selectedProjectId) {
                await onSaveProject(selectedProjectId, form);
            } else if (settingsLevel === 'worker' && selectedWorkerId) {
                await onSaveWorker(selectedWorkerId, form);
            }
            setSuccess('Postavke spremljene! ✅');
            setTimeout(() => setSuccess(''), 3000);
        } catch (e) {
            error('Save error:', e);
        }
        setSaving(false);
    };

    return (
        <div>
            {/* Level selector */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: C.bg, borderRadius: 10, padding: 4 }}>
                {[
                    { id: 'company', label: '🏢 Firma' },
                    { id: 'project', label: '📋 Projekt' },
                    { id: 'worker', label: '👷 Radnik' },
                ].map(l => (
                    <button
                        key={l.id}
                        onClick={() => setSettingsLevel(l.id)}
                        style={{
                            flex: 1, padding: '10px', borderRadius: 8, border: 'none',
                            cursor: 'pointer', fontSize: 13, fontWeight: settingsLevel === l.id ? 700 : 500,
                            background: settingsLevel === l.id ? C.card : 'transparent',
                            color: settingsLevel === l.id ? C.accent : C.textMuted,
                            boxShadow: settingsLevel === l.id ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                        }}
                    >
                        {l.label}
                    </button>
                ))}
            </div>

            {/* Project/Worker selector */}
            {settingsLevel === 'project' && (
                <div className="u-mb-16">
                    <select
                        value={selectedProjectId}
                        onChange={e => setSelectedProjectId(e.target.value)}
                        style={styles.input}
                    >
                        <option value="">— Odaberi projekt —</option>
                        {projects.filter(p => p.status !== 'arhiviran').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
            )}
            {settingsLevel === 'worker' && (
                <div className="u-mb-16">
                    <select
                        value={selectedWorkerId}
                        onChange={e => setSelectedWorkerId(e.target.value)}
                        style={styles.input}
                    >
                        <option value="">— Odaberi radnika —</option>
                        {workers.filter(w => w.active !== false).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
            )}

            {/* Override indicator */}
            {settingsLevel !== 'company' && (
                <div style={{
                    background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
                    borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#2563EB',
                    marginBottom: 16,
                }}>
                    ℹ️ Postavke na razini {settingsLevel === 'project' ? 'projekta' : 'radnika'} nadjačavaju postavke firme.
                    Polja koja nisu promijenjena koriste postavke firme automatski.
                </div>
            )}

            {/* Settings form */}
            <div style={styles.card}>
                {success && (
                    <div style={{
                        background: 'rgba(16,185,129,0.1)', color: '#059669',
                        borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600,
                        marginBottom: 16,
                    }}>
                        {success}
                    </div>
                )}

                {/* Master switch */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 0', borderBottom: `1px solid ${C.border}60`,
                    marginBottom: 16,
                }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>📡 GPS praćenje</div>
                        <div className="u-fs-12" className="u-text-muted">Uključi/isključi GPS modul</div>
                    </div>
                    <ToggleSwitch value={form.enabled} onChange={v => updateField('enabled', v)} />
                </div>

                {form.enabled && (
                    <>
                        {/* GPS Mode */}
                        <SettingSection title="🎯 Način praćenja">
                            <div style={{ display: 'grid', gap: 8 }}>
                                {GPS_MODE_OPTIONS.filter(m => m.value !== 'OFF').map(mode => (
                                    <label
                                        key={mode.value}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                                            border: `1.5px solid ${form.gpsMode === mode.value ? C.accent : C.border}`,
                                            background: form.gpsMode === mode.value ? C.accentLight : 'transparent',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        <input
                                            type="radio" name="gpsMode" value={mode.value}
                                            checked={form.gpsMode === mode.value}
                                            onChange={() => updateField('gpsMode', mode.value)}
                                            style={{ accentColor: C.accent }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{mode.label}</div>
                                            <div className="u-fs-12" className="u-text-muted">{mode.desc}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </SettingSection>

                        {/* Throttle settings */}
                        <SettingSection title="⏱️ Frekvencija praćenja">
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                                <Field label="Min. pomak (metri)">
                                    <select value={form.distanceThreshold} onChange={e => updateField('distanceThreshold', +e.target.value)} style={styles.input}>
                                        {DISTANCE_OPTIONS.map(v => <option key={v} value={v}>{v}m</option>)}
                                    </select>
                                </Field>
                                <Field label="Min. interval (sekunde)">
                                    <select value={form.minInterval} onChange={e => updateField('minInterval', +e.target.value)} style={styles.input}>
                                        {INTERVAL_OPTIONS.map(v => <option key={v} value={v}>{v < 60 ? `${v}s` : `${v / 60} min`}</option>)}
                                    </select>
                                </Field>
                                <Field label="Keepalive (čak i kad miruje)">
                                    <select value={form.keepAlive} onChange={e => updateField('keepAlive', +e.target.value)} style={styles.input}>
                                        {KEEPALIVE_OPTIONS.map(v => <option key={v} value={v}>{v / 60} min</option>)}
                                    </select>
                                </Field>
                                <Field label="Max preciznost (odbaci iznad)">
                                    <select value={form.maxAccuracy} onChange={e => updateField('maxAccuracy', +e.target.value)} style={styles.input}>
                                        {[30, 50, 80, 100, 200].map(v => <option key={v} value={v}>±{v}m</option>)}
                                    </select>
                                </Field>
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                                <ToggleSwitch value={form.requireTwoReadings} onChange={v => updateField('requireTwoReadings', v)} />
                                <div style={{ fontSize: 13, color: C.textDim }}>Zahtijevaj 2 uzastopna čitanja za alarm (manje lažnih alarma)</div>
                            </div>
                        </SettingSection>

                        {/* Geofence */}
                        <SettingSection title="🔲 Geofence zona">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div style={{ fontSize: 13, color: C.textDim }}>Uključi geofence provjeru zone</div>
                                <ToggleSwitch value={form.geofenceEnabled} onChange={v => updateField('geofenceEnabled', v)} />
                            </div>
                            {form.geofenceEnabled && (
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
                                    <Field label="Radijus zone">
                                        <select value={form.geofenceRadius} onChange={e => updateField('geofenceRadius', +e.target.value)} style={styles.input}>
                                            {RADIUS_OPTIONS.map(v => <option key={v} value={v}>{v < 1000 ? `${v}m` : `${v / 1000}km`}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Debounce alarma">
                                        <select value={form.alertDebounce} onChange={e => updateField('alertDebounce', +e.target.value)} style={styles.input}>
                                            {DEBOUNCE_OPTIONS.map(v => <option key={v} value={v}>{v} min</option>)}
                                        </select>
                                    </Field>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                            <ToggleSwitch value={form.alertOnLeave} onChange={v => updateField('alertOnLeave', v)} size="sm" />
                                            <span style={{ fontSize: 12, color: C.textDim }}>Alarm kad napusti</span>
                                        </div>
                                        <div className="u-flex-center u-gap-8">
                                            <ToggleSwitch value={form.alertOnEnter} onChange={v => updateField('alertOnEnter', v)} size="sm" />
                                            <span style={{ fontSize: 12, color: C.textDim }}>Alarm kad uđe</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </SettingSection>

                        {/* Time window */}
                        <SettingSection title="⏰ Vremenski prozor">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div style={{ fontSize: 13, color: C.textDim }}>Prati samo u zadanom vremenu</div>
                                <ToggleSwitch value={form.timeWindowEnabled} onChange={v => updateField('timeWindowEnabled', v)} />
                            </div>
                            {form.timeWindowEnabled && (
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                    <Field label="Od">
                                        <input type="time" value={form.timeWindowStart} onChange={e => updateField('timeWindowStart', e.target.value)} style={styles.input} />
                                    </Field>
                                    <span style={{ color: C.textMuted, marginTop: 16 }}>—</span>
                                    <Field label="Do">
                                        <input type="time" value={form.timeWindowEnd} onChange={e => updateField('timeWindowEnd', e.target.value)} style={styles.input} />
                                    </Field>
                                </div>
                            )}
                        </SettingSection>
                    </>
                )}

                {/* Save button */}
                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            ...styles.btn,
                            opacity: saving ? 0.6 : 1,
                            minWidth: 160,
                            justifyContent: 'center',
                        }}
                    >
                        {saving ? '⏳ Spremam...' : '💾 Spremi postavke'}
                    </button>
                </div>
            </div>
        </div>
    );
}
