import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp, add as addDoc, update as updateDoc } from '../context/AppContext';
import { Icon, Input, useIsMobile } from './ui/SharedComponents';
import { C, styles, genId, today, nowTime } from '../utils/helpers';

// ══════════════════════════════════════════════════════════════════════════
// QR CHECK-IN — Worker scanner for check-in/check-out via QR codes
// ══════════════════════════════════════════════════════════════════════════

export function QrCheckIn() {
    const { currentUser, projects, timesheets } = useApp();
    const [scanning, setScanning] = useState(false);
    const [manualCode, setManualCode] = useState('');
    const [result, setResult] = useState<any>(null);
    const [gpsLocation, setGpsLocation] = useState('');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const isMobile = useIsMobile();
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const userId = currentUser?.workerId || currentUser?.id;

    const activeCheckin = useMemo(() => {
        const todayStr = today();
        return timesheets.find((t: any) =>
            t.workerId === userId &&
            t.date === todayStr &&
            t.source === 'qr-checkin' &&
            !t.endTime
        );
    }, [timesheets, userId]);

    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => setGpsLocation(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
            () => { },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, []);

    const startScan = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
            });
            streamRef.current = stream;
            setScanning(true);
            if ('BarcodeDetector' in window) {
                const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
                const interval = setInterval(async () => {
                    if (videoRef.current && videoRef.current.readyState >= 2) {
                        try {
                            const barcodes = await detector.detect(videoRef.current);
                            if (barcodes.length > 0) { clearInterval(interval); handleScanResult(barcodes[0].rawValue); }
                        } catch (e) { }
                    }
                }, 300);
                return () => clearInterval(interval);
            }
        } catch (err: any) { alert('Kamera nije dostupna: ' + err.message); }
    };

    const stopScan = () => {
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        setScanning(false);
    };

    useEffect(() => {
        if (scanning && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch(() => { });
        }
    }, [scanning]);

    useEffect(() => () => stopScan(), []);

    const handleScanResult = (code: string) => {
        stopScan();
        if (code?.startsWith('VIDISEF:')) {
            const projectId = code.replace('VIDISEF:', '');
            const project = projects.find((p: any) => p.id === projectId);
            if (project) setResult({ projectId, projectName: project.name, location: project.location });
            else setResult({ error: 'Projekt nije pronađen' });
        } else { setResult({ error: 'Nevaljan QR kod' }); }
    };

    const handleManualSubmit = () => { if (manualCode.trim()) handleScanResult(manualCode.trim()); };

    const clockIn = async () => {
        if (!result?.projectId) return;
        setSaving(true);
        await addDoc('timesheets', {
            id: genId(), workerId: userId, projectId: result.projectId, date: today(),
            startTime: nowTime(), endTime: '', breakMins: 0, description: 'QR Check-in',
            type: 'normalan', gpsLocation, status: 'na čekanju', source: 'qr-checkin',
            createdAt: new Date().toISOString(), createdBy: currentUser?.name, editLog: [],
        });
        setSaving(false);
        setSuccess('✅ Check-in uspješan! Sati se broje...');
        setResult(null);
    };

    const clockOut = async () => {
        if (!activeCheckin) return;
        setSaving(true);
        await updateDoc('timesheets', activeCheckin.id, {
            endTime: nowTime(), gpsLocationEnd: gpsLocation, updatedAt: new Date().toISOString(),
        });
        setSaving(false);
        setSuccess('✅ Check-out! Smjena zabilježena.');
    };

    return (
        <div style={{ maxWidth: 500, margin: '0 auto' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 24 }}>📷 QR Check-in</div>
            {success && (
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, color: C.green, fontWeight: 600, fontSize: 14 }}>{success}</div>
            )}
            {activeCheckin && (
                <div style={{ ...styles.card, background: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.3)', marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>🟢 Smjena aktivna</div>
                            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                                Od: {activeCheckin.startTime} • {projects.find((p: any) => p.id === activeCheckin.projectId)?.name || '—'}
                            </div>
                        </div>
                        <button onClick={clockOut} disabled={saving} style={{ ...styles.btn, background: C.red }}>
                            <Icon name="clock" size={16} /> Check-out
                        </button>
                    </div>
                </div>
            )}
            {!activeCheckin && (
                <div style={styles.card}>
                    {scanning ? (
                        <div>
                            <video ref={videoRef} style={{ width: '100%', borderRadius: 10, marginBottom: 12, background: '#000' }} autoPlay playsInline muted />
                            <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', marginBottom: 12 }}>📸 Usmjerite kameru prema QR kodu na gradilištu</div>
                            <button onClick={stopScan} style={{ ...styles.btnSecondary, width: '100%', justifyContent: 'center' }}>✕ Zatvori kameru</button>
                        </div>
                    ) : (
                        <div>
                            <button onClick={startScan} style={{ ...styles.btn, width: '100%', justifyContent: 'center', padding: '18px 24px', fontSize: 16, marginBottom: 16 }}>📷 Skeniraj QR kod</button>
                            <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', marginBottom: 16 }}>ili unesite kod ručno</div>
                            <div className="u-flex-gap-8">
                                <Input value={manualCode} onChange={e => setManualCode(e.target.value)} placeholder="VIDISEF:project-id" className="u-flex-1" onKeyDown={e => e.key === 'Enter' && handleManualSubmit()} />
                                <button onClick={handleManualSubmit} disabled={!manualCode.trim()} style={styles.btn}><Icon name="check" size={16} /></button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {result && !result.error && (
                <div style={{ ...styles.card, marginTop: 16, background: 'rgba(249,115,22,0.06)', borderColor: 'rgba(249,115,22,0.3)' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>📍 {result.projectName}</div>
                    {result.location && <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>{result.location}</div>}
                    {gpsLocation && <div style={{ fontSize: 11, color: C.green, marginBottom: 12 }}>✅ GPS: {gpsLocation}</div>}
                    <button onClick={clockIn} disabled={saving} style={{ ...styles.btn, width: '100%', justifyContent: 'center', padding: '16px 24px', fontSize: 16 }}>
                        {saving ? 'Šaljem...' : '🟢 Check-in — Počni smjenu'}
                    </button>
                </div>
            )}
            {result?.error && (
                <div style={{ ...styles.card, marginTop: 16, background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.3)' }}>
                    <div style={{ color: C.red, fontWeight: 600 }}>❌ {result.error}</div>
                </div>
            )}
            <div style={{ textAlign: 'center', fontSize: 11, color: C.textMuted, marginTop: 16 }}>
                {gpsLocation ? `📍 GPS: ${gpsLocation}` : '📡 Tražim GPS lokaciju...'}
            </div>
        </div>
    );
}
