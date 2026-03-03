import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp, add as addDoc, update as updateDoc, remove as removeDoc } from '../context/AppContext';
import { Icon, Modal, Field, Input, Select, useIsMobile } from './ui/SharedComponents';
import { C, styles, genId } from '../utils/helpers';

// ── WMO Weather Code Mapping ──
const WMO = {
    0: { l: 'Vedro', i: '', g: ['#FF9500', '#FF6B00'] }, 1: { l: 'Pretežno vedro', i: '', g: ['#FFB347', '#FF8C00'] },
    2: { l: 'Djelomično oblačno', i: '⛅', g: ['#87CEEB', '#4A90D9'] }, 3: { l: 'Oblačno', i: '☁️', g: ['#8E9AAF', '#6B7B8D'] },
    45: { l: 'Magla', i: '🌫️', g: ['#B0BEC5', '#78909C'] }, 48: { l: 'Magla (mraz)', i: '🌫️', g: ['#B0BEC5', '#607D8B'] },
    51: { l: 'Slaba rosulja', i: '🌦️', g: ['#74B9FF', '#0984E3'] }, 53: { l: 'Rosulja', i: '🌦️', g: ['#74B9FF', '#0984E3'] },
    55: { l: 'Jaka rosulja', i: '', g: ['#5B86E5', '#36D1DC'] }, 61: { l: 'Slaba kiša', i: '', g: ['#667EEA', '#764BA2'] },
    63: { l: 'Kiša', i: '', g: ['#4834D4', '#686DE0'] }, 65: { l: 'Jaka kiša', i: '', g: ['#341F97', '#5F27CD'] },
    71: { l: 'Slab snijeg', i: '', g: ['#E0EAFC', '#CFDEF3'] }, 73: { l: 'Snijeg', i: '', g: ['#D5DEE7', '#B8C6D3'] },
    75: { l: 'Jak snijeg', i: '', g: ['#BCCCE0', '#9BAFC4'] }, 80: { l: 'Pljuskovi', i: '', g: ['#667EEA', '#764BA2'] },
    82: { l: 'Obilni pljuskovi', i: '', g: ['#341F97', '#5F27CD'] }, 95: { l: 'Grmljavina', i: '', g: ['#1B1464', '#6C5CE7'] },
};
const getWmo = (c) => WMO[c] || { l: 'Nepoznato', i: '🌡️', g: ['#636E72', '#2D3436'] };

// ── Construction Alert Thresholds Defaults ──
const ACTIVITY_PRESETS = {
    betoniranje: { label: '🧱 Betoniranje', minTemp: 5, maxRain: 2, maxWind: 40 },
    dizalica: { label: '🏗️ Rad s dizalicom', minTemp: -10, maxRain: 20, maxWind: 50 },
    fasade: { label: '🎨 Fasaderski radovi', minTemp: 3, maxRain: 1, maxWind: 30 },
    iskop: { label: '⛏️ Iskop', minTemp: -5, maxRain: 10, maxWind: 60 },
    krovovi: { label: '🏠 Krovopokrivanje', minTemp: 0, maxRain: 0.5, maxWind: 35 },
    montaza: { label: '🔧 Montažni radovi', minTemp: -5, maxRain: 5, maxWind: 45 },
};

// ── Open-Meteo API ──
const fetchWeather = async (lat, lng, days) => {
    try {
        const p = new URLSearchParams({
            latitude: lat, longitude: lng,
            current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature',
            daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,wind_speed_10m_max,precipitation_probability_max',
            hourly: 'temperature_2m,weather_code',
            forecast_days: Math.min(days, 16), timezone: 'auto',
        });
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`);
        return r.ok ? await r.json() : null;
    } catch { return null; }
};
const fetchHistorical = async (lat, lng, daysBack) => {
    const end = new Date(), start = new Date();
    start.setDate(start.getDate() - daysBack);
    try {
        const p = new URLSearchParams({
            latitude: lat, longitude: lng,
            start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10),
            daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,wind_speed_10m_max',
            timezone: 'auto',
        });
        const r = await fetch(`https://archive-api.open-meteo.com/v1/archive?${p}`);
        return r.ok ? await r.json() : null;
    } catch { return null; }
};

// ── Work Suitability Score Calculator ──
function calcWorkScore(dayData, rules) {
    if (!dayData || !rules?.length) return { score: 85, issues: [] };
    let worst = 100; const issues = [];
    for (const r of rules) {
        const preset = ACTIVITY_PRESETS[r.activity];
        if (!preset) continue;
        const minT = r.minTemp ?? preset.minTemp;
        const maxR = r.maxRain ?? preset.maxRain;
        const maxW = r.maxWind ?? preset.maxWind;
        if (dayData.min < minT) { worst = Math.min(worst, 30); issues.push(` Temp ${Math.round(dayData.min)}° < ${minT}° (${preset.label})`); }
        if (dayData.precip > maxR) { worst = Math.min(worst, 40); issues.push(` Kiša ${dayData.precip.toFixed(1)}mm > ${maxR}mm (${preset.label})`); }
        if (dayData.wind > maxW) { worst = Math.min(worst, 35); issues.push(`💨 Vjetar ${Math.round(dayData.wind)} > ${maxW} km/h (${preset.label})`); }
    }
    if (!issues.length) {
        if (dayData.precip > 0.5) worst = Math.min(worst, 75);
        if (dayData.wind > 30) worst = Math.min(worst, 70);
    }
    return { score: worst, issues };
}

