import { useState, useRef, useEffect } from 'react';
import { C, styles } from '../../utils/helpers';

// ── Signature Canvas Component ──
export function SignatureCanvas({ onSave, existingSignature }) {
    const canvasRef = useRef(null);
    const [drawing, setDrawing] = useState(false);
    const [hasContent, setHasContent] = useState(!!existingSignature);

    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth * 2; canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2); ctx.lineWidth = 2; ctx.strokeStyle = '#1E293B'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (existingSignature) {
            const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
            img.src = existingSignature;
        }
    }, []);

    const getPos = (e) => {
        const canvas = canvasRef.current, rect = canvas.getBoundingClientRect();
        const touch = e.touches ? e.touches[0] : e;
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    };
    const start = (e) => { e.preventDefault(); setDrawing(true); const ctx = canvasRef.current.getContext('2d'); const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const draw = (e) => { if (!drawing) return; e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); setHasContent(true); };
    const stop = () => setDrawing(false);
    const clear = () => {
        const canvas = canvasRef.current, ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height); setHasContent(false);
    };
    const save = () => { if (!hasContent) return; onSave(canvasRef.current.toDataURL('image/png', 0.5)); };

    return (
        <div>
            <canvas ref={canvasRef} onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
                onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
                style={{ width: '100%', height: 120, border: `2px dashed ${C.border}`, borderRadius: 12, cursor: 'crosshair', touchAction: 'none', background: C.bgElevated }} />
            <div className="u-flex u-gap-8" style={{ marginTop: 6 }}>
                <button onClick={clear} style={{ ...styles.btnSmall, fontSize: 11 }}>🗑️ Obriši</button>
                <button onClick={save} disabled={!hasContent} style={{ ...styles.btnSmall, fontSize: 11, background: hasContent ? C.accent : C.border, color: '#fff' }}>✓ Potvrdi potpis</button>
            </div>
        </div>
    );
}

// ── Category presets ──
export const CATEGORY_PRESETS = {
    ppe: { label: '🦺 Osobna zaštitna oprema', items: ['Kaciga', 'Zaštitne naočale', 'Zaštitne rukavice', 'Sigurnosne cipele', 'Reflektirajući prsluk', 'Zaštita za sluh'] },
    site: { label: '🏗️ Sigurnost gradilišta', items: ['Ograda postavljena', 'Putevi označeni', 'Rasvjeta adekvatna', 'Znakovi upozorenja', 'Prva pomoć dostupna', 'Protupožarni aparat'] },
    equipment: { label: '🔧 Oprema i alati', items: ['Alati ispravni', 'Električni kablovi neoštećeni', 'Ljestve sigurne', 'Skela stabilna', 'Dizalica pregledana', 'Strojevi servisirani'] },
    excavation: { label: '⛏️ Iskop i temeljenje', items: ['Bočne strane osigurane', 'Pristupne ljestve', 'Podzemne instalacije označene', 'Odvodnja vode', 'Provjera tla'] },
    electrical: { label: '⚡ Električna sigurnost', items: ['Isključeno napajanje', 'Zaštita od udara', 'Kablovi neprekinuti', 'Uzemljenje ispravno', 'FID sklopka testirana'] },
    heights: { label: '🧗 Rad na visini', items: ['Zaštitni pojas', 'Sidra provjerena', 'Podna zaštita', 'Ljestve učvršćene', 'Vjetar prihvatljiv', 'Pristup siguran'] },
};
