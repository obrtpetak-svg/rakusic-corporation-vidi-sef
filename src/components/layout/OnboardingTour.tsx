import { useState } from 'react';
import { styles } from '../../utils/helpers';

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

export function OnboardingTour({ onComplete, haptic }: { onComplete: () => void; haptic: (ms?: number) => void }) {
    const [step, setStep] = useState(0);
    const current = STEPS[step];
    const TOTAL = STEPS.length;

    return (
        <div role="dialog" aria-modal="true" aria-label="Vodič za korištenje" style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ background: 'var(--card-solid)', borderRadius: 20, padding: 28, maxWidth: 400, width: '92%', boxShadow: 'var(--shadow-xl)', animation: 'cardEntry 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
                <div style={{ fontSize: 44, textAlign: 'center', marginBottom: 12 }}>{current.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', textAlign: 'center', marginBottom: 8 }}>{current.title}</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>{current.text}</div>
                {/* Progress bar */}
                <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginBottom: 16 }}>
                    {STEPS.map((_, i) => <div key={i} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 3, background: i === step ? 'var(--accent)' : i < step ? 'var(--green)' : 'var(--divider)', transition: 'all 0.2s' }} />)}
                </div>
                {/* Step counter */}
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{step + 1} / {TOTAL}</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {step > 0 && (
                        <button onClick={() => { haptic(); setStep(step - 1); }} className="s-btn" style={{ background: 'var(--divider)', color: 'var(--text-muted)', borderRadius: 10, fontSize: 13 }}>← Natrag</button>
                    )}
                    <button onClick={onComplete} className="s-btn" style={{ background: 'var(--divider)', color: 'var(--text-muted)', borderRadius: 10, fontSize: 13 }}>Preskoči</button>
                    <button onClick={() => {
                        haptic();
                        if (step < TOTAL - 1) setStep(step + 1);
                        else onComplete();
                    }} className="s-btn" style={{ background: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
                        {step < TOTAL - 1 ? 'Dalje →' : 'Kreni! 🚀'}
                    </button>
                </div>
            </div>
        </div>
    );
}
