import { useState, useMemo, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { SvgLineChart, SvgDonutChart, useIsMobile } from './ui/SharedComponents';
import { C, styles, fmtDate, diffMins, today } from '../utils/helpers';
import { Card, InsightBadge, ProgressBar } from './ai/AiWidgets';
import { parseChatQuery } from './ai/parseChatQuery';

const TABS = [
    { id: 'pregled', label: '🧠 Pregled' },
    { id: 'chatbot', label: '🤖 Chatbot' },
    { id: 'projekti', label: '🔮 Projekti' },
    { id: 'tim', label: '🏅 Tim' },
    { id: 'rizici', label: '🗺️ Rizici' },
];

export function AiInsightsPage({ leaderProjectIds }) {
    const { projects, workers, timesheets, invoices, dailyLogs, otpremnice, vehicles, smjestaj, obaveze, safetyChecklists, currentUser } = useApp();
    const isMobile = useIsMobile();
    const [tab, setTab] = useState('pregled');
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const lastContext = useRef({ worker: null, project: null }); // Chat context memory
    const isLeaderView = !!leaderProjectIds?.length;

    const scope = useMemo(() => {
        if (!isLeaderView) return { projects, workers, timesheets, invoices, dailyLogs, otpremnice, vehicles, smjestaj, obaveze, safetyChecklists };
        const sp = projects.filter(p => leaderProjectIds.includes(p.id));
        const wIds = new Set(sp.flatMap(p => p.workers || []));
        return { projects: sp, workers: workers.filter(w => wIds.has(w.id)), timesheets: timesheets.filter(t => leaderProjectIds.includes(t.projectId)), invoices: invoices.filter(i => leaderProjectIds.includes(i.projectId)), dailyLogs: (dailyLogs || []).filter(l => leaderProjectIds.includes(l.projectId)), otpremnice, vehicles, smjestaj, obaveze, safetyChecklists };
    }, [projects, workers, timesheets, invoices, dailyLogs, otpremnice, vehicles, smjestaj, obaveze, safetyChecklists, leaderProjectIds, isLeaderView]);

    const now = new Date();
    const weekStr = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const prevWeekStr = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10);
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // ── Smart Summary Data ──
    const insights = useMemo(() => {
        const arr = [];
        const approved = scope.timesheets.filter(t => t.status === 'odobren' || t.status === 'prihvaćen');
        const thisWeek = approved.filter(t => t.date >= weekStr);
        const lastWeek = approved.filter(t => t.date >= prevWeekStr && t.date < weekStr);
        const thisH = thisWeek.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0) / 60;
        const lastH = lastWeek.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0) / 60;
        const pct = lastH > 0 ? ((thisH - lastH) / lastH * 100).toFixed(0) : 0;

        arr.push({ type: thisH >= lastH ? 'success' : 'warn', text: `Ovaj tjedan odrađeno ${thisH.toFixed(1)}h — ${pct > 0 ? '+' : ''}${pct}% u odnosu na prošli tjedan (${lastH.toFixed(1)}h)` });

        // Projects without daily log in 3+ days
        scope.projects.filter(p => p.status === 'aktivan').forEach(p => {
            const logs = (scope.dailyLogs || []).filter(l => l.projectId === p.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            const lastLog = logs[0];
            if (!lastLog || (new Date(now) - new Date(lastLog.date)) / 86400000 > 3) {
                arr.push({ type: 'warn', text: `Projekt "${p.name}" nema dnevnik ${lastLog ? Math.floor((now - new Date(lastLog.date)) / 86400000) + ' dana' : 'uopće'}` });
            }
        });

        // Workers with overtime risk
        scope.workers.filter(w => w.active !== false).forEach(w => {
            const wTs = thisWeek.filter(t => t.workerId === w.id);
            const h = wTs.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0) / 60;
            if (h > 45) arr.push({ type: 'danger', text: `${w.name} radi ${h.toFixed(1)}h ovaj tjedan — moguć prekovremeni rizik!` });
        });

        // Pending approvals
        const pendTs = scope.timesheets.filter(t => t.status === 'na čekanju');
        const old = pendTs.filter(t => (now - new Date(t.createdAt || t.date)) / 86400000 > 2);
        if (old.length > 0) arr.push({ type: 'danger', text: `${old.length} radnih sati čeka odobrenje više od 48h!` });
        if (pendTs.length > 0 && old.length === 0) arr.push({ type: 'info', text: `${pendTs.length} radnih sati na čekanju odobrenja` });

        return arr;
    }, [scope, weekStr, prevWeekStr, now]);

    // ── Weekly trend ──
    const weeklyData = useMemo(() => {
        const weeks = [];
        for (let w = 7; w >= 0; w--) {
            const start = new Date(now.getTime() - (w + 1) * 7 * 86400000);
            const end = new Date(now.getTime() - w * 7 * 86400000);
            const sStr = start.toISOString().slice(0, 10);
            const eStr = end.toISOString().slice(0, 10);
            const ts = scope.timesheets.filter(t => t.date >= sStr && t.date < eStr && (t.status === 'odobren' || t.status === 'prihvaćen'));
            const h = ts.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0) / 60;
            weeks.push({ dan: `T${8 - w}`, hours: +h.toFixed(1) });
        }
        return weeks;
    }, [scope.timesheets, now]);

    // ── Hours by project (donut) ──
    const projectHours = useMemo(() => {
        const map = {};
        const colors = ['#F97316', '#1D4ED8', '#047857', '#B91C1C', '#7C3AED', '#0891B2', '#BE185D', '#B45309'];
        scope.timesheets.filter(t => t.date >= monthStart && (t.status === 'odobren' || t.status === 'prihvaćen')).forEach(t => {
            const p = scope.projects.find(x => x.id === t.projectId);
            const n = p?.name || '?';
            map[n] = (map[n] || 0) + diffMins(t.startTime, t.endTime) / 60;
        });
        return Object.entries(map).map(([name, value], i) => ({ name, value: Math.round(value), color: colors[i % colors.length] }));
    }, [scope.timesheets, scope.projects, monthStart]);

    // ── Anomalies ──
    const anomalies = useMemo(() => {
        const arr = [];
        const todayStr = today();
        // Workers without any timesheet today
        const workedIds = new Set(scope.timesheets.filter(t => t.date === todayStr).map(t => t.workerId));
        const absent = scope.workers.filter(w => w.active !== false && !workedIds.has(w.id));
        if (absent.length > 0) arr.push({ type: 'warn', title: `${absent.length} radnika bez unosa danas`, items: absent.map(w => w.name) });

        // Projects with no GPS
        const noGps = scope.projects.filter(p => p.status === 'aktivan' && (!p.siteLat || !p.siteLng));
        if (noGps.length > 0) arr.push({ type: 'info', title: `${noGps.length} projekata bez GPS koordinata`, items: noGps.map(p => p.name) });

        // Unassigned workers
        const assignedIds = new Set(scope.projects.filter(p => p.status === 'aktivan').flatMap(p => p.workers || []));
        const unassigned = scope.workers.filter(w => w.active !== false && !assignedIds.has(w.id));
        if (unassigned.length > 0) arr.push({ type: 'warn', title: `${unassigned.length} radnika bez aktivnog projekta`, items: unassigned.map(w => w.name) });

        return arr;
    }, [scope, now]);

    // ── Team Performance ──
    const teamScores = useMemo(() => {
        return scope.workers.filter(w => w.active !== false).map(w => {
            const wTs = scope.timesheets.filter(t => t.workerId === w.id && t.date >= monthStart);
            const totalH = wTs.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0) / 60;
            const daysWorked = new Set(wTs.map(t => t.date)).size;
            const avgH = daysWorked > 0 ? totalH / daysWorked : 0;
            // Score: presence(40) + consistency(30) + volume(30)
            const daysSinceMonth = Math.max(1, Math.floor((now - new Date(monthStart)) / 86400000));
            const workDays = Math.floor(daysSinceMonth * 5 / 7);
            const presenceScore = Math.min(40, (daysWorked / Math.max(1, workDays)) * 40);
            const consistencyScore = avgH >= 7 && avgH <= 9 ? 30 : avgH > 0 ? 15 : 0;
            const volumeScore = Math.min(30, (totalH / Math.max(1, workDays * 8)) * 30);
            const score = Math.round(presenceScore + consistencyScore + volumeScore);
            // Streak
            let streak = 0;
            const sorted = [...new Set(wTs.map(t => t.date))].sort().reverse();
            const tdy = today();
            for (const d of sorted) {
                const expected = new Date(now.getTime() - streak * 86400000).toISOString().slice(0, 10);
                if (d === expected || d === tdy) streak++;
                else break;
            }
            return { id: w.id, name: w.name, score, totalH: +totalH.toFixed(1), daysWorked, avgH: +avgH.toFixed(1), streak };
        }).sort((a, b) => b.score - a.score);
    }, [scope.workers, scope.timesheets, monthStart, now]);

    // ── Project Risk Matrix ──
    const projectRisks = useMemo(() => {
        return scope.projects.filter(p => p.status === 'aktivan').map(p => {
            const pTs = scope.timesheets.filter(t => t.projectId === p.id && t.date >= monthStart);
            const pInv = (invoices || []).filter(i => i.projectId === p.id);
            const pLogs = (scope.dailyLogs || []).filter(l => l.projectId === p.id);
            const totalH = pTs.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0) / 60;
            const totalCost = pInv.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
            const pendingCount = pTs.filter(t => t.status === 'na čekanju').length;
            const lastLog = pLogs.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
            const daysSinceLog = lastLog ? Math.floor((now - new Date(lastLog.date)) / 86400000) : 99;
            // Financial risk (0-100)
            const finRisk = Math.min(100, pendingCount * 15 + (totalCost > 10000 ? 30 : totalCost > 5000 ? 15 : 0));
            // Operational risk (0-100)
            const opRisk = Math.min(100, daysSinceLog * 10 + (totalH < 20 ? 20 : 0));
            const workerCount = (p.workers || []).length;
            return { id: p.id, name: p.name, finRisk, opRisk, workerCount, totalH: +totalH.toFixed(1), totalCost, daysSinceLog, pendingCount };
        });
    }, [scope.projects, scope.timesheets, invoices, scope.dailyLogs, monthStart, now]);

    // ── Chatbot ──
    const handleChat = useCallback(() => {
        if (!chatInput.trim()) return;
        // Context-aware: resolve pronouns to last mentioned worker/project
        let resolvedInput = chatInput;
        const ql = chatInput.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const hasExplicitName = scope.workers.some(w => ql.includes((w.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) ||
            scope.projects.some(p => ql.includes((p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
        if (!hasExplicitName) {
            // Inject last context for pronoun-based follow-ups
            if (lastContext.current.worker && /\b(on|ona|njeg|njoj|taj radnik|isti)\b/.test(ql)) {
                resolvedInput = resolvedInput + ' ' + lastContext.current.worker;
            }
            if (lastContext.current.project && /\b(taj projekt|isti projekt|on|taj)\b/.test(ql)) {
                resolvedInput = resolvedInput + ' ' + lastContext.current.project;
            }
        }
        const result = parseChatQuery(resolvedInput, scope);
        // Track context from this answer
        const mw = scope.workers.find(w => ql.includes((w.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
        const mp = scope.projects.find(p => ql.includes((p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
        if (mw) lastContext.current.worker = mw.name;
        if (mp) lastContext.current.project = mp.name;
        setChatHistory(h => [...h, { q: chatInput, a: result.answer, type: result.type }]);
        setChatInput('');
    }, [chatInput, scope]);

    // ── Recommendations ──
    const recommendations = useMemo(() => {
        const arr = [];
        const noGps = scope.projects.filter(p => p.status === 'aktivan' && (!p.siteLat || !p.siteLng));
        if (noGps.length) arr.push({ icon: '📍', text: `Dodajte GPS koordinate za ${noGps.length} projek${noGps.length === 1 ? 't' : 'ata'} — omogućit će vremenske izvještaje`, priority: 'high' });
        const pendOld = scope.timesheets.filter(t => t.status === 'na čekanju' && (now - new Date(t.createdAt || t.date)) / 86400000 > 3);
        if (pendOld.length) arr.push({ icon: '⏰', text: `${pendOld.length} radnih sati čeka odobrenje više od 3 dana — ubrzajte proces`, priority: 'high' });
        const noLog = scope.projects.filter(p => p.status === 'aktivan').filter(p => !(scope.dailyLogs || []).some(l => l.projectId === p.id && l.date >= weekStr));
        if (noLog.length) arr.push({ icon: '📋', text: `${noLog.length} projekata bez dnevnika ovaj tjedan — potaknite radnike na unos`, priority: 'medium' });
        if (teamScores.length > 0 && teamScores[teamScores.length - 1].score < 20) arr.push({ icon: '👷', text: `${teamScores.filter(t => t.score < 20).length} radnika ima niski performance score — provjerite angažman`, priority: 'medium' });
        return arr;
    }, [scope, weekStr, teamScores, now]);

    const medals = ['🥇', '🥈', '🥉'];

    return (
        <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>🧠 AI Uvidi</div>
            <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 20 }}>Pametna analitika, predviđanja i preporuke</div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: tab === t.id ? 'linear-gradient(135deg, #F97316, #EA580C)' : '#F1F5F9', color: tab === t.id ? '#fff' : C.textMuted, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>{t.label}</button>
                ))}
            </div>

            {/* ═══ TAB: PREGLED ═══ */}
            {tab === 'pregled' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Card title="🧠 Smart Summary" icon="">
                        {insights.length === 0 && <div style={{ color: C.textMuted, textAlign: 'center', padding: 20 }}>Nema dovoljno podataka za analizu</div>}
                        {insights.map((ins, i) => <InsightBadge key={i} type={ins.type}>{ins.text}</InsightBadge>)}
                    </Card>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }} className="u-gap-16">
                        <Card title="📈 Tjedni trend sati"><SvgLineChart data={weeklyData} dataKey="hours" color="#F97316" /></Card>
                        <Card title="📊 Sati po projektu (mjesec)"><SvgDonutChart data={projectHours} /></Card>
                    </div>

                    {/* Anomalies */}
                    {anomalies.length > 0 && (
                        <Card title="⚠️ Anomalije & Upozorenja">
                            {anomalies.map((a, i) => (
                                <div key={i} className="u-mb-12">
                                    <InsightBadge type={a.type}>{a.title}</InsightBadge>
                                    {a.items && <div style={{ paddingLeft: 16, fontSize: 12, color: C.textMuted }}>{a.items.slice(0, 5).map((item, j) => <div key={j}>• {item}</div>)}{a.items.length > 5 && <div>... i još {a.items.length - 5}</div>}</div>}
                                </div>
                            ))}
                        </Card>
                    )}

                    {/* Recommendations */}
                    {recommendations.length > 0 && (
                        <Card title="💡 Preporuke">
                            {recommendations.map((r, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: i < recommendations.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                                    <span style={{ fontSize: 20 }}>{r.icon}</span>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.text}</div>
                                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: r.priority === 'high' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)', color: r.priority === 'high' ? '#EF4444' : '#B45309', fontWeight: 700 }}>{r.priority === 'high' ? 'Visoki prioritet' : 'Srednji prioritet'}</span>
                                    </div>
                                </div>
                            ))}
                        </Card>
                    )}
                </div>
            )}

            {/* ═══ TAB: CHATBOT ═══ */}
            {tab === 'chatbot' && (
                <div style={{ maxWidth: 700 }}>
                    <Card title="🤖 AI Asistent — Pitajte o podacima">
                        <div style={{ minHeight: 300, maxHeight: 400, overflowY: 'auto', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {chatHistory.length === 0 && (
                                <div style={{ textAlign: 'center', color: C.textMuted, padding: 40 }}>
                                    <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
                                    <div className="u-fw-600" style={{ fontSize: 14 }}>Pitajte me bilo što o vašim podacima!</div>
                                    <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.8 }}>
                                        Primjeri:<br />
                                        "Koliko je sati radio Marko ovaj tjedan?"<br />
                                        "Tko nije unio sate danas?"<br />
                                        "Tko radi više od 10 sati?"<br />
                                        "Top 5 radnika ovaj mjesec"<br />
                                        "Usporedi zadnja 2 tjedna"<br />
                                        "Gdje je Marko?" · "Sažetak dana"<br />
                                        "Istekle obaveze" · "Koliko vozila?"<br />
                                        Napišite "pomoć" za sve primjere
                                    </div>
                                </div>
                            )}
                            {chatHistory.map((ch, i) => (
                                <div key={i}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                                        <div style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#fff', padding: '8px 14px', borderRadius: '14px 14px 4px 14px', maxWidth: '80%', fontSize: 13, fontWeight: 500 }}>{ch.q}</div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                        <div style={{ background: C.bgElevated, padding: '10px 14px', borderRadius: '14px 14px 14px 4px', maxWidth: '85%', fontSize: 13, whiteSpace: 'pre-line' }}>
                                            {ch.a.split('**').map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()} placeholder="Postavite pitanje..." style={{ flex: 1, padding: '10px 14px', borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none' }} />
                            <button onClick={handleChat} style={{ ...styles.btn, padding: '10px 20px' }}>Pitaj</button>
                        </div>
                    </Card>
                </div>
            )}

            {/* ═══ TAB: PROJEKTI (Predictive + Cost) ═══ */}
            {tab === 'projekti' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Card title="🔮 Prediktivna analiza projekata">
                        {scope.projects.filter(p => p.status === 'aktivan').map(p => {
                            const pTs = scope.timesheets.filter(t => t.projectId === p.id && (t.status === 'odobren' || t.status === 'prihvaćen'));
                            const totalH = pTs.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0) / 60;
                            const pInv = (invoices || []).filter(i => i.projectId === p.id);
                            const totalCost = pInv.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
                            const daysActive = Math.max(1, pTs.length > 0 ? Math.floor((now - new Date(pTs.sort((a, b) => a.date.localeCompare(b.date))[0]?.date || now)) / 86400000) : 1);
                            const dailyRate = totalH / daysActive;
                            const dailyCost = totalCost / daysActive;
                            const workerCount = (p.workers || []).length;

                            return (
                                <div key={p.id} style={{ padding: '16px 0', borderBottom: `1px solid ${C.border}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{p.name}</div>
                                            <div className="u-fs-12" className="u-text-muted">👷 {workerCount} radnika • {daysActive} dana aktivan</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>{totalH.toFixed(0)}h</div>
                                            <div className="u-fs-11" className="u-text-muted">{dailyRate.toFixed(1)}h/dan</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(59,130,246,0.06)', textAlign: 'center' }}>
                                            <div className="u-fs-11" className="u-text-muted">Ukupni troškovi</div>
                                            <div style={{ fontSize: 16, fontWeight: 800, color: '#1D4ED8' }}>{totalCost.toFixed(0)}€</div>
                                        </div>
                                        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
                                            <div className="u-fs-11" className="u-text-muted">Dnevni burn</div>
                                            <div style={{ fontSize: 16, fontWeight: 800, color: '#EA580C' }}>{dailyCost.toFixed(0)}€/dan</div>
                                        </div>
                                        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(16,185,129,0.06)', textAlign: 'center' }}>
                                            <div className="u-fs-11" className="u-text-muted">€/sat</div>
                                            <div style={{ fontSize: 16, fontWeight: 800, color: '#10B981' }}>{totalH > 0 ? (totalCost / totalH).toFixed(1) : '0'}€</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {scope.projects.filter(p => p.status === 'aktivan').length === 0 && <div style={{ textAlign: 'center', color: C.textMuted, padding: 30 }}>Nema aktivnih projekata</div>}
                    </Card>

                    {/* Cost distribution donut */}
                    <Card title="€ Distribucija troškova">
                        <SvgDonutChart data={(() => {
                            const map = {};
                            const colors = ['#F97316', '#1D4ED8', '#047857', '#B91C1C', '#7C3AED', '#0891B2'];
                            (invoices || []).filter(i => i.date >= monthStart).forEach(i => {
                                const p = scope.projects.find(x => x.id === i.projectId);
                                const n = p?.name || 'Ostalo';
                                map[n] = (map[n] || 0) + parseFloat(i.amount || 0);
                            });
                            return Object.entries(map).map(([name, value], i) => ({ name, value: Math.round(value), color: colors[i % colors.length] }));
                        })()} />
                    </Card>
                </div>
            )}

            {/* ═══ TAB: TIM (Gamification) ═══ */}
            {tab === 'tim' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Top 3 Podium */}
                    {teamScores.length >= 3 && (
                        <Card>
                            <div style={{ textAlign: 'center', marginBottom: 16 }}><span style={{ fontSize: 20, fontWeight: 800, color: C.text }}>🏆 Radnici Mjeseca</span></div>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: isMobile ? 8 : 24, marginBottom: 8 }}>
                                {[1, 0, 2].map(idx => {
                                    const s = teamScores[idx];
                                    if (!s) return null;
                                    const isFirst = idx === 0;
                                    return (
                                        <div key={s.id} style={{ textAlign: 'center', width: isMobile ? 90 : 120 }}>
                                            <div style={{ fontSize: isFirst ? 40 : 28 }}>{medals[idx]}</div>
                                            <div style={{ fontSize: isFirst ? 15 : 13, fontWeight: 800, color: C.text, marginTop: 4 }}>{s.name}</div>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: C.accent, marginTop: 4 }}>{s.score}</div>
                                            <div className="u-fs-11" className="u-text-muted">{s.totalH}h • {s.daysWorked} dana</div>
                                            <div style={{ marginTop: 8, height: isFirst ? 80 : idx === 1 ? 60 : 40, background: `linear-gradient(to top, ${C.accent}22, ${C.accent}08)`, borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 6 }}>
                                                <span style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>#{idx + 1}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    )}

                    {/* Full leaderboard */}
                    <Card title="📊 Leaderboard — Svi radnici">
                        {teamScores.map((s, i) => (
                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}7A` }}>
                                <div style={{ width: 32, textAlign: 'center', fontSize: 14, fontWeight: 800, color: i < 3 ? C.accent : C.textMuted }}>{i < 3 ? medals[i] : `#${i + 1}`}</div>
                                <div className="u-flex-1">
                                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{s.name}</div>
                                    <div className="u-fs-12" className="u-text-muted">{s.totalH}h ukupno • {s.avgH}h/dan • {s.daysWorked} dana</div>
                                </div>
                                {s.streak > 2 && <div style={{ padding: '2px 8px', borderRadius: 8, background: 'rgba(249,115,22,0.1)', fontSize: 11, fontWeight: 700, color: '#EA580C' }}>🔥 {s.streak} dana streak</div>}
                                <div style={{ width: 80 }}>
                                    <ProgressBar value={s.score} max={100} color={s.score > 70 ? '#10B981' : s.score > 40 ? '#F59E0B' : '#EF4444'} />
                                    <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 800, color: s.score > 70 ? '#10B981' : s.score > 40 ? '#F59E0B' : '#EF4444' }}>{s.score}</div>
                                </div>
                            </div>
                        ))}
                        {teamScores.length === 0 && <div style={{ textAlign: 'center', color: C.textMuted, padding: 30 }}>Nema podataka o radnicima</div>}
                    </Card>
                </div>
            )}

            {/* ═══ TAB: RIZICI (Risk Matrix) ═══ */}
            {tab === 'rizici' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Card title="🗺️ Risk Matrix — Projekti">
                        <div style={{ position: 'relative', width: '100%', paddingBottom: isMobile ? '100%' : '60%', background: C.bgElevated, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden', marginBottom: 16 }}>
                            {/* Quadrant labels */}
                            <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, color: '#10B981', fontWeight: 700, opacity: 0.5 }}>✅ Nizak rizik</div>
                            <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, color: '#F59E0B', fontWeight: 700, opacity: 0.5 }}>⚡ Fin. rizik</div>
                            <div style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 10, color: '#3B82F6', fontWeight: 700, opacity: 0.5 }}>🔧 Op. rizik</div>
                            <div style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 10, color: '#EF4444', fontWeight: 700, opacity: 0.5 }}>🚨 Kritično</div>
                            {/* Center lines */}
                            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: `${C.border}` }} />
                            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: `${C.border}` }} />
                            {/* Bubbles */}
                            {projectRisks.map(p => {
                                const x = Math.min(90, Math.max(5, p.finRisk));
                                const y = Math.min(90, Math.max(5, 100 - p.opRisk));
                                const size = Math.max(24, Math.min(56, p.workerCount * 12));
                                const isHigh = p.finRisk > 50 || p.opRisk > 50;
                                const color = isHigh ? '#EF4444' : p.finRisk > 30 || p.opRisk > 30 ? '#F59E0B' : '#10B981';
                                return (
                                    <div key={p.id} title={`${p.name}\nFin: ${p.finRisk} | Op: ${p.opRisk}\n${p.totalH}h | ${p.totalCost}€`} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)', width: size, height: size, borderRadius: '50%', background: `${color}30`, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.3s', fontSize: 9, fontWeight: 800, color, textAlign: 'center', lineHeight: 1.1 }}>
                                        {p.name.slice(0, 6)}
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, textAlign: 'center' }}>X: Financijski rizik → | Y: ↑ Operativni rizik | Veličina = broj radnika</div>
                    </Card>

                    {/* Risk details table */}
                    <Card title="📋 Detalji rizika po projektu">
                        <div className="u-overflow-x">
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                                        <th style={{ textAlign: 'left', padding: 8, color: C.textMuted, fontSize: 11, fontWeight: 700 }}>PROJEKT</th>
                                        <th style={{ textAlign: 'center', padding: 8, color: C.textMuted, fontSize: 11 }}>FIN. RIZIK</th>
                                        <th style={{ textAlign: 'center', padding: 8, color: C.textMuted, fontSize: 11 }}>OP. RIZIK</th>
                                        <th style={{ textAlign: 'center', padding: 8, color: C.textMuted, fontSize: 11 }}>RADNICI</th>
                                        <th style={{ textAlign: 'center', padding: 8, color: C.textMuted, fontSize: 11 }}>NA ČEK.</th>
                                        <th style={{ textAlign: 'center', padding: 8, color: C.textMuted, fontSize: 11 }}>ZADNJI DNEVNIK</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projectRisks.sort((a, b) => (b.finRisk + b.opRisk) - (a.finRisk + a.opRisk)).map(p => {
                                        const riskLevel = p.finRisk + p.opRisk > 100 ? 'danger' : p.finRisk + p.opRisk > 50 ? 'warn' : 'success';
                                        const rColors = { danger: '#EF4444', warn: '#F59E0B', success: '#10B981' };
                                        return (
                                            <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}7A` }}>
                                                <td style={{ padding: 8, fontWeight: 600 }}>{p.name}</td>
                                                <td style={{ padding: 8, textAlign: 'center' }}><span style={{ padding: '2px 8px', borderRadius: 6, background: `${rColors[riskLevel]}15`, color: rColors[riskLevel], fontWeight: 700, fontSize: 12 }}>{p.finRisk}</span></td>
                                                <td style={{ padding: 8, textAlign: 'center' }}><span style={{ padding: '2px 8px', borderRadius: 6, background: `${rColors[riskLevel]}15`, color: rColors[riskLevel], fontWeight: 700, fontSize: 12 }}>{p.opRisk}</span></td>
                                                <td style={{ padding: 8, textAlign: 'center' }}>{p.workerCount}</td>
                                                <td style={{ padding: 8, textAlign: 'center' }}>{p.pendingCount > 0 ? <span style={{ color: '#EF4444', fontWeight: 700 }}>{p.pendingCount}</span> : '0'}</td>
                                                <td style={{ padding: 8, textAlign: 'center', fontSize: 12, color: p.daysSinceLog > 3 ? '#EF4444' : C.textMuted }}>{p.daysSinceLog < 99 ? `prije ${p.daysSinceLog}d` : '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
