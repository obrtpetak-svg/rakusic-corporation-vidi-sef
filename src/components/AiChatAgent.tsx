import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { C, styles, diffMins, fmtDate, isDarkTheme } from '../utils/helpers';
import { useIsMobile } from './ui/SharedComponents';

// Build context from app data for the AI
function buildDataContext({ projects, workers, timesheets, invoices, otpremnice, vehicles, smjestaj, obaveze, companyProfile }) {
    const lines = [];
    const company = companyProfile?.companyName || 'Vi-Di-Sef';
    lines.push(`TVRTKA: ${company} | OIB: ${companyProfile?.oib || '—'} | Adresa: ${companyProfile?.address || '—'}, ${companyProfile?.city || '—'}`);
    lines.push('');

    const wName = (id) => workers.find(w => w.id === id)?.name || id;
    const pName = (id) => projects.find(p => p.id === id)?.name || id;
    const calcHours = (t) => (t.durationMins || diffMins(t.startTime, t.endTime)) / 60;

    // Workers summary
    lines.push(`RADNICI (${workers.length}):`);
    workers.forEach(w => {
        const wTs = timesheets.filter(t => t.workerId === w.id);
        const totalH = wTs.reduce((s, t) => s + calcHours(t), 0);
        const projs = [...new Set(wTs.map(t => t.projectId))].map(pid => pName(pid));
        lines.push(`  • ${w.name} | Uloga: ${w.role || 'radnik'} | Satnica: ${w.hourlyRate || '—'}€/h | Status: ${w.status || 'aktivan'} | Tel: ${w.phone || '—'} | Ukupno sati: ${totalH.toFixed(1)}h | Projekti: ${projs.length > 0 ? projs.join(', ') : 'nema'}`);
    });
    lines.push('');

    // Projects summary
    lines.push(`PROJEKTI (${projects.length}):`);
    projects.forEach(p => {
        const pTs = timesheets.filter(t => t.projectId === p.id);
        const totalH = pTs.reduce((s, t) => s + calcHours(t), 0);
        const workerIds = [...new Set(pTs.map(t => t.workerId))];
        lines.push(`  • ${p.name} | Lokacija: ${p.location || '—'} | Status: ${p.status || 'aktivan'} | Klijent: ${p.client || '—'} | Budget: ${p.budget || '—'}€ | Ukupno sati: ${totalH.toFixed(1)}h | Radnici (${workerIds.length}): ${workerIds.map(id => wName(id)).join(', ') || 'nema'}`);
    });
    lines.push('');

    // Timesheets — last 60 days, detailed
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const recentTS = timesheets.filter(t => t.date >= cutoff.toISOString().slice(0, 10));
    lines.push(`EVIDENCIJA SATI (zadnjih 60 dana, ${recentTS.length} zapisa):`);

    // Group by worker with project breakdown
    const byWorker = {};
    recentTS.forEach(t => {
        const name = wName(t.workerId);
        if (!byWorker[name]) byWorker[name] = { total: 0, entries: 0, projects: {}, types: {} };
        const h = calcHours(t);
        byWorker[name].total += h;
        byWorker[name].entries++;
        const proj = pName(t.projectId);
        byWorker[name].projects[proj] = (byWorker[name].projects[proj] || 0) + h;
        const type = t.type || 'normalan';
        byWorker[name].types[type] = (byWorker[name].types[type] || 0) + h;
    });
    Object.entries(byWorker).forEach(([name, d]) => {
        const projDetail = Object.entries(d.projects).map(([p, h]) => `${p}: ${h.toFixed(1)}h`).join(', ');
        const typeDetail = Object.entries(d.types).map(([t, h]) => `${t}: ${h.toFixed(1)}h`).join(', ');
        lines.push(`  • ${name}: ${d.total.toFixed(1)}h (${d.entries} zapisa) | Projekti: ${projDetail} | Tipovi: ${typeDetail}`);
    });

    // Last 20 individual entries
    const last20 = [...recentTS].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 20);
    if (last20.length > 0) {
        lines.push('  Zadnjih 20 unosa:');
        last20.forEach(t => {
            const h = calcHours(t).toFixed(1);
            lines.push(`    ${t.date} | ${wName(t.workerId)} | ${pName(t.projectId)} | ${t.startTime || '—'}–${t.endTime || '—'} (${h}h) | Tip: ${t.type || 'normalan'} | ${t.note || ''}`);
        });
    }
    lines.push('');

    // Invoices
    lines.push(`RAČUNI (${invoices.length}):`);
    const totalInv = invoices.reduce((s, i) => s + (parseFloat(i.total) || parseFloat(i.amount) || 0), 0);
    const paidInv = invoices.filter(i => i.status === 'plaćen' || i.status === 'paid').length;
    lines.push(`  Ukupno: ${totalInv.toFixed(2)}€ | Plaćeni: ${paidInv}/${invoices.length}`);
    invoices.slice(-15).forEach(i => {
        const worker = wName(i.workerId);
        const project = pName(i.projectId);
        lines.push(`  • #${i.invoiceNumber || i.id?.slice(0, 6)} | Radnik: ${worker} | Projekt: ${project} | ${i.total || i.amount || 0}€ | Status: ${i.status || '—'} | Datum: ${i.date || '—'} | Opis: ${i.description || '—'}`);
    });
    lines.push('');

    // Otpremnice
    lines.push(`OTPREMNICE (${otpremnice.length}):`);
    otpremnice.slice(-15).forEach(o => {
        const proj = pName(o.projectId);
        lines.push(`  • #${o.deliveryNumber || o.number || o.id?.slice(0, 6)} | Projekt: ${proj} | Dobavljač: ${o.supplier || '—'} | Iznos: ${o.amount || '—'}€ | Stavke: ${o.items?.length || 0} | Status: ${o.status || '—'} | Datum: ${o.date || '—'}`);
    });
    lines.push('');

    // Vehicles
    lines.push(`VOZILA (${vehicles.length}):`);
    vehicles.forEach(v => {
        const logs = v.fuelLogs || [];
        const totalFuel = logs.reduce((s, f) => s + (parseFloat(f.totalCost) || 0), 0);
        const totalLiters = logs.reduce((s, f) => s + (parseFloat(f.liters) || 0), 0);
        lines.push(`  • ${v.name || '—'} | Reg: ${v.regNumber || '—'} | ${v.brand || ''} ${v.model || ''} | Gorivo: ${v.fuelType || '—'} | Km: ${v.currentKm || '—'} | Dodijeljeno: ${wName(v.assignedWorker)} | Tankanja: ${logs.length} | Gorivo ukupno: ${totalFuel.toFixed(2)}€ (${totalLiters.toFixed(0)}L)`);
    });
    lines.push('');

    // Accommodation
    lines.push(`SMJEŠTAJ (${(smjestaj || []).length}):`);
    (smjestaj || []).forEach(s => {
        const residents = (s.residents || []).map(r => wName(r.workerId || r)).join(', ');
        lines.push(`  • ${s.name || s.address || '—'} | Adresa: ${s.address || '—'} | Kapacitet: ${s.capacity || '—'} | Cijena: ${s.price || '—'}€ | Stanari (${(s.residents || []).length}): ${residents || 'nema'}`);
    });
    lines.push('');

    // Obligations
    const activeObaveze = (obaveze || []).filter(o => o.status !== 'completed' && o.status !== 'završeno');
    lines.push(`OBAVEZE (${(obaveze || []).length}, aktivne: ${activeObaveze.length}):`);
    activeObaveze.slice(0, 15).forEach(o => {
        lines.push(`  • ${o.title || o.description || '—'} | Rok: ${o.deadline || '—'} | Prioritet: ${o.priority || '—'} | Status: ${o.status || '—'} | Dodijeljeno: ${o.assignedTo ? wName(o.assignedTo) : '—'}`);
    });

    return lines.join('\n');
}

