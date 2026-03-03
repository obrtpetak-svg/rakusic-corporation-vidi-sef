import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Icon, Modal, Select, useIsMobile, StatusBadge } from '../ui/SharedComponents';
import { C, styles, today, diffMins, fmtDate } from '../../utils/helpers';
import { renderQrToCanvas, renderPosterToCanvas } from './qrEncoder';

// Small QR preview for batch modal
function BatchQrPreview({ project }: { project: any }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (ref.current) renderQrToCanvas(ref.current, `VIDISEF:${project.id}`, { size: 140 });
    }, [project.id]);
    return <canvas ref={ref} style={{ width: 100, height: 100, borderRadius: 8 }} />;
}

export function QrAdminPage() {
    const { projects, workers, timesheets, companyProfile } = useApp();
    const [selectedProject, setSelectedProject] = useState('');
    const [showPoster, setShowPoster] = useState(false);
    const [showLog, setShowLog] = useState(false);
    const [showBatch, setShowBatch] = useState(false);
    const isMobile = useIsMobile();
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);
    const posterCanvasRef = useRef<HTMLCanvasElement>(null);
    const batchContainerRef = useRef<HTMLDivElement>(null);

    const companyName = companyProfile?.companyName || 'Vi-Di-Sef';
    const activeProjects = useMemo(() => projects.filter((p: any) => p.status === 'aktivan' || p.status === 'planiran'), [projects]);
    const project = useMemo(() => projects.find((p: any) => p.id === selectedProject), [projects, selectedProject]);

    // QR check-in stats
    const qrTimesheets = useMemo(() => timesheets.filter((t: any) => t.source === 'qr-checkin'), [timesheets]);
    const todayStr = today();
    const todayCheckins = useMemo(() => qrTimesheets.filter((t: any) => t.date === todayStr), [qrTimesheets, todayStr]);
    const uniqueQrWorkers = useMemo(() => new Set(qrTimesheets.map((t: any) => t.workerId)).size, [qrTimesheets]);
    const activeNow = useMemo(() => qrTimesheets.filter((t: any) => t.date === todayStr && !t.endTime).length, [qrTimesheets, todayStr]);

    // Render QR when project changes
    useEffect(() => {
        if (!project || !qrCanvasRef.current) return;
        renderQrToCanvas(qrCanvasRef.current, `VIDISEF:${project.id}`, { size: 320 });
    }, [project]);

    const downloadQr = useCallback(() => {
        if (!qrCanvasRef.current || !project) return;
        const link = document.createElement('a');
        link.download = `QR-${project.name.replace(/\s+/g, '-')}.png`;
        link.href = qrCanvasRef.current.toDataURL('image/png');
        link.click();
    }, [project]);

    const downloadPoster = useCallback(() => {
        if (!project) return;
        const canvas = document.createElement('canvas');
        renderPosterToCanvas(canvas, project, companyName);
        const link = document.createElement('a');
        link.download = `Poster-${project.name.replace(/\s+/g, '-')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }, [project, companyName]);

    const openPoster = useCallback(() => {
        if (!project) return;
        setShowPoster(true);
        setTimeout(() => {
            if (posterCanvasRef.current) renderPosterToCanvas(posterCanvasRef.current, project, companyName);
        }, 50);
    }, [project, companyName]);

    const printPoster = useCallback(() => {
        if (!project) return;
        const canvas = document.createElement('canvas');
        renderPosterToCanvas(canvas, project, companyName);
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>QR Poster - ${project.name}</title><style>@page{size:A4;margin:0}body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fff}</style></head><body><img src="${canvas.toDataURL('image/png')}" style="max-width:100%;height:auto" onload="setTimeout(()=>window.print(),300)"></body></html>`);
        win.document.close();
    }, [project, companyName]);

    const downloadAllQr = useCallback(() => {
        activeProjects.forEach((p: any, i: number) => {
            setTimeout(() => {
                const canvas = document.createElement('canvas');
                renderQrToCanvas(canvas, `VIDISEF:${p.id}`, { size: 400 });
                const link = document.createElement('a');
                link.download = `QR-${p.name.replace(/\s+/g, '-')}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            }, i * 300);
        });
    }, [activeProjects]);

    const downloadAllPosters = useCallback(() => {
        activeProjects.forEach((p: any, i: number) => {
            setTimeout(() => {
                const canvas = document.createElement('canvas');
                renderPosterToCanvas(canvas, p, companyName);
                const link = document.createElement('a');
                link.download = `Poster-${p.name.replace(/\s+/g, '-')}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            }, i * 400);
        });
    }, [activeProjects, companyName]);

    // Recent QR log
    const recentLog = useMemo(() =>
        qrTimesheets
            .sort((a: any, b: any) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''))
            .slice(0, 50)
        , [qrTimesheets]);

    const getWorkerName = (id: string) => workers.find((w: any) => w.id === id)?.name || '—';
    const getProjectName = (id: string) => projects.find((p: any) => p.id === id)?.name || '—';

    const statCards = [
        { label: 'Danas check-in', value: todayCheckins.length, icon: '📷', color: C.accent },
        { label: 'Aktivni sada', value: activeNow, icon: '🟢', color: '#10B981' },
        { label: 'Ukupno QR unosa', value: qrTimesheets.length, icon: '📊', color: C.blue },
        { label: 'Radnika koristi QR', value: uniqueQrWorkers, icon: '👥', color: '#7C3AED' },
        { label: 'Aktivnih projekata', value: activeProjects.length, icon: '📁', color: '#F59E0B' },
    ];

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ background: C.accent, color: '#fff', borderRadius: 12, padding: '8px 12px', fontSize: 20 }}>📷</span>
                        QR Upravljanje
                    </div>
                    <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Generiraj, isprintaj i upravljaj QR kodovima za gradilišta</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => setShowLog(true)} style={styles.btnSecondary}><Icon name="history" size={16} /> Check-in log</button>
                    <button onClick={() => setShowBatch(true)} style={styles.btn}><Icon name="download" size={16} /> Batch preuzmi</button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${statCards.length}, 1fr)`, gap: 12, marginBottom: 24 }}>
                {statCards.map(s => (
                    <div key={s.label} style={{ ...styles.card, textAlign: 'center', padding: '16px 10px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 40, opacity: 0.06 }}>{s.icon}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Main content: Generator + Preview */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
                {/* Left: Project selector + actions */}
                <div>
                    <div style={styles.card}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Icon name="project" size={18} /> Odaberi projekt
                        </div>
                        <Select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={{ marginBottom: 16 }}>
                            <option value="">— Odaberi projekt za QR kod —</option>
                            {activeProjects.map((p: any) => (
                                <option key={p.id} value={p.id}>📁 {p.name}{p.location ? ` (${p.location})` : ''}</option>
                            ))}
                        </Select>

                        {project && (
                            <div>
                                <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(217,93,8,0.06)', border: '1px solid rgba(217,93,8,0.15)', marginBottom: 16 }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{project.name}</div>
                                    {project.location && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>📍 {project.location}</div>}
                                    {project.client && <div className="u-fs-12" style={{ color: C.textMuted, marginTop: 2 }}>🏢 {project.client}</div>}
                                    <div style={{ fontSize: 11, color: C.accent, marginTop: 6, fontFamily: 'monospace' }}>VIDISEF:{project.id}</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <button onClick={downloadQr} style={{ ...styles.btn, width: '100%', justifyContent: 'center', padding: '14px 20px' }}>
                                        <Icon name="download" size={18} /> Preuzmi QR kod (PNG)
                                    </button>
                                    <button onClick={openPoster} style={{ ...styles.btn, width: '100%', justifyContent: 'center', padding: '14px 20px', background: '#1D4ED8' }}>
                                        🖼️ Poster za print (A4)
                                    </button>
                                    <button onClick={printPoster} style={{ ...styles.btnSecondary, width: '100%', justifyContent: 'center', padding: '14px 20px' }}>
                                        🖨️ Isprintaj poster
                                    </button>
                                </div>
                                {(() => {
                                    const pQr = qrTimesheets.filter((t: any) => t.projectId === project.id);
                                    const pToday = pQr.filter((t: any) => t.date === todayStr);
                                    return pQr.length > 0 ? (
                                        <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: C.bgElevated, border: `1px solid ${C.border}` }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>QR statistika za ovaj projekt</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                                                <div><div style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>{pToday.length}</div><div style={{ fontSize: 10, color: C.textMuted }}>Danas</div></div>
                                                <div><div style={{ fontSize: 18, fontWeight: 800, color: C.blue }}>{pQr.length}</div><div style={{ fontSize: 10, color: C.textMuted }}>Ukupno</div></div>
                                                <div><div style={{ fontSize: 18, fontWeight: 800, color: '#7C3AED' }}>{new Set(pQr.map((t: any) => t.workerId)).size}</div><div style={{ fontSize: 10, color: C.textMuted }}>Radnika</div></div>
                                            </div>
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                        )}

                        {!project && (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: C.textMuted }}>
                                <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>📷</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>Odaberi projekt za generiranje QR koda</div>
                                <div style={{ fontSize: 12, marginTop: 4 }}>QR kod služi za brzi check-in radnika na gradilištu</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: QR Preview */}
                <div>
                    <div style={{ ...styles.card, textAlign: 'center', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        {project ? (
                            <>
                                <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>QR KOD PREVIEW</div>
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                    <div style={{ position: 'absolute', inset: -12, borderRadius: 24, background: 'rgba(217,93,8,0.08)', border: '2px solid rgba(217,93,8,0.15)', zIndex: 0 }} />
                                    <canvas ref={qrCanvasRef} style={{ width: 280, height: 280, borderRadius: 16, position: 'relative', zIndex: 1 }} />
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginTop: 20 }}>{project.name}</div>
                                {project.location && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>📍 {project.location}</div>}
                                <div style={{ fontSize: 11, color: C.accent, marginTop: 8, fontFamily: 'monospace', background: C.accentLight, padding: '4px 12px', borderRadius: 6 }}>VIDISEF:{project.id}</div>
                            </>
                        ) : (
                            <div style={{ opacity: 0.2 }}>
                                <div style={{ fontSize: 80 }}>📷</div>
                                <div style={{ fontSize: 14, color: C.textMuted, marginTop: 8 }}>QR preview</div>
                            </div>
                        )}
                    </div>
                    <div style={{ ...styles.card, marginTop: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>💡 Savjeti</div>
                        {['Isprintajte poster i postavite ga na vidljivo mjesto na gradilištu',
                            'Radnici skeniraju QR kod za automatski check-in/check-out',
                            'GPS lokacija se automatski bilježi uz svaki QR check-in',
                            'Koristite "Batch preuzmi" za preuzimanje svih QR kodova odjednom'
                        ].map((tip, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, fontSize: 12, color: C.textDim }}>
                                <span style={{ color: C.accent, fontWeight: 700, flexShrink: 0 }}>•</span> {tip}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Poster Preview Modal */}
            {showPoster && project && (
                <Modal title={`Poster — ${project.name}`} onClose={() => setShowPoster(false)} wide>
                    <div style={{ textAlign: 'center' }}>
                        <canvas ref={posterCanvasRef} style={{ maxWidth: '100%', height: 'auto', borderRadius: 12, border: `1px solid ${C.border}` }} />
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
                            <button onClick={downloadPoster} style={styles.btn}><Icon name="download" size={16} /> Preuzmi PNG</button>
                            <button onClick={printPoster} style={styles.btnSecondary}>🖨️ Isprintaj</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Check-in Log Modal */}
            {showLog && (
                <Modal title="📋 QR Check-in Log" onClose={() => setShowLog(false)} wide>
                    {recentLog.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>Nema QR check-in zapisa</div>
                    ) : (
                        <div className="u-overflow-x">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr>
                                    <th style={styles.th}>Datum</th><th style={styles.th}>Radnik</th><th style={styles.th}>Projekt</th>
                                    <th style={styles.th}>Check-in</th><th style={styles.th}>Check-out</th><th style={styles.th}>Sati</th><th style={styles.th}>Status</th>
                                </tr></thead>
                                <tbody>
                                    {recentLog.map((t: any) => {
                                        const mins = diffMins(t.startTime, t.endTime);
                                        return (
                                            <tr key={t.id}>
                                                <td style={styles.td}>{fmtDate(t.date)}</td>
                                                <td style={styles.td}><span style={{ fontWeight: 600 }}>{getWorkerName(t.workerId)}</span></td>
                                                <td style={styles.td}>{getProjectName(t.projectId)}</td>
                                                <td style={styles.td}><span style={{ color: C.green, fontWeight: 600 }}>{t.startTime || '—'}</span></td>
                                                <td style={styles.td}><span style={{ color: t.endTime ? C.red : C.textMuted, fontWeight: 600 }}>{t.endTime || '🟢 aktivno'}</span></td>
                                                <td style={styles.td}>{t.endTime ? `${(mins / 60).toFixed(1)}h` : '—'}</td>
                                                <td style={styles.td}><StatusBadge status={t.endTime ? 'završen' : 'aktivno'} /></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Modal>
            )}

            {/* Batch Download Modal */}
            {showBatch && (
                <Modal title="📦 Batch preuzimanje QR kodova" onClose={() => setShowBatch(false)} wide>
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 14, color: C.textDim, marginBottom: 16 }}>Preuzmite QR kodove ili postere za sve aktivne projekte ({activeProjects.length})</div>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                            <button onClick={() => { downloadAllQr(); }} style={styles.btn}>
                                <Icon name="download" size={16} /> Svi QR kodovi ({activeProjects.length})
                            </button>
                            <button onClick={() => { downloadAllPosters(); }} style={{ ...styles.btn, background: '#1D4ED8' }}>
                                🖼️ Svi posteri ({activeProjects.length})
                            </button>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }} ref={batchContainerRef}>
                        {activeProjects.map((p: any) => (
                            <div key={p.id} style={{ textAlign: 'center', padding: 12, borderRadius: 10, background: C.bgElevated, border: `1px solid ${C.border}` }}>
                                <BatchQrPreview project={p} />
                                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                {p.location && <div style={{ fontSize: 10, color: C.textMuted }}>{p.location}</div>}
                            </div>
                        ))}
                    </div>
                </Modal>
            )}
        </div>
    );
}
