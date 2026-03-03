import { useState, useEffect } from 'react';
import { C } from '../utils/helpers';

export function PwaInstallBanner() {
    const [show, setShow] = useState(false);
    const [isIos, setIsIos] = useState(false);
    const [showIosGuide, setShowIosGuide] = useState(false);

    useEffect(() => {
        // Already installed? Hide.
        if (window.matchMedia('(display-mode: standalone)').matches) return;
        if (window.navigator.standalone === true) return;

        // Dismissed recently? (7 days)
        const dismissed = localStorage.getItem('pwa-dismiss');
        if (dismissed && Date.now() - parseInt(dismissed) < 7 * 86400000) return;

        // iOS detection
        const ua = navigator.userAgent;
        const iosDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (iosDevice) {
            setIsIos(true);
            setTimeout(() => setShow(true), 3000);
            return;
        }

        // Android/Chrome: check if prompt was already captured in main.jsx
        if (window.__pwaPrompt) {
            setTimeout(() => setShow(true), 3000);
            return;
        }

        // Also listen in case it fires late
        const handler = (e) => {
            e.preventDefault();
            window.__pwaPrompt = e;
            setTimeout(() => setShow(true), 2000);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (isIos) { setShowIosGuide(true); return; }
        const prompt = window.__pwaPrompt;
        if (!prompt) return;
        prompt.prompt();
        const result = await prompt.userChoice;
        if (result.outcome === 'accepted') setShow(false);
        window.__pwaPrompt = null;
    };

    const handleDismiss = () => {
        setShow(false);
        localStorage.setItem('pwa-dismiss', Date.now().toString());
    };

    if (!show) return null;

    return (
        <>
            <div style={{
                position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                background: 'var(--card-solid)', color: 'var(--text)', borderRadius: 16, padding: '14px 20px',
                display: 'flex', alignItems: 'center', gap: 14, zIndex: 9999,
                boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)',
                maxWidth: 420, width: 'calc(100% - 32px)',
                animation: 'slideUp 0.3s ease-out'
            }}>
                <img src="/icon-192.png" alt="" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Instaliraj RAKUŠIĆ corporation</div>
                    <div className="u-fs-12" className="u-text-muted">
                        {isIos ? 'Operativni centar upravljanja — dodajte na početni ekran' : 'Operativni centar upravljanja — brži pristup i offline rad'}
                    </div>
                </div>
                <button onClick={handleInstall} style={{
                    background: C.accent, color: '#fff', border: 'none', borderRadius: 8,
                    padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
                }}>
                    {isIos ? 'Kako?' : 'Instaliraj'}
                </button>
                <button onClick={handleDismiss} style={{
                    background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer',
                    padding: 4, fontSize: 18, lineHeight: 1
                }}>✕</button>
            </div>

            {showIosGuide && (
                <div onClick={() => setShowIosGuide(false)} style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10000, padding: 20
                }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: C.card, borderRadius: 16, padding: 28, maxWidth: 340,
                        width: '100%', textAlign: 'center'
                    }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 16 }}>
                            Instaliraj na iPhone/iPad
                        </div>
                        <div style={{ textAlign: 'left', fontSize: 14, color: C.textDim, lineHeight: 1.8 }}>
                            <div style={{ marginBottom: 8 }}>
                                <strong>1.</strong> Kliknite <span style={{ fontSize: 18 }}>⬆️</span> (Share dugme) na dnu Safarija
                            </div>
                            <div style={{ marginBottom: 8 }}>
                                <strong>2.</strong> Skrolajte i odaberite <strong>"Add to Home Screen"</strong>
                            </div>
                            <div>
                                <strong>3.</strong> Kliknite <strong>"Add"</strong> — gotovo! 🎉
                            </div>
                        </div>
                        <button onClick={() => setShowIosGuide(false)} style={{
                            background: C.accent, color: '#fff', border: 'none', borderRadius: 8,
                            padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 20
                        }}>Razumijem</button>
                    </div>
                </div>
            )}
        </>
    );
}
