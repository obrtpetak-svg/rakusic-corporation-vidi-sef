import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Icon, Field, Input } from './ui/SharedComponents';
import { C, styles } from '../utils/helpers';

export function CompanySetup() {
    const { handleCompanySetup } = useApp();
    const [data, setData] = useState({ companyName: '', address: '', oib: '', ownerName: '', contactPhone: '', contactEmail: '' });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const update = (k, v) => { setData(d => ({ ...d, [k]: v })); setError(''); };

    const submit = async () => {
        if (!data.companyName.trim()) { setError('Ime tvrtke je obavezno'); return; }
        if (!data.ownerName.trim()) { setError('Ime vlasnika je obavezno'); return; }
        if (data.oib && !/^\d{11}$/.test(data.oib)) { setError('OIB nije valjan (mora imati 11 znamenki)'); return; }
        if (data.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) { setError('Email adresa nije valjana'); return; }
        setSaving(true);
        const profile = { ...data, createdAt: new Date().toISOString(), id: 'company_' + Date.now() };
        try { await handleCompanySetup(profile); } catch (e) { setError('Greška pri spremanju.'); setSaving(false); }
    };

    return (
        <div style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 600 }}>
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <img src="/icon-192.png" alt="Rakušić Corporation" style={{ width: 80, height: 80, borderRadius: 20, marginBottom: 20 }} />
                    <div style={{ fontSize: 26, fontWeight: 900, color: C.text, letterSpacing: '0.02em' }}>RAKUŠIĆ corporation</div>
                    <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>Operativni centar upravljanja</div>
                    <div style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6 }}>Kreirajte profil vaše tvrtke za početak rada</div>
                </div>
                <div style={styles.card}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Icon name="project" size={20} /> Podaci o tvrtki
                    </div>
                    {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: C.red, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="warning" size={16} />{error}</div>}
                    <Field label="Naziv tvrtke" required><Input value={data.companyName} onChange={e => update('companyName', e.target.value)} placeholder="npr. Građevinska Kuća d.o.o." autoFocus /></Field>
                    <Field label="Adresa sjedišta"><Input value={data.address} onChange={e => update('address', e.target.value)} placeholder="Ulica i broj, Poštanski broj Grad" /></Field>
                    <Field label="OIB (Osobni identifikacijski broj)"><Input value={data.oib} onChange={e => update('oib', e.target.value.replace(/\D/g, ''))} placeholder="11 znamenki" maxLength={11} /></Field>
                    <Field label="Ime i prezime vlasnika / direktora" required><Input value={data.ownerName} onChange={e => update('ownerName', e.target.value)} placeholder="Ivan Horvat" /></Field>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Field label="Kontakt telefon"><Input value={data.contactPhone} onChange={e => update('contactPhone', e.target.value)} placeholder="+385 91 234 5678" /></Field>
                        <Field label="Kontakt email"><Input type="email" value={data.contactEmail} onChange={e => update('contactEmail', e.target.value)} placeholder="info@tvrtka.hr" /></Field>
                    </div>
                    <button onClick={submit} disabled={saving || !data.companyName.trim() || !data.ownerName.trim()} style={{ ...styles.btn, width: '100%', justifyContent: 'center', marginTop: 24, padding: '16px 24px', fontSize: 16, opacity: saving || !data.companyName.trim() || !data.ownerName.trim() ? 0.5 : 1 }}>
                        {saving ? 'Spremam...' : '🚀 Kreiraj profil i nastavi'}
                    </button>
                </div>
                <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 12, marginTop: 24, lineHeight: 1.7 }}>
                    Podaci o tvrtki će se koristiti u izvještajima i dokumentima.<br />
                    Za pomoć kontaktirajte <a href="mailto:info@vi-di.me" style={{ color: C.accent, textDecoration: 'none' }}>info@vi-di.me</a>
                </div>
            </div>
        </div>
    );
}
