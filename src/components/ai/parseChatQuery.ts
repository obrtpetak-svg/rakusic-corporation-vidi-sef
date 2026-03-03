import { fmtDate, diffMins, today } from '../../utils/helpers';

/**
 * parseChatQuery — NLP chatbot engine for ViDiSef.
 * Handles 100+ Croatian questions about workers, projects, timesheets, etc.
 */
export const parseChatQuery = (q: string, data: any) => {
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
    const activeWorkers = workers.filter((w: any) => w.active !== false);
    const activeProjects = projects.filter((p: any) => p.status === 'aktivan');
    const approved = timesheets.filter((t: any) => t.status === 'odobren' || t.status === 'prihvaćen');

    const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const mw = workers.find((w: any) => ql.includes(norm(w.name)));
    const mp = projects.find((p: any) => ql.includes(norm(p.name)));
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

    const filterTs = (since: string, until: string | null) => {
        let ts = approved.filter((t: any) => t.date >= since && (!until || t.date < until));
        if (mw) ts = ts.filter((t: any) => t.workerId === mw.id);
        if (mp) ts = ts.filter((t: any) => t.projectId === mp.id);
        return ts;
    };
    const sumH = (ts: any[]) => +(ts.reduce((s: number, t: any) => s + diffMins(t.startTime, t.endTime), 0) / 60).toFixed(1);
    const who = mw ? mw.name : 'Ukupno';
    const where = mp ? ` na projektu ${mp.name}` : '';

    // ─── 1-13: SATI RADA ─────────────────────────────────────────────
    if (ql.includes('koliko') && (ql.includes('sat') || ql.includes('radio') || ql.includes('radila') || ql.includes('odradio') || ql.includes('odradila'))) {
        const ts = filterTs(periodStr, periodEnd);
        const h = sumH(ts);
        return { answer: `${who} je odradio/la **${h} sati** ${periodLabel}${where}.`, type: 'success' };
    }
    if ((ql.includes('najvise') || ql.includes('top') || ql.includes('najbolji')) && (ql.includes('sat') || ql.includes('radio'))) {
        const since = isMonth ? monthStart : weekStr;
        const byW: Record<string, number> = {};
        approved.filter((t: any) => t.date >= since).forEach((t: any) => { byW[t.workerId] = (byW[t.workerId] || 0) + diffMins(t.startTime, t.endTime); });
        const sorted = Object.entries(byW).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 5);
        if (!sorted.length) return { answer: 'Nema podataka o satima.', type: 'info' };
        const lines = sorted.map(([id, m], i) => `${i + 1}. ${workers.find((w: any) => w.id === id)?.name || '?'} — **${(m / 60).toFixed(1)}h**`);
        return { answer: `🏆 Top radnici po satima (${isMonth ? 'mjesec' : 'tjedan'}):\n${lines.join('\n')}`, type: 'success' };
    }
    if ((ql.includes('najmanje') || ql.includes('najmanji')) && (ql.includes('sat') || ql.includes('radio'))) {
        const since = isMonth ? monthStart : weekStr;
        const byW: Record<string, number> = {};
        activeWorkers.forEach((w: any) => { byW[w.id] = 0; });
        approved.filter((t: any) => t.date >= since).forEach((t: any) => { byW[t.workerId] = (byW[t.workerId] || 0) + diffMins(t.startTime, t.endTime); });
        const sorted = Object.entries(byW).sort((a, b) => (a[1] as number) - (b[1] as number)).slice(0, 5);
        const lines = sorted.map(([id, m], i) => `${i + 1}. ${workers.find((w: any) => w.id === id)?.name || '?'} — **${(m / 60).toFixed(1)}h**`);
        return { answer: `📉 Radnici s najmanje sati (${isMonth ? 'mjesec' : 'tjedan'}):\n${lines.join('\n')}`, type: 'warn' };
    }
    if (ql.includes('prosjecn') && (ql.includes('sat') || ql.includes('rad'))) {
        const since = isMonth ? monthStart : weekStr;
        const ts = approved.filter((t: any) => t.date >= since);
        const total = sumH(ts);
        const avg = activeWorkers.length ? (total / activeWorkers.length).toFixed(1) : 0;
        return { answer: `Prosječno **${avg} sati** po radniku ${isMonth ? 'ovaj mjesec' : 'ovaj tjedan'}. (Ukupno: ${total}h, ${activeWorkers.length} radnika)`, type: 'info' };
    }
    if (ql.includes('ukupno') && (ql.includes('sat') || ql.includes('rad'))) {
        const ts = filterTs(periodStr, periodEnd);
        const h = sumH(ts);
        const cnt = new Set(ts.map((t: any) => t.workerId)).size;
        return { answer: `Ukupno **${h} sati** ${periodLabel}${where}. (${cnt} radnika)`, type: 'success' };
    }
    if (ql.includes('koliko') && (ql.includes('dan') || ql.includes('dana')) && (ql.includes('radio') || ql.includes('radila') || ql.includes('rad'))) {
        if (!mw) return { answer: 'Molim navedite ime radnika. Npr: "Koliko dana je Marko radio ovaj mjesec?"', type: 'info' };
        const since = isMonth ? monthStart : weekStr;
        const days = new Set(approved.filter((t: any) => t.workerId === mw.id && t.date >= since).map((t: any) => t.date)).size;
        return { answer: `${mw.name} je radio/la **${days} dana** ${periodLabel}.`, type: 'success' };
    }
    if (ql.includes('koliko') && ql.includes('sat') && mp) {
        const since = isMonth ? monthStart : weekStr;
        const h = sumH(approved.filter((t: any) => t.projectId === mp.id && t.date >= since));
        return { answer: `Projekt **${mp.name}** ima **${h} sati** ${periodLabel}.`, type: 'success' };
    }
    if ((ql.includes('sati po projektu') || ql.includes('projekti sati') || ql.includes('raspodjela')) && ql.includes('sat')) {
        const since = isMonth ? monthStart : weekStr;
        const byP: Record<string, number> = {};
        approved.filter((t: any) => t.date >= since).forEach((t: any) => { byP[t.projectId] = (byP[t.projectId] || 0) + diffMins(t.startTime, t.endTime); });
        const sorted = Object.entries(byP).sort((a, b) => (b[1] as number) - (a[1] as number));
        if (!sorted.length) return { answer: 'Nema podataka.', type: 'info' };
        const lines = sorted.map(([id, m]) => `• ${projects.find((p: any) => p.id === id)?.name || '?'} — **${(m / 60).toFixed(1)}h**`);
        return { answer: `📊 Sati po projektu (${isMonth ? 'mjesec' : 'tjedan'}):\n${lines.join('\n')}`, type: 'info' };
    }
    if ((ql.includes('kada') || ql.includes('kad') || ql.includes('zadnji put')) && (ql.includes('radio') || ql.includes('radila'))) {
        if (!mw) return { answer: 'Navedite ime radnika. Npr: "Kad je Marko zadnji put radio?"', type: 'info' };
        const last = approved.filter((t: any) => t.workerId === mw.id).sort((a: any, b: any) => b.date.localeCompare(a.date))[0];
        if (!last) return { answer: `${mw.name} nema evidentiranih sati.`, type: 'warn' };
        return { answer: `${mw.name} je zadnji put radio/la **${fmtDate(last.date)}** (${last.startTime}–${last.endTime}).`, type: 'info' };
    }

    // ─── 14-18: PREKOVREMENI ──────────────────────────────────────────
    if ((ql.includes('prekovrem') || (ql.includes('vise od') && ql.includes('sat'))) && !ql.includes('cekanj')) {
        const threshold = num || 10;
        const isDaily = isToday || isYesterday || ql.includes('dan');
        const since = isDaily ? (isYesterday ? yesterdayStr : todayStr) : isMonth ? monthStart : weekStr;
        const byW: Record<string, number> = {};
        approved.filter((t: any) => t.date >= since && (!isDaily || t.date === since)).forEach((t: any) => { byW[t.workerId] = (byW[t.workerId] || 0) + diffMins(t.startTime, t.endTime); });
        const over = Object.entries(byW).filter(([, m]) => m / 60 > threshold).sort((a, b) => (b[1] as number) - (a[1] as number));
        if (!over.length) return { answer: `✅ Nitko nije radio više od ${threshold}h ${isDaily ? 'tog dana' : periodLabel}.`, type: 'success' };
        const lines = over.map(([id, m]) => `• ${workers.find((w: any) => w.id === id)?.name || '?'} — **${(m / 60).toFixed(1)}h**`);
        return { answer: `🚨 **${over.length} radnika** s više od ${threshold}h ${periodLabel}:\n${lines.join('\n')}`, type: 'danger' };
    }
    if (ql.includes('koliko') && ql.includes('prekovrem')) {
        const since = isMonth ? monthStart : weekStr;
        const dailyLimit = 8;
        let overtime = 0;
        const byWD: Record<string, number> = {};
        approved.filter((t: any) => t.date >= since).forEach((t: any) => {
            const k = `${t.workerId}_${t.date}`;
            byWD[k] = (byWD[k] || 0) + diffMins(t.startTime, t.endTime);
        });
        Object.values(byWD).forEach((m: number) => { if (m / 60 > dailyLimit) overtime += m / 60 - dailyLimit; });
        return { answer: `Ukupno **${overtime.toFixed(1)} sati** prekovremenog rada ${periodLabel} (iznad ${dailyLimit}h/dan).`, type: overtime > 0 ? 'warn' : 'success' };
    }

    // ─── 19-24: UNOS SATI / PRISUTNOST ───────────────────────────────
    if ((ql.includes('tko') || ql.includes('koji') || ql.includes('ko')) && (ql.includes('nije radio') || ql.includes('nije radila') || ql.includes('nije uni') || ql.includes('bez unosa'))) {
        const checkDate = isYesterday ? yesterdayStr : todayStr;
        const label = isYesterday ? 'jučer' : 'danas';
        const workedIds = new Set(timesheets.filter((t: any) => t.date === checkDate).map((t: any) => t.workerId));
        const absent = activeWorkers.filter((w: any) => !workedIds.has(w.id));
        if (absent.length === 0) return { answer: `Svi aktivni radnici imaju unos za ${label}! ✅`, type: 'success' };
        return { answer: `**${absent.length} radnika** bez unosa ${label}:\n${absent.map((w: any) => `• ${w.name}`).join('\n')}`, type: 'warn' };
    }
    if ((ql.includes('svi') || ql.includes('postotak') || ql.includes('ispunj') || ql.includes('kompletnost')) && (ql.includes('unos') || ql.includes('ispuni') || ql.includes('sat'))) {
        const checkDate = isYesterday ? yesterdayStr : todayStr;
        const workedIds = new Set(timesheets.filter((t: any) => t.date === checkDate).map((t: any) => t.workerId));
        const filled = activeWorkers.filter((w: any) => workedIds.has(w.id)).length;
        const pct = activeWorkers.length ? Math.round(filled / activeWorkers.length * 100) : 0;
        return { answer: `Ispunjenost unosa ${isYesterday ? 'jučer' : 'danas'}: **${pct}%** (${filled}/${activeWorkers.length} radnika)`, type: pct >= 80 ? 'success' : pct >= 50 ? 'warn' : 'danger' };
    }
    if ((ql.includes('kasni') || ql.includes('zaostaj') || ql.includes('propust')) && (ql.includes('unos') || ql.includes('sat'))) {
        const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10);
        const late = activeWorkers.filter((w: any) => {
            const last = timesheets.filter((t: any) => t.workerId === w.id).sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''))[0];
            return !last || last.date < twoDaysAgo;
        });
        if (!late.length) return { answer: '✅ Svi radnici su ažurni s unosom sati!', type: 'success' };
        return { answer: `⚠️ **${late.length} radnika** kasni s unosom (2+ dana):\n${late.map((w: any) => `• ${w.name}`).join('\n')}`, type: 'warn' };
    }

    // ─── 25-35: PROJEKTI ─────────────────────────────────────────────
    if (ql.includes('koliko') && (ql.includes('projekt') || ql.includes('projekat')) && (ql.includes('aktivn') || ql.includes('imamo') || ql.includes('ukupno'))) {
        return { answer: `Imate **${activeProjects.length} aktivnih** projekata od ukupno ${projects.length}.`, type: 'info' };
    }
    if (ql.includes('projekt') && (ql.includes('troskov') || ql.includes('skup') || ql.includes('racun') || ql.includes('najskuplji'))) {
        const costByP: Record<string, number> = {};
        invoices.forEach((i: any) => { if (i.amount) costByP[i.projectId] = (costByP[i.projectId] || 0) + parseFloat(i.amount || 0); });
        const sorted = Object.entries(costByP).sort((a, b) => (b[1] as number) - (a[1] as number));
        if (!sorted.length) return { answer: 'Nema podataka o troškovima.', type: 'info' };
        const lines = sorted.slice(0, 5).map(([id, c], i) => `${i + 1}. ${projects.find((p: any) => p.id === id)?.name || '?'} — **${(c as number).toFixed(2)} €**`);
        return { answer: `€ Projekti po troškovima:\n${lines.join('\n')}`, type: 'info' };
    }
    if (ql.includes('koliko') && ql.includes('radnik') && ql.includes('projekt')) {
        if (mp) {
            const cnt = (mp.workers || []).length;
            const names = (mp.workers || []).map((id: string) => workers.find((w: any) => w.id === id)?.name || '?');
            return { answer: `Na projektu **${mp.name}** radi **${cnt} radnika**:\n${names.map((n: string) => `• ${n}`).join('\n')}`, type: 'info' };
        }
        const lines = activeProjects.map((p: any) => `• ${p.name}: **${(p.workers || []).length}** radnika`);
        return { answer: `👷 Radnici po projektu:\n${lines.join('\n')}`, type: 'info' };
    }
    if ((ql.includes('status') || ql.includes('stanje')) && ql.includes('projekt')) {
        const active = projects.filter((p: any) => p.status === 'aktivan').length;
        const completed = projects.filter((p: any) => p.status === 'završen').length;
        const paused = projects.filter((p: any) => p.status === 'pauziran').length;
        return { answer: `📊 Status projekata:\n• Aktivni: **${active}**\n• Završeni: **${completed}**\n• Pauzirani: **${paused}**\n• Ukupno: **${projects.length}**`, type: 'info' };
    }
    if (ql.includes('bez gps') || (ql.includes('gps') && (ql.includes('nema') || ql.includes('nedostaj')))) {
        const noGps = activeProjects.filter((p: any) => !p.siteLat || !p.siteLng);
        if (!noGps.length) return { answer: '✅ Svi aktivni projekti imaju GPS koordinate!', type: 'success' };
        return { answer: `📍 **${noGps.length} projekata** bez GPS-a:\n${noGps.map((p: any) => `• ${p.name}`).join('\n')}`, type: 'warn' };
    }
    if ((ql.includes('na kojem') || ql.includes('koji projekt')) && (ql.includes('radi') || ql.includes('radio'))) {
        if (!mw) return { answer: 'Navedite ime radnika.', type: 'info' };
        const wProjects = projects.filter((p: any) => (p.workers || []).includes(mw.id) && p.status === 'aktivan');
        if (!wProjects.length) return { answer: `${mw.name} nije dodijeljen/a nijednom aktivnom projektu.`, type: 'warn' };
        return { answer: `${mw.name} radi na:\n${wProjects.map((p: any) => `• **${p.name}**`).join('\n')}`, type: 'info' };
    }
    if ((ql.includes('trosak po satu') || ql.includes('cijena sata') || ql.includes('€/sat') || ql.includes('eur po sat'))) {
        const byP: Record<string, number> = {};
        approved.filter((t: any) => t.date >= monthStart).forEach((t: any) => { byP[t.projectId] = (byP[t.projectId] || 0) + diffMins(t.startTime, t.endTime) / 60; });
        const costByP: Record<string, number> = {};
        invoices.forEach((i: any) => { if (i.amount) costByP[i.projectId] = (costByP[i.projectId] || 0) + parseFloat(i.amount || 0); });
        const rows = Object.keys(byP).filter(id => byP[id] > 0 && costByP[id]).map(id => {
            const rate = costByP[id] / byP[id];
            return { name: projects.find((p: any) => p.id === id)?.name || '?', rate };
        }).sort((a, b) => b.rate - a.rate);
        if (!rows.length) return { answer: 'Nema dovoljno podataka za izračun.', type: 'info' };
        return { answer: `💶 Trošak po satu:\n${rows.map(r => `• ${r.name}: **${r.rate.toFixed(2)} €/h**`).join('\n')}`, type: 'info' };
    }
    if (ql.includes('projekt') && (ql.includes('bez dnevnik') || ql.includes('nema dnevnik') || ql.includes('nedostaje dnevnik'))) {
        const noLog = activeProjects.filter((p: any) => !(dailyLogs || []).some((l: any) => l.projectId === p.id && l.date >= weekStr));
        if (!noLog.length) return { answer: '✅ Svi aktivni projekti imaju dnevnike ovaj tjedan!', type: 'success' };
        return { answer: `📋 **${noLog.length} projekata** bez dnevnika ovaj tjedan:\n${noLog.map((p: any) => `• ${p.name}`).join('\n')}`, type: 'warn' };
    }
    if (ql.includes('projekt') && (ql.includes('bez radnik') || ql.includes('nema radnik') || ql.includes('prazan'))) {
        const empty = activeProjects.filter((p: any) => !(p.workers || []).length);
        if (!empty.length) return { answer: '✅ Svi aktivni projekti imaju dodijeljene radnike!', type: 'success' };
        return { answer: `⚠️ **${empty.length} projekata** bez radnika:\n${empty.map((p: any) => `• ${p.name}`).join('\n')}`, type: 'warn' };
    }
    if ((ql.includes('radnik') || ql.includes('tko')) && ql.includes('bez projekt')) {
        const assignedIds = new Set(activeProjects.flatMap((p: any) => p.workers || []));
        const free = activeWorkers.filter((w: any) => !assignedIds.has(w.id));
        if (!free.length) return { answer: '✅ Svi radnici su dodijeljeni projektima!', type: 'success' };
        return { answer: `👷 **${free.length} radnika** bez aktivnog projekta:\n${free.map((w: any) => `• ${w.name}`).join('\n')}`, type: 'warn' };
    }

    // ─── 36-45: ODOBRENJA & STATUS ───────────────────────────────────
    if (ql.includes('cekanj') || ql.includes('odobrenj') || ql.includes('pending') || ql.includes('na cekanju')) {
        const pts = timesheets.filter((t: any) => t.status === 'na čekanju').length;
        const pinv = invoices.filter((i: any) => i.status === 'na čekanju').length;
        const plogs = (dailyLogs || []).filter((l: any) => l.status === 'na čekanju' || l.status === 'odobreno voditeljem').length;
        const potp = (otpremnice || []).filter((o: any) => o.status === 'na čekanju' || o.status === 'odobreno-voditelj').length;
        return { answer: `Na čekanju:\n• Radni sati: **${pts}**\n• Računi: **${pinv}**\n• Dnevnici: **${plogs}**\n• Otpremnice: **${potp}**`, type: pts + pinv + plogs + potp > 0 ? 'warn' : 'success' };
    }
    if ((ql.includes('star') || ql.includes('zastarjel') || ql.includes('dugo ceka')) && (ql.includes('odobrenj') || ql.includes('cekanj'))) {
        const old = timesheets.filter((t: any) => t.status === 'na čekanju' && ((now as any) - (new Date(t.createdAt || t.date) as any)) / 86400000 > 2);
        if (!old.length) return { answer: '✅ Nema starih odobrenja! Sva se obrađuju na vrijeme.', type: 'success' };
        return { answer: `🚨 **${old.length} radnih sati** čeka odobrenje više od 48h!`, type: 'danger' };
    }
    if ((ql.includes('koji') || ql.includes('tko') || ql.includes('ciji')) && ql.includes('sat') && ql.includes('cekanj')) {
        const pending = timesheets.filter((t: any) => t.status === 'na čekanju');
        const byW: Record<string, number> = {};
        pending.forEach((t: any) => { byW[t.workerId] = (byW[t.workerId] || 0) + 1; });
        const sorted = Object.entries(byW).sort((a, b) => (b[1] as number) - (a[1] as number));
        if (!sorted.length) return { answer: '✅ Nema sati na čekanju!', type: 'success' };
        const lines = sorted.map(([id, c]) => `• ${workers.find((w: any) => w.id === id)?.name || '?'}: **${c}** unosa`);
        return { answer: `⏳ Sati na čekanju po radniku:\n${lines.join('\n')}`, type: 'warn' };
    }
    if (ql.includes('koliko') && (ql.includes('odobren') || ql.includes('odbijen') || ql.includes('prihvacen'))) {
        const a = timesheets.filter((t: any) => t.status === 'odobren' || t.status === 'prihvaćen').length;
        const r = timesheets.filter((t: any) => t.status === 'odbijen').length;
        const p = timesheets.filter((t: any) => t.status === 'na čekanju').length;
        return { answer: `📊 Status svih radnih sati:\n• Odobreno: **${a}**\n• Odbijeno: **${r}**\n• Na čekanju: **${p}**\n• Ukupno: **${timesheets.length}**`, type: 'info' };
    }

    // ─── 46-55: USPOREDBE & TRENDOVI ─────────────────────────────────
    if (ql.includes('usporedi') || ql.includes('usporedba')) {
        if (isMonth || ql.includes('mjesec')) {
            const ts1 = approved.filter((t: any) => t.date >= prevMonth && t.date < prevMonthEnd);
            const ts2 = approved.filter((t: any) => t.date >= monthStart);
            const h1 = sumH(ts1), h2 = sumH(ts2);
            const diff = h1 > 0 ? (((h2 - h1) / h1) * 100).toFixed(0) : 0;
            return { answer: `Prošli mjesec: **${h1}h** → Ovaj mjesec: **${h2}h** (${(diff as any) > 0 ? '+' : ''}${diff}%)`, type: (diff as any) >= 0 ? 'success' : 'warn' };
        }
        const ts1 = approved.filter((t: any) => t.date >= prevWeekStart && t.date < weekStr);
        const ts2 = approved.filter((t: any) => t.date >= weekStr);
        const h1 = sumH(ts1), h2 = sumH(ts2);
        const diff = h1 > 0 ? (((h2 - h1) / h1) * 100).toFixed(0) : 0;
        return { answer: `Prošli tjedan: **${h1}h** → Ovaj tjedan: **${h2}h** (${(diff as any) > 0 ? '+' : ''}${diff}%)`, type: (diff as any) >= 0 ? 'success' : 'warn' };
    }
    if ((ql.includes('trend') || ql.includes('po danima') || ql.includes('dnevni pregled'))) {
        const days: string[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
            const h = sumH(approved.filter((t: any) => t.date === d));
            const dayName = new Date(d).toLocaleDateString('hr-HR', { weekday: 'short' });
            days.push(`• ${dayName} ${fmtDate(d)}: **${h}h**`);
        }
        return { answer: `📈 Zadnjih 7 dana:\n${days.join('\n')}`, type: 'info' };
    }
    if ((ql.includes('koji dan') || ql.includes('najaktivniji')) && (ql.includes('rad') || ql.includes('sat'))) {
        const byDay: Record<string, number> = {};
        approved.filter((t: any) => t.date >= weekStr).forEach((t: any) => { byDay[t.date] = (byDay[t.date] || 0) + diffMins(t.startTime, t.endTime); });
        const sorted = Object.entries(byDay).sort((a, b) => (b[1] as number) - (a[1] as number));
        if (!sorted.length) return { answer: 'Nema podataka ovaj tjedan.', type: 'info' };
        const [d, m] = sorted[0];
        return { answer: `📅 Najaktivniji dan: **${fmtDate(d)}** — **${(m / 60).toFixed(1)}h** ukupno`, type: 'success' };
    }
    if (ql.includes('produktivnost') || (ql.includes('raste') || ql.includes('pada'))) {
        const ts1 = approved.filter((t: any) => t.date >= prevWeekStart && t.date < weekStr);
        const ts2 = approved.filter((t: any) => t.date >= weekStr);
        const h1 = sumH(ts1), h2 = sumH(ts2);
        const trend = h2 > h1 ? '📈 RASTE' : h2 < h1 ? '📉 PADA' : '➡️ STABILNA';
        const pct = h1 > 0 ? Math.abs(((h2 - h1) / h1) * 100).toFixed(0) : 0;
        return { answer: `Produktivnost: ${trend} (${pct}% ${h2 >= h1 ? 'više' : 'manje'} sati nego prošli tjedan)`, type: h2 >= h1 ? 'success' : 'warn' };
    }
    if (ql.includes('koliko') && (ql.includes('novi') || ql.includes('novih')) && ql.includes('unos')) {
        const cnt = timesheets.filter((t: any) => t.date === todayStr).length;
        return { answer: `Danas je uneseno **${cnt} novih** radnih sati.`, type: cnt > 0 ? 'success' : 'info' };
    }

    // ─── 56-65: TIM PERFORMANCE ──────────────────────────────────────
    if ((ql.includes('najbolji') || ql.includes('najproduktivniji') || ql.includes('top radnik'))) {
        const byW: Record<string, number> = {};
        approved.filter((t: any) => t.date >= monthStart).forEach((t: any) => { byW[t.workerId] = (byW[t.workerId] || 0) + diffMins(t.startTime, t.endTime); });
        const sorted = Object.entries(byW).sort((a, b) => (b[1] as number) - (a[1] as number));
        if (!sorted.length) return { answer: 'Nema podataka.', type: 'info' };
        const [id, m] = sorted[0];
        return { answer: `🥇 Najproduktivniji radnik ovaj mjesec: **${workers.find((w: any) => w.id === id)?.name || '?'}** — **${(m / 60).toFixed(1)}h**`, type: 'success' };
    }
    if (ql.includes('ranking') || ql.includes('leaderboard') || ql.includes('poredak') || ql.includes('top 5') || ql.includes('top5')) {
        const byW: Record<string, number> = {};
        approved.filter((t: any) => t.date >= monthStart).forEach((t: any) => { byW[t.workerId] = (byW[t.workerId] || 0) + diffMins(t.startTime, t.endTime); });
        const sorted = Object.entries(byW).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 5);
        const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
        const lines = sorted.map(([id, m], i) => `${medals[i]} ${workers.find((w: any) => w.id === id)?.name || '?'} — **${(m / 60).toFixed(1)}h**`);
        return { answer: `🏆 Top 5 radnika (mjesec):\n${lines.join('\n')}`, type: 'success' };
    }
    if ((ql.includes('info') || ql.includes('profil') || ql.includes('detalji')) && mw) {
        const ts = approved.filter((t: any) => t.workerId === mw.id && t.date >= monthStart);
        const h = sumH(ts);
        const days = new Set(ts.map((t: any) => t.date)).size;
        const wProjs = projects.filter((p: any) => (p.workers || []).includes(mw.id) && p.status === 'aktivan');
        return { answer: `👷 **${mw.name}**\n• Sati ovaj mjesec: **${h}h**\n• Radnih dana: **${days}**\n• Prosjek: **${days ? (h / days).toFixed(1) : 0}h/dan**\n• Aktivni projekti: ${wProjs.map((p: any) => p.name).join(', ') || 'nema'}`, type: 'info' };
    }

    // ─── 66-69: LOKACIJA / GPS ───────────────────────────────────────
    if ((ql.includes('gdje je') || ql.includes('lokacija') || ql.includes('pozicija')) && mw) {
        const lastTs = timesheets.filter((t: any) => t.workerId === mw.id && t.gpsLocation).sort((a: any, b: any) => (b.date + b.startTime).localeCompare(a.date + a.startTime))[0];
        const wProjs = activeProjects.filter((p: any) => (p.workers || []).includes(mw.id));
        if (lastTs?.gpsLocation) {
            const proj = projects.find((p: any) => p.id === lastTs.projectId);
            return { answer: `📍 **${mw.name}** — zadnja GPS lokacija: ${fmtDate(lastTs.date)}\nProjekt: **${proj?.name || '?'}**\nGPS: ${lastTs.gpsLocation}`, type: 'info' };
        }
        if (wProjs.length) return { answer: `${mw.name} je dodijeljen/a: ${wProjs.map((p: any) => `**${p.name}** (${p.location || 'bez lokacije'})`).join(', ')}`, type: 'info' };
        return { answer: `Nema GPS podataka za ${mw.name}.`, type: 'warn' };
    }
    if (ql.includes('tko radi na') && mp) {
        const wIds = mp.workers || [];
        if (!wIds.length) return { answer: `Nitko nije dodijeljen projektu **${mp.name}**.`, type: 'warn' };
        const names = wIds.map((id: string) => workers.find((w: any) => w.id === id)?.name || '?');
        return { answer: `Na **${mp.name}** rade:\n${names.map((n: string) => `• ${n}`).join('\n')}`, type: 'info' };
    }

    // ─── 70-75: VOZILA ───────────────────────────────────────────────
    if (ql.includes('koliko') && (ql.includes('vozil') || ql.includes('auto'))) {
        const v = vehicles || [];
        return { answer: `🚗 Ukupno vozila: **${v.length}**`, type: 'info' };
    }
    if ((ql.includes('koja') || ql.includes('lista') || ql.includes('popis')) && (ql.includes('vozil') || ql.includes('auto'))) {
        const v = vehicles || [];
        if (!v.length) return { answer: 'Nema registriranih vozila.', type: 'info' };
        const lines = v.map((vh: any) => `• **${vh.name || vh.make || '?'}** ${vh.plates || vh.licensePlate || ''} ${vh.year || ''}`);
        return { answer: `🚗 Vozila (${v.length}):\n${lines.join('\n')}`, type: 'info' };
    }

    // ─── 76-80: SMJEŠTAJ ─────────────────────────────────────────────
    if (ql.includes('koliko') && ql.includes('smjestaj')) {
        const s = smjestaj || [];
        const totalCap = s.reduce((sum: number, a: any) => sum + (parseInt(a.maxCapacity) || 0), 0);
        const totalOcc = s.reduce((sum: number, a: any) => sum + (a.workerIds || []).length, 0);
        return { answer: `🏠 Smještaji: **${s.length}**\nKapacitet: **${totalOcc}/${totalCap}** mjesta zauzeto`, type: 'info' };
    }
    if ((ql.includes('koji') || ql.includes('lista') || ql.includes('popis')) && ql.includes('smjestaj')) {
        const s = smjestaj || [];
        if (!s.length) return { answer: 'Nema registriranih smještaja.', type: 'info' };
        const lines = s.map((a: any) => `• **${a.name}** (${a.city || a.address || '?'}) — ${(a.workerIds || []).length}/${a.maxCapacity || '?'} mjesta`);
        return { answer: `🏠 Smještaji:\n${lines.join('\n')}`, type: 'info' };
    }
    if (ql.includes('smjest') && mw) {
        const s = (smjestaj || []).find((a: any) => (a.workerIds || []).includes(mw.id));
        if (!s) return { answer: `${mw.name} nema dodijeljeni smještaj.`, type: 'warn' };
        return { answer: `${mw.name} je smješten/a u **${s.name}** (${s.city || s.address || '?'}).`, type: 'info' };
    }

    // ─── 81-85: OBAVEZE ──────────────────────────────────────────────
    if (ql.includes('koliko') && (ql.includes('obavez') || ql.includes('zadatak') || ql.includes('task'))) {
        const ob = obaveze || [];
        const active = ob.filter((o: any) => o.active !== false);
        const overdue = active.filter((o: any) => o.dueDate && o.dueDate < todayStr);
        const high = active.filter((o: any) => o.priority === 'visok' || o.priority === 'hitan');
        return { answer: `📋 Obaveze:\n• Aktivne: **${active.length}**\n• Istekle: **${overdue.length}**\n• Prioritetne: **${high.length}**\n• Ukupno: **${ob.length}**`, type: overdue.length > 0 ? 'warn' : 'info' };
    }
    if ((ql.includes('istek') || ql.includes('prekorac') || ql.includes('overdue') || ql.includes('kasn')) && (ql.includes('obavez') || ql.includes('zadatak'))) {
        const ob = (obaveze || []).filter((o: any) => o.active !== false && o.dueDate && o.dueDate < todayStr);
        if (!ob.length) return { answer: '✅ Nema isteklih obaveza!', type: 'success' };
        const lines = ob.map((o: any) => `• **${o.title}** (rok: ${fmtDate(o.dueDate)}) — ${o.priority || 'normalan'}`);
        return { answer: `🚨 **${ob.length} isteklih** obaveza:\n${lines.join('\n')}`, type: 'danger' };
    }
    if (ql.includes('obavez') && mw) {
        const ob = (obaveze || []).filter((o: any) => o.active !== false && (o.workerIds || []).includes(mw.id));
        if (!ob.length) return { answer: `${mw.name} nema aktivnih obaveza.`, type: 'info' };
        const lines = ob.map((o: any) => `• **${o.title}** (rok: ${o.dueDate ? fmtDate(o.dueDate) : 'nema'}) — ${o.priority || 'normalan'}`);
        return { answer: `📋 Obaveze za ${mw.name}:\n${lines.join('\n')}`, type: 'info' };
    }

    // ─── 86-90: OTPREMNICE ───────────────────────────────────────────
    if (ql.includes('koliko') && ql.includes('otpremnic')) {
        const o = otpremnice || [];
        const pending = o.filter((x: any) => x.status === 'na čekanju').length;
        const total = o.reduce((s: number, x: any) => s + (parseFloat(x.amount) || 0), 0);
        return { answer: `📦 Otpremnice: **${o.length}** ukupno\n• Na čekanju: **${pending}**\n• Ukupni iznos: **${total.toFixed(2)} €**`, type: 'info' };
    }
    if (ql.includes('otpremnic') && (ql.includes('cekanj') || ql.includes('pending'))) {
        const pend = (otpremnice || []).filter((o: any) => o.status === 'na čekanju' || o.status === 'odobreno-voditelj');
        if (!pend.length) return { answer: '✅ Nema otpremnica na čekanju!', type: 'success' };
        const lines = pend.slice(0, 10).map((o: any) => `• ${fmtDate(o.date)} — **${o.supplier || '?'}** — ${o.amount ? o.amount + '€' : '—'}`);
        return { answer: `📦 **${pend.length}** otpremnica na čekanju:\n${lines.join('\n')}`, type: 'warn' };
    }
    if (ql.includes('iznos') && ql.includes('otpremnic')) {
        const o = otpremnice || [];
        const total = o.reduce((s: number, x: any) => s + (parseFloat(x.amount) || 0), 0);
        const approvedAmt = o.filter((x: any) => x.status === 'prihvaćena').reduce((s: number, x: any) => s + (parseFloat(x.amount) || 0), 0);
        return { answer: `€ Otpremnice:\n• Ukupni iznos: **${total.toFixed(2)} €**\n• Prihvaćeno: **${approvedAmt.toFixed(2)} €**`, type: 'info' };
    }

    // ─── 91-95: SIGURNOST / SAFETY ───────────────────────────────────
    if (ql.includes('sigurnost') || ql.includes('safety') || ql.includes('kontroln') || ql.includes('checklist')) {
        const sc = safetyChecklists || [];
        const recent = sc.filter((c: any) => c.date >= weekStr).length;
        return { answer: `🛡️ Sigurnosne kontrole:\n• Ukupno: **${sc.length}**\n• Ovaj tjedan: **${recent}**`, type: 'info' };
    }

    // ─── 96-100: DNEVNIK RADA ────────────────────────────────────────
    if (ql.includes('dnevnik') || ql.includes('daily log')) {
        const dl = dailyLogs || [];
        const recent = dl.filter((l: any) => l.date >= weekStr).length;
        const pending = dl.filter((l: any) => l.status === 'na čekanju').length;
        return { answer: `📋 Dnevnici rada:\n• Ukupno: **${dl.length}**\n• Ovaj tjedan: **${recent}**\n• Na čekanju: **${pending}**`, type: 'info' };
    }

    // ─── GENERAL / SAŽETAK ──────────────────────────────────────────
    if (ql.includes('sazetak') || ql.includes('summary') || ql.includes('pregled dana') || ql.includes('izvjestaj')) {
        const tTs = timesheets.filter((t: any) => t.date === todayStr);
        const tH = sumH(tTs.filter((t: any) => t.status === 'odobren' || t.status === 'prihvaćen'));
        const workedCnt = new Set(tTs.map((t: any) => t.workerId)).size;
        const absentCnt = activeWorkers.length - new Set(tTs.map((t: any) => t.workerId)).size;
        const pendAll = timesheets.filter((t: any) => t.status === 'na čekanju').length;
        return { answer: `📊 **Sažetak dana**:\n• Odrađeno: **${tH}h** (${workedCnt} radnika)\n• Bez unosa: **${absentCnt}** radnika\n• Na čekanju: **${pendAll}** odobrenja\n• Aktivnih projekata: **${activeProjects.length}**`, type: 'info' };
    }
    if (ql.includes('koliko') && ql.includes('radnik') && !ql.includes('projekt')) {
        return { answer: `👷 Ukupno radnika: **${workers.length}** (aktivnih: **${activeWorkers.length}**)`, type: 'info' };
    }
    if (ql.includes('pomoc') || ql.includes('help') || ql.includes('sto mog') || ql.includes('primjer')) {
        return { answer: '🤖 Pitajte me:\n• "Koliko je sati radio Marko ovaj tjedan?"\n• "Tko nije unio sate danas?"\n• "Usporedi zadnja 2 tjedna"\n• "Top 5 radnika ovaj mjesec"\n• "Koji projekt ima najviše troškova?"\n• "Na čekanju odobrenja"\n• "Gdje je Marko?"\n• "Koliko imamo vozila?"\n• "Istekle obaveze"\n• "Sažetak dana"\n• "Tko radi više od 10 sati?"\n• "Daj mi info o Marku"', type: 'info' };
    }

    return { answer: 'Nisam razumio pitanje. Pokušajte:\n• "Koliko sati radio [ime] ovaj tjedan?"\n• "Tko nije radio danas?"\n• "Top 5 radnika"\n• "Usporedi tjedne"\n• "Projekti po troškovima"\n• "Na čekanju"\n• "Sažetak dana"\n• "Pomoć" za više primjera', type: 'info' };
};
