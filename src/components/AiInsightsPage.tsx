import { useState, useMemo, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Icon, SvgBarChart, SvgLineChart, SvgDonutChart, useIsMobile } from './ui/SharedComponents';
import { C, styles, fmtDate, diffMins, today } from '../utils/helpers';

const TABS = [
    { id: 'pregled', label: '🧠 Pregled' },
    { id: 'chatbot', label: '🤖 Chatbot' },
    { id: 'projekti', label: '🔮 Projekti' },
    { id: 'tim', label: '🏅 Tim' },
    { id: 'rizici', label: '🗺️ Rizici' },
];

const Card = ({ title, icon, children, accent, style: s }) => (
    <div style={{ ...styles.card, ...s }}>
        {title && <div style={{ fontSize: 14, fontWeight: 700, color: accent || C.text, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>{icon} {title}</div>}
        {children}
    </div>
);

const InsightBadge = ({ type = 'info', children }) => {
    const colors = { info: ['#3B82F6', 'rgba(59,130,246,0.08)'], warn: ['#F59E0B', 'rgba(245,158,11,0.08)'], danger: ['#EF4444', 'rgba(239,68,68,0.08)'], success: ['#10B981', 'rgba(16,185,129,0.08)'] };
    const [c, bg] = colors[type] || colors.info;
    return <div style={{ padding: '10px 14px', borderRadius: 10, background: bg, border: `1px solid ${c}20`, fontSize: 13, color: c, fontWeight: 600, marginBottom: 8 }}>{children}</div>;
};

const ProgressBar = ({ value, max, color = C.accent, label }) => (
    <div style={{ marginBottom: 8 }}>
        {label && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.textMuted, marginBottom: 4 }}><span>{label}</span><span>{Math.round(value / max * 100)}%</span></div>}
        <div style={{ height: 8, borderRadius: 4, background: C.bgElevated }}><div style={{ height: '100%', borderRadius: 4, background: color, width: `${Math.min(100, value / max * 100)}%`, transition: 'width 0.5s' }} /></div>
    </div>
);

