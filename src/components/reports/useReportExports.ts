import { C, styles, today, fmtDate, diffMins } from '../../utils/helpers';

export function useReportExports({ periodTs, periodInvoices, workers, projects, vehicles, otpremnice, companyProfile, hoursByWorker, hoursByProject, totalHours, totalCosts, activeWorkersCount, costsByProject, costsByCategory, vehicleData, otpremnicePeriod, otpStats, dateFrom, dateTo, filterWorker, filterProject, filterVehicle }) {
    const exportCSV = () => {
        let csv = 'Datum;Radnik;Projekt;Od;Do;Sati;Tip;Status\n';
        periodTs.forEach(t => {
            const w = workers.find(x => x.id === t.workerId)?.name || '—';
            const p = projects.find(x => x.id === t.projectId)?.name || '—';
            const h = ((t.durationMins || diffMins(t.startTime, t.endTime)) / 60).toFixed(1);
            csv += `${t.date};${w};${p};${t.startTime || ''};${t.endTime || ''};${h};${t.type || 'normalan'};${t.status || ''}\n`;
        });
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
        link.download = `izvjestaj-${today()}.csv`; link.click();
    };

    const exportPDF = () => {
        const company = companyProfile?.companyName || 'Vi-Di-Sef';
        const w = window.open('', '_blank');
        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Izvještaj - ${company}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#1E293B}
        h1{color:#1D4ED8;font-size:22px}h2{font-size:15px;margin-top:28px;border-bottom:2px solid #1D4ED8;padding-bottom:6px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #CBD5E1;padding:7px 10px;text-align:left;font-size:11px}
        th{background:#F1F5F9;font-weight:700}tr:nth-child(even){background:#FAFBFC}
        .header{border-bottom:3px solid #1D4ED8;padding-bottom:14px;margin-bottom:24px}
        .stat{display:inline-block;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:10px 18px;margin:4px;text-align:center}
        .stat .val{font-size:22px;font-weight:800;color:#1D4ED8}.stat .lbl{font-size:10px;color:#64748B;text-transform:uppercase}
        .footer{margin-top:30px;color:#94A3B8;font-size:10px}@media print{button{display:none!important}}</style></head><body>`;
        html += `<div class="header"><h1> ${company}</h1><p style="color:#64748B;font-size:12px">Izvještaj: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}</p></div>`;
        html += `<div><div class="stat"><div class="val">${Math.round(totalHours / 60)}h</div><div class="lbl">Ukupno sati</div></div><div class="stat"><div class="val">${periodTs.length}</div><div class="lbl">Unosa</div></div><div class="stat"><div class="val">${totalCosts.toFixed(0)}€</div><div class="lbl">Računi</div></div><div class="stat"><div class="val">${activeWorkersCount}</div><div class="lbl">Radnika</div></div></div>`;
        html += `<h2>Sati po radnicima</h2><table><tr><th>Radnik</th><th>Sati</th><th>Normalan</th><th>Prekovremeni</th><th>Noćni</th><th>Vikend</th><th>Unosa</th></tr>`;
        hoursByWorker.forEach(w => { html += `<tr><td>${w.name}</td><td><strong>${w.sati}h</strong></td><td>${w.normalan}h</td><td>${w.prekovremeni}h</td><td>${w.nocni}h</td><td>${w.vikend}h</td><td>${w.unosa}</td></tr>`; });
        html += `</table>`;
        html += `<h2>Sati po projektima</h2><table><tr><th>Projekt</th><th>Sati</th><th>Radnika</th><th>Računi €</th></tr>`;
        hoursByProject.forEach(p => { html += `<tr><td>${p.fullName}</td><td><strong>${p.sati}h</strong></td><td>${p.radnika}</td><td>${p.trošak.toFixed(2)}€</td></tr>`; });
        html += `</table>`;
        html += `<h2>Detaljni pregled</h2><table><tr><th>Datum</th><th>Radnik</th><th>Projekt</th><th>Od</th><th>Do</th><th>Sati</th><th>Tip</th></tr>`;
        periodTs.sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(t => {
            const wn = workers.find(x => x.id === t.workerId)?.name || '—';
            const pn = projects.find(x => x.id === t.projectId)?.name || '—';
            const h = ((t.durationMins || diffMins(t.startTime, t.endTime)) / 60).toFixed(1);
            html += `<tr><td>${t.date}</td><td>${wn}</td><td>${pn}</td><td>${t.startTime || ''}</td><td>${t.endTime || ''}</td><td>${h}h</td><td>${t.type || 'normalan'}</td></tr>`;
        });
        html += `</table><p class="footer">Generirano: ${new Date().toLocaleString('hr-HR')} • ${company} • Vi-Di-Sef v3.0</p></body></html>`;
        w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500);
    };

    // PDF for Workers section only
    const exportWorkersPDF = () => {
        const company = companyProfile?.companyName || 'Vi-Di-Sef';
        const selectedWorker = filterWorker !== 'sve' ? workers.find(w => w.id === filterWorker)?.name : null;
        const selectedProject = filterProject !== 'sve' ? projects.find(p => p.id === filterProject)?.name : null;
        const w = window.open('', '_blank');
        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Radnici - ${company}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#1E293B}
        h1{color:#1D4ED8;font-size:22px}h2{font-size:15px;margin-top:28px;border-bottom:2px solid #1D4ED8;padding-bottom:6px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #CBD5E1;padding:7px 10px;text-align:left;font-size:11px}
        th{background:#F1F5F9;font-weight:700}tr:nth-child(even){background:#FAFBFC}
        .header{border-bottom:3px solid #1D4ED8;padding-bottom:14px;margin-bottom:24px}
        .stat{display:inline-block;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:10px 18px;margin:4px;text-align:center}
        .stat .val{font-size:22px;font-weight:800;color:#1D4ED8}.stat .lbl{font-size:10px;color:#64748B;text-transform:uppercase}
        .footer{margin-top:30px;color:#94A3B8;font-size:10px}@media print{button{display:none!important}}</style></head><body>`;
        html += `<div class="header"><h1>👷 ${company} — Izvještaj po radnicima</h1>`;
        html += `<p style="color:#64748B;font-size:12px">Period: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}`;
        if (selectedWorker) html += ` | Radnik: <strong>${selectedWorker}</strong>`;
        if (selectedProject) html += ` | Projekt: <strong>${selectedProject}</strong>`;
        html += `</p></div>`;
        html += `<div><div class="stat"><div class="val">${hoursByWorker.length}</div><div class="lbl">Radnika</div></div>`;
        html += `<div class="stat"><div class="val">${Math.round(totalHours / 60)}h</div><div class="lbl">Ukupno sati</div></div>`;
        html += `<div class="stat"><div class="val">${periodTs.length}</div><div class="lbl">Unosa</div></div></div>`;
        html += `<h2>Sati po radnicima</h2><table><tr><th>Radnik</th><th>Ukupno sati</th><th>Normalan</th><th>Prekovremeni</th><th>Noćni</th><th>Vikend</th><th>Br. unosa</th><th>Prosj/dan</th></tr>`;
        hoursByWorker.forEach(wr => {
            html += `<tr><td><strong>${wr.name}</strong></td><td><strong>${wr.sati}h</strong></td><td>${wr.normalan}h</td><td>${wr.prekovremeni}h</td><td>${wr.nocni}h</td><td>${wr.vikend}h</td><td>${wr.unosa}</td><td>${wr.unosa > 0 ? (wr.sati / wr.unosa).toFixed(1) : 0}h</td></tr>`;
        });
        html += `</table>`;
        // Detailed entries for each worker
        hoursByWorker.forEach(wr => {
            const wTs = periodTs.filter(t => t.workerId === wr.id).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            if (wTs.length === 0) return;
            html += `<h2>${wr.name} — Detaljni pregled (${wTs.length} unosa)</h2>`;
            html += `<table><tr><th>Datum</th><th>Projekt</th><th>Od</th><th>Do</th><th>Sati</th><th>Tip</th></tr>`;
            wTs.forEach(t => {
                const pn = projects.find(x => x.id === t.projectId)?.name || '—';
                const h = ((t.durationMins || diffMins(t.startTime, t.endTime)) / 60).toFixed(1);
                html += `<tr><td>${t.date}</td><td>${pn}</td><td>${t.startTime || ''}</td><td>${t.endTime || ''}</td><td>${h}h</td><td>${t.type || 'normalan'}</td></tr>`;
            });
            html += `</table>`;
        });
        html += `<p class="footer">Generirano: ${new Date().toLocaleString('hr-HR')} • ${company} • Vi-Di-Sef v3.0</p></body></html>`;
        w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500);
    };

    // PDF for Projects section only
    const exportProjectsPDF = () => {
        const company = companyProfile?.companyName || 'Vi-Di-Sef';
        const selectedProject = filterProject !== 'sve' ? projects.find(p => p.id === filterProject)?.name : null;
        const selectedWorker = filterWorker !== 'sve' ? workers.find(w => w.id === filterWorker)?.name : null;
        const w = window.open('', '_blank');
        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Projekti - ${company}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#1E293B}
        h1{color:#047857;font-size:22px}h2{font-size:15px;margin-top:28px;border-bottom:2px solid #047857;padding-bottom:6px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #CBD5E1;padding:7px 10px;text-align:left;font-size:11px}
        th{background:#F0FDF4;font-weight:700}tr:nth-child(even){background:#FAFBFC}
        .header{border-bottom:3px solid #047857;padding-bottom:14px;margin-bottom:24px}
        .stat{display:inline-block;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:10px 18px;margin:4px;text-align:center}
        .stat .val{font-size:22px;font-weight:800;color:#047857}.stat .lbl{font-size:10px;color:#64748B;text-transform:uppercase}
        .footer{margin-top:30px;color:#94A3B8;font-size:10px}@media print{button{display:none!important}}</style></head><body>`;
        html += `<div class="header"><h1>🏗️ ${company} — Izvještaj po projektima</h1>`;
        html += `<p style="color:#64748B;font-size:12px">Period: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}`;
        if (selectedProject) html += ` | Projekt: <strong>${selectedProject}</strong>`;
        if (selectedWorker) html += ` | Radnik: <strong>${selectedWorker}</strong>`;
        html += `</p></div>`;
        html += `<div><div class="stat"><div class="val">${hoursByProject.length}</div><div class="lbl">Projekata</div></div>`;
        html += `<div class="stat"><div class="val">${Math.round(totalHours / 60)}h</div><div class="lbl">Ukupno sati</div></div>`;
        html += `<div class="stat"><div class="val">${totalCosts.toFixed(0)}€</div><div class="lbl">Troškovi</div></div></div>`;
        html += `<h2>Pregled projekata</h2><table><tr><th>Projekt</th><th>Sati</th><th>Radnika</th><th>Troškovi</th><th>Status</th><th>% vremena</th></tr>`;
        hoursByProject.forEach(p => {
            const proj = projects.find(x => x.id === p.id);
            html += `<tr><td><strong>${p.fullName || p.name}</strong></td><td><strong>${p.sati}h</strong></td><td>${p.radnika}</td><td>${p.trošak.toFixed(0)}€</td><td>${proj?.status || 'aktivan'}</td><td>${totalHours > 0 ? ((p.sati / (totalHours / 60)) * 100).toFixed(1) : 0}%</td></tr>`;
        });
        html += `</table>`;
        // Detailed per-project breakdown
        hoursByProject.forEach(p => {
            const pTs = periodTs.filter(t => t.projectId === p.id);
            if (pTs.length === 0) return;
            // Workers on this project
            const projectWorkers = {};
            pTs.forEach(t => {
                const wn = workers.find(x => x.id === t.workerId)?.name || '—';
                if (!projectWorkers[wn]) projectWorkers[wn] = 0;
                projectWorkers[wn] += (t.durationMins || diffMins(t.startTime, t.endTime)) / 60;
            });
            html += `<h2>${p.fullName || p.name} — Radnici (${Object.keys(projectWorkers).length})</h2>`;
            html += `<table><tr><th>Radnik</th><th>Sati</th><th>% od projekta</th></tr>`;
            Object.entries(projectWorkers).sort((a, b) => b[1] - a[1]).forEach(([name, hrs]) => {
                html += `<tr><td><strong>${name}</strong></td><td>${hrs.toFixed(1)}h</td><td>${p.sati > 0 ? ((hrs / p.sati) * 100).toFixed(1) : 0}%</td></tr>`;
            });
            html += `</table>`;
        });
        html += `<p class="footer">Generirano: ${new Date().toLocaleString('hr-HR')} • ${company} • Vi-Di-Sef v3.0</p></body></html>`;
        w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500);
    };

    // PDF for Costs section
    const exportCostsPDF = () => {
        const company = companyProfile?.companyName || 'Vi-Di-Sef';
        const selectedProject = filterProject !== 'sve' ? projects.find(p => p.id === filterProject)?.name : null;
        const w = window.open('', '_blank');
        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Troškovi - ${company}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#1E293B}
        h1{color:#B91C1C;font-size:22px}h2{font-size:15px;margin-top:28px;border-bottom:2px solid #B91C1C;padding-bottom:6px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #CBD5E1;padding:7px 10px;text-align:left;font-size:11px}
        th{background:#FEF2F2;font-weight:700}tr:nth-child(even){background:#FAFBFC}
        .header{border-bottom:3px solid #B91C1C;padding-bottom:14px;margin-bottom:24px}
        .stat{display:inline-block;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:10px 18px;margin:4px;text-align:center}
        .stat .val{font-size:22px;font-weight:800;color:#B91C1C}.stat .lbl{font-size:10px;color:#64748B;text-transform:uppercase}
        .footer{margin-top:30px;color:#94A3B8;font-size:10px}@media print{button{display:none!important}}</style></head><body>`;
        html += `<div class="header"><h1>€ ${company} — Izvještaj troškova</h1>`;
        html += `<p style="color:#64748B;font-size:12px">Period: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}`;
        if (selectedProject) html += ` | Projekt: <strong>${selectedProject}</strong>`;
        html += `</p></div>`;
        html += `<div><div class="stat"><div class="val">${totalCosts.toFixed(2)}€</div><div class="lbl">Ukupni troškovi</div></div>`;
        html += `<div class="stat"><div class="val">${periodInvoices.length}</div><div class="lbl">Računa</div></div>`;
        html += `<div class="stat"><div class="val">${vehicleData.reduce((s, v) => s + v.trošak, 0).toFixed(2)}€</div><div class="lbl">Gorivo</div></div></div>`;
        html += `<h2>Troškovi po projektima</h2><table><tr><th>Projekt</th><th>Troškovi €</th><th>% ukupnog</th></tr>`;
        costsByProject.forEach(c => { html += `<tr><td>${c.fullName || c.name}</td><td><strong>${c.iznos.toFixed(2)}€</strong></td><td>${totalCosts > 0 ? ((c.iznos / totalCosts) * 100).toFixed(1) : 0}%</td></tr>`; });
        html += `</table>`;
        if (costsByCategory.length > 0) {
            html += `<h2>Troškovi po kategorijama</h2><table><tr><th>Kategorija</th><th>Iznos €</th><th>% ukupnog</th></tr>`;
            costsByCategory.forEach(c => { html += `<tr><td>${c.name}</td><td><strong>${c.iznos.toFixed(2)}€</strong></td><td>${totalCosts > 0 ? ((c.iznos / totalCosts) * 100).toFixed(1) : 0}%</td></tr>`; });
            html += `</table>`;
        }
        html += `<p class="footer">Generirano: ${new Date().toLocaleString('hr-HR')} • ${company} • Vi-Di-Sef v3.0</p></body></html>`;
        w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500);
    };

    // PDF for Vehicles section
    const exportVehiclesPDF = () => {
        const company = companyProfile?.companyName || 'Vi-Di-Sef';
        const selectedVehicle = filterVehicle !== 'sve' ? (vehicles || []).find(v => v.id === filterVehicle) : null;
        const w = window.open('', '_blank');
        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vozila - ${company}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#1E293B}
        h1{color:#B45309;font-size:22px}h2{font-size:15px;margin-top:28px;border-bottom:2px solid #B45309;padding-bottom:6px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #CBD5E1;padding:7px 10px;text-align:left;font-size:11px}
        th{background:#FFFBEB;font-weight:700}tr:nth-child(even){background:#FAFBFC}
        .header{border-bottom:3px solid #B45309;padding-bottom:14px;margin-bottom:24px}
        .stat{display:inline-block;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:10px 18px;margin:4px;text-align:center}
        .stat .val{font-size:22px;font-weight:800;color:#B45309}.stat .lbl{font-size:10px;color:#64748B;text-transform:uppercase}
        .footer{margin-top:30px;color:#94A3B8;font-size:10px}@media print{button{display:none!important}}</style></head><body>`;
        html += `<div class="header"><h1>🚛 ${company} — Izvještaj vozila</h1>`;
        html += `<p style="color:#64748B;font-size:12px">Period: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}`;
        if (selectedVehicle) html += ` | Vozilo: <strong>${selectedVehicle.name || selectedVehicle.regNumber}</strong>`;
        html += `</p></div>`;
        html += `<div><div class="stat"><div class="val">${vehicleData.reduce((s, v) => s + v.trošak, 0).toFixed(2)}€</div><div class="lbl">Ukupno gorivo</div></div>`;
        html += `<div class="stat"><div class="val">${vehicleData.reduce((s, v) => s + v.litara, 0).toFixed(0)}</div><div class="lbl">Litara</div></div>`;
        html += `<div class="stat"><div class="val">${vehicleData.length}</div><div class="lbl">Vozila</div></div></div>`;
        html += `<h2>Pregled vozila</h2><table><tr><th>Vozilo</th><th>Litara</th><th>Trošak €</th><th>Km</th><th>Br. tankanja</th></tr>`;
        vehicleData.forEach(v => { html += `<tr><td><strong>${v.name}</strong></td><td>${v.litara.toFixed(1)}</td><td><strong>${v.trošak.toFixed(2)}€</strong></td><td>${v.km.toFixed(0)}</td><td>${v.unosa}</td></tr>`; });
        html += `</table>`;
        html += `<p class="footer">Generirano: ${new Date().toLocaleString('hr-HR')} • ${company} • Vi-Di-Sef v3.0</p></body></html>`;
        w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500);
    };

    // PDF for Otpremnice section
    const exportOtpremnicePDF = () => {
        const company = companyProfile?.companyName || 'Vi-Di-Sef';
        const selectedProject = filterProject !== 'sve' ? projects.find(p => p.id === filterProject)?.name : null;
        const w = window.open('', '_blank');
        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Otpremnice - ${company}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#1E293B}
        h1{color:#3B82F6;font-size:22px}h2{font-size:15px;margin-top:28px;border-bottom:2px solid #3B82F6;padding-bottom:6px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #CBD5E1;padding:7px 10px;text-align:left;font-size:11px}
        th{background:#EFF6FF;font-weight:700}tr:nth-child(even){background:#FAFBFC}
        .header{border-bottom:3px solid #3B82F6;padding-bottom:14px;margin-bottom:24px}
        .stat{display:inline-block;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:10px 18px;margin:4px;text-align:center}
        .stat .val{font-size:22px;font-weight:800;color:#3B82F6}.stat .lbl{font-size:10px;color:#64748B;text-transform:uppercase}
        .footer{margin-top:30px;color:#94A3B8;font-size:10px}@media print{button{display:none!important}}</style></head><body>`;
        html += `<div class="header"><h1>📦 ${company} — Izvještaj otpremnica</h1>`;
        html += `<p style="color:#64748B;font-size:12px">Period: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}`;
        if (selectedProject) html += ` | Projekt: <strong>${selectedProject}</strong>`;
        html += `</p></div>`;
        html += `<div><div class="stat"><div class="val">${otpStats.totalAmount}€</div><div class="lbl">Ukupni iznos</div></div>`;
        html += `<div class="stat"><div class="val">${otpStats.count}</div><div class="lbl">Otpremnica</div></div>`;
        html += `<div class="stat"><div class="val">${otpStats.approved}</div><div class="lbl">Odobrene</div></div>`;
        html += `<div class="stat"><div class="val">${otpStats.pending}</div><div class="lbl">Na čekanju</div></div></div>`;
        html += `<h2>Sve otpremnice (${otpremnicePeriod.length})</h2><table><tr><th>Br.</th><th>Datum</th><th>Dobavljač</th><th>Projekt</th><th>Iznos</th><th>Status</th><th>Napomena</th></tr>`;
        otpremnicePeriod.sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(o => {
            const proj = projects.find(p => p.id === o.projectId);
            html += `<tr><td>${o.deliveryNumber || '—'}</td><td>${fmtDate(o.date)}</td><td>${o.supplier || '—'}</td><td>${proj?.name || '—'}</td><td><strong>${o.amount ? parseFloat(o.amount).toFixed(2) + '€' : '—'}</strong></td><td>${o.status || '—'}</td><td>${o.note || '—'}</td></tr>`;
        });
        html += `</table>`;
        html += `<p class="footer">Generirano: ${new Date().toLocaleString('hr-HR')} • ${company} • Vi-Di-Sef v3.0</p></body></html>`;
        w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500);
    };

    return { exportCSV, exportPDF, exportWorkersPDF, exportProjectsPDF, exportCostsPDF, exportVehiclesPDF, exportOtpremnicePDF };
}
