import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useApp } from '../context/AppContext';
import { Icon, useIsMobile, useDarkMode, DarkModeToggle, GlobalSearch, PageErrorBoundary } from './ui/SharedComponents';
import { C, styles } from '../utils/helpers';
import { PwaInstallBanner } from './PwaInstallBanner';
import { UndoToast } from './ui/UndoToast';
import { initSyncQueue } from '../services/GpsDataWriter';
import { log } from '../utils/logger';
import { useGpsTracking } from './layout/useGpsTracking';
import { getDb } from '../context/firebaseCore';

// Direct imports for the most frequently accessed pages
import { Dashboard } from './Dashboard';
import { ProjectsPage } from './ProjectsPage';
import { WorkersPage } from './WorkersPage';
import { TimesheetsPage } from './TimesheetsPage';
import { TimesheetEntry } from './TimesheetEntry';
import { InvoicesPage } from './InvoicesPage';
import { WorkerEvidencija } from './WorkerEvidencija';
import { useNotifications, requestNotificationPermission } from '../hooks/useNotifications';

// Lazy-loaded pages (less frequently accessed, heavier components)
const ReportsPage = lazy(() => import('./ReportsPage').then(m => ({ default: m.ReportsPage })));
const KalendarPage = lazy(() => import('./KalendarPage').then(m => ({ default: m.KalendarPage })));
const VozilaPage = lazy(() => import('./VozilaPage').then(m => ({ default: m.VozilaPage })));
const WeatherPage = lazy(() => import('./WeatherPage').then(m => ({ default: m.WeatherPage })));
const SafetyChecklistPage = lazy(() => import('./SafetyChecklistPage').then(m => ({ default: m.SafetyChecklistPage })));
const AiInsightsPage = lazy(() => import('./AiInsightsPage').then(m => ({ default: m.AiInsightsPage })));
const ArhivaPage = lazy(() => import('./ArhivaPage').then(m => ({ default: m.ArhivaPage })));
const GpsAdminPanel = lazy(() => import('./GpsAdminPanel'));
const OtpremnicePage = lazy(() => import('./OtpremnicePage').then(m => ({ default: m.OtpremnicePage })));
const NotificationsPage = lazy(() => import('./NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const ObavezePage = lazy(() => import('./ObavezePage').then(m => ({ default: m.ObavezePage })));
const DailyLogPage = lazy(() => import('./DailyLogPage').then(m => ({ default: m.DailyLogPage })));
const SmjestajPage = lazy(() => import('./SmjestajPage').then(m => ({ default: m.SmjestajPage })));
const QrCheckInPage = lazy(() => import('./QrCheckIn').then(m => ({ default: m.QrCheckIn })));
const QrAdminPage = lazy(() => import('./qr/QrAdminPage').then(m => ({ default: m.QrAdminPage })));
const LeaveTrackerPage = lazy(() => import('./LeaveTracker').then(m => ({ default: m.LeaveTracker })));
const ProizvodnyaPage = lazy(() => import('./ProizvodnyaPage').then(m => ({ default: m.ProizvodnyaPage })));
const FleetDashboard = lazy(() => import('./fleet/FleetDashboard'));
const SettingsPage = lazy(() => import('./SettingsPage').then(m => ({ default: m.SettingsPage })));
const AiChatAgentLazy = lazy(() => import('./AiChatAgent').then(m => ({ default: m.AiChatAgent })));


const SkeletonBlock = ({ w = '100%', h = 16, r = 8, style = {} }) => (
    <div style={{ width: w, height: h, borderRadius: r, background: 'var(--divider)', animation: 'shimmer 1.5s ease infinite', ...style }} />
);
const LazyFallback = ({ type = 'dashboard' }) => {
    if (type === 'table') return (
        <div className="skel-root">
            <div className="skel-header">
                <SkeletonBlock w={160} h={28} r={10} />
                <SkeletonBlock w={130} h={40} r={12} />
            </div>
            <div className="skel-filter-bar">
                <SkeletonBlock h={40} r={8} style={{ flex: 1 }} />
                <SkeletonBlock w={140} h={40} r={8} />
                <SkeletonBlock w={100} h={40} r={8} />
            </div>
            <div className="skel-table-head">
                {[60, 100, 80, 70, 50, 90].map((w, i) => <SkeletonBlock key={i} w={w} h={10} r={4} />)}
            </div>
            {[0, 1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="skel-table-row">
                    <SkeletonBlock w={70} h={14} r={4} />
                    <div className="skel-row-inner">
                        <SkeletonBlock w={28} h={28} r={14} />
                        <SkeletonBlock w={90 + (i % 3) * 20} h={14} r={4} />
                    </div>
                    <SkeletonBlock w={80} h={14} r={4} />
                    <SkeletonBlock w={50} h={14} r={4} />
                    <SkeletonBlock w={60} h={24} r={12} />
                    <SkeletonBlock w={70} h={24} r={6} />
                </div>
            ))}
        </div>
    );
    if (type === 'cards') return (
        <div className="skel-root">
            <div className="skel-header">
                <SkeletonBlock w={140} h={28} r={10} />
                <SkeletonBlock w={140} h={40} r={12} />
            </div>
            <div className="skel-filter-bar">
                <SkeletonBlock h={40} r={8} style={{ flex: 1 }} />
                <SkeletonBlock w={140} h={40} r={8} />
            </div>
            <div className="skel-card-grid">
                {[0, 1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="skel-card">
                        <div className="skel-card-head">
                            <SkeletonBlock w={44} h={44} r={22} />
                            <div className="skel-flex-1"><SkeletonBlock w={120} h={14} r={4} /><SkeletonBlock w={80} h={12} r={4} style={{ marginTop: 6 }} /></div>
                        </div>
                        <div className="skel-card-mid">
                            <SkeletonBlock w={90} h={12} r={4} />
                            <SkeletonBlock w={80} h={12} r={4} />
                        </div>
                        <div className="skel-card-foot">
                            <SkeletonBlock w={70} h={12} r={4} />
                            <div className="skel-gap-6">
                                <SkeletonBlock w={80} h={28} r={6} />
                                <SkeletonBlock w={28} h={28} r={6} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
    // Default: dashboard skeleton
    return (
        <div className="skel-root">
            <div className="skel-header">
                <div><SkeletonBlock w={200} h={28} r={10} /><SkeletonBlock w={140} h={14} style={{ marginTop: 8 }} /></div>
                <SkeletonBlock w={120} h={40} r={12} />
            </div>
            <div className="skel-stat-grid">
                {[0, 1, 2, 3].map(i => (
                    <div key={i} className="skel-stat-card">
                        <SkeletonBlock w={48} h={48} r={14} />
                        <div className="skel-flex-1"><SkeletonBlock w={60} h={10} /><SkeletonBlock w={80} h={24} style={{ marginTop: 6 }} /><SkeletonBlock w={50} h={10} style={{ marginTop: 4 }} /></div>
                    </div>
                ))}
            </div>
            <div className="skel-content-grid">
                <div className="skel-content-card skel-content-main">
                    <SkeletonBlock w={180} h={16} r={8} style={{ marginBottom: 16 }} />
                    <SkeletonBlock h={160} r={10} />
                </div>
                <div className="skel-content-card">
                    <SkeletonBlock w={100} h={16} r={8} style={{ marginBottom: 16 }} />
                    {[0, 1, 2, 3].map(i => <SkeletonBlock key={i} h={40} r={10} style={{ marginBottom: 8 }} />)}
                </div>
            </div>
        </div>
    );
};

export function Layout() {
    const { currentUser, handleLogout, projects, workers, timesheets, invoices, otpremnice, obaveze, vehicles, smjestaj, dailyLogs, companyProfile,
        isLeader, leaderProjectIds, leaderWorkerIds, prodAlerts } = useApp();
    const [page, setPage] = useState('dashboard');
    const [navDetail, setNavDetail] = useState(null);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [dark, setDark] = useDarkMode();
    const isMobile = useIsMobile();
    const isAdmin = currentUser?.role === 'admin';
    const userId = currentUser?.workerId || currentUser?.id;
    const [notifPermission, setNotifPermission] = useState('default');

    const [sessionWarning, setSessionWarning] = useState(false);
    const [showMoreSheet, setShowMoreSheet] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('vidisef-onboarded'));
    const [onboardingStep, setOnboardingStep] = useState(0);
    const [showFab, setShowFab] = useState(false);
    const [island, setIsland] = useState(null);
    const [pageHistory, setPageHistory] = useState(['dashboard']);

    // Haptic feedback utility
    const haptic = (ms = 10) => { try { navigator.vibrate?.(ms); } catch { } };

    // Dynamic Island notification
    const showIsland = (icon, text, duration = 3000) => {
        setIsland({ icon, text });
        setTimeout(() => setIsland(null), duration);
    };

    // CMD+K / Ctrl+K global search shortcut
    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // Check notification permission on mount
    useEffect(() => {
        if ('Notification' in window) setNotifPermission(Notification.permission);
        // Restore theme preset
        const preset = localStorage.getItem('vidisef-preset');
        if (preset) document.documentElement.setAttribute('data-preset', preset);
        // Offline listener
        const goOff = () => { setIsOffline(true); showIsland('', 'Offline — promjene čekaju sync'); };
        const goOn = () => { setIsOffline(false); showIsland('', 'Ponovo online!'); };
        window.addEventListener('offline', goOff);
        window.addEventListener('online', goOn);
        // Ambient background
        const h = new Date().getHours();
        const ambient = h >= 6 && h < 12 ? 'morning' : h >= 12 && h < 18 ? 'afternoon' : 'evening';
        document.documentElement.setAttribute('data-ambient', ambient);
        return () => { window.removeEventListener('offline', goOff); window.removeEventListener('online', goOn); };
    }, []);

    // ── Service Worker update listener ──
    useEffect(() => {
        const handler = (e) => {
            if (e.data?.type === 'SW_UPDATED') {
                log('[SW] New version:', e.data.version);
                // Auto-reload after 2s to pick up new assets
                setTimeout(() => window.location.reload(), 2000);
            }
        };
        navigator.serviceWorker?.addEventListener('message', handler);
        return () => navigator.serviceWorker?.removeEventListener('message', handler);
    }, []);

    // ── Initialize offline sync queue ──
    useEffect(() => {
        initSyncQueue();
    }, []);

    // ── Session timeout (8h inactivity → auto-logout) ──
    useEffect(() => {
        const TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours
        const WARNING = 5 * 60 * 1000; // 5 minutes before
        let timer, warningTimer;
        const reset = () => {
            clearTimeout(timer);
            clearTimeout(warningTimer);
            setSessionWarning(false);
            warningTimer = setTimeout(() => setSessionWarning(true), TIMEOUT - WARNING);
            timer = setTimeout(() => {
                alert('Sesija istekla — automatska odjava zbog neaktivnosti.');
                handleLogout();
            }, TIMEOUT);
        };
        const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
        events.forEach(e => window.addEventListener(e, reset, { passive: true }));
        reset();
        return () => {
            clearTimeout(timer);
            clearTimeout(warningTimer);
            events.forEach(e => window.removeEventListener(e, reset));
        };
    }, [handleLogout]);

    // Activate PWA notifications
    useNotifications({ currentUser, timesheets, invoices, otpremnice, projects, vehicles, smjestaj, obaveze, workers });

    // ── Background GPS tracking for workers/leaders ──
    useGpsTracking({ currentUser, isAdmin, userId, projects, getDb });

    const enableNotifications = async () => {
        const result = await requestNotificationPermission();
        setNotifPermission(result);
        if (result === 'granted') {
            new Notification('✅ Vi-Di-Sef', { body: 'Obavijesti su aktivirane!', icon: '/icon-192.png' });
        }
    };

    // Pending counts (include leader-approved items for admin)
    const pendingTimesheets = timesheets.filter(t => (t.status === 'na čekanju' || t.status === 'odobreno-voditelj') && t.workerId).length;
    const pendingInvoices = invoices.filter(i => (i.status === 'na čekanju' || i.status === 'odobreno-voditelj' || !i.status) && i.source === 'radnik').length;
    const pendingOtpremnice = otpremnice.filter(o => o.status === 'na čekanju' || o.status === 'odobreno-voditelj').length;
    const pendingDailyLogs = (dailyLogs || []).filter(l => l.status === 'na čekanju' || l.status === 'odobreno voditeljem').length;
    const pendingProdAlerts = (prodAlerts || []).filter(a => a.status === 'unread' && a.targetRole === 'admin').length;
    const pendingCount = pendingTimesheets + pendingInvoices + pendingOtpremnice + pendingDailyLogs + pendingProdAlerts;

    // Worker-specific badges
    const workerObavezeBadge = obaveze.filter(o => (o.workerIds || []).includes(userId) && !(o.completions || []).some(c => c.workerId === userId)).length;
    const adminObavezeBadge = obaveze.reduce((acc, o) => (o.completions || []).filter(c => !c.adminSeen).length + acc, 0);

    // Admin sidebar items
    const adminNav = [
        { id: 'dashboard', icon: 'dashboard', label: 'Pregled' },
        { id: 'projekti', icon: 'project', label: 'Projekti' },
        { id: 'proizvodnja', icon: 'misc', label: 'Proizvodnja' },
        { id: 'radnici', icon: 'workers', label: 'Radnici' },
        { id: 'radni-sati', icon: 'clock', label: 'Radni sati' },
        { id: 'racuni', icon: 'invoice', label: 'Računi R1' },
        { id: 'otpremnice', icon: 'file', label: 'Otpremnice' },
        { id: 'obavijesti', icon: 'bell', label: 'Obavijesti', badge: pendingCount },
        { id: 'izvjestaji', icon: 'report', label: 'Izvještaji' },
        { id: 'kalendar', icon: 'calendar', label: 'Kalendar' },
        { id: 'gps', icon: 'location', label: 'GPS Nadzor' },
        { id: 'gps-vozila', icon: 'car', label: 'GPS Vozila' },
        { id: 'vozila', icon: 'car', label: 'Vozila' },
        { id: 'smjestaj', icon: 'home', label: 'Smještaj' },
        { id: 'dnevnik', icon: 'file', label: 'Dnevnik' },
        { id: 'vrijeme', icon: 'misc', label: 'Vrijeme' },
        { id: 'sigurnost', icon: 'check', label: 'Sigurnost' },
        { id: 'ai-uvidi', icon: 'misc', label: 'AI Uvidi' },
        { id: 'obaveze', icon: 'check', label: 'Obaveze', badge: adminObavezeBadge || null },
        { id: 'odmori', icon: 'calendar', label: 'GO & Odsutnosti' },
        { id: 'qr-checkin', icon: 'check', label: 'QR Check-in' },
        { id: 'arhiva', icon: 'misc', label: 'Arhiva' },
        { id: 'postavke', icon: 'settings', label: 'Postavke' },
    ];

    // Worker sidebar - dynamic based on assignments
    const hasVehicle = (vehicles || []).some(v => v.assignedWorker === userId);
    const hasSmjestaj = (smjestaj || []).some(s => (s.workerIds || []).includes(userId));
    const hasProject = (projects || []).some(p => (p.workers || []).includes(userId));

    const workerNav = [
        { id: 'unos-sati', icon: 'clock', label: 'Unos sati' },
        { id: 'moji-racuni', icon: 'invoice', label: 'Moji računi' },
        { id: 'moje-otpremnice', icon: 'file', label: 'Otpremnice' },
        { id: 'moja-evidencija', icon: 'history', label: 'Evidencija' },
        { id: 'moje-obaveze', icon: 'check', label: 'Obaveze', badge: workerObavezeBadge || null },
        ...(hasProject ? [{ id: 'moji-projekti', icon: 'project', label: 'Projekti' }] : []),
        ...(hasVehicle ? [{ id: 'moje-vozilo', icon: 'car', label: 'Moje vozilo' }] : []),
        ...(hasSmjestaj ? [{ id: 'moj-smjestaj', icon: 'home', label: 'Smještaj' }] : []),
        { id: 'moj-dnevnik', icon: 'file', label: 'Dnevnik' },
        { id: 'moje-vrijeme', icon: 'misc', label: 'Vrijeme' },
        { id: 'moja-sigurnost', icon: 'check', label: 'Sigurnost' },

        { id: 'qr-checkin', icon: 'check', label: 'QR Check-in' },
        { id: 'moji-odmori', icon: 'calendar', label: 'Odmori' },
        { id: 'moje-postavke', icon: 'settings', label: 'Postavke' },
    ];
    // Leader sidebar — project-scoped admin subset
    const leaderPendingTs = timesheets.filter(t => t.status === 'na čekanju' && leaderProjectIds.includes(t.projectId) && t.workerId !== userId).length;
    const leaderPendingInv = invoices.filter(i => i.status === 'na čekanju' && i.source === 'radnik' && leaderProjectIds.includes(i.projectId)).length;
    const leaderPendingOtp = otpremnice.filter(o => o.status === 'na čekanju' && leaderProjectIds.includes(o.projectId)).length;
    const leaderPendingLogs = (dailyLogs || []).filter(l => l.status === 'na čekanju' && leaderProjectIds.includes(l.projectId)).length;
    const leaderPendingCount = leaderPendingTs + leaderPendingInv + leaderPendingOtp + leaderPendingLogs;

    const leaderNav = [
        { id: 'dashboard', icon: 'dashboard', label: 'Pregled' },
        { id: 'unos-sati', icon: 'clock', label: 'Unos sati' },
        { id: 'moja-evidencija', icon: 'history', label: 'Moja evidencija' },
        { id: 'separator-1', separator: true },
        { id: 'projekti', icon: 'project', label: 'Projekti' },
        { id: 'proizvodnja', icon: 'misc', label: 'Proizvodnja' },
        { id: 'radnici', icon: 'workers', label: 'Radnici' },
        { id: 'radni-sati', icon: 'clock', label: 'Radni sati' },
        { id: 'racuni', icon: 'invoice', label: 'Računi R1' },
        { id: 'otpremnice', icon: 'file', label: 'Otpremnice' },
        { id: 'obavijesti', icon: 'bell', label: 'Obavijesti', badge: leaderPendingCount },
        { id: 'obaveze', icon: 'check', label: 'Obaveze' },
        { id: 'gps-vozila', icon: 'car', label: 'GPS Vozila' },
        { id: 'vozila', icon: 'car', label: 'Vozila' },
        { id: 'smjestaj', icon: 'home', label: 'Smještaj' },
        { id: 'dnevnik', icon: 'file', label: 'Dnevnik' },
        { id: 'vrijeme', icon: 'misc', label: 'Vrijeme' },
        { id: 'sigurnost', icon: 'check', label: 'Sigurnost' },
        { id: 'ai-uvidi', icon: 'misc', label: 'AI Uvidi' },
        { id: 'qr-checkin', icon: 'check', label: 'QR Check-in' },
        { id: 'odmori', icon: 'calendar', label: 'Odmori' },
        { id: 'postavke', icon: 'settings', label: 'Postavke' },
    ];

    const navItems = isAdmin ? adminNav : isLeader ? leaderNav : workerNav;

    const navigate = (id) => {
        haptic();
        setPageHistory(prev => {
            const h = prev.filter(p => p !== id);
            return [id, ...h].slice(0, 5);
        });
        const doNav = () => { setPage(id); setMobileOpen(false); };
        if (document.startViewTransition) {
            document.startViewTransition(doNav);
        } else {
            doNav();
        }
    };

    const renderPage = () => {
        if (isAdmin) {
            switch (page) {
                case 'dashboard': return <Dashboard onGoToNotifications={() => setPage('obavijesti')} onNavigate={navigate} />;
                case 'projekti': return <ProjectsPage onNavigate={(pg, detail) => { setNavDetail(detail || null); navigate(pg); }} />;
                case 'proizvodnja': return <ProizvodnyaPage />;
                case 'radnici': return <WorkersPage defaultDetailId={page === 'radnici' ? navDetail : null} onDetailConsumed={() => setNavDetail(null)} />;
                case 'radni-sati': return <TimesheetsPage />;
                case 'racuni': return <InvoicesPage />;
                case 'otpremnice': return <OtpremnicePage />;
                case 'obavijesti': return <NotificationsPage />;
                case 'izvjestaji': return <ReportsPage />;
                case 'kalendar': return <KalendarPage />;
                case 'gps': return <GpsAdminPanel />;
                case 'gps-vozila': return <FleetDashboard />;
                case 'vozila': return <VozilaPage />;
                case 'smjestaj': return <SmjestajPage />;
                case 'obaveze': return <ObavezePage />;
                case 'dnevnik': return <DailyLogPage />;
                case 'vrijeme': return <WeatherPage />;
                case 'sigurnost': return <SafetyChecklistPage />;
                case 'ai-uvidi': return <AiInsightsPage />;
                case 'arhiva': return <ArhivaPage />;
                case 'odmori': return <LeaveTrackerPage />;
                case 'qr-checkin': return <QrAdminPage />;
                case 'postavke': return <SettingsPage />;
                default: return <Dashboard onGoToNotifications={() => setPage('obavijesti')} onNavigate={navigate} />;
            }
        } else if (isLeader) {
            // Leader: admin-like views but scoped to assigned projects
            switch (page) {
                case 'dashboard': return <Dashboard leaderProjectIds={leaderProjectIds} onGoToNotifications={() => setPage('obavijesti')} onNavigate={navigate} />;
                case 'unos-sati': return <TimesheetEntry />;
                case 'moja-evidencija': return <WorkerEvidencija />;
                case 'projekti': return <ProjectsPage leaderProjectIds={leaderProjectIds} onNavigate={(pg, detail) => { setNavDetail(detail || null); navigate(pg); }} />;
                case 'proizvodnja': return <ProizvodnyaPage leaderProjectIds={leaderProjectIds} />;
                case 'radnici': return <WorkersPage leaderProjectIds={leaderProjectIds} leaderWorkerIds={leaderWorkerIds} defaultDetailId={page === 'radnici' ? navDetail : null} onDetailConsumed={() => setNavDetail(null)} />;
                case 'radni-sati': return <TimesheetsPage leaderProjectIds={leaderProjectIds} />;
                case 'racuni': return <InvoicesPage leaderProjectIds={leaderProjectIds} />;
                case 'otpremnice': return <OtpremnicePage leaderProjectIds={leaderProjectIds} />;
                case 'obavijesti': return <NotificationsPage leaderProjectIds={leaderProjectIds} />;
                case 'obaveze': return <ObavezePage leaderProjectIds={leaderProjectIds} leaderWorkerIds={leaderWorkerIds} />;
                case 'vozila': return <VozilaPage leaderProjectIds={leaderProjectIds} leaderWorkerIds={leaderWorkerIds} />;
                case 'smjestaj': return <SmjestajPage leaderProjectIds={leaderProjectIds} leaderWorkerIds={leaderWorkerIds} />;
                case 'gps': return <GpsAdminPanel leaderProjectIds={leaderProjectIds} />;
                case 'gps-vozila': return <FleetDashboard />;
                case 'dnevnik': return <DailyLogPage leaderProjectIds={leaderProjectIds} />;
                case 'vrijeme': return <WeatherPage leaderProjectIds={leaderProjectIds} />;
                case 'sigurnost': return <SafetyChecklistPage leaderProjectIds={leaderProjectIds} />;
                case 'ai-uvidi': return <AiInsightsPage leaderProjectIds={leaderProjectIds} />;
                case 'qr-checkin': return <QrAdminPage />;
                case 'odmori': return <LeaveTrackerPage />;
                case 'postavke': return <SettingsPage workerFilterId={userId} />;
                default: return <Dashboard leaderProjectIds={leaderProjectIds} onGoToNotifications={() => setPage('obavijesti')} onNavigate={navigate} />;
            }
        } else {
            switch (page) {
                case 'unos-sati': return <TimesheetEntry />;
                case 'moji-racuni': return <InvoicesPage workerFilterId={userId} />;
                case 'moje-otpremnice': return <OtpremnicePage workerFilterId={userId} />;
                case 'moja-evidencija': return <WorkerEvidencija />;
                case 'moje-obaveze': return <ObavezePage workerFilterId={userId} />;
                case 'moji-projekti': return <ProjectsPage workerFilterId={userId} />;
                case 'moje-vozilo': return <VozilaPage workerFilterId={userId} />;
                case 'moj-smjestaj': return <SmjestajPage workerFilterId={userId} />;
                case 'moj-dnevnik': return <DailyLogPage workerFilterId={userId} />;
                case 'moje-vrijeme': return <WeatherPage workerFilterId={userId} />;
                case 'moja-sigurnost': return <SafetyChecklistPage workerFilterId={userId} />;

                case 'qr-checkin': return <QrCheckInPage />;
                case 'moji-odmori': return <LeaveTrackerPage />;
                case 'moje-postavke': return <SettingsPage workerFilterId={userId} />;
                default: return <TimesheetEntry />;
            }
        }
    };

    // ── Collapsible sidebar groups (admin only) ──
    const adminGroups = isAdmin ? [
        { label: null, items: [adminNav[0]] },
        { label: 'Upravljanje', items: adminNav.slice(1, 8) },
        { label: 'Operativa', items: adminNav.slice(8, 15) },
        { label: 'Alati & Sustav', items: adminNav.slice(15) },
    ] : null;

    const [collapsedGroups, setCollapsedGroups] = useState({});
    const toggleGroup = (label) => setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
    const activeGroupLabel = adminGroups?.find(g => g.items.some(i => i.id === page))?.label;

    const renderNavItem = (item) => {
        if (item.separator) return <div key={item.id} style={{ height: 1, background: C.border, margin: '8px 14px' }} />;
        const active = page === item.id;
        return (
            <button key={item.id} className="nav-btn" onClick={() => navigate(item.id)} aria-current={active ? 'page' : undefined} aria-label={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', marginBottom: 3, background: active ? C.accentLight : 'transparent', color: active ? C.accent : C.textDim, fontWeight: active ? 700 : 500, fontSize: 14, transition: 'all 0.15s' }}>
                <Icon name={item.icon} size={18} />
                {item.label}
                {item.badge > 0 && <span style={{ marginLeft: 'auto', background: C.red, color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 800, padding: '2px 7px', minWidth: 20, textAlign: 'center', animation: 'badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>{item.badge}</span>}
                {active && !item.badge && <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: 3, background: C.accent, animation: 'fadeIn 0.2s ease' }} />}
            </button>
        );
    };

    const renderSidebar = () => {
        if (adminGroups) {
            return adminGroups.map((group, gi) => {
                if (!group.label) return group.items.map(renderNavItem);
                const isCollapsed = collapsedGroups[group.label] && activeGroupLabel !== group.label;
                const groupBadge = group.items.reduce((sum, i) => sum + (i.badge || 0), 0);
                return (
                    <div key={group.label} style={{ marginBottom: 4 }}>
                        <button onClick={() => toggleGroup(group.label)} aria-expanded={!isCollapsed} aria-label={`${isCollapsed ? 'Otvori' : 'Zatvori'} grupu ${group.label}`} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '6px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: C.textMuted, marginTop: gi > 0 ? 8 : 0 }}>
                            <span style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.15s', marginRight: 6, fontSize: 8 }}>▼</span>
                            {group.label}
                            {groupBadge > 0 && <span style={{ marginLeft: 'auto', background: C.red, color: '#fff', borderRadius: 20, fontSize: 9, fontWeight: 800, padding: '1px 5px' }}>{groupBadge}</span>}
                        </button>
                        {!isCollapsed && group.items.map(renderNavItem)}
                    </div>
                );
            });
        }
        return navItems.map(renderNavItem);
    };

    return (
        <div style={styles.page}>
            {/* Skip Navigation — a11y */}
            <a href="#main-content" className="skip-nav" style={{ position: 'absolute', left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden', zIndex: 10001 }} onFocus={e => { e.currentTarget.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:10001;background:var(--accent);color:#fff;padding:8px 20px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;box-shadow:0 4px 12px rgba(0,0,0,0.3)'; }} onBlur={e => { e.currentTarget.style.cssText = 'position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden'; }}>Preskoči na glavni sadržaj</a>
            <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        input:focus, textarea:focus, select:focus { outline: none; border-color: var(--accent) !important; box-shadow: 0 0 0 3px var(--input-focus-ring); }
        input::placeholder, textarea::placeholder { color: var(--text-muted); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: var(--sidebar-bg); }
        ::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); }
        @media (max-width: 767px) {
          .sidebar { transform: translateX(-100%) !important; }
          .sidebar.sidebar-open { transform: translateX(0) !important; }
          .mob-close-btn { display: block !important; }
          .main-content { margin-left: 0 !important; }
        }
        .nav-btn { transition: all 0.15s cubic-bezier(0.16,1,0.3,1); }
        .nav-btn:active { transform: scale(0.97); }
        .nav-btn:hover { transform: translateX(2px); }
      `}</style>

            {/* Mobile overlay */}
            {mobileOpen && <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 98, animation: 'fadeIn 0.2s ease' }} />}

            {/* Sidebar */}
            <div className={mobileOpen ? 'sidebar sidebar-open' : 'sidebar'} role="navigation" aria-label="Glavni izbornik" style={{ width: 240, background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 99, transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1), background 0.4s ease' }}>
                {/* Logo */}
                <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img src="/icon-192.png" alt="Logo" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }} />
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{companyProfile?.companyName || 'Vi-Di-Sef'}</div>
                            <a href="https://www.vi-di.me" target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: C.accent, fontWeight: 600, textDecoration: 'none', display: 'block', marginTop: 2 }}>www.Vi-Di.me</a>
                        </div>
                    </div>
                    <button onClick={() => setMobileOpen(false)} className="mob-close-btn" aria-label="Zatvori izbornik" style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 6, display: 'none' }}>
                        <Icon name="close" size={18} />
                    </button>
                </div>

                {/* Nav */}
                <nav aria-label="Navigacija" style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
                    {renderSidebar()}
                    {/* User info + dark mode + logout */}
                    <div style={{ padding: '12px 4px', marginTop: 8, borderTop: `1px solid ${C.border}` }}>
                        <DarkModeToggle dark={dark} onToggle={() => setDark(!dark)} />
                        {/* Theme Presets */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', marginTop: 4 }}>
                            <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>Tema:</span>
                            {[
                                { id: '', color: '#D95D08', label: 'Default' },
                                { id: 'ocean', color: '#0EA5E9', label: 'Ocean' },
                                { id: 'forest', color: '#059669', label: 'Forest' },
                                { id: 'sunset', color: '#E11D48', label: 'Sunset' },
                            ].map(t => (
                                <button key={t.id} title={t.label} onClick={() => {
                                    if (t.id) document.documentElement.setAttribute('data-preset', t.id);
                                    else document.documentElement.removeAttribute('data-preset');
                                    localStorage.setItem('vidisef-preset', t.id);
                                }} style={{
                                    width: 18, height: 18, borderRadius: '50%', background: t.color, border: (localStorage.getItem('vidisef-preset') || '') === t.id ? '2px solid var(--text)' : '2px solid transparent',
                                    cursor: 'pointer', transition: 'all 0.15s', padding: 0, flexShrink: 0
                                }} />
                            ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-elevated)', marginTop: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                                {currentUser?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser?.name}</div>
                                <div className="u-fs-11" style={{ color: C.textMuted }}>{isAdmin ? 'Administrator' : isLeader ? 'Voditelj' : 'Radnik'}</div>
                            </div>
                            <button onClick={handleLogout} title="Odjava" style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 4 }}>
                                <Icon name="logout" size={16} />
                            </button>
                        </div>
                    </div>
                </nav>
            </div>

            {/* Main content */}
            <main id="main-content" role="main" aria-label="Glavni sadržaj" className="main-content" style={{ marginLeft: isMobile ? 0 : 240, padding: isMobile ? '16px 12px' : 24, minHeight: '100vh', transition: 'background 0.4s ease, color 0.4s ease' }}>
                {/* Mobile header */}
                {isMobile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, position: 'sticky', top: 0, background: 'var(--card-solid)', zIndex: 50, padding: '8px 0', marginTop: -8, borderBottom: '1px solid var(--border)' }}>
                        <button onClick={() => setMobileOpen(true)} aria-label="Otvori navigaciju" style={{ background: 'none', border: 'none', color: C.text, cursor: 'pointer', padding: 8, WebkitTapHighlightColor: 'transparent' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, flex: 1 }}>{companyProfile?.companyName || 'Vi-Di-Sef'}</div>
                    </div>
                )}
                {/* Breadcrumbs */}
                {!isMobile && page !== 'dashboard' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12, color: C.textMuted }}>
                        <button onClick={() => navigate('dashboard')} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}>Pregled</button>
                        <span style={{ opacity: 0.5 }}>›</span>
                        <span style={{ fontWeight: 600, color: C.text }}>{navItems.find(n => n.id === page)?.label || page}</span>
                        {pageHistory.length > 2 && (
                            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: C.textMuted }}>Nedavno:</span>
                                {pageHistory.slice(1, 4).map(p => {
                                    const item = navItems.find(n => n.id === p);
                                    return item ? <button key={p} onClick={() => navigate(p)} style={{ background: C.accentLight, border: 'none', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 600, color: C.accent, cursor: 'pointer' }}>{item.label}</button> : null;
                                })}
                            </span>
                        )}
                    </div>
                )}
                <Suspense fallback={<LazyFallback type={['timesheets', 'invoices', 'otpremnice', 'reports', 'arhiva', 'dailyLog', 'auditLog'].includes(page) ? 'table' : ['workers', 'projects', 'vehicles', 'smjestaj', 'obaveze'].includes(page) ? 'cards' : 'dashboard'} />}><PageErrorBoundary key={page} onGoHome={() => setPage('dashboard')}><div key={page} style={{ animation: 'fadeIn 0.3s ease, slideUp 0.3s ease' }}>{renderPage()}</div></PageErrorBoundary></Suspense>
            </main>
            {/* Dynamic Island */}
            {/* Dynamic Island — a11y live region */}
            <div role="status" aria-live="polite" aria-atomic="true">
                {island && (
                    <div className="dynamic-island">
                        <span style={{ fontSize: 18 }}>{island.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{island.text}</span>
                    </div>
                )}
            </div>
            {/* FAB (mobile only) */}
            {isMobile && (
                <>
                    <button className="fab" onClick={() => { haptic(); setShowFab(!showFab); }} aria-label="Brze akcije" aria-expanded={showFab} style={{ transform: showFab ? 'rotate(45deg)' : 'none' }}>+</button>
                    {showFab && (
                        <div className="fab-menu">
                            {[
                                { icon: '', label: 'Novi radni sat', page: 'timesheets' },
                                { icon: '', label: 'Novi projekt', page: 'projects' },
                                { icon: '', label: 'QR Skeniranje', page: 'qr-checkin' }
                            ].map((item, i) => (
                                <button key={i} className="fab-item" style={{ animationDelay: `${i * 0.05}s` }} onClick={() => { navigate(item.page); setShowFab(false); }}>
                                    <span>{item.icon}</span> {item.label}
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}
            {showSearch && <GlobalSearch navItems={navItems.filter(n => !n.separator)} workers={workers} projects={projects} onNavigate={navigate} onClose={() => setShowSearch(false)} />}
            {sessionWarning && (
                <div role="alert" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: 'rgba(239,68,68,0.95)', color: '#fff', padding: '12px 20px', textAlign: 'center', fontSize: 14, fontWeight: 600, backdropFilter: 'blur(8px)' }}>
                    Sesija istječe za 5 minuta — pomaknite miš ili dodirnite ekran za nastavak
                </div>
            )}
            {/* Offline Indicator */}
            {isOffline && (
                <div role="status" aria-live="polite" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9998, background: 'var(--yellow)', color: '#000', padding: '8px 20px', textAlign: 'center', fontSize: 13, fontWeight: 700, animation: 'slideDown 0.3s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    Offline — promjene čekaju sync
                </div>
            )}
            {/* Onboarding Tour — 10 Steps */}
            {showOnboarding && (() => {
                const STEPS = [
                    { icon: '👋', title: 'Dobro došli!', text: 'Vi-Di-Sef je vaš sveobuhvatni alat za upravljanje gradilištima, radnicima i cijelim poslovanjem. Provest ćemo vas kroz ključne module.' },
                    { icon: '🧭', title: 'Navigacija', text: 'Koristite bočnu traku za pristup svim modulima. Na mobitelu koristite donji tab bar i gumb "Više" za sve opcije.' },
                    { icon: '', title: 'Dashboard', text: 'Pregled vam daje ukupne statistike, grafove, analitiku projekata i financija — sve na jednom mjestu.' },
                    { icon: '⏱️', title: 'Radni sati', text: 'Radnici unose sate, vi ih odobravate. Sustav prati normalne, prekovremene, noćne i vikend sate automatski.' },
                    { icon: '📁', title: 'Projekti', text: 'Kreirajte projekte, dodajte GPS lokaciju za Weather i praćenje, dodijelite radnike i pratite napredak.' },
                    { icon: '🧾', title: 'Računi i otpremnice', text: 'Radnici fotografiraju račune, vi ih odobravate. Otpremnice pratite s količinama i statusom.' },
                    { icon: '📡', title: 'GPS Nadzor', text: 'Pratite lokacije radnika u stvarnom vremenu, geofencing zone oko gradilišta, i povijest kretanja.' },
                    { icon: '☁️', title: 'Vrijeme', text: 'Automatska prognoza za projekte s GPS lokacijom. Sustav ocjenjuje podobnost za rad na otvorenom.' },
                    { icon: '📈', title: 'Izvještaji i AI', text: 'Generirajte PDF/CSV izvještaje, koristite AI uvide za analizu troškova i optimizaciju resursa.' },
                    { icon: '⚡', title: 'Spremni ste!', text: 'Koristite ⌘K za brzu pretragu bilo čega. Dark mode i teme su u bočnoj traci. Ugodno korištenje! 🚀' },
                ];
                const step = STEPS[onboardingStep];
                const TOTAL = STEPS.length;
                return (
                    <div role="dialog" aria-modal="true" aria-label="Vodič za korištenje" style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.3s ease' }}>
                        <div style={{ background: 'var(--card-solid)', borderRadius: 20, padding: 28, maxWidth: 400, width: '92%', boxShadow: 'var(--shadow-xl)', animation: 'cardEntry 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
                            <div style={{ fontSize: 44, textAlign: 'center', marginBottom: 12 }}>{step.icon}</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', textAlign: 'center', marginBottom: 8 }}>{step.title}</div>
                            <div style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>{step.text}</div>
                            {/* Progress bar */}
                            <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginBottom: 16 }}>
                                {STEPS.map((_, i) => <div key={i} style={{ width: i === onboardingStep ? 20 : 6, height: 6, borderRadius: 3, background: i === onboardingStep ? 'var(--accent)' : i < onboardingStep ? 'var(--green)' : 'var(--divider)', transition: 'all 0.2s' }} />)}
                            </div>
                            {/* Step counter */}
                            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{onboardingStep + 1} / {TOTAL}</div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                {onboardingStep > 0 && (
                                    <button onClick={() => { haptic(); setOnboardingStep(onboardingStep - 1); }} style={{ ...styles.btn, background: 'var(--divider)', color: 'var(--text-muted)', borderRadius: 10, fontSize: 13 }}>← Natrag</button>
                                )}
                                <button onClick={() => { setShowOnboarding(false); localStorage.setItem('vidisef-onboarded', '1'); }} style={{ ...styles.btn, background: 'var(--divider)', color: 'var(--text-muted)', borderRadius: 10, fontSize: 13 }}>Preskoči</button>
                                <button onClick={() => {
                                    haptic();
                                    if (onboardingStep < TOTAL - 1) setOnboardingStep(onboardingStep + 1);
                                    else { setShowOnboarding(false); localStorage.setItem('vidisef-onboarded', '1'); }
                                }} style={{ ...styles.btn, background: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
                                    {onboardingStep < TOTAL - 1 ? 'Dalje →' : 'Kreni! 🚀'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
            <PwaInstallBanner />
            {
                notifPermission !== 'granted' && notifPermission !== 'denied' && (
                    <div style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 1000, background: C.sidebar, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px', maxWidth: 320, boxShadow: '0 8px 30px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 28 }}><Icon name="bell" size={28} /></div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Uključi obavijesti</div>
                            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>Primaj obavijesti na mobitel u stvarnom vremenu</div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={enableNotifications} style={{ ...styles.btn, fontSize: 12, padding: '6px 14px' }}>Aktiviraj</button>
                                <button onClick={() => setNotifPermission('denied')} style={{ ...styles.btnSecondary, fontSize: 12, padding: '6px 14px' }}>Ne sada</button>
                            </div>
                        </div>
                    </div>
                )
            }
            <Suspense fallback={null}><AiChatAgentLazy /></Suspense>

            {/* Mobile Bottom Tab Bar */}
            {isMobile && (
                <div className="bottom-tab-bar" role="tablist" aria-label="Glavna navigacija">
                    {[
                        { id: 'dashboard', icon: '', label: 'Pregled' },
                        { id: 'radni-sati', icon: '', label: 'Sati' },
                        { id: 'projekti', icon: '', label: 'Projekti' },
                        { id: 'obavijesti', icon: '', label: 'Obavijesti', badge: pendingCount },
                        { id: '__more__', icon: '⋯', label: 'Više' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            className={`tab-item ${(tab.id === '__more__' ? showMoreSheet : page === tab.id) ? 'active' : ''}`}
                            onClick={() => tab.id === '__more__' ? setShowMoreSheet(!showMoreSheet) : (navigate(tab.id), setShowMoreSheet(false))}
                            role="tab"
                            aria-selected={page === tab.id}
                            aria-label={tab.label}
                        >
                            <span className="tab-icon" style={{ position: 'relative' }}>
                                {tab.icon}
                                {tab.badge > 0 && <span style={{ position: 'absolute', top: -4, right: -8, background: 'var(--red)', color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 800, padding: '1px 5px', minWidth: 14, textAlign: 'center', animation: 'badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>{tab.badge}</span>}
                            </span>
                            <span>{tab.label}</span>
                            {page === tab.id && tab.id !== '__more__' && <span className="tab-dot" />}
                        </button>
                    ))}
                </div>
            )}

            {/* More Sheet (mobile) */}
            {showMoreSheet && isMobile && (
                <>
                    <div className="more-sheet-overlay" onClick={() => setShowMoreSheet(false)} aria-hidden="true" />
                    <div className="more-sheet" role="dialog" aria-modal="true" aria-label="Više opcija">
                        <div className="more-sheet-handle" />
                        {navItems.filter(n => !n.separator && !['dashboard', 'radni-sati', 'projekti', 'obavijesti'].includes(n.id)).map(item => (
                            <button
                                key={item.id}
                                className={`more-sheet-item ${page === item.id ? 'active' : ''}`}
                                onClick={() => { navigate(item.id); setShowMoreSheet(false); }}
                            >
                                <Icon name={item.icon} size={20} />
                                {item.label}
                                {item.badge > 0 && <span style={{ marginLeft: 'auto', background: 'var(--red)', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '2px 7px' }}>{item.badge}</span>}
                            </button>
                        ))}
                    </div>
                </>
            )}

            {/* GPS alert pulse animation */}
            <style>{`
                @keyframes pulse-alert {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.8; transform: scale(1.01); }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translate(-50%, 20px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
            `}</style>
            <UndoToast />
        </div >
    );
}
