import { useState, useEffect } from 'react';
import { C, styles } from '../utils/helpers';

const CONSENT_KEY = 'vidisef-cookie-consent';

export function CookieConsent() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem(CONSENT_KEY);
        if (!consent) {
            // Delay showing to avoid flash
            const t = setTimeout(() => setShow(true), 1500);
            return () => clearTimeout(t);
        }
    }, []);

    const accept = () => {
        localStorage.setItem(CONSENT_KEY, 'accepted');
        setShow(false);
    };

    const decline = () => {
        localStorage.setItem(CONSENT_KEY, 'declined');
        setShow(false);
    };

    if (!show) return null;

    return (
        <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: 'var(--card-solid, #1E293B)',
            borderTop: '1px solid var(--border, #334155)',
            padding: '16px 20px',
            zIndex: 10000,
            animation: 'slideUp 0.3s ease',
        }}>
            <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>🍪 Kolačići i privatnost</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        Koristimo kolačiće za funkcioniranje aplikacije (Firebase Auth sesija, tema, postavke).
                        Ne koristimo kolačiće za praćenje ili oglašavanje.
                        <button onClick={() => window.open('/privacy', '_blank')} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0, marginLeft: 4 }}>
                            Pravila privatnosti →
                        </button>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={decline} style={{ ...styles.btnSecondary, padding: '8px 16px', fontSize: 13 }}>
                        Odbij
                    </button>
                    <button onClick={accept} style={{ ...styles.btn, padding: '8px 16px', fontSize: 13 }}>
                        ✓ Prihvaćam
                    </button>
                </div>
            </div>
        </div>
    );
}

export function PrivacyPolicyPage() {
    return (
        <div style={{ ...styles.page, padding: '40px 20px', maxWidth: 800, margin: '0 auto' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>Pravila privatnosti</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>Posljednje ažuriranje: {new Date().toLocaleDateString('hr-HR')}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <Section title="1. Voditelj obrade podataka">
                    <p>RAKUŠIĆ corporation d.o.o. ("mi", "naš") je voditelj obrade vaših osobnih podataka u aplikaciji Vi-Di-Sef.</p>
                    <p>Kontakt: <a href="mailto:info@vi-di.me" style={{ color: C.accent }}>info@vi-di.me</a></p>
                </Section>

                <Section title="2. Koje podatke prikupljamo">
                    <ul>
                        <li><strong>Identifikacijski podaci:</strong> Ime, prezime, korisničko ime, email adresa</li>
                        <li><strong>Podaci o prisutnosti:</strong> Evidencija radnih sati, lokacija rada</li>
                        <li><strong>Projektni podaci:</strong> Dodjeljivanje projekata, dnevni izvještaji</li>
                        <li><strong>Tehnički podaci:</strong> IP adresa, User Agent (samo za sigurnosni audit)</li>
                    </ul>
                </Section>

                <Section title="3. Pravna osnova obrade">
                    <p>Podatke obrađujemo na temelju:</p>
                    <ul>
                        <li>Izvršenja ugovora o radu (čl. 6. st. 1. t. b GDPR)</li>
                        <li>Legitimnog interesa za sigurnost sustava (čl. 6. st. 1. t. f GDPR)</li>
                    </ul>
                </Section>

                <Section title="4. Kolačići">
                    <p>Koristimo samo <strong>nužne kolačiće</strong> za funkcioniranje aplikacije:</p>
                    <ul>
                        <li><strong>Firebase Auth sesija</strong> — održavanje prijave</li>
                        <li><strong>Tema (tamna/svijetla)</strong> — postavke prikaza</li>
                        <li><strong>localStorage</strong> — konfiguracija aplikacije</li>
                    </ul>
                    <p>Ne koristimo kolačiće za praćenje, analitiku niti oglašavanje.</p>
                </Section>

                <Section title="5. Dijeljenje podataka">
                    <p>Vaši podaci se pohranjuju na Google Firebase (EU regija) i ne dijele se s trećim stranama osim:</p>
                    <ul>
                        <li><strong>Firebase/Google Cloud</strong> — hosting i pohrana podataka (EU)</li>
                        <li><strong>Vercel</strong> — hosting web aplikacije</li>
                    </ul>
                </Section>

                <Section title="6. Vaša prava (GDPR)">
                    <ul>
                        <li>✅ <strong>Pristup</strong> — možete preuzeti svoje podatke (Postavke → Preuzmi moje podatke)</li>
                        <li>✅ <strong>Ispravak</strong> — kontaktirajte administratora za ispravke</li>
                        <li>✅ <strong>Brisanje</strong> — pravo na zaborav (kontaktirajte voditelja)</li>
                        <li>✅ <strong>Prenosivost</strong> — izvoz podataka u JSON formatu</li>
                        <li>✅ <strong>Prigovor</strong> — kontaktirajte nas na info@vi-di.me</li>
                    </ul>
                </Section>

                <Section title="7. Sigurnost podataka">
                    <ul>
                        <li>🔒 Firebase Authentication (enkripcija lozinki)</li>
                        <li>🔒 Firestore Security Rules (role-based pristup)</li>
                        <li>🔒 HTTPS enkripcija (TLS 1.3)</li>
                        <li>🔒 Content Security Policy (CSP)</li>
                        <li>🔒 HSTS, X-Frame-Options, XSS Protection</li>
                        <li>🔒 Audit log svih pristupa</li>
                    </ul>
                </Section>

                <Section title="8. Zadržavanje podataka">
                    <p>Osobni podaci se čuvaju dok je aktivan radni odnos. Nakon prestanka, podaci se brišu u roku od 30 dana osim ako zakon nalaže duže čuvanje.</p>
                </Section>

                <Section title="9. Kontakt">
                    <p>Za sva pitanja vezana uz privatnost: <a href="mailto:info@vi-di.me" style={{ color: C.accent }}>info@vi-di.me</a></p>
                </Section>
            </div>

            <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-muted)', fontSize: 12 }}>
                © {new Date().getFullYear()} RAKUŠIĆ corporation · powered by <a href="https://vi-di-sef.com" style={{ color: C.accent, textDecoration: 'none' }}>Vi-Di-Sef</a>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ background: 'var(--card)', border: '1px solid var(--glass-border)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{title}</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{children}</div>
        </div>
    );
}