// ── SVG Mini Temp Chart ──
function TempChart({ data, height = 100 }) {
    if (!data?.length) return null;
    const maxT = Math.max(...data.map(d => d.max)), minT = Math.min(...data.map(d => d.min));
    const range = (maxT - minT) || 1, pad = 20, w = Math.max(data.length * 44, 300), h = height;
    const yS = v => pad + ((maxT - v) / range) * (h - pad * 2), xS = i => pad + (i / Math.max(data.length - 1, 1)) * (w - pad * 2);
    const maxP = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xS(i)},${yS(d.max)}`).join(' ');
    const minP = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xS(i)},${yS(d.min)}`).join(' ');
    const area = `${maxP} L${xS(data.length - 1)},${yS(data[data.length - 1].min)} ${[...data].reverse().map((d, i) => `L${xS(data.length - 1 - i)},${yS(d.min)}`).join(' ')} Z`;
    return (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <svg width={w} height={h + 24} viewBox={`0 0 ${w} ${h + 24}`} style={{ display: 'block' }}>
                <defs><linearGradient id="tG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F97316" stopOpacity="0.3" /><stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" /></linearGradient></defs>
                <path d={area} fill="url(#tG)" /><path d={maxP} fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
                <path d={minP} fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
                {data.map((d, i) => (<g key={i}><circle cx={xS(i)} cy={yS(d.max)} r="3" fill="#F97316" /><circle cx={xS(i)} cy={yS(d.min)} r="3" fill="#3B82F6" />
                    {data.length <= 16 && <text x={xS(i)} y={h + 16} textAnchor="middle" fontSize="10" fill="#94A3B8" fontWeight="600">{d.label}</text>}
                    {data.length <= 16 && <><text x={xS(i)} y={yS(d.max) - 8} textAnchor="middle" fontSize="9" fill="#F97316" fontWeight="700">{Math.round(d.max)}°</text>
                        <text x={xS(i)} y={yS(d.min) + 16} textAnchor="middle" fontSize="9" fill="#3B82F6" fontWeight="700">{Math.round(d.min)}°</text></>}
                </g>))}
            </svg></div>);
}

// ── Work Score Ring ──
function ScoreRing({ score, size = 64 }) {
    const r = (size - 8) / 2, circ = 2 * Math.PI * r, offset = circ * (1 - score / 100);
    const color = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F5F9" strokeWidth="6" />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
            <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize="16" fontWeight="800" fill={color}
                style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>{score}</text>
        </svg>);
}

