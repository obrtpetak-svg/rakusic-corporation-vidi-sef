import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ConfirmProvider } from './components/ui/ConfirmModal';
import { AppLogin } from './components/AppLogin';
import { FirebaseConfigScreen } from './components/FirebaseConfig';
import { CompanySetup } from './components/CompanySetup';
import { AdminCreateScreen } from './components/AdminCreate';
import { AuthScreen } from './components/UserLogin';
import { Layout } from './components/Layout';
import { CookieConsent, PrivacyPolicyPage } from './components/CookieConsent';
import { initTheme } from './utils/helpers';

function AppContent() {
    const { step } = useApp();

    // Initialize theme on mount
    useEffect(() => { initTheme(); }, []);

    if (step === 'loading') {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', transition: 'background 0.4s ease' }}>
                <div style={{ textAlign: 'center' }}>
                    <img src="/icon-192.png" alt="Rakušić Corporation" style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 16 }} />
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>RAKUŠIĆ corporation</div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>Učitavanje...</div>
                    <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '16px auto 0' }} />
                </div>
            </div>
        );
    }
    // Handle /privacy route
    if (window.location.pathname === '/privacy') {
        return <PrivacyPolicyPage />;
    }

    if (step === 'appLogin') return <><AppLogin /><CookieConsent /></>;
    if (step === 'firebaseConfig') return <FirebaseConfigScreen />;
    if (step === 'companySetup') return <CompanySetup />;
    if (step === 'adminCreate') return <AdminCreateScreen />;
    if (step === 'userLogin') return <AuthScreen />;
    return <><Layout /><CookieConsent /></>;
}

export default function App() {
    return (
        <AppProvider>
            <ConfirmProvider>
                <AppContent />
            </ConfirmProvider>
        </AppProvider>
    );
}