const SYSTEM_PROMPT = `Ti si Vi-Di-Sef AI asistent — pametni pomoćnik za upravljanje gradilištem.
Odgovaraš ISKLJUČIVO na hrvatskom jeziku.
Imaš pristup svim podacima tvrtke (radnici, projekti, sati, računi, otpremnice, vozila, smještaj, obaveze).

Tvoje sposobnosti:
- Odgovaraš na pitanja o radnicima, projektima, satima, financijama
- Izračunavaš statistike (ukupni sati, troškovi, prosjeci)
- Daješ preporuke i upozorenja
- Pratiš rokove i obaveze
- Sve iznosiš TOČNO prema podacima

Pravila:
- Budi koncizan i precizan
- Koristi emoji za preglednost
- Ako nemaš podatak, reci to jasno
- Iznosi su u EUR (€)
- Datumi u HR formatu (dd.mm.yyyy.)
- Ako te pitaju nešto izvan domene upravljanja gradilištem, ljubazno preusmjeri na relevantnu temu`;

export function AiChatAgent() {
    const { projects, workers, timesheets, invoices, otpremnice, vehicles, smjestaj, obaveze, companyProfile } = useApp();
    const isMobile = useIsMobile();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: '👋 Bok! Ja sam Vi-Di-Sef AI asistent. Pitaj me o radnicima, projektima, satima, računima — bilo čemu iz tvoje baze podataka!' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [provider, setProvider] = useState(localStorage.getItem('ai-provider') || 'openai');
    const [showSettings, setShowSettings] = useState(false);
    const chatEndRef = useRef(null);
    const inputRef = useRef(null);

    const apiKey = localStorage.getItem('ai-api-key') || '';

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (open && inputRef.current) inputRef.current.focus();
    }, [open]);

    const saveSettings = (key, prov) => {
        localStorage.setItem('ai-api-key', key);
        localStorage.setItem('ai-provider', prov);
        setProvider(prov);
        setShowSettings(false);
    };

    const sendMessage = async () => {
        if (!input.trim() || loading) return;

        const key = localStorage.getItem('ai-api-key');
        if (!key) { setShowSettings(true); return; }

        const userMsg = { role: 'user', content: input.trim() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const dataContext = buildDataContext({ projects, workers, timesheets, invoices, otpremnice, vehicles, smjestaj, obaveze, companyProfile });
            const systemMsg = { role: 'system', content: `${SYSTEM_PROMPT}\n\n--- PODACI TVRTKE ---\n${dataContext}` };

            // Keep last 10 messages for context window
            const chatHistory = messages.slice(-10).filter(m => m.role !== 'system');

            const prov = localStorage.getItem('ai-provider') || 'openai';
            let response;

            if (prov === 'anthropic') {
                // Claude API
                try {
                    response = await fetch('https://api.anthropic.com/v1/messages', {
                        method: 'POST',
                        headers: {
                            'x-api-key': key,
                            'anthropic-version': '2023-06-01',
                            'anthropic-dangerous-direct-browser-access': 'true',
                            'content-type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: 'claude-3-haiku-20240307',
                            max_tokens: 1024,
                            system: systemMsg.content,
                            messages: [...chatHistory, userMsg].map(m => ({ role: m.role, content: m.content }))
                        })
                    });
                } catch (fetchErr) {
                    // CORS blocked — fallback to OpenAI suggestion
                    throw new Error('Claude API ne dopušta pozive iz browsera. Prebaci na OpenAI u postavkama (⚙️).');
                }
                const data = await response.json();
                if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
                setMessages(prev => [...prev, { role: 'assistant', content: data.content[0].text }]);
            } else {
                // OpenAI API
                response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${key}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [systemMsg, ...chatHistory, userMsg],
                        max_tokens: 1024,
                        temperature: 0.3
                    })
                });
                const data = await response.json();
                if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
                setMessages(prev => [...prev, { role: 'assistant', content: data.choices[0].message.content }]);
            }
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: `❌ Greška: ${err.message}` }]);
        }
        setLoading(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    // Settings mini-form
    if (showSettings) {
        return <SettingsForm onSave={saveSettings} onClose={() => setShowSettings(false)} currentKey={apiKey} currentProvider={provider} />;
    }

    return (
        <>
            {/* Floating chat button */}
            {!open && (
                <button onClick={() => setOpen(true)} style={{
                    position: 'fixed', bottom: isMobile ? 72 : 24, right: isMobile ? 12 : 24,
                    width: 56, height: 56,
                    borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                    color: 'var(--text-on-accent)', border: 'none', cursor: 'pointer', fontSize: 24,
                    boxShadow: 'var(--shadow-lg)', zIndex: 9998,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'transform 0.2s', animation: 'breathe 3s ease-in-out infinite'
                }}
                    onMouseEnter={e => e.target.style.transform = 'scale(1.1)'}
                    onMouseLeave={e => e.target.style.transform = 'scale(1)'}>
                    🤖
                </button>
            )}

            {/* Chat window */}
            {open && (
                <div style={{
                    position: 'fixed', bottom: isMobile ? 72 : 24, right: isMobile ? 12 : 24,
                    width: Math.min(400, window.innerWidth - (isMobile ? 24 : 48)),
                    height: Math.min(560, window.innerHeight - (isMobile ? 96 : 48)),
                    background: 'var(--card-solid)',
                    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 20, zIndex: 9998,
                    boxShadow: 'var(--shadow-xl)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    animation: 'modalEntry 0.3s cubic-bezier(0.34,1.56,0.64,1)'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '14px 16px',
                        background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                        color: 'var(--text-on-accent)', display: 'flex', alignItems: 'center', gap: 10
                    }}>
                        <span style={{ fontSize: 22 }}>🤖</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>Vi-Di-Sef AI</div>
                            <div style={{ fontSize: 11, opacity: 0.8 }}>Pametni asistent za gradilište</div>
                        </div>
                        <button onClick={() => setShowSettings(true)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'inherit', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>⚙️</button>
                        <button onClick={() => setMessages([messages[0]])} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'inherit', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>🗑️</button>
                        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 20, padding: 4 }}>✕</button>
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg)' }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '85%'
                            }}>
                                <div style={{
                                    background: msg.role === 'user' ? 'var(--accent)' : 'var(--card)',
                                    color: msg.role === 'user' ? 'var(--text-on-accent)' : 'var(--text)',
                                    padding: '10px 14px', borderRadius: 14,
                                    borderBottomRightRadius: msg.role === 'user' ? 4 : 14,
                                    borderBottomLeftRadius: msg.role === 'user' ? 14 : 4,
                                    fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    border: msg.role === 'user' ? 'none' : '1px solid var(--glass-border)',
                                    boxShadow: 'var(--shadow-xs)'
                                }}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                                <div style={{ background: 'var(--card)', border: '1px solid var(--glass-border)', padding: '10px 14px', borderRadius: 14, borderBottomLeftRadius: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                                    <span style={{ animation: 'pulse 1.5s infinite' }}>Razmišljam...</span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input */}
                    <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, background: 'var(--card-solid)' }}>
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Pitaj o radnicima, projektima, satima..."
                            style={{
                                flex: 1, padding: '10px 14px',
                                border: '1.5px solid var(--input-border)',
                                borderRadius: 12, fontSize: 14, outline: 'none',
                                fontFamily: 'inherit',
                                background: 'var(--input-bg)', color: 'var(--text)',
                                transition: 'border-color 0.15s'
                            }}
                        />
                        <button onClick={sendMessage} disabled={loading || !input.trim()} style={{
                            background: 'var(--accent)', color: 'var(--text-on-accent)',
                            border: 'none', borderRadius: 12,
                            padding: '10px 16px', cursor: 'pointer', fontSize: 16,
                            opacity: (loading || !input.trim()) ? 0.5 : 1,
                            transition: 'opacity 0.15s'
                        }}>➤</button>
                    </div>

                    {/* No API key notice */}
                    {!apiKey && (
                        <div onClick={() => setShowSettings(true)} style={{
                            padding: '8px 12px', background: 'var(--yellow-light)',
                            cursor: 'pointer', fontSize: 12, color: 'var(--yellow)',
                            textAlign: 'center', fontWeight: 600
                        }}>
                            ⚠️ Klikni za unos API ključa (OpenAI ili Claude)
                        </div>
                    )}
                </div>
            )}

        </>
    );
}

