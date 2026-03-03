// ═══════════════════════════════════════════════════════
// GPS Admin Panel — Orchestrator
// Slim 120-line container that wires tabs to data via useGpsData hook
// ═══════════════════════════════════════════════════════
import { useState } from 'react';
import { C, styles } from '../utils/helpers';
import { formatDistance } from '../services/GpsSettingsManager';
import { useGpsData } from '../hooks/useGpsData';

// Tab components (all in gps/ folder)
import GpsMapTab from './gps/GpsMapTab';
import GpsWorkersTab from './gps/GpsWorkersTab';
import GpsEventsTab from './gps/GpsEventsTab';
import GpsSettingsTab from './gps/GpsSettingsTab';
import GpsReportTab from './gps/GpsReportTab';
import GpsAnalyticsTab from './gps/GpsAnalyticsTab';
import GpsPlaybackTab from './gps/GpsPlaybackTab';
import GpsAlertTab from './gps/GpsAlertTab';

const TAB_ITEMS = [
    { id: 'map', label: '🗺️ Karta', icon: 'location' },
    { id: 'workers', label: '👷 Radnici', icon: 'workers' },
    { id: 'events', label: '📋 Eventi', icon: 'history' },
    { id: 'reports', label: '📊 Izvještaji', icon: 'chart' },
    { id: 'analytics', label: '📈 Analitika', icon: 'chart' },
    { id: 'playback', label: '🎬 Povijest', icon: 'history' },
    { id: 'alerts', label: '🔔 Alarmi', icon: 'bell' },
    { id: 'settings', label: '⚙️ Postavke', icon: 'settings' },
];

