// ═══════════════════════════════════════════════════════
// Fleet Report Tab — Export PDF/Excel fleet reports
// ═══════════════════════════════════════════════════════
import React, { useState } from 'react';
import { C, styles } from '../../utils/helpers';
import { useIsMobile } from '../ui/SharedComponents';
import type { FleetVehicle } from './FleetDashboard';

const REPORT_TYPES = [
    { id: 'daily', icon: '📊', label: 'Dnevni sažetak', desc: 'Km, brzina, stajanja, rad motora po vozilu' },
    { id: 'routes', icon: '📍', label: 'Povijest ruta', desc: 'Sve rute za period s detaljima' },
    { id: 'idle', icon: '⏱️', label: 'Vrijeme mirovanja', desc: 'Idle time analiza po vozilu' },
    { id: 'geofence', icon: '🏗️', label: 'Geofence eventi', desc: 'Ulazi/izlazi iz zona s vremenima' },
    { id: 'fuel', icon: '⛽', label: 'Potrošnja goriva', desc: 'Procjena potrošnje na bazi km i vremena' },
    { id: 'maintenance', icon: '🔧', label: 'Održavanje', desc: 'Servisni intervali i nadolazeći rokovi' },
];

export default function FleetReportTab({ vehicles }: { vehicles: FleetVehicle[] }) {
    const isMobile = useIsMobile();
    const [selectedReport, setSelectedReport] = useState('');
    const [dateFrom, setDateFrom] = useState('2026-03-01');
    const [dateTo, setDateTo] = useState('2026-03-02');
    const [generating, setGenerating] = useState(false);
    const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);

    const toggleVehicle = (id: string) => {
        setSelectedVehicles(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleGenerate = async (format: 'pdf' | 'excel') => {
        setGenerating(true);
        // Sprint 3: actual report generation with jsPDF / SheetJS
        await new Promise(r => setTimeout(r, 2000));
        setGenerating(false);
        alert(`${format.toUpperCase()} izvještaj bi se preuzeo — implementacija u Sprint 3`);
    };

    return (
        <div>
            {/* ── Report Type Selection ── */}
            <div className="u-section-title u-mb-12">📊 Odaberite vrstu izvještaja</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                {REPORT_TYPES.map(r => (
                    <button key={r.id} onClick={() => setSelectedReport(r.id)} style={{
                        background: 'var(--card)', border: `2px solid ${selectedReport === r.id ? C.accent : C.border}`,
                        borderRadius: 14, padding: 16, cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.2s',
                    }}>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>{r.icon}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: selectedReport === r.id ? C.accent : C.text, marginBottom: 4 }}>{r.label}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.4 }}>{r.desc}</div>
                    </button>
                ))}
            </div>

            {selectedReport && (
                <>
                    {/* ── Date Range + Vehicle Selection ── */}
                    <div style={{ background: 'var(--card)', border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>⚙️ Parametri izvještaja</div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4 }}>Od</label>
                                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                    style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: 13 }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4 }}>Do</label>
                                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                    style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: 13 }} />
                            </div>
                        </div>

                        {/* Vehicle selection */}
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>
                            Vozila ({selectedVehicles.length === 0 ? 'sva' : `${selectedVehicles.length} odabrano`})
                            <button onClick={() => setSelectedVehicles(selectedVehicles.length === vehicles.length ? [] : vehicles.map(v => v.id))}
                                style={{ marginLeft: 8, fontSize: 11, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                                {selectedVehicles.length === vehicles.length ? 'Poništi' : 'Odaberi sva'}
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {vehicles.map(v => (
                                <button key={v.id} onClick={() => toggleVehicle(v.id)} style={{
                                    padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                    border: `1px solid ${selectedVehicles.includes(v.id) ? C.accent : C.border}`,
                                    background: selectedVehicles.includes(v.id) ? `${C.accent}12` : 'transparent',
                                    color: selectedVehicles.includes(v.id) ? C.accent : C.textDim,
                                    cursor: 'pointer', transition: 'all 0.15s',
                                }}>{v.plate}</button>
                            ))}
                        </div>
                    </div>

                    {/* ── Generate Buttons ── */}
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <button onClick={() => handleGenerate('pdf')} disabled={generating}
                            style={{ ...styles.btn, fontSize: 14, padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 8, opacity: generating ? 0.5 : 1 }}>
                            {generating ? '⏳ Generiram...' : '📄 Generiraj PDF'}
                        </button>
                        <button onClick={() => handleGenerate('excel')} disabled={generating}
                            style={{ ...styles.btn, fontSize: 14, padding: '14px 28px', background: '#10B981', display: 'flex', alignItems: 'center', gap: 8, opacity: generating ? 0.5 : 1 }}>
                            {generating ? '⏳ Generiram...' : '📊 Generiraj Excel'}
                        </button>
                    </div>
                </>
            )}

            {!selectedReport && (
                <div style={{ background: 'var(--card)', border: `1px solid ${C.border}`, borderRadius: 14, padding: 40, textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                    <div style={{ fontSize: 14, color: C.textMuted }}>Odaberite vrstu izvještaja za generiranje</div>
                </div>
            )}
        </div>
    );
}