// Settings mini-form component
function SettingsForm({ onSave, onClose, currentKey, currentProvider }) {
    const [key, setKey] = useState(currentKey);
    const [prov, setProv] = useState(currentProvider);

    return (
        <div style={{
            position: 'fixed', bottom: 24, right: 24,
            width: Math.min(380, window.innerWidth - 32),
            background: 'var(--card-solid)',
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid var(--glass-border)',
            borderRadius: 20, zIndex: 9998,
            boxShadow: 'var(--shadow-xl)', padding: 24,
            animation: 'modalEntry 0.3s cubic-bezier(0.34,1.56,0.64,1)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>🤖 AI Postavke</div>
                <button onClick={onClose} style={{ background: 'var(--divider)', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--text-muted)', borderRadius: 8, padding: '4px 8px' }}>✕</button>
            </div>

            <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Provider</div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {[['openai', '🟢 OpenAI (GPT-4o-mini)'], ['anthropic', '🟣 Claude (Haiku)']].map(([val, label]) => (
                        <button key={val} onClick={() => setProv(val)} style={{
                            flex: 1, padding: '10px 12px', borderRadius: 10,
                            border: `2px solid ${prov === val ? 'var(--accent)' : 'var(--border)'}`,
                            background: prov === val ? 'var(--accent-light)' : 'var(--card)',
                            cursor: 'pointer', fontSize: 12, fontWeight: 600,
                            color: prov === val ? 'var(--accent)' : 'var(--text-secondary)',
                            fontFamily: 'inherit', transition: 'all 0.15s'
                        }}>{label}</button>
                    ))}
                </div>
            </div>

            <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>API Ključ</div>
                <input
                    value={key}
                    onChange={e => setKey(e.target.value)}
                    placeholder={prov === 'openai' ? 'sk-...' : 'sk-ant-...'}
                    type="password"
                    style={{
                        width: '100%', padding: '10px 14px',
                        border: '1.5px solid var(--input-border)',
                        borderRadius: 10, fontSize: 14,
                        fontFamily: 'var(--font-mono)', outline: 'none',
                        background: 'var(--input-bg)', color: 'var(--text)'
                    }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {prov === 'openai' ? 'platform.openai.com → API Keys' : 'console.anthropic.com → API Keys'}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} style={{ ...styles.btnSecondary, flex: 1, justifyContent: 'center' }}>Odustani</button>
                <button onClick={() => onSave(key, prov)} style={{ ...styles.btn, flex: 1, justifyContent: 'center' }}>✅ Spremi</button>
            </div>
        </div>
    );
}
