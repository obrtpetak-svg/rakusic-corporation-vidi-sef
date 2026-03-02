import { useEffect, useRef, useCallback } from 'react';

// ── Permission request ───────────────────────────────────────────────────
export async function requestNotificationPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    const result = await Notification.requestPermission();
    return result;
}

// ── Show browser notification ────────────────────────────────────────────
function showNotification(title, body, icon = '/icon-192.png') {
    if (Notification.permission !== 'granted') return;

    // Try service worker notification (works in background)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, {
                body,
                icon,
                badge: '/icon-192.png',
                vibrate: [200, 100, 200],
                tag: `vidisef-${Date.now()}`,
                renotify: true,
                data: { url: window.location.href }
            });
        });
    } else {
        // Fallback to basic notification
        new Notification(title, { body, icon });
    }
}

// ── Storage helpers ──────────────────────────────────────────────────────
const STORAGE_KEY = 'vidisef-notif-state';
function getNotifState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
}
function setNotifState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ── Main hook ────────────────────────────────────────────────────────────
export function useNotifications({ currentUser, timesheets, invoices, otpremnice, projects, vehicles, smjestaj, obaveze, workers }) {
    const prevRef = useRef(null);
    const isAdmin = currentUser?.role === 'admin';
    const userId = currentUser?.workerId || currentUser?.id;
    const initialized = useRef(false);

    // Worker name helper
    const wName = useCallback((id) => workers?.find(w => w.id === id)?.name || '', [workers]);
    const pName = useCallback((id) => projects?.find(p => p.id === id)?.name || '', [projects]);

    useEffect(() => {
        if (!currentUser || Notification.permission !== 'granted') return;

        // Build current snapshot
        const current = {
            // Admin monitors
            pendingTsIds: timesheets.filter(t => t.status === 'na čekanju').map(t => t.id),
            pendingInvIds: invoices.filter(i => i.status === 'na čekanju').map(i => i.id),
            pendingOtpIds: (otpremnice || []).filter(o => o.status === 'na čekanju').map(o => o.id),
            // Worker monitors — their own items status
            myApprovedTs: timesheets.filter(t => t.workerId === userId && t.status === 'odobren').map(t => t.id),
            myRejectedTs: timesheets.filter(t => t.workerId === userId && t.status === 'odbijen').map(t => t.id),
            myApprovedInv: invoices.filter(i => i.workerId === userId && (i.status === 'prihvaćena' || i.status === 'odobrena')).map(i => i.id),
            myRejectedInv: invoices.filter(i => i.workerId === userId && i.status === 'odbijena').map(i => i.id),
            myApprovedOtp: (otpremnice || []).filter(o => o.workerId === userId && o.status === 'prihvaćena').map(o => o.id),
            myRejectedOtp: (otpremnice || []).filter(o => o.workerId === userId && o.status === 'odbijena').map(o => o.id),
            // Worker assignments
            myProjectIds: (projects || []).filter(p => (p.workers || []).includes(userId)).map(p => p.id),
            myVehicleIds: (vehicles || []).filter(v => v.assignedWorker === userId).map(v => v.id),
            mySmjestajIds: (smjestaj || []).filter(s => (s.workerIds || []).includes(userId)).map(s => s.id),
            myObavezeIds: (obaveze || []).filter(o => (o.workerIds || []).includes(userId)).map(o => o.id),
        };

        // Skip first render — just store initial state
        if (!initialized.current) {
            prevRef.current = current;
            initialized.current = true;
            return;
        }

        const prev = prevRef.current;
        if (!prev) { prevRef.current = current; return; }

        // ═══════ ADMIN NOTIFICATIONS ═══════
        if (isAdmin) {
            // New pending timesheets
            const newPendingTs = current.pendingTsIds.filter(id => !prev.pendingTsIds.includes(id));
            newPendingTs.forEach(id => {
                const t = timesheets.find(x => x.id === id);
                if (t) showNotification('⏱️ Novi radni sati', `${wName(t.workerId)} — ${pName(t.projectId)} • ${t.date}`);
            });

            // New pending invoices
            const newPendingInv = current.pendingInvIds.filter(id => !prev.pendingInvIds.includes(id));
            newPendingInv.forEach(id => {
                const i = invoices.find(x => x.id === id);
                if (i) showNotification('🧾 Novi račun', `${wName(i.workerId)} — ${i.amount || '?'}€`);
            });

            // New pending otpremnice
            const newPendingOtp = current.pendingOtpIds.filter(id => !prev.pendingOtpIds.includes(id));
            newPendingOtp.forEach(id => {
                const o = (otpremnice || []).find(x => x.id === id);
                if (o) showNotification('📦 Nova otpremnica', `${o.supplier || '—'} — ${pName(o.projectId)}`);
            });
        }

        // ═══════ WORKER NOTIFICATIONS ═══════
        if (!isAdmin) {
            // Timesheet approved
            const newApprovedTs = current.myApprovedTs.filter(id => !prev.myApprovedTs.includes(id));
            newApprovedTs.forEach(id => {
                const t = timesheets.find(x => x.id === id);
                if (t) showNotification('✅ Sati odobreni', `${t.date} — ${pName(t.projectId)}`);
            });

            // Timesheet rejected
            const newRejectedTs = current.myRejectedTs.filter(id => !prev.myRejectedTs.includes(id));
            newRejectedTs.forEach(id => {
                const t = timesheets.find(x => x.id === id);
                if (t) showNotification('❌ Sati odbijeni', `${t.date} — ${t.rejectReason || 'Bez razloga'}`);
            });

            // Invoice approved
            const newApprovedInv = current.myApprovedInv.filter(id => !prev.myApprovedInv.includes(id));
            newApprovedInv.forEach(() => showNotification('✅ Račun prihvaćen', 'Vaš račun je odobren'));

            // Invoice rejected
            const newRejectedInv = current.myRejectedInv.filter(id => !prev.myRejectedInv.includes(id));
            newRejectedInv.forEach(() => showNotification('❌ Račun odbijen', 'Vaš račun je odbijen'));

            // Otpremnica approved
            const newApprovedOtp = current.myApprovedOtp.filter(id => !prev.myApprovedOtp.includes(id));
            newApprovedOtp.forEach(() => showNotification('✅ Otpremnica prihvaćena', 'Vaša otpremnica je odobrena'));

            // Otpremnica rejected
            const newRejectedOtp = current.myRejectedOtp.filter(id => !prev.myRejectedOtp.includes(id));
            newRejectedOtp.forEach(() => showNotification('❌ Otpremnica odbijena', 'Vaša otpremnica je odbijena'));

            // New project assigned
            const newProjects = current.myProjectIds.filter(id => !prev.myProjectIds.includes(id));
            newProjects.forEach(id => showNotification('🏗️ Novi projekt', `Dodijeljeni ste na projekt: ${pName(id)}`));

            // New vehicle assigned
            const newVehicles = current.myVehicleIds.filter(id => !prev.myVehicleIds.includes(id));
            newVehicles.forEach(id => {
                const v = (vehicles || []).find(x => x.id === id);
                showNotification('🚛 Novo vozilo', `Dodijeljeno vam je vozilo: ${v?.name || v?.regNumber || '—'}`);
            });

            // New smjestaj assigned
            const newSmjestaj = current.mySmjestajIds.filter(id => !prev.mySmjestajIds.includes(id));
            newSmjestaj.forEach(id => {
                const s = (smjestaj || []).find(x => x.id === id);
                showNotification('🏠 Novi smještaj', `Dodijeljeni ste u: ${s?.name || s?.address || '—'}`);
            });

            // New obaveze assigned
            const newObaveze = current.myObavezeIds.filter(id => !prev.myObavezeIds.includes(id));
            newObaveze.forEach(id => {
                const o = (obaveze || []).find(x => x.id === id);
                showNotification('📌 Nova obaveza', `${o?.title || o?.description || 'Nova zadatak'}`);
            });
        }

        prevRef.current = current;
    }, [timesheets, invoices, otpremnice, projects, vehicles, smjestaj, obaveze, currentUser, isAdmin, userId, wName, pName]);
}