export default function GpsAdminPanel({ leaderProjectIds }) {
    const gps = useGpsData({ leaderProjectIds });
    const [tab, setTab] = useState('map');
    const [selectedProjectId, setSelectedProjectId] = useState('all');

    // Projects with GPS coordinates
    const gpsProjects = gps.filteredProjects.filter(p => p.siteLat && p.siteLng && p.status === 'aktivan');
    const noGpsProjects = gps.filteredProjects.filter(p => (!p.siteLat || !p.siteLng) && p.status === 'aktivan');

    // Filter workers by selected project
    const filteredWorkers = selectedProjectId === 'all'
        ? gps.workersWithLocation
        : gps.workersWithLocation.filter(w => {
            const proj = gps.filteredProjects.find(p => p.id === selectedProjectId);
            return proj && (proj.workers || []).includes(w.id);
        });

    // Selected project for map centering
    const selectedProject = selectedProjectId !== 'all' ? gps.filteredProjects.find(p => p.id === selectedProjectId) : null;

    if (gps.loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
            <div className="spinner" />
        </div>
    );

    return (
        <div>
            {/* Header */}
            <div className="u-mb-20">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: 'linear-gradient(135deg, #D95D08 0%, #F97316 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22, color: 'white',
                    }}>📡</div>
                    <div className="u-flex-1">
                        <div className="u-fs-24 u-fw-800 u-color-text">GPS Nadzor</div>
                        <div className="u-fs-13 u-text-muted">
                            {gpsProjects.length} projekt{gpsProjects.length !== 1 ? 'a' : ''} s GPS-om
                            {noGpsProjects.length > 0 && <span style={{ color: '#F59E0B', marginLeft: 6 }}>· {noGpsProjects.length} bez GPS-a</span>}
                        </div>
                    </div>
                    {/* Project filter */}
                    <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} style={{
                        ...styles.input, width: 'auto', minWidth: 180, maxWidth: 280, fontSize: 13, padding: '8px 12px',
                        borderColor: selectedProjectId !== 'all' ? '#F97316' : undefined, fontWeight: selectedProjectId !== 'all' ? 700 : 400,
                    }}>
                        <option value="all">📍 Svi projekti ({gpsProjects.length})</option>
                        {gpsProjects.map(p => (
                            <option key={p.id} value={p.id}>📍 {p.name}</option>
                        ))}
                        {noGpsProjects.length > 0 && <option disabled>── Bez GPS koordinata ──</option>}
                        {noGpsProjects.map(p => (
                            <option key={p.id} value={p.id} disabled>⚠️ {p.name}</option>
                        ))}
                    </select>
                </div>
                {selectedProject && selectedProject.siteLat && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 8, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)', fontSize: 11, color: C.accent, fontWeight: 600 }}>
                        📍 {selectedProject.location || selectedProject.name} — {Number(selectedProject.siteLat).toFixed(4)}°N, {Number(selectedProject.siteLng).toFixed(4)}°E
                        <button onClick={() => setSelectedProjectId('all')} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 11, padding: '0 4px' }}>✕</button>
                    </div>
                )}
            </div>

            {/* Feature flag alert */}
            {!gps.effectiveCompanySettings.enabled && (
                <div style={{
                    ...styles.card, marginBottom: 20,
                    background: 'rgba(234,179,8,0.06)', borderColor: 'rgba(234,179,8,0.2)',
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                }}>
                    <span style={{ fontSize: 24 }}>⚠️</span>
                    <div className="u-flex-1">
                        <div style={{ fontWeight: 700, color: C.yellow, fontSize: 14 }}>GPS modul je isključen</div>
                        <div style={{ color: C.textMuted, fontSize: 13 }}>Uključite GPS praćenje u Postavkama da počnete koristiti ovaj modul.</div>
                    </div>
                    <button
                        onClick={() => setTab('settings')}
                        style={{ ...styles.btn, background: '#B45309', fontSize: 13 }}
                    >
                        ⚙️ Otvori postavke
                    </button>
                </div>
            )}

            {/* Stats Bar */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: gps.isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                gap: 12, marginBottom: 20,
            }}>
                <StatBox label="Radnici" value={gps.stats.total} icon="👷" color="#3B82F6" sub={`${gps.stats.active} aktivnih`} />
                <StatBox label="U zoni" value={gps.stats.inZone} icon="✅" color="#10B981" sub={`od ${gps.stats.active} aktivnih`} />
                <StatBox label="Izvan zone" value={gps.stats.outZone} icon="🚨" color="#EF4444" sub={gps.stats.outZone > 0 ? 'Provjeri!' : 'Sve OK'} alert={gps.stats.outZone > 0} />
                <StatBox label="Prosj. udaljenost" value={formatDistance(gps.stats.avgDist)} icon="📏" color="#8B5CF6" sub="od centra gradilišta" />
            </div>

            {/* Tab Navigation */}
            <div style={{
                display: 'flex', gap: gps.isMobile ? 0 : 6,
                background: `${C.bg}`,
                borderRadius: 12, padding: 4,
                marginBottom: 20,
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
            }}>
                {TAB_ITEMS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        style={{
                            flex: gps.isMobile ? 1 : 'none',
                            padding: gps.isMobile ? '10px 8px' : '10px 20px',
                            borderRadius: 10,
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: gps.isMobile ? 12 : 14,
                            fontWeight: tab === t.id ? 700 : 500,
                            background: tab === t.id ? C.card : 'transparent',
                            color: tab === t.id ? C.accent : C.textMuted,
                            boxShadow: tab === t.id ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {tab === 'map' && (
                <GpsMapTab
                    workers={filteredWorkers}
                    projects={gps.filteredProjects}
                    settings={gps.effectiveCompanySettings}
                    isMobile={gps.isMobile}
                    centerProject={selectedProject}
                />
            )}
            {tab === 'workers' && (
                <GpsWorkersTab
                    workers={filteredWorkers}
                    projects={gps.filteredProjects}
                    getProjectName={gps.getProjectName}
                    isMobile={gps.isMobile}
                />
            )}
            {tab === 'events' && (
                <GpsEventsTab
                    events={gps.gpsEvents}
                    getWorkerName={gps.getWorkerName}
                    getProjectName={gps.getProjectName}
                    isMobile={gps.isMobile}
                />
            )}
            {tab === 'reports' && (
                <GpsReportTab
                    timesheets={gps.timesheets}
                    workers={gps.workers}
                    projects={gps.filteredProjects}
                    gpsEvents={gps.gpsEvents}
                    liveLocations={gps.effectiveLocations}
                    getWorkerName={gps.getWorkerName}
                    getProjectName={gps.getProjectName}
                    isMobile={gps.isMobile}
                />
            )}
            {tab === 'analytics' && (
                <GpsAnalyticsTab
                    timesheets={gps.timesheets}
                    workers={gps.workers}
                    projects={gps.filteredProjects}
                    gpsEvents={gps.gpsEvents}
                    liveLocations={gps.effectiveLocations}
                    getWorkerName={gps.getWorkerName}
                    getProjectName={gps.getProjectName}
                    isMobile={gps.isMobile}
                />
            )}
            {tab === 'playback' && (
                <GpsPlaybackTab
                    gpsEvents={gps.gpsEvents}
                    timesheets={gps.timesheets}
                    workers={gps.workers}
                    projects={gps.filteredProjects}
                    getWorkerName={gps.getWorkerName}
                    getProjectName={gps.getProjectName}
                    isMobile={gps.isMobile}
                />
            )}
            {tab === 'alerts' && (
                <GpsAlertTab
                    gpsEvents={gps.gpsEvents}
                    workers={gps.workers}
                    projects={gps.filteredProjects}
                    liveLocations={gps.effectiveLocations}
                    getWorkerName={gps.getWorkerName}
                    getProjectName={gps.getProjectName}
                    isMobile={gps.isMobile}
                />
            )}
            {tab === 'settings' && (
                <GpsSettingsTab
                    companySettings={gps.gpsSettings}
                    projectSettings={gps.projectGpsSettings}
                    workerSettings={gps.workerGpsSettings}
                    projects={gps.filteredProjects}
                    workers={gps.workers}
                    onSaveCompany={gps.saveCompanySettings}
                    onSaveProject={gps.saveProjectSettings}
                    onSaveWorker={gps.saveWorkerSettings}
                    getProjectName={gps.getProjectName}
                    getWorkerName={gps.getWorkerName}
                    isMobile={gps.isMobile}
                />
            )}
        </div>
    );
}

// ── Stat Box (stays here — only used by orchestrator) ──
function StatBox({ label, value, icon, color, sub, alert }) {
    return (
        <div style={{
            ...styles.card,
            position: 'relative', overflow: 'hidden',
            ...(alert ? { borderColor: `${color}40` } : {}),
        }}>
            <div style={{
                position: 'absolute', top: -20, right: -20,
                width: 70, height: 70, borderRadius: '50%',
                background: `${color}08`,
            }} />
            <div className="u-relative">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 20 }}>{icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {label}
                    </span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: alert ? color : C.text }}>{value}</div>
                {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
            </div>
        </div>
    );
}
