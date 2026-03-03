import React, { useState, useEffect, useRef } from 'react';
import { C, styles } from '../../utils/helpers';
import { Icon } from './CoreUI';

// ── WorkerCheckboxList ───────────────────────────────────────────────────
export const WorkerCheckboxList = ({ allWorkers, selected, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef();
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    const toggle = (id) => selected.includes(id) ? onChange(selected.filter(x => x !== id)) : onChange([...selected, id]);
    const names = allWorkers.filter(w => selected.includes(w.id)).map(w => w.name);
    return (
        <div ref={ref} className="u-relative">
            <button type="button" onClick={() => setOpen(v => !v)} style={{ ...styles.input, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: names.length > 0 ? C.text : C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>
                    {names.length > 0 ? names.join(', ') : '— Odaberite radnike —'}
                </span>
                <span style={{ color: C.textMuted, fontSize: 12, marginLeft: 8 }}>▾</span>
            </button>
            {open && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200, background: C.card, border: `1px solid ${C.accent}`, borderRadius: 8, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
                    {allWorkers.length === 0 && <div style={{ padding: '12px 16px', color: C.textMuted, fontSize: 13 }}>Nema aktivnih radnika</div>}
                    {allWorkers.map(w => {
                        const checked = selected.includes(w.id);
                        return (
                            <div key={w.id} onClick={() => toggle(w.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`, background: checked ? C.accentLight : 'transparent' }}>
                                <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? C.accent : C.border}`, background: checked ? C.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {checked && <Icon name="check" size={12} />}
                                </div>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent, fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                                    {w.name?.charAt(0)}
                                </div>
                                <div>
                                    <div style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{w.name}</div>
                                    {w.position && <div style={{ color: C.textMuted, fontSize: 11 }}>{w.position}</div>}
                                </div>
                            </div>
                        );
                    })}
                    {selected.length > 0 && (
                        <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.border}` }}>
                            <span style={{ color: C.accent, fontSize: 12, fontWeight: 700 }}>{selected.length} odabrano</span>
                            <button onClick={(e) => { e.stopPropagation(); onChange([]); }} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12 }}>Poništi sve</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
