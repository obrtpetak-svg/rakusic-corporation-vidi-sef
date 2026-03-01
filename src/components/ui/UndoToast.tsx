import React, { useState, useEffect, useRef } from 'react';
import { restoreItem, getLastDeleted } from '../../context/AppContext';

const COLLECTION_NAMES = {
    workers: 'Radnik', projects: 'Projekt', timesheets: 'Radni sat',
    invoices: 'Račun', vehicles: 'Vozilo', smjestaj: 'Smještaj',
    obaveze: 'Obaveza', otpremnice: 'Otpremnica',
};

export function UndoToast() {
    const [visible, setVisible] = useState(false);
    const [info, setInfo] = useState(null);
    const [progress, setProgress] = useState(100);
    const timerRef = useRef(null);
    const intervalRef = useRef(null);

    // Poll for new deletions
    useEffect(() => {
        const check = setInterval(() => {
            const last = getLastDeleted();
            if (last && (!info || info.id !== last.id || info.deletedAt !== last.deletedAt)) {
                setInfo(last);
                setVisible(true);
                setProgress(100);

                // Clear previous timers
                if (timerRef.current) clearTimeout(timerRef.current);
                if (intervalRef.current) clearInterval(intervalRef.current);

                // 5 second countdown
                const start = Date.now();
                intervalRef.current = setInterval(() => {
                    const elapsed = Date.now() - start;
                    setProgress(Math.max(0, 100 - (elapsed / 50))); // 5000ms = 100%
                }, 50);

                timerRef.current = setTimeout(() => {
                    setVisible(false);
                    if (intervalRef.current) clearInterval(intervalRef.current);
                }, 5000);
            }
        }, 200);
        return () => clearInterval(check);
    }, [info]);

    const handleUndo = async () => {
        if (!info) return;
        try {
            await restoreItem(info.collection, info.id);
            setVisible(false);
            if (timerRef.current) clearTimeout(timerRef.current);
            if (intervalRef.current) clearInterval(intervalRef.current);
        } catch (e) {
            console.error('Undo failed:', e);
        }
    };

    const handleDismiss = () => {
        setVisible(false);
        if (timerRef.current) clearTimeout(timerRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
    };

    if (!visible || !info) return null;

    const label = COLLECTION_NAMES[info.collection] || info.collection;

    return (
        <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: '#1a1a2e', color: '#fff', borderRadius: 12, padding: '12px 20px',
            display: 'flex', alignItems: 'center', gap: 14, zIndex: 10000,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)', minWidth: 280,
            animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
            overflow: 'hidden',
        }}>
            {/* Progress bar */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, height: 3,
                background: 'var(--accent)', width: `${progress}%`,
                transition: 'width 0.05s linear', borderRadius: '0 0 12px 12px',
            }} />
            <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>
                🗑️ {label} obrisan/a
            </span>
            <button onClick={handleUndo} style={{
                background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 8, padding: '6px 16px', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
                ↩ Poništi
            </button>
            <button onClick={handleDismiss} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer', padding: 4, fontSize: 16, lineHeight: 1,
            }}>✕</button>
        </div>
    );
}