// ══════════════════════════════════════════════════════════════════════
export function WeatherPage({ leaderProjectIds, workerFilterId }) {
    const { projects, timesheets, weatherRules, addAuditLog, loadWeatherRules } = useApp();
    const isMobile = useIsMobile();
    const [period, setPeriod] = useState(7);

    // C-4: Load weatherRules on mount (lazy)
    useEffect(() => { loadWeatherRules(); }, [loadWeatherRules]);
    const [weatherData, setWeatherData] = useState({});
    const [loading, setLoading] = useState(false);
    const [expandedProject, setExpandedProject] = useState(null);
    const [tab, setTab] = useState('weather'); // weather | planner | alerts | settings
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [ruleForm, setRuleForm] = useState({ projectId: '', activities: [], customThresholds: {} });

    const geoProjects = useMemo(() => {
        let list = projects.filter(p => p.siteLat && p.siteLng && p.status === 'aktivan');
        if (leaderProjectIds?.length) list = list.filter(p => leaderProjectIds.includes(p.id));
        if (workerFilterId) list = list.filter(p => (p.workers || []).includes(workerFilterId));
        return list;
    }, [projects, leaderProjectIds, workerFilterId]);

    const allProjects = useMemo(() => {
        let list = projects.filter(p => p.status === 'aktivan');
        if (leaderProjectIds?.length) list = list.filter(p => leaderProjectIds.includes(p.id));
        if (workerFilterId) list = list.filter(p => (p.workers || []).includes(workerFilterId));
        return list;
    }, [projects, leaderProjectIds, workerFilterId]);

    const noGpsProjects = allProjects.filter(p => !p.siteLat || !p.siteLng);

    // ── Fetch weather ──
    const loadWeather = useCallback(async () => {
        if (!geoProjects.length) return;
        setLoading(true);
        const results = {};
        await Promise.all(geoProjects.map(async p => {
            if (period <= 16) {
                const d = await fetchWeather(p.siteLat, p.siteLng, period);
                if (d) results[p.id] = { type: 'forecast', data: d };
            } else {
                const [f, h] = await Promise.all([fetchWeather(p.siteLat, p.siteLng, 7), fetchHistorical(p.siteLat, p.siteLng, period)]);
                results[p.id] = { type: 'combined', forecast: f, historical: h };
            }
        }));
        setWeatherData(results);
        setLoading(false);
    }, [geoProjects, period]);

    useEffect(() => { loadWeather(); }, [loadWeather]);

    const getDailyData = (pid) => {
        const wd = weatherData[pid]; if (!wd) return [];
        const d = wd.type === 'forecast' ? wd.data?.daily : wd.historical?.daily;
        if (!d) return [];
        return d.time.map((t, i) => ({
            date: t, label: new Date(t).toLocaleDateString('hr', { weekday: 'short', day: 'numeric' }),
            max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], code: d.weather_code[i],
            precip: d.precipitation_sum[i] || 0, wind: d.wind_speed_10m_max?.[i] || 0,
        }));
    };
    const getCurrent = (pid) => {
        const wd = weatherData[pid];
        return (wd?.type === 'forecast' ? wd.data : wd?.forecast)?.current || null;
    };
    const getHourly = (pid) => {
        const wd = weatherData[pid];
        return (wd?.type === 'forecast' ? wd.data : wd?.forecast)?.hourly?.temperature_2m?.slice(0, 24) || [];
    };

    // ── Rules for a project ──
    const getRulesForProject = (pid) => (weatherRules || []).filter(r => r.projectId === pid);

    // ── Generate alerts for all projects ──
    const alerts = useMemo(() => {
        const result = [];
        geoProjects.forEach(p => {
            const daily = getDailyData(p.id);
            const rules = getRulesForProject(p.id);
            if (!rules.length || !daily.length) return;
            // Check tomorrow (index 1) and day after (index 2)
            [1, 2].forEach(idx => {
                const day = daily[idx]; if (!day) return;
                const { score, issues } = calcWorkScore(day, rules);
                if (score < 70) {
                    result.push({ project: p, day, score, issues, daysAhead: idx });
                }
            });
        });
        return result.sort((a, b) => a.score - b.score);
    }, [geoProjects, weatherData, weatherRules]);

    // ── AI Insight: Weather × Productivity ──
    const aiInsights = useMemo(() => {
        if (!timesheets?.length) return [];
        const insights = [];
        // Calculate avg hours on rainy vs sunny days per project
        geoProjects.forEach(p => {
            const daily = getDailyData(p.id);
            if (daily.length < 7) return;
            const rainyDays = daily.filter(d => d.precip > 2).map(d => d.date);
            const sunnyDays = daily.filter(d => d.precip < 0.5 && d.code <= 2).map(d => d.date);
            const projTS = timesheets.filter(t => t.projectId === p.id);
            const rainyHours = projTS.filter(t => rainyDays.includes(t.date)).reduce((s, t) => s + (t.hours || 0), 0);
            const sunnyHours = projTS.filter(t => sunnyDays.includes(t.date)).reduce((s, t) => s + (t.hours || 0), 0);
            const rainyCount = projTS.filter(t => rainyDays.includes(t.date)).length || 1;
            const sunnyCount = projTS.filter(t => sunnyDays.includes(t.date)).length || 1;
            const avgR = rainyHours / rainyCount, avgS = sunnyHours / sunnyCount;
            if (avgS > 0 && avgR > 0 && Math.abs(avgS - avgR) > 0.5) {
                const diff = ((avgS - avgR) / avgS * 100).toFixed(0);
                if (diff > 0) insights.push({ project: p.name, text: `Kišnih dana produktivnost pada ${diff}%`, avgRainy: avgR.toFixed(1), avgSunny: avgS.toFixed(1) });
            }
        });
        return insights;
    }, [geoProjects, weatherData, timesheets]);

    // ── Save/Delete Rules ──
    const saveRule = async () => {
        if (!ruleForm.projectId || !ruleForm.activities.length) return alert('Odaberite projekt i aktivnosti');
        for (const act of ruleForm.activities) {
            const existing = (weatherRules || []).find(r => r.projectId === ruleForm.projectId && r.activity === act);
            const preset = ACTIVITY_PRESETS[act];
            const doc = {
                id: existing?.id || genId(),
                projectId: ruleForm.projectId, activity: act,
                minTemp: ruleForm.customThresholds[act]?.minTemp ?? preset.minTemp,
                maxRain: ruleForm.customThresholds[act]?.maxRain ?? preset.maxRain,
                maxWind: ruleForm.customThresholds[act]?.maxWind ?? preset.maxWind,
                enabled: true,
            };
            if (existing) await updateDoc('weatherRules', existing.id, doc);
            else await addDoc('weatherRules', doc);
        }
        await addAuditLog('WEATHER_RULES_UPDATED', `Pravila postavljena za ${projects.find(p => p.id === ruleForm.projectId)?.name}`);
        setShowRuleModal(false);
    };
    const deleteRule = async (id) => { await removeDoc('weatherRules', id); };

    const periods = [
        { v: 3, l: '3d', s: 'Prognoza' }, { v: 7, l: '7d', s: 'Prognoza' }, { v: 14, l: '14d', s: 'Prognoza' },
        { v: 30, l: '30d', s: 'Povijest' }, { v: 60, l: '60d', s: 'Povijest' }, { v: 90, l: '90d', s: 'Povijest' },
    ];

    const avgTemp = useMemo(() => {
        const all = geoProjects.map(p => getCurrent(p.id)).filter(Boolean);
        return all.length ? (all.reduce((s, c) => s + c.temperature_2m, 0) / all.length).toFixed(1) : null;
    }, [geoProjects, weatherData]);

    const isWorkerView = !!workerFilterId;

    // ── TABS ──
    const tabs = isWorkerView ? [
        { id: 'weather', label: ' Pregled', icon: 'eye' },
        { id: 'alerts', label: `⚠️ Upozorenja${alerts.length ? ` (${alerts.length})` : ''}`, icon: 'check' },
    ] : [
        { id: 'weather', label: ' Pregled', icon: 'eye' },
        { id: 'planner', label: '📅 Planer', icon: 'calendar' },
        { id: 'alerts', label: `⚠️ Upozorenja${alerts.length ? ` (${alerts.length})` : ''}`, icon: 'check' },
        { id: 'settings', label: '⚙️ Pravila', icon: 'settings' },
    ];

    return (
        <div>
            {/* ── Hero Header ── */}
            <div style={{ background: 'linear-gradient(135deg,#0F172A,#1E3A5F,#0F172A)', borderRadius: 20, padding: isMobile ? '20px 16px' : '28px 32px', marginBottom: 20, color: '#fff', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -30, right: -20, fontSize: 120, opacity: 0.06 }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, position: 'relative', zIndex: 1 }}>
                    <div>
                        <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 800, letterSpacing: '-0.5px' }}> Vremenske prilike</div>
                        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{geoProjects.length} projekt{geoProjects.length !== 1 ? 'a' : ''} s GPS lokacijom</div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                            {avgTemp && <div style={{ padding: '6px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                                <div style={{ fontSize: 9, opacity: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>Prosjek</div>
                                <div style={{ fontSize: 20, fontWeight: 800 }}>{avgTemp}°C</div>
                            </div>}
                            {alerts.length > 0 && <div style={{ padding: '6px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)' }}>
                                <div style={{ fontSize: 9, opacity: 0.8, textTransform: 'uppercase', fontWeight: 700 }}>⚠️ Upozorenja</div>
                                <div style={{ fontSize: 20, fontWeight: 800 }}>{alerts.length}</div>
                            </div>}
                        </div>
                    </div>
                    <button onClick={loadWeather} disabled={loading} style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
                        {loading ? '⏳ Učitavam...' : '🔄 Osvježi'}
                    </button>
                </div>
            </div>

            {/* ── Alert Banner (if any) ── */}
            {alerts.length > 0 && tab !== 'alerts' && (
                <div style={{ ...styles.card, background: 'linear-gradient(135deg,rgba(239,68,68,0.06),rgba(249,115,22,0.06))', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16, cursor: 'pointer' }} onClick={() => setTab('alerts')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 20 }}>⚠️</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.red }}>{alerts.length} vremensko upozorenje{alerts.length !== 1 ? 'a' : ''}</div>
                            <div className="u-fs-12" style={{ color: C.textMuted }}>{alerts[0].issues[0]} — klikni za detalje</div>
                        </div>
                        <span className="u-fs-11" style={{ color: C.textMuted }}>▶</span>
                    </div>
                </div>
            )}

            {/* ── Tab Bar ── */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: C.bgElevated, borderRadius: 12, padding: 4, overflowX: 'auto' }}>
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{
                        flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
                        background: tab === t.id ? '#fff' : 'transparent', color: tab === t.id ? C.text : C.textMuted,
                        boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s', whiteSpace: 'nowrap', minWidth: isMobile ? 'auto' : 'unset'
                    }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ══════ TAB: WEATHER OVERVIEW ══════ */}
            {tab === 'weather' && <>
                {/* Period selector */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                    {periods.map(p => (
                        <button key={p.v} onClick={() => setPeriod(p.v)} style={{
                            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: period === p.v ? 700 : 500,
                            background: period === p.v ? C.accent : '#F1F5F9', color: period === p.v ? '#fff' : C.textDim, transition: 'all 0.2s'
                        }}>
                            {p.l}<span style={{ display: 'block', fontSize: 9, opacity: 0.7 }}>{p.s}</span>
                        </button>
                    ))}
                </div>

                {loading && <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>⏳ Učitavam vremenske podatke...</div>}

                {!loading && <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(340px,1fr))', gap: 16 }}>
                    {geoProjects.map(p => {
                        const cur = getCurrent(p.id), daily = getDailyData(p.id), hourly = getHourly(p.id);
                        const wmo = cur ? getWmo(cur.weather_code) : getWmo(2);
                        const rules = getRulesForProject(p.id);
                        const todayScore = daily[0] ? calcWorkScore(daily[0], rules) : { score: 85, issues: [] };
                        const isExp = expandedProject === p.id;

                        return (
                            <div key={p.id} style={{ borderRadius: 20, overflow: 'hidden', border: `1px solid ${C.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', cursor: 'pointer' }}
                                onClick={() => setExpandedProject(isExp ? null : p.id)}>
                                {/* Gradient header */}
                                <div style={{
                                    background: cur ? `linear-gradient(135deg,${wmo.g[0]},${wmo.g[1]})` : 'linear-gradient(135deg,#64748B,#475569)',
                                    padding: isMobile ? '16px' : '20px 22px 16px', color: '#fff', position: 'relative', overflow: 'hidden'
                                }}>
                                    <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 72, opacity: 0.15 }}>{wmo.i}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                                        <div>
                                            <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
                                            <div style={{ fontSize: 11, opacity: 0.8 }}>📍 {p.location || `${p.siteLat?.toFixed(2)}°N`}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {rules.length > 0 && <ScoreRing score={todayScore.score} size={48} />}
                                            <span style={{ fontSize: 28 }}>{wmo.i}</span>
                                        </div>
                                    </div>
                                    {cur && <div style={{ marginTop: 10, position: 'relative', zIndex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                            <span style={{ fontSize: 42, fontWeight: 800, lineHeight: 1 }}>{Math.round(cur.temperature_2m)}°</span>
                                            <span style={{ fontSize: 13, opacity: 0.8 }}>{wmo.l}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 11, opacity: 0.8 }}>
                                            <span>💨 {cur.wind_speed_10m} km/h</span><span>💧 {cur.relative_humidity_2m}%</span>
                                            <span>🌡️ {Math.round(cur.apparent_temperature)}°</span>
                                        </div>
                                    </div>}
                                    {/* Hourly sparkline */}
                                    {hourly.length > 0 && <div style={{ marginTop: 8, opacity: 0.5 }}>
                                        <svg width={isMobile ? 260 : 300} height={36} viewBox={`0 0 ${isMobile ? 260 : 300} 36`}>
                                            <polyline points={hourly.map((t, i) => `${(i / (hourly.length - 1)) * (isMobile ? 260 : 300)},${3 + ((Math.max(...hourly) - t) / (Math.max(...hourly) - Math.min(...hourly) || 1)) * 30}`).join(' ')}
                                                fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                    </div>}
                                </div>
                                {/* Daily mini row */}
                                <div style={{ background: C.card, padding: '10px 14px' }}>
                                    <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
                                        {daily.slice(0, 7).map((d, i) => (
                                            <div key={i} style={{ textAlign: 'center', padding: '4px 6px', borderRadius: 8, minWidth: 40, background: i === 0 ? 'rgba(249,115,22,0.06)' : 'transparent' }}>
                                                <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 600 }}>{d.label}</div>
                                                <div style={{ fontSize: 16, margin: '2px 0' }}>{getWmo(d.code).i}</div>
                                                <div style={{ fontSize: 10 }}><span style={{ fontWeight: 700, color: '#F97316' }}>{Math.round(d.max)}°</span><span style={{ color: C.textMuted }}>/</span><span style={{ color: '#3B82F6' }}>{Math.round(d.min)}°</span></div>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Score issues for today */}
                                    {todayScore.issues.length > 0 && (
                                        <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', fontSize: 11, color: C.red }}>
                                            {todayScore.issues[0]}
                                        </div>
                                    )}
                                    <div style={{ textAlign: 'center', marginTop: 4 }}><span style={{ fontSize: 10, color: C.textMuted }}>{isExp ? '▲' : '▼'}</span></div>
                                </div>
                                {/* Expanded */}
                                {isExp && daily.length > 0 && (
                                    <div style={{ background: C.bgElevated, padding: '14px 18px', borderTop: `1px solid ${C.border}` }}>
                                        <TempChart data={daily} />
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginTop: 12 }}>
                                            <thead><tr style={{ borderBottom: `2px solid ${C.border}` }}>
                                                <th style={{ textAlign: 'left', padding: '6px 4px', color: C.textMuted, fontWeight: 700, fontSize: 9 }}>DAN</th>
                                                <th style={{ textAlign: 'center', padding: '6px', fontSize: 9, color: C.textMuted }}>UVJETI</th>
                                                <th style={{ textAlign: 'center', padding: '6px', fontSize: 9, color: '#F97316' }}>MAX</th>
                                                <th style={{ textAlign: 'center', padding: '6px', fontSize: 9, color: '#3B82F6' }}>MIN</th>
                                                <th style={{ textAlign: 'center', padding: '6px', fontSize: 9, color: C.textMuted }}>💧</th>
                                                <th style={{ textAlign: 'center', padding: '6px', fontSize: 9, color: C.textMuted }}>💨</th>
                                                {rules.length > 0 && <th style={{ textAlign: 'center', padding: '6px', fontSize: 9, color: C.textMuted }}>SKOR</th>}
                                            </tr></thead>
                                            <tbody>{daily.map((d, i) => {
                                                const wm = getWmo(d.code), sc = calcWorkScore(d, rules);
                                                return (<tr key={i} style={{ borderBottom: `1px solid ${C.border}7A` }}>
                                                    <td style={{ padding: '6px 4px', fontWeight: 600 }}>{d.label}</td>
                                                    <td style={{ padding: '6px', textAlign: 'center' }}>{wm.i} <span style={{ fontSize: 10, color: C.textDim }}>{wm.l}</span></td>
                                                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700, color: '#F97316' }}>{Math.round(d.max)}°</td>
                                                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700, color: '#3B82F6' }}>{Math.round(d.min)}°</td>
                                                    <td style={{ padding: '6px', textAlign: 'center', color: d.precip > 0 ? '#3B82F6' : C.textMuted }}>{d.precip.toFixed(1)}</td>
                                                    <td style={{ padding: '6px', textAlign: 'center', color: d.wind > 40 ? C.red : C.textDim }}>{Math.round(d.wind)}</td>
                                                    {rules.length > 0 && <td style={{ padding: '6px', textAlign: 'center' }}>
                                                        <span style={{
                                                            padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                                            background: sc.score >= 80 ? 'rgba(16,185,129,0.1)' : sc.score >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                                            color: sc.score >= 80 ? '#10B981' : sc.score >= 50 ? '#F59E0B' : '#EF4444'
                                                        }}>{sc.score}</span>
                                                    </td>}
                                                </tr>);
                                            })}</tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>}

                {/* AI Insights */}
                {aiInsights.length > 0 && (
                    <div style={{ ...styles.card, marginTop: 20, background: 'linear-gradient(135deg,rgba(99,102,241,0.04),rgba(139,92,246,0.04))', border: '1px solid rgba(99,102,241,0.15)' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#6366F1', marginBottom: 10 }}>🤖 AI Uvidi — Vrijeme × Produktivnost</div>
                        {aiInsights.map((ins, i) => (
                            <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.06)', marginBottom: 6, fontSize: 12 }}>
                                <span style={{ fontWeight: 700, color: C.text }}>{ins.project}:</span> <span style={{ color: C.textDim }}>{ins.text}</span>
                                <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 8 }}>( {ins.avgSunny}h vs  {ins.avgRainy}h prosjek)</span>
                            </div>
                        ))}
                    </div>
                )}

                {noGpsProjects.length > 0 && <div style={{ ...styles.card, background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(249,115,22,0.2)', marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 6 }}>📍 Projekti bez GPS-a</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{noGpsProjects.map(p => (
                        <span key={p.id} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(249,115,22,0.08)', fontSize: 11, fontWeight: 600, color: C.textDim }}>{p.name}</span>
                    ))}</div>
                </div>}
            </>}

            {/* ══════ TAB: WEEKLY PLANNER ══════ */}
            {tab === 'planner' && (
                <div style={{ ...styles.card }}>
                    <div className="u-section-title u-mb-12">📅 Tjedni vremenski planer</div>
                    <div className="u-overflow-x">
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                            <thead><tr>
                                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: `2px solid ${C.border}`, fontSize: 11, color: C.textMuted, fontWeight: 700, minWidth: 120 }}>PROJEKT</th>
                                {[...Array(7)].map((_, i) => {
                                    const d = new Date(); d.setDate(d.getDate() + i);
                                    return <th key={i} style={{ textAlign: 'center', padding: '10px 4px', borderBottom: `2px solid ${C.border}`, fontSize: 10, color: i === 0 ? C.accent : C.textMuted, fontWeight: 700 }}>
                                        {d.toLocaleDateString('hr', { weekday: 'short' })}<br />{d.getDate()}.
                                    </th>;
                                })}
                            </tr></thead>
                            <tbody>
                                {geoProjects.map(p => {
                                    const daily = getDailyData(p.id);
                                    const rules = getRulesForProject(p.id);
                                    return (
                                        <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}7A` }}>
                                            <td style={{ padding: '10px 8px' }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{p.name}</div>
                                                <div style={{ fontSize: 10, color: C.textMuted }}>📍 {p.location || '—'}</div>
                                            </td>
                                            {[...Array(7)].map((_, i) => {
                                                const d = daily[i];
                                                if (!d) return <td key={i} style={{ textAlign: 'center', padding: 8, color: C.textMuted, fontSize: 11 }}>—</td>;
                                                const sc = calcWorkScore(d, rules);
                                                const bgColor = sc.score >= 80 ? 'rgba(16,185,129,0.06)' : sc.score >= 50 ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)';
                                                return (
                                                    <td key={i} style={{ textAlign: 'center', padding: '6px 4px', background: bgColor, borderRadius: 4 }} title={sc.issues.join('\n')}>
                                                        <div style={{ fontSize: 18 }}>{getWmo(d.code).i}</div>
                                                        <div style={{ fontSize: 10, fontWeight: 700 }}>
                                                            <span style={{ color: '#F97316' }}>{Math.round(d.max)}°</span>
                                                            <span style={{ color: C.textMuted }}>/</span>
                                                            <span style={{ color: '#3B82F6' }}>{Math.round(d.min)}°</span>
                                                        </div>
                                                        {d.precip > 0.5 && <div style={{ fontSize: 9, color: '#3B82F6' }}>💧{d.precip.toFixed(1)}</div>}
                                                        {rules.length > 0 && <div style={{ fontSize: 9, fontWeight: 700, marginTop: 2, color: sc.score >= 80 ? '#10B981' : sc.score >= 50 ? '#F59E0B' : '#EF4444' }}>{sc.score}</div>}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: C.textMuted }}>
                        <span>🟢 ≥80 Idealno</span><span>🟡 50-79 Ograničeno</span><span>🔴 &lt;50 Rizično</span>
                    </div>
                </div>
            )}

            {/* ══════ TAB: ALERTS ══════ */}
            {tab === 'alerts' && (
                <div>
                    {alerts.length === 0 ? (
                        <div style={{ ...styles.card, textAlign: 'center', padding: 40 }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Nema upozorenja</div>
                            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Vremenski uvjeti su povoljni za sve projekte.</div>
                            {(weatherRules || []).length === 0 && <div style={{ fontSize: 12, color: C.accent, marginTop: 8, cursor: 'pointer' }} onClick={() => setTab('settings')}>⚙️ Postavite pravila za upozorenja →</div>}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {alerts.map((a, i) => (
                                <div key={i} style={{ ...styles.card, borderLeft: `4px solid ${a.score < 50 ? '#EF4444' : '#F59E0B'}`, background: a.score < 50 ? 'rgba(239,68,68,0.03)' : 'rgba(245,158,11,0.03)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <div>
                                            <div className="u-section-title">{a.project.name}</div>
                                            <div className="u-fs-11" style={{ color: C.textMuted }}>{a.daysAhead === 1 ? '⏰ Sutra' : '📅 Za 2 dana'} — {a.day.label}</div>
                                        </div>
                                        <ScoreRing score={a.score} size={52} />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, fontSize: 12 }}>
                                        <span>{getWmo(a.day.code).i} {getWmo(a.day.code).l}</span>
                                        <span style={{ color: '#F97316', fontWeight: 600 }}>↑{Math.round(a.day.max)}°</span>
                                        <span style={{ color: '#3B82F6', fontWeight: 600 }}>↓{Math.round(a.day.min)}°</span>
                                        {a.day.precip > 0 && <span style={{ color: '#3B82F6' }}>💧 {a.day.precip.toFixed(1)}mm</span>}
                                        <span style={{ color: C.textDim }}>💨 {Math.round(a.day.wind)} km/h</span>
                                    </div>
                                    {a.issues.map((iss, j) => (
                                        <div key={j} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', fontSize: 11, color: C.red, marginBottom: 4 }}>{iss}</div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ══════ TAB: SETTINGS ══════ */}
            {tab === 'settings' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>⚙️ Pravila upozorenja</div>
                            <div className="u-fs-12" style={{ color: C.textMuted }}>Definirajte pragove za svaki projekt i tip radova</div>
                        </div>
                        <button onClick={() => { setRuleForm({ projectId: '', activities: [], customThresholds: {} }); setShowRuleModal(true); }} style={styles.btn}>
                            <Icon name="plus" size={14} /> Novo pravilo
                        </button>
                    </div>

                    {/* Existing rules grouped by project */}
                    {geoProjects.map(p => {
                        const pRules = getRulesForProject(p.id);
                        if (!pRules.length) return null;
                        return (
                            <div key={p.id} style={{ ...styles.card, marginBottom: 12 }}>
                                <div className="u-section-title" style={{ fontSize: 13, marginBottom: 10 }}>{p.name} <span className="u-fs-11" style={{ color: C.textMuted }}>— {pRules.length} pravilo{pRules.length !== 1 ? 'a' : ''}</span></div>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(220px,1fr))', gap: 8 }}>
                                    {pRules.map(r => {
                                        const preset = ACTIVITY_PRESETS[r.activity];
                                        return (
                                            <div key={r.id} style={{ padding: '10px 14px', borderRadius: 10, background: C.bgElevated, border: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontSize: 12, fontWeight: 700 }}>{preset?.label || r.activity}</div>
                                                    <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                                                         ≥{r.minTemp}° &nbsp;  ≤{r.maxRain}mm &nbsp; 💨 ≤{r.maxWind}km/h
                                                    </div>
                                                </div>
                                                <button onClick={() => deleteRule(r.id)} style={{ ...styles.btnSmall, color: C.red, borderColor: 'rgba(239,68,68,0.2)', padding: '4px 8px' }}>✕</button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {(weatherRules || []).length === 0 && (
                        <div style={{ ...styles.card, textAlign: 'center', padding: 40, color: C.textMuted }}>
                            <div style={{ fontSize: 36, marginBottom: 8 }}>⚙️</div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>Nema definiranih pravila</div>
                            <div style={{ fontSize: 12, marginTop: 4 }}>Dodajte pravila za praćenje vremenskih uvjeta po projektu i tipu radova.</div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Rule Modal ── */}
            {showRuleModal && (
                <Modal title="Novo pravilo upozorenja" onClose={() => setShowRuleModal(false)}>
                    <Field label="Projekt" required>
                        <Select value={ruleForm.projectId} onChange={e => setRuleForm(f => ({ ...f, projectId: e.target.value }))}>
                            <option value="">— Odaberi —</option>
                            {geoProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                    </Field>

                    <div style={{ marginTop: 12 }}>
                        <span style={styles.label}>Tipovi radova</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                            {Object.entries(ACTIVITY_PRESETS).map(([key, preset]) => {
                                const active = ruleForm.activities.includes(key);
                                return (
                                    <div key={key} onClick={() => setRuleForm(f => ({ ...f, activities: active ? f.activities.filter(a => a !== key) : [...f.activities, key] }))}
                                        style={{
                                            padding: '10px 12px', borderRadius: 10, border: `2px solid ${active ? C.accent : C.border}`, cursor: 'pointer',
                                            background: active ? 'rgba(249,115,22,0.06)' : '#fff', transition: 'all 0.2s'
                                        }}>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{preset.label}</div>
                                        <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>
                                             ≥{preset.minTemp}° &nbsp;  ≤{preset.maxRain}mm &nbsp; 💨 ≤{preset.maxWind}km/h
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {ruleForm.activities.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                            <span style={styles.label}>Prilagodi pragove (opcionalno)</span>
                            {ruleForm.activities.map(act => {
                                const preset = ACTIVITY_PRESETS[act];
                                const custom = ruleForm.customThresholds[act] || {};
                                const setCustom = (k, v) => setRuleForm(f => ({ ...f, customThresholds: { ...f.customThresholds, [act]: { ...custom, [k]: v ? Number(v) : undefined } } }));
                                return (
                                    <div key={act} style={{ padding: '10px 12px', borderRadius: 8, background: C.bgElevated, marginTop: 8 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{preset.label}</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                            <div><label style={{ fontSize: 10, color: C.textMuted }}>Min temp (°C)</label>
                                                <Input type="number" placeholder={String(preset.minTemp)} value={custom.minTemp ?? ''} onChange={e => setCustom('minTemp', e.target.value)} /></div>
                                            <div><label style={{ fontSize: 10, color: C.textMuted }}>Max kiša (mm)</label>
                                                <Input type="number" placeholder={String(preset.maxRain)} value={custom.maxRain ?? ''} onChange={e => setCustom('maxRain', e.target.value)} /></div>
                                            <div><label style={{ fontSize: 10, color: C.textMuted }}>Max vjetar (km/h)</label>
                                                <Input type="number" placeholder={String(preset.maxWind)} value={custom.maxWind ?? ''} onChange={e => setCustom('maxWind', e.target.value)} /></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                        <button onClick={() => setShowRuleModal(false)} style={styles.btnSecondary}>Odustani</button>
                        <button onClick={saveRule} style={styles.btn}><Icon name="check" size={14} /> Spremi</button>
                    </div>
                </Modal>
            )}

            {geoProjects.length === 0 && !loading && <div style={{ ...styles.card, textAlign: 'center', padding: 60, color: C.textMuted }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📍</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Nema projekata s GPS koordinatama</div>
                <div style={{ fontSize: 13 }}>Postavite GPS koordinate u postavkama projekta.</div>
            </div>}
        </div>
    );
}
