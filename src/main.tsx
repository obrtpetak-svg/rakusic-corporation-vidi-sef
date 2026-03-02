import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Capture PWA install prompt BEFORE React renders (event fires early!)
window.__pwaPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__pwaPrompt = e;
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)

// Register Service Worker for PWA with update detection
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            // Check for SW updates every 60 seconds
            setInterval(() => reg.update(), 60000);

            // When a new SW is waiting, activate it immediately
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[SW] New version available — activating...');
                        newWorker.postMessage({ type: 'SKIP_WAITING' });
                    }
                });
            });
        }).catch(() => { });

        // Handle SW messages (background sync triggers)
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data?.type === 'FLUSH_GPS_QUEUE') {
                // Trigger GPS queue flush from SyncQueue
                window.dispatchEvent(new CustomEvent('gps-sync-flush'));
            }
        });
    });
}