// ── NLP Chatbot Engine (100 questions) ──
const parseChatQuery = (q, data) => {
    const { workers, projects, timesheets, dailyLogs, invoices, otpremnice, vehicles, smjestaj, obaveze, safetyChecklists } = data;
    const ql = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const now = new Date();
    const todayStr = today();
    const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStr = weekAgo.toISOString().slice(0, 10);
    const prevWeekStart = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10);
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const prevMonth = now.getMonth() === 0 ? `${now.getFullYear() - 1}-12-01` : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}-01`;
    const prevMonthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const activeWorkers = workers.filter(w => w.active !== false);
    const activeProjects = projects.filter(p => p.status === 'aktivan');
    const approved = timesheets.filter(t => t.status === 'odobren' || t.status === 'prihvaćen');

    const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const mw = workers.find(w => ql.includes(norm(w.name)));
    const mp = projects.find(p => ql.includes(norm(p.name)));
    const numMatch = ql.match(/(\d+)/); const num = numMatch ? parseInt(numMatch[1]) : null;

    const isToday = ql.includes('danas');
    const isYesterday = ql.includes('jucer');
    const isWeek = ql.includes('tjedan') || ql.includes('tjednu') || ql.includes('tjedno');
    const isPrevWeek = ql.includes('prosli tjedan') || ql.includes('proslom tjedn');
    const isMonth = ql.includes('mjesec') || ql.includes('mjesecu');
    const isPrevMonth = ql.includes('prosli mjesec') || ql.includes('proslom mjesec');
    const periodStr = isToday ? todayStr : isYesterday ? yesterdayStr : isPrevMonth ? prevMonth : isMonth ? monthStart : isPrevWeek ? prevWeekStart : weekStr;
    const periodEnd = isPrevWeek ? weekStr : isPrevMonth ? prevMonthEnd : null;
    const periodLabel = isToday ? 'danas' : isYesterday ? 'jučer' : isPrevMonth ? 'prošli mjesec' : isMonth ? 'ovaj mjesec' : isPrevWeek ? 'prošli tjedan' : 'ovaj tjedan';

    const filterTs = (since, until) => {
        let ts = approved.filter(t => t.date >= since && (!until || t.date < until));
        if (mw) ts = ts.filter(t => t.workerId === mw.id);
        if (mp) ts = ts.filter(t => t.projectId === mp.id);
        return ts;
    };
    const sumH = ts => +(ts.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0) / 60).toFixed(1);
    const who = mw ? mw.name : 'Ukupno';
    const where = mp ? ` na projektu ${mp.name}` : '';

    // ─── 1-13: SATI RADA ─────────────────────────────────────────────
    // Q1-5: Koliko sati radio [ime] danas/jučer/tjedan/mjesec
    if (ql.includes('koliko') && (ql.includes('sat') || ql.includes('radio') || ql.includes('radila') || ql.includes('odradio') || ql.includes('odradila'))) {
        const ts = filterTs(periodStr, periodEnd);
        const h = sumH(ts);
        return { answer: `${who} je odradio/la **${h} sati** ${periodLabel}${where}.`, type: 'success' };
    }
    // Q6: Tko ima najviše sati
    if ((ql.includes('najvise') || ql.includes('top') || ql.includes('najbolji')) && (ql.includes('sat') || ql.includes('radio'))) {
        const since = isMonth ? monthStart : weekStr;
        const byW = {};
        approved.filter(t => t.date >= since).forEach(t => { byW[t.workerId] = (byW[t.workerId] || 0) + diffMins(t.startTime, t.endTime); });
        const sorted = Object.entries(byW).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (!sorted.length) return { answer: 'Nema podataka o satima.', type: 'info' };
        const lines = sorted.map(([id, m], i) => `${i + 1}. ${workers.find(w => w.id === id)?.name || '?'} — **${(m / 60).toFixed(1)}h**`);
        return { answer: `🏆 Top radnici po satima (${isMonth ? 'mjesec' : 'tjedan'}):\n${lines.join('\n')}`, type: 'success' };
    }
    // Q7: Tko ima najmanje sati
    if ((ql.includes('najmanje') || ql.includes('najmanji')) && (ql.includes('sat') || ql.includes('radio'))) {
        const since = isMonth ? monthStart : weekStr;
        const byW = {};
        activeWorkers.forEach(w => { byW[w.id] = 0; });
        approved.filter(t => t.date >= since).forEach(t => { byW[t.workerId] = (byW[t.workerId] || 0) + diffMins(t.startTime, t.endTime); });
        const sorted = Object.entries(byW).sort((a, b) => a[1] - b[1]).slice(0, 5);
        const lines = sorted.map(([id, m], i) => `${i + 1}. ${workers.find(w => w.id === id)?.name || '?'} — **${(m / 60).toFixed(1)}h**`);
        return { answer: `📉 Radnici s najmanje sati (${isMonth ? 'mjesec' : 'tjedan'}):\n${lines.join('\n')}`, type: 'warn' };
    }
    // Q8: Prosječno sati po radniku
    if (ql.includes('prosjecn') && (ql.includes('sat') || ql.includes('rad'))) {
        const since = isMonth ? monthStart : weekStr;
        const ts = approved.filter(t => t.date >= since);
        const total = sumH(ts);
        const avg = activeWorkers.length ? (total / activeWorkers.length).toFixed(1) : 0;
        return { answer: `Prosječno **${avg} sati** po radniku ${isMonth ? 'ovaj mjesec' : 'ovaj tjedan'}. (Ukupno: ${total}h, ${activeWorkers.length} radnika)`, type: 'info' };
    }
    // Q9: Ukupno sati danas/tjedan/mjesec
    if (ql.includes('ukupno') && (ql.includes('sat') || ql.includes('rad'))) {
        const ts = filterTs(periodStr, periodEnd);
        const h = sumH(ts);
        const cnt = new Set(ts.map(t => t.workerId)).size;
        return { answer: `Ukupno **${h} sati** ${periodLabel}${where}. (${cnt} radnika)`, type: 'success' };
    }
    // Q10: Koliko dana je [ime] radio ovaj mjesec/tjedan
    if (ql.includes('koliko') && (ql.includes('dan') || ql.includes('dana')) && (ql.includes('radio') || ql.includes('radila') || ql.includes('rad'))) {
        if (!mw) return { answer: 'Molim navedite ime radnika. Npr: "Koliko dana je Marko radio ovaj mjesec?"', type: 'info' };
        const since = isMonth ? monthStart : weekStr;
        const days = new Set(approved.filter(t => t.workerId === mw.id && t.date >= since).map(t => t.date)).size;
        return { answer: `${mw.name} je radio/la **${days} dana** ${periodLabel}.`, type: 'success' };
    }
    // Q11: Koliko sati ima projekt [ime]
    if (ql.includes('koliko') && ql.includes('sat') && mp) {
        const since = isMonth ? monthStart : weekStr;
        const h = sumH(approved.filter(t => t.projectId === mp.id && t.date >= since));
        return { answer: `Projekt **${mp.name}** ima **${h} sati** ${periodLabel}.`, type: 'success' };
    }
    // Q12: Sati po projektu breakdown
    if ((ql.includes('sati po projektu') || ql.includes('projekti sati') || ql.includes('raspodjela')) && ql.includes('sat')) {
        const since = isMonth ? monthStart : weekStr;
        const byP = {};
        approved.filter(t => t.date >= since).forEach(t => { byP[t.projectId] = (byP[t.projectId] || 0) + diffMins(t.startTime, t.endTime); });
        const sorted = Object.entries(byP).sort((a, b) => b[1] - a[1]);
        if (!sorted.length) return { answer: 'Nema podataka.', type: 'info' };
        const lines = sorted.map(([id, m]) => `• ${projects.find(p => p.id === id)?.name || '?'} — **${(m / 60).toFixed(1)}h**`);
        return { answer: `📊 Sati po projektu (${isMonth ? 'mjesec' : 'tjedan'}):\n${lines.join('\n')}`, type: 'info' };
    }
    // Q13: Kada je [ime] zadnji put radio
    if ((ql.includes('kada') || ql.includes('kad') || ql.includes('zadnji put')) && (ql.includes('radio') || ql.includes('radila'))) {
        if (!mw) return { answer: 'Navedite ime radnika. Npr: "Kad je Marko zadnji put radio?"', type: 'info' };
        const last = approved.filter(t => t.workerId === mw.id).sort((a, b) => b.date.localeCompare(a.date))[0];
        if (!last) return { answer: `${mw.name} nema evidentiranih sati.`, type: 'warn' };
        return { answer: `${mw.name} je zadnji put radio/la **${fmtDate(last.date)}** (${last.startTime}–${last.endTime}).`, type: 'info' };
    }

    // ─── 14-18: PREKOVREMENI ──────────────────────────────────────────
    // Q14: Tko radi prekovremeno / više od X sati
    if ((ql.includes('prekovrem') || (ql.includes('vise od') && ql.includes('sat'))) && !ql.includes('cekanj')) {
        const threshold = num || 10;
        const isDaily = isToday || isYesterday || ql.includes('dan');
        const since = isDaily ? (isYesterday ? yesterdayStr : todayStr) : isMonth ? monthStart : weekStr;
        const byW = {};
        approved.filter(t => t.date >= since && (!isDaily || t.date === since)).forEach(t => { byW[t.workerId] = (byW[t.workerId] || 0) + diffMins(t.startTime, t.endTime); });
        const over = Object.entries(byW).filter(([, m]) => m / 60 > threshold).sort((a, b) => b[1] - a[1]);
        if (!over.length) return { answer: `✅ Nitko nije radio više od ${threshold}h ${isDaily ? 'tog dana' : periodLabel}.`, type: 'success' };
        const lines = over.map(([id, m]) => `• ${workers.find(w => w.id === id)?.name || '?'} — **${(m / 60).toFixed(1)}h**`);
        return { answer: `🚨 **${over.length} radnika** s više od ${threshold}h ${periodLabel}:\n${lines.join('\n')}`, type: 'danger' };
    }
    // Q15: Koliko prekovremenih sati ukupno
    if (ql.includes('koliko') && ql.includes('prekovrem')) {
        const since = isMonth ? monthStart : weekStr;
        const dailyLimit = 8;
        let overtime = 0;
        const byWD = {};
        approved.filter(t => t.date >= since).forEach(t => {
            const k = `${t.workerId}_${t.date}`;
            byWD[k] = (byWD[k] || 0) + diffMins(t.startTime, t.endTime);
        });
        Object.values(byWD).forEach(m => { if (m / 60 > dailyLimit) overtime += m / 60 - dailyLimit; });
        return { answer: `Ukupno **${overtime.toFixed(1)} sati** prekovremenog rada ${periodLabel} (iznad ${dailyLimit}h/dan).`, type: overtime > 0 ? 'warn' : 'success' };
    }

    // ─── 19-24: UNOS SATI / PRISUTNOST ───────────────────────────────
    // Q19: Tko nije radio danas / tko nije unio sate
    if ((ql.includes('tko') || ql.includes('koji') || ql.includes('ko')) && (ql.includes('nije radio') || ql.includes('nije radila') || ql.includes('nije uni') || ql.includes('bez unosa'))) {
        const checkDate = isYesterday ? yesterdayStr : todayStr;
        const label = isYesterday ? 'jučer' : 'danas';
        const workedIds = new Set(timesheets.filter(t => t.date === checkDate).map(t => t.workerId));
        const absent = activeWorkers.filter(w => !workedIds.has(w.id));
        if (absent.length === 0) return { answer: `Svi aktivni radnici imaju unos za ${label}! ✅`, type: 'success' };
        return { answer: `**${absent.length} radnika** bez unosa ${label}:\n${absent.map(w => `• ${w.name}`).join('\n')}`, type: 'warn' };
    }
    // Q20: Jesu svi ispunili / postotak ispunjenosti
    if ((ql.includes('svi') || ql.includes('postotak') || ql.includes('ispunj') || ql.includes('kompletnost')) && (ql.includes('unos') || ql.includes('ispuni') || ql.includes('sat'))) {
        const checkDate = isYesterday ? yesterdayStr : todayStr;
        const workedIds = new Set(timesheets.filter(t => t.date === checkDate).map(t => t.workerId));
        const filled = activeWorkers.filter(w => workedIds.has(w.id)).length;
        const pct = activeWorkers.length ? Math.round(filled / activeWorkers.length * 100) : 0;
        return { answer: `Ispunjenost unosa ${isYesterday ? 'jučer' : 'danas'}: **${pct}%** (${filled}/${activeWorkers.length} radnika)`, type: pct >= 80 ? 'success' : pct >= 50 ? 'warn' : 'danger' };
    }
    // Q21: Tko kasni s unosom / 2+ dana bez unosa
    if ((ql.includes('kasni') || ql.includes('zaostaj') || ql.includes('propust')) && (ql.includes('unos') || ql.includes('sat'))) {
        const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10);
        const late = activeWorkers.filter(w => {
            const last = timesheets.filter(t => t.workerId === w.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
            return !last || last.date < twoDaysAgo;
        });
        if (!late.length) return { answer: '✅ Svi radnici su ažurni s unosom sati!', type: 'success' };
        return { answer: `⚠️ **${late.length} radnika** kasni s unosom (2+ dana):\n${late.map(w => `• ${w.name}`).join('\n')}`, type: 'warn' };
    }

    // ─── 25-35: PROJEKTI ─────────────────────────────────────────────
    // Q25: Koliko imamo aktivnih projekata
    if (ql.includes('koliko') && (ql.includes('projekt') || ql.includes('projekat')) && (ql.includes('aktivn') || ql.includes('imamo') || ql.includes('ukupno'))) {
        return { answer: `Imate **${activeProjects.length} aktivnih** projekata od ukupno ${projects.length}.`, type: 'info' };
    }
    // Q26: Koji projekt ima najviše troškova/sati
    if (ql.includes('projekt') && (ql.includes('troskov') || ql.includes('skup') || ql.includes('racun') || ql.includes('najskuplji'))) {
        const costByP = {};
        invoices.forEach(i => { if (i.amount) costByP[i.projectId] = (costByP[i.projectId] || 0) + parseFloat(i.amount || 0); });
        const sorted = Object.entries(costByP).sort((a, b) => b[1] - a[1]);
        if (!sorted.length) return { answer: 'Nema podataka o troškovima.', type: 'info' };
        const lines = sorted.slice(0, 5).map(([id, c], i) => `${i + 1}. ${projects.find(p => p.id === id)?.name || '?'} — **${c.toFixed(2)} €**`);
        return { answer: `€ Projekti po troškovima:\n${lines.join('\n')}`, type: 'info' };
    }
    // Q27: Koliko radnika radi na projektu [ime]
    if (ql.includes('koliko') && ql.includes('radnik') && ql.includes('projekt')) {
        if (mp) {
            const cnt = (mp.workers || []).length;
            const names = (mp.workers || []).map(id => workers.find(w => w.id === id)?.name || '?');
            return { answer: `Na projektu **${mp.name}** radi **${cnt} radnika**:\n${names.map(n => `• ${n}`).join('\n')}`, type: 'info' };
        }
        const lines = activeProjects.map(p => `• ${p.name}: **${(p.workers || []).length}** radnika`);
        return { answer: `👷 Radnici po projektu:\n${lines.join('\n')}`, type: 'info' };
    }
    // Q28: Status projekata
    if ((ql.includes('status') || ql.includes('stanje')) && ql.includes('projekt')) {
        const active = projects.filter(p => p.status === 'aktivan').length;
        const completed = projects.filter(p => p.status === 'završen').length;
        const paused = projects.filter(p => p.status === 'pauziran').length;
        return { answer: `📊 Status projekata:\n• Aktivni: **${active}**\n• Završeni: **${completed}**\n• Pauzirani: **${paused}**\n• Ukupno: **${projects.length}**`, type: 'info' };
    }
    // Q29: Projekti bez GPS-a
    if (ql.includes('bez gps') || (ql.includes('gps') && (ql.includes('nema') || ql.includes('nedostaj')))) {
        const noGps = activeProjects.filter(p => !p.siteLat || !p.siteLng);
        if (!noGps.length) return { answer: '✅ Svi aktivni projekti imaju GPS koordinate!', type: 'success' };
        return { answer: `📍 **${noGps.length} projekata** bez GPS-a:\n${noGps.map(p => `• ${p.name}`).join('\n')}`, type: 'warn' };
    }
    // Q30: Na kojem projektu radi [ime]
    if ((ql.includes('na kojem') || ql.includes('koji projekt')) && (ql.includes('radi') || ql.includes('radio'))) {
        if (!mw) return { answer: 'Navedite ime radnika.', type: 'info' };
        const wProjects = projects.filter(p => (p.workers || []).includes(mw.id) && p.status === 'aktivan');
        if (!wProjects.length) return { answer: `${mw.name} nije dodijeljen/a nijednom aktivnom projektu.`, type: 'warn' };
        return { answer: `${mw.name} radi na:\n${wProjects.map(p => `• **${p.name}**`).join('\n')}`, type: 'info' };
    }
    // Q31: Trošak po satu projekta
    if ((ql.includes('trosak po satu') || ql.includes('cijena sata') || ql.includes('€/sat') || ql.includes('eur po sat'))) {
        const byP = {};
        approved.filter(t => t.date >= monthStart).forEach(t => { byP[t.projectId] = (byP[t.projectId] || 0) + diffMins(t.startTime, t.endTime) / 60; });
        const costByP = {};
        invoices.forEach(i => { if (i.amount) costByP[i.projectId] = (costByP[i.projectId] || 0) + parseFloat(i.amount || 0); });
        const rows = Object.keys(byP).filter(id => byP[id] > 0 && costByP[id]).map(id => {
            const rate = costByP[id] / byP[id];
            return { name: projects.find(p => p.id === id)?.name || '?', rate };
        }).sort((a, b) => b.rate - a.rate);
        if (!rows.length) return { answer: 'Nema dovoljno podataka za izračun.', type: 'info' };
        return { answer: `💶 Trošak po satu:\n${rows.map(r => `• ${r.name}: **${r.rate.toFixed(2)} €/h**`).join('\n')}`, type: 'info' };
    }
    // Q32: Koji projekti nemaju dnevnik
    if (ql.includes('projekt') && (ql.includes('bez dnevnik') || ql.includes('nema dnevnik') || ql.includes('nedostaje dnevnik'))) {
        const noLog = activeProjects.filter(p => !(dailyLogs || []).some(l => l.projectId === p.id && l.date >= weekStr));
        if (!noLog.length) return { answer: '✅ Svi aktivni projekti imaju dnevnike ovaj tjedan!', type: 'success' };
        return { answer: `📋 **${noLog.length} projekata** bez dnevnika ovaj tjedan:\n${noLog.map(p => `• ${p.name}`).join('\n')}`, type: 'warn' };
    }
    // Q33: Projekti bez radnika
    if (ql.includes('projekt') && (ql.includes('bez radnik') || ql.includes('nema radnik') || ql.includes('prazan'))) {
        const empty = activeProjects.filter(p => !(p.workers || []).length);
        if (!empty.length) return { answer: '✅ Svi aktivni projekti imaju dodijeljene radnike!', type: 'success' };
        return { answer: `⚠️ **${empty.length} projekata** bez radnika:\n${empty.map(p => `• ${p.name}`).join('\n')}`, type: 'warn' };
    }
    // Q34: Radnici bez projekta
    if ((ql.includes('radnik') || ql.includes('tko')) && ql.includes('bez projekt')) {
        const assignedIds = new Set(activeProjects.flatMap(p => p.workers || []));
        const free = activeWorkers.filter(w => !assignedIds.has(w.id));
        if (!free.length) return { answer: '✅ Svi radnici su dodijeljeni projektima!', type: 'success' };
        return { answer: `👷 **${free.length} radnika** bez aktivnog projekta:\n${free.map(w => `• ${w.name}`).join('\n')}`, type: 'warn' };
    }

    // ─── 36-45: ODOBRENJA & STATUS ───────────────────────────────────
    // Q36: Na čekanju / pending
    if (ql.includes('cekanj') || ql.includes('odobrenj') || ql.includes('pending') || ql.includes('na cekanju')) {
        const pts = timesheets.filter(t => t.status === 'na čekanju').length;
        const pinv = invoices.filter(i => i.status === 'na čekanju').length;
        const plogs = (dailyLogs || []).filter(l => l.status === 'na čekanju' || l.status === 'odobreno voditeljem').length;
        const potp = (otpremnice || []).filter(o => o.status === 'na čekanju' || o.status === 'odobreno-voditelj').length;
        return { answer: `Na čekanju:\n• Radni sati: **${pts}**\n• Računi: **${pinv}**\n• Dnevnici: **${plogs}**\n• Otpremnice: **${potp}**`, type: pts + pinv + plogs + potp > 0 ? 'warn' : 'success' };
    }
    // Q37: Stara odobrenja (>48h)
    if ((ql.includes('star') || ql.includes('zastarjel') || ql.includes('dugo ceka')) && (ql.includes('odobrenj') || ql.includes('cekanj'))) {
        const old = timesheets.filter(t => t.status === 'na čekanju' && (now - new Date(t.createdAt || t.date)) / 86400000 > 2);
        if (!old.length) return { answer: '✅ Nema starih odobrenja! Sva se obrađuju na vrijeme.', type: 'success' };
        return { answer: `🚨 **${old.length} radnih sati** čeka odobrenje više od 48h!`, type: 'danger' };
    }
    // Q38: Koji radnici imaju sate na čekanju
    if ((ql.includes('koji') || ql.includes('tko') || ql.includes('ciji')) && ql.includes('sat') && ql.includes('cekanj')) {
        const pending = timesheets.filter(t => t.status === 'na čekanju');
        const byW = {};
        pending.forEach(t => { byW[t.workerId] = (byW[t.workerId] || 0) + 1; });
        const sorted = Object.entries(byW).sort((a, b) => b[1] - a[1]);
        if (!sorted.length) return { answer: '✅ Nema sati na čekanju!', type: 'success' };
        const lines = sorted.map(([id, c]) => `• ${workers.find(w => w.id === id)?.name || '?'}: **${c}** unosa`);
        return { answer: `⏳ Sati na čekanju po radniku:\n${lines.join('\n')}`, type: 'warn' };
    }
    // Q39: Koliko odobrenih / odbijenih
    if (ql.includes('koliko') && (ql.includes('odobren') || ql.includes('odbijen') || ql.includes('prihvacen'))) {
        const a = timesheets.filter(t => t.status === 'odobren' || t.status === 'prihvaćen').length;
        const r = timesheets.filter(t => t.status === 'odbijen').length;
        const p = timesheets.filter(t => t.status === 'na čekanju').length;
        return { answer: `📊 Status svih radnih sati:\n• Odobreno: **${a}**\n• Odbijeno: **${r}**\n• Na čekanju: **${p}**\n• Ukupno: **${timesheets.length}**`, type: 'info' };
    }

    // ─── 46-55: USPOREDBE & TRENDOVI ─────────────────────────────────
    // Q46: Usporedi tjedne
    if (ql.includes('usporedi') || ql.includes('usporedba')) {
        if (isMonth || ql.includes('mjesec')) {
            const ts1 = approved.filter(t => t.date >= prevMonth && t.date < prevMonthEnd);
            const ts2 = approved.filter(t => t.date >= monthStart);
            const h1 = sumH(ts1), h2 = sumH(ts2);
            const diff = h1 > 0 ? (((h2 - h1) / h1) * 100).toFixed(0) : 0;
            return { answer: `Prošli mjesec: **${h1}h** → Ovaj mjesec: **${h2}h** (${diff > 0 ? '+' : ''}${diff}%)`, type: diff >= 0 ? 'success' : 'warn' };
        }
        const ts1 = approved.filter(t => t.date >= prevWeekStart && t.date < weekStr);
        const ts2 = approved.filter(t => t.date >= weekStr);
        const h1 = sumH(ts1), h2 = sumH(ts2);
        const diff = h1 > 0 ? (((h2 - h1) / h1) * 100).toFixed(0) : 0;
        return { answer: `Prošli tjedan: **${h1}h** → Ovaj tjedan: **${h2}h** (${diff > 0 ? '+' : ''}${diff}%)`, type: diff >= 0 ? 'success' : 'warn' };
    }
    // Q47: Trend po danima
    if ((ql.includes('trend') || ql.includes('po danima') || ql.includes('dnevni pregled'))) {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
            const h = sumH(approved.filter(t => t.date === d));
            const dayName = new Date(d).toLocaleDateString('hr-HR', { weekday: 'short' });
            days.push(`• ${dayName} ${fmtDate(d)}: **${h}h**`);
        }
        return { answer: `📈 Zadnjih 7 dana:\n${days.join('\n')}`, type: 'info' };
    }
    // Q48: Koji dan se najviše radilo
    if ((ql.includes('koji dan') || ql.includes('najaktivniji')) && (ql.includes('rad') || ql.includes('sat'))) {
        const byDay = {};
        approved.filter(t => t.date >= weekStr).forEach(t => { byDay[t.date] = (byDay[t.date] || 0) + diffMins(t.startTime, t.endTime); });
        const sorted = Object.entries(byDay).sort((a, b) => b[1] - a[1]);
        if (!sorted.length) return { answer: 'Nema podataka ovaj tjedan.', type: 'info' };
        const [d, m] = sorted[0];
        return { answer: `📅 Najaktivniji dan: **${fmtDate(d)}** — **${(m / 60).toFixed(1)}h** ukupno`, type: 'success' };
    }
    // Q49: Produktivnost raste ili pada
    if (ql.includes('produktivnost') || (ql.includes('raste') || ql.includes('pada'))) {
        const ts1 = approved.filter(t => t.date >= prevWeekStart && t.date < weekStr);
        const ts2 = approved.filter(t => t.date >= weekStr);
        const h1 = sumH(ts1), h2 = sumH(ts2);
        const trend = h2 > h1 ? '📈 RASTE' : h2 < h1 ? '📉 PADA' : '➡️ STABILNA';
        const pct = h1 > 0 ? Math.abs(((h2 - h1) / h1) * 100).toFixed(0) : 0;
        return { answer: `Produktivnost: ${trend} (${pct}% ${h2 >= h1 ? 'više' : 'manje'} sati nego prošli tjedan)`, type: h2 >= h1 ? 'success' : 'warn' };
    }
    // Q50: Koliko novih unosa danas
    if (ql.includes('koliko') && (ql.includes('novi') || ql.includes('novih')) && ql.includes('unos')) {
        const cnt = timesheets.filter(t => t.date === todayStr).length;
        return { answer: `Danas je uneseno **${cnt} novih** radnih sati.`, type: cnt > 0 ? 'success' : 'info' };
    }

    // ─── 56-65: TIM PERFORMANCE ──────────────────────────────────────
    // Q56: Tko je najbolji radnik
    if ((ql.includes('najbolji') || ql.includes('najproduktivniji') || ql.includes('top radnik'))) {
        const byW = {};
        approved.filter(t => t.date >= monthStart).forEach(t => { byW[t.workerId] = (byW[t.workerId] || 0) + diffMins(t.startTime, t.endTime); });
        const sorted = Object.entries(byW).sort((a, b) => b[1] - a[1]);
        if (!sorted.length) return { answer: 'Nema podataka.', type: 'info' };
        const [id, m] = sorted[0];
        return { answer: `🥇 Najproduktivniji radnik ovaj mjesec: **${workers.find(w => w.id === id)?.name || '?'}** — **${(m / 60).toFixed(1)}h**`, type: 'success' };
    }
    // Q57: Ranking / leaderboard
    if (ql.includes('ranking') || ql.includes('leaderboard') || ql.includes('poredak') || ql.includes('top 5') || ql.includes('top5')) {
        const byW = {};
        approved.filter(t => t.date >= monthStart).forEach(t => { byW[t.workerId] = (byW[t.workerId] || 0) + diffMins(t.startTime, t.endTime); });
        const sorted = Object.entries(byW).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
        const lines = sorted.map(([id, m], i) => `${medals[i]} ${workers.find(w => w.id === id)?.name || '?'} — **${(m / 60).toFixed(1)}h**`);
        return { answer: `🏆 Top 5 radnika (mjesec):\n${lines.join('\n')}`, type: 'success' };
    }
    // Q58: Info o radniku [ime]
    if ((ql.includes('info') || ql.includes('profil') || ql.includes('detalji')) && mw) {
        const ts = approved.filter(t => t.workerId === mw.id && t.date >= monthStart);
        const h = sumH(ts);
        const days = new Set(ts.map(t => t.date)).size;
        const wProjs = projects.filter(p => (p.workers || []).includes(mw.id) && p.status === 'aktivan');
        return { answer: `👷 **${mw.name}**\n• Sati ovaj mjesec: **${h}h**\n• Radnih dana: **${days}**\n• Prosjek: **${days ? (h / days).toFixed(1) : 0}h/dan**\n• Aktivni projekti: ${wProjs.map(p => p.name).join(', ') || 'nema'}`, type: 'info' };
    }

    // ─── 66-69: LOKACIJA / GPS ───────────────────────────────────────
    // Q66: Gdje je [ime] / lokacija radnika
    if ((ql.includes('gdje je') || ql.includes('lokacija') || ql.includes('pozicija')) && mw) {
        const lastTs = timesheets.filter(t => t.workerId === mw.id && t.gpsLocation).sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime))[0];
        const wProjs = activeProjects.filter(p => (p.workers || []).includes(mw.id));
        if (lastTs?.gpsLocation) {
            const proj = projects.find(p => p.id === lastTs.projectId);
            return { answer: `📍 **${mw.name}** — zadnja GPS lokacija: ${fmtDate(lastTs.date)}\nProjekt: **${proj?.name || '?'}**\nGPS: ${lastTs.gpsLocation}`, type: 'info' };
        }
        if (wProjs.length) return { answer: `${mw.name} je dodijeljen/a: ${wProjs.map(p => `**${p.name}** (${p.location || 'bez lokacije'})`).join(', ')}`, type: 'info' };
        return { answer: `Nema GPS podataka za ${mw.name}.`, type: 'warn' };
    }
    // Q67: Tko radi na lokaciji / projektu
    if (ql.includes('tko radi na') && mp) {
        const wIds = mp.workers || [];
        if (!wIds.length) return { answer: `Nitko nije dodijeljen projektu **${mp.name}**.`, type: 'warn' };
        const names = wIds.map(id => workers.find(w => w.id === id)?.name || '?');
        return { answer: `Na **${mp.name}** rade:\n${names.map(n => `• ${n}`).join('\n')}`, type: 'info' };
    }

    // ─── 70-75: VOZILA ───────────────────────────────────────────────
    // Q70: Koliko imamo vozila
    if (ql.includes('koliko') && (ql.includes('vozil') || ql.includes('auto'))) {
        const v = vehicles || [];
        return { answer: `🚗 Ukupno vozila: **${v.length}**`, type: 'info' };
    }
    // Q71: Koja vozila imamo / lista vozila
    if ((ql.includes('koja') || ql.includes('lista') || ql.includes('popis')) && (ql.includes('vozil') || ql.includes('auto'))) {
        const v = vehicles || [];
        if (!v.length) return { answer: 'Nema registriranih vozila.', type: 'info' };
        const lines = v.map(vh => `• **${vh.name || vh.make || '?'}** ${vh.plates || vh.licensePlate || ''} ${vh.year || ''}`);
        return { answer: `🚗 Vozila (${v.length}):\n${lines.join('\n')}`, type: 'info' };
    }

    // ─── 76-80: SMJEŠTAJ ─────────────────────────────────────────────
    // Q76: Koliko smještaja / kapacitet
    if (ql.includes('koliko') && ql.includes('smjestaj')) {
        const s = smjestaj || [];
        const totalCap = s.reduce((sum, a) => sum + (parseInt(a.maxCapacity) || 0), 0);
        const totalOcc = s.reduce((sum, a) => sum + (a.workerIds || []).length, 0);
        return { answer: `🏠 Smještaji: **${s.length}**\nKapacitet: **${totalOcc}/${totalCap}** mjesta zauzeto`, type: 'info' };
    }
    // Q77: Popis smještaja
    if ((ql.includes('koji') || ql.includes('lista') || ql.includes('popis')) && ql.includes('smjestaj')) {
        const s = smjestaj || [];
        if (!s.length) return { answer: 'Nema registriranih smještaja.', type: 'info' };
        const lines = s.map(a => `• **${a.name}** (${a.city || a.address || '?'}) — ${(a.workerIds || []).length}/${a.maxCapacity || '?'} mjesta`);
        return { answer: `🏠 Smještaji:\n${lines.join('\n')}`, type: 'info' };
    }
    // Q78: Gdje je smješten [ime]
    if (ql.includes('smjest') && mw) {
        const s = (smjestaj || []).find(a => (a.workerIds || []).includes(mw.id));
        if (!s) return { answer: `${mw.name} nema dodijeljeni smještaj.`, type: 'warn' };
        return { answer: `${mw.name} je smješten/a u **${s.name}** (${s.city || s.address || '?'}).`, type: 'info' };
    }

    // ─── 81-85: OBAVEZE ──────────────────────────────────────────────
    // Q81: Koliko obaveza / aktivnih
    if (ql.includes('koliko') && (ql.includes('obavez') || ql.includes('zadatak') || ql.includes('task'))) {
        const ob = obaveze || [];
        const active = ob.filter(o => o.active !== false);
        const overdue = active.filter(o => o.dueDate && o.dueDate < todayStr);
        const high = active.filter(o => o.priority === 'visok' || o.priority === 'hitan');
        return { answer: `📋 Obaveze:\n• Aktivne: **${active.length}**\n• Istekle: **${overdue.length}**\n• Prioritetne: **${high.length}**\n• Ukupno: **${ob.length}**`, type: overdue.length > 0 ? 'warn' : 'info' };
    }
    // Q82: Koje obaveze su istekle
    if ((ql.includes('istek') || ql.includes('prekorac') || ql.includes('overdue') || ql.includes('kasn')) && (ql.includes('obavez') || ql.includes('zadatak'))) {
        const ob = (obaveze || []).filter(o => o.active !== false && o.dueDate && o.dueDate < todayStr);
        if (!ob.length) return { answer: '✅ Nema isteklih obaveza!', type: 'success' };
        const lines = ob.map(o => `• **${o.title}** (rok: ${fmtDate(o.dueDate)}) — ${o.priority || 'normalan'}`);
        return { answer: `🚨 **${ob.length} isteklih** obaveza:\n${lines.join('\n')}`, type: 'danger' };
    }
    // Q83: Obaveze za [ime]
    if (ql.includes('obavez') && mw) {
        const ob = (obaveze || []).filter(o => o.active !== false && (o.workerIds || []).includes(mw.id));
        if (!ob.length) return { answer: `${mw.name} nema aktivnih obaveza.`, type: 'info' };
        const lines = ob.map(o => `• **${o.title}** (rok: ${o.dueDate ? fmtDate(o.dueDate) : 'nema'}) — ${o.priority || 'normalan'}`);
        return { answer: `📋 Obaveze za ${mw.name}:\n${lines.join('\n')}`, type: 'info' };
    }

    // ─── 86-90: OTPREMNICE ───────────────────────────────────────────
    // Q86: Koliko otpremnica
    if (ql.includes('koliko') && ql.includes('otpremnic')) {
        const o = otpremnice || [];
        const pending = o.filter(x => x.status === 'na čekanju').length;
        const total = o.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
        return { answer: `📦 Otpremnice: **${o.length}** ukupno\n• Na čekanju: **${pending}**\n• Ukupni iznos: **${total.toFixed(2)} €**`, type: 'info' };
    }
    // Q87: Otpremnice na čekanju
    if (ql.includes('otpremnic') && (ql.includes('cekanj') || ql.includes('pending'))) {
        const pend = (otpremnice || []).filter(o => o.status === 'na čekanju' || o.status === 'odobreno-voditelj');
        if (!pend.length) return { answer: '✅ Nema otpremnica na čekanju!', type: 'success' };
        const lines = pend.slice(0, 10).map(o => `• ${fmtDate(o.date)} — **${o.supplier || '?'}** — ${o.amount ? o.amount + '€' : '—'}`);
        return { answer: `📦 **${pend.length}** otpremnica na čekanju:\n${lines.join('\n')}`, type: 'warn' };
    }
    // Q88: Ukupni iznos otpremnica
    if (ql.includes('iznos') && ql.includes('otpremnic')) {
        const o = otpremnice || [];
        const total = o.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
        const approved = o.filter(x => x.status === 'prihvaćena').reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
        return { answer: `€ Otpremnice:\n• Ukupni iznos: **${total.toFixed(2)} €**\n• Prihvaćeno: **${approved.toFixed(2)} €**`, type: 'info' };
    }

    // ─── 91-95: SIGURNOST / SAFETY ───────────────────────────────────
    // Q91: Safety checkliste
    if (ql.includes('sigurnost') || ql.includes('safety') || ql.includes('kontroln') || ql.includes('checklist')) {
        const sc = safetyChecklists || [];
        const recent = sc.filter(c => c.date >= weekStr).length;
        return { answer: `🛡️ Sigurnosne kontrole:\n• Ukupno: **${sc.length}**\n• Ovaj tjedan: **${recent}**`, type: 'info' };
    }

    // ─── 96-100: DNEVNIK RADA ────────────────────────────────────────
    // Q96: Dnevnik rada
    if (ql.includes('dnevnik') || ql.includes('daily log')) {
        const dl = dailyLogs || [];
        const recent = dl.filter(l => l.date >= weekStr).length;
        const pending = dl.filter(l => l.status === 'na čekanju').length;
        return { answer: `📋 Dnevnici rada:\n• Ukupno: **${dl.length}**\n• Ovaj tjedan: **${recent}**\n• Na čekanju: **${pending}**`, type: 'info' };
    }

    // ─── GENERAL / SAŽETAK ──────────────────────────────────────────
    // Sažetak dana
    if (ql.includes('sazetak') || ql.includes('summary') || ql.includes('pregled dana') || ql.includes('izvjestaj')) {
        const tTs = timesheets.filter(t => t.date === todayStr);
        const tH = sumH(tTs.filter(t => t.status === 'odobren' || t.status === 'prihvaćen'));
        const workedCnt = new Set(tTs.map(t => t.workerId)).size;
        const absentCnt = activeWorkers.length - new Set(tTs.map(t => t.workerId)).size;
        const pendAll = timesheets.filter(t => t.status === 'na čekanju').length;
        return { answer: `📊 **Sažetak dana**:\n• Odrađeno: **${tH}h** (${workedCnt} radnika)\n• Bez unosa: **${absentCnt}** radnika\n• Na čekanju: **${pendAll}** odobrenja\n• Aktivnih projekata: **${activeProjects.length}**`, type: 'info' };
    }
    // Koliko radnika
    if (ql.includes('koliko') && ql.includes('radnik') && !ql.includes('projekt')) {
        return { answer: `👷 Ukupno radnika: **${workers.length}** (aktivnih: **${activeWorkers.length}**)`, type: 'info' };
    }
    // Pomoć
    if (ql.includes('pomoc') || ql.includes('help') || ql.includes('sto mog') || ql.includes('primjer')) {
        return { answer: '🤖 Pitajte me:\n• "Koliko je sati radio Marko ovaj tjedan?"\n• "Tko nije unio sate danas?"\n• "Usporedi zadnja 2 tjedna"\n• "Top 5 radnika ovaj mjesec"\n• "Koji projekt ima najviše troškova?"\n• "Na čekanju odobrenja"\n• "Gdje je Marko?"\n• "Koliko imamo vozila?"\n• "Istekle obaveze"\n• "Sažetak dana"\n• "Tko radi više od 10 sati?"\n• "Daj mi info o Marku"', type: 'info' };
    }

    return { answer: 'Nisam razumio pitanje. Pokušajte:\n• "Koliko sati radio [ime] ovaj tjedan?"\n• "Tko nije radio danas?"\n• "Top 5 radnika"\n• "Usporedi tjedne"\n• "Projekti po troškovima"\n• "Na čekanju"\n• "Sažetak dana"\n• "Pomoć" za više primjera', type: 'info' };
};

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

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                        <Card title="📈 Tjedni trend sati"><SvgLineChart data={weeklyData} dataKey="hours" color="#F97316" /></Card>
                        <Card title="📊 Sati po projektu (mjesec)"><SvgDonutChart data={projectHours} /></Card>
                    </div>

                    {/* Anomalies */}
                    {anomalies.length > 0 && (
                        <Card title="⚠️ Anomalije & Upozorenja">
                            {anomalies.map((a, i) => (
                                <div key={i} style={{ marginBottom: 12 }}>
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
                                    <div style={{ fontSize: 14, fontWeight: 600 }}>Pitajte me bilo što o vašim podacima!</div>
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
                                            <div style={{ fontSize: 12, color: C.textMuted }}>👷 {workerCount} radnika • {daysActive} dana aktivan</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>{totalH.toFixed(0)}h</div>
                                            <div style={{ fontSize: 11, color: C.textMuted }}>{dailyRate.toFixed(1)}h/dan</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(59,130,246,0.06)', textAlign: 'center' }}>
                                            <div style={{ fontSize: 11, color: C.textMuted }}>Ukupni troškovi</div>
                                            <div style={{ fontSize: 16, fontWeight: 800, color: '#1D4ED8' }}>{totalCost.toFixed(0)}€</div>
                                        </div>
                                        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
                                            <div style={{ fontSize: 11, color: C.textMuted }}>Dnevni burn</div>
                                            <div style={{ fontSize: 16, fontWeight: 800, color: '#EA580C' }}>{dailyCost.toFixed(0)}€/dan</div>
                                        </div>
                                        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(16,185,129,0.06)', textAlign: 'center' }}>
                                            <div style={{ fontSize: 11, color: C.textMuted }}>€/sat</div>
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
                                            <div style={{ fontSize: 11, color: C.textMuted }}>{s.totalH}h • {s.daysWorked} dana</div>
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
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{s.name}</div>
                                    <div style={{ fontSize: 12, color: C.textMuted }}>{s.totalH}h ukupno • {s.avgH}h/dan • {s.daysWorked} dana</div>
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
                        <div style={{ overflowX: 'auto' }}>
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
