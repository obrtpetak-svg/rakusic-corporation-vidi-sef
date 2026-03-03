/**
 * QR MATRIX ENCODER — Zero-dependency client-side QR code generator
 * Supports byte mode, error correction level M, versions 1-10
 */

const QR = (() => {
    // GF(256) arithmetic for Reed-Solomon
    const GF_EXP = new Uint8Array(512);
    const GF_LOG = new Uint8Array(256);
    (() => { let x = 1; for (let i = 0; i < 255; i++) { GF_EXP[i] = x; GF_LOG[x] = i; x = (x << 1) ^ (x >= 128 ? 0x11d : 0); } for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]; })();
    const gfMul = (a: number, b: number) => a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];

    function rsEncode(data: Uint8Array, ecLen: number) {
        const gen: number[] = [1];
        for (let i = 0; i < ecLen; i++) {
            const ng = new Array(gen.length + 1).fill(0);
            const f = GF_EXP[i];
            for (let j = 0; j < gen.length; j++) { ng[j] ^= gen[j]; ng[j + 1] ^= gfMul(gen[j], f); }
            gen.length = ng.length; for (let j = 0; j < ng.length; j++) gen[j] = ng[j];
        }
        const msg = new Uint8Array(data.length + ecLen);
        msg.set(data);
        for (let i = 0; i < data.length; i++) {
            const coef = msg[i]; if (coef === 0) continue;
            for (let j = 0; j < gen.length; j++) msg[i + j] ^= gfMul(gen[j], coef);
        }
        return msg.slice(data.length);
    }

    const VERSION_INFO: any[] = [
        null,
        { totalCW: 26, ecCW: 10, groups: [[1, 16]] },
        { totalCW: 44, ecCW: 16, groups: [[1, 28]] },
        { totalCW: 70, ecCW: 26, groups: [[1, 44]] },
        { totalCW: 100, ecCW: 18, groups: [[2, 32]] },
        { totalCW: 134, ecCW: 24, groups: [[2, 43]] },
        { totalCW: 172, ecCW: 16, groups: [[4, 27]] },
        { totalCW: 196, ecCW: 18, groups: [[4, 31]] },
        { totalCW: 242, ecCW: 20, groups: [[2, 38], [2, 39]] },
        { totalCW: 292, ecCW: 24, groups: [[3, 36], [2, 37]] },
        { totalCW: 346, ecCW: 28, groups: [[4, 43], [1, 44]] },
    ];

    function encode(text: string): boolean[][] {
        const bytes = new TextEncoder().encode(text);
        let ver = 1;
        for (let v = 1; v <= 10; v++) {
            const info = VERSION_INFO[v];
            const dataCW = info.groups.reduce((s: number, g: number[]) => s + g[0] * g[1], 0);
            if (bytes.length + 3 <= dataCW) { ver = v; break; }
            if (v === 10) ver = 10;
        }
        const info = VERSION_INFO[ver];
        const dataCW = info.groups.reduce((s: number, g: number[]) => s + g[0] * g[1], 0);

        const bits: number[] = [];
        const pushBits = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
        pushBits(0b0100, 4);
        pushBits(bytes.length, ver <= 9 ? 8 : 16);
        for (const b of bytes) pushBits(b, 8);
        pushBits(0, Math.min(4, dataCW * 8 - bits.length));
        while (bits.length % 8 !== 0) bits.push(0);
        while (bits.length < dataCW * 8) {
            pushBits(0xEC, 8); if (bits.length < dataCW * 8) pushBits(0x11, 8);
        }

        const codewords: number[] = [];
        for (let i = 0; i < bits.length; i += 8) {
            let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] || 0);
            codewords.push(b);
        }

        const blocks: Uint8Array[] = [], ecBlocks: Uint8Array[] = [];
        let cwIdx = 0;
        for (const [count, dcCW] of info.groups) {
            for (let i = 0; i < count; i++) {
                const block = new Uint8Array(codewords.slice(cwIdx, cwIdx + dcCW));
                cwIdx += dcCW;
                blocks.push(block);
                ecBlocks.push(rsEncode(block, info.ecCW));
            }
        }

        const final: number[] = [];
        const maxDC = Math.max(...blocks.map(b => b.length));
        for (let i = 0; i < maxDC; i++) for (const b of blocks) if (i < b.length) final.push(b[i]);
        for (let i = 0; i < info.ecCW; i++) for (const b of ecBlocks) if (i < b.length) final.push(b[i]);

        const size = 17 + ver * 4;
        const matrix = Array.from({ length: size }, () => new Int8Array(size));
        const reserved = Array.from({ length: size }, () => new Uint8Array(size));

        const setFinder = (r: number, c: number) => {
            for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
                const rr = r + dr, cc = c + dc;
                if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
                const v = (dr === -1 || dr === 7 || dc === -1 || dc === 7) ? -1
                    : (dr === 0 || dr === 6 || dc === 0 || dc === 6) ? 1
                        : (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4) ? 1 : -1;
                matrix[rr][cc] = v; reserved[rr][cc] = 1;
            }
        };
        setFinder(0, 0); setFinder(0, size - 7); setFinder(size - 7, 0);

        for (let i = 8; i < size - 8; i++) {
            matrix[6][i] = matrix[i][6] = i % 2 === 0 ? 1 : -1;
            reserved[6][i] = reserved[i][6] = 1;
        }

        if (ver >= 2) {
            const positions: any = [6, [0, 18], [0, 22], [0, 26], [0, 26, 30], [0, 26, 34], [0, 26, 34, 38],
                [0, 28, 38], [0, 24, 32, 40], [0, 28, 36, 44]][ver];
            const pos = typeof positions === 'number' ? [6, size - 7] : positions.map((p: number) => p === 0 ? 6 : p);
            for (const r of pos) for (const c of pos) {
                if (reserved[r]?.[c]) continue;
                for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
                    const rr = r + dr, cc = c + dc;
                    if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
                    matrix[rr][cc] = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)) ? 1 : -1;
                    reserved[rr][cc] = 1;
                }
            }
        }

        for (let i = 0; i < 8; i++) {
            reserved[8][i] = reserved[i][8] = 1;
            reserved[8][size - 1 - i] = reserved[size - 1 - i][8] = 1;
        }
        reserved[8][8] = 1;
        matrix[size - 8][8] = 1; reserved[size - 8][8] = 1;

        const finalBits: number[] = [];
        for (const b of final) for (let i = 7; i >= 0; i--) finalBits.push((b >> i) & 1);
        let bitIdx = 0;
        for (let col = size - 1; col >= 0; col -= 2) {
            if (col === 6) col = 5;
            for (let i = 0; i < size; i++) {
                for (let j = 0; j < 2; j++) {
                    const c = col - j;
                    const r = ((Math.floor((size - 1 - col + (col < 6 ? 1 : 0)) / 2)) % 2 === 0) ? size - 1 - i : i;
                    if (c < 0 || r < 0 || c >= size || r >= size || reserved[r][c]) continue;
                    matrix[r][c] = bitIdx < finalBits.length && finalBits[bitIdx] ? 1 : -1;
                    bitIdx++;
                }
            }
        }

        for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
            if (!reserved[r][c] && (r + c) % 2 === 0) matrix[r][c] = matrix[r][c] === 1 ? -1 : 1;
        }

        const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
        const formatPositions = [
            [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]],
            [[size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8], [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]]
        ];
        for (const positions of formatPositions) {
            for (let i = 0; i < 15; i++) {
                const [r, c] = positions[i];
                matrix[r][c] = formatBits[i] ? 1 : -1;
            }
        }

        return matrix.map(row => Array.from(row).map(v => v === 1));
    }

    return { encode };
})();


// ══════════════════════════════════════════════════════════════════════════
// QR CANVAS RENDERER — Premium branded QR codes
// ══════════════════════════════════════════════════════════════════════════

export function renderQrToCanvas(canvas: HTMLCanvasElement, data: string, options: any = {}) {
    const { size = 300, fgColor = '#D95D08', bgColor = '#0F172A', quiet = 4, rounded = true } = options;
    const matrix = QR.encode(data);
    const modules = matrix.length;
    const totalModules = modules + quiet * 2;
    const moduleSize = size / totalModules;
    const ctx = canvas.getContext('2d')!;
    canvas.width = size; canvas.height = size;

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 16);
    ctx.fill();

    ctx.fillStyle = fgColor;
    const r = rounded ? moduleSize * 0.35 : 0;
    for (let row = 0; row < modules; row++) {
        for (let col = 0; col < modules; col++) {
            if (!matrix[row][col]) continue;
            const x = (col + quiet) * moduleSize;
            const y = (row + quiet) * moduleSize;
            if (rounded) {
                ctx.beginPath();
                ctx.roundRect(x + 0.5, y + 0.5, moduleSize - 1, moduleSize - 1, r);
                ctx.fill();
            } else {
                ctx.fillRect(x, y, moduleSize, moduleSize);
            }
        }
    }

    const logoSize = size * 0.18;
    const cx = size / 2, cy = size / 2;
    ctx.fillStyle = bgColor;
    ctx.beginPath(); ctx.arc(cx, cy, logoSize / 2 + 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = fgColor;
    ctx.beginPath(); ctx.arc(cx, cy, logoSize / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${logoSize * 0.32}px Barlow, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('VDS', cx, cy);
}


// ══════════════════════════════════════════════════════════════════════════
// QR POSTER RENDERER — Print-ready A4 poster with project info
// ══════════════════════════════════════════════════════════════════════════

export function renderPosterToCanvas(canvas: HTMLCanvasElement, project: any, companyName: string) {
    const W = 800, H = 1100;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0F172A'); grad.addColorStop(1, '#1E293B');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#D95D08';
    ctx.fillRect(0, 0, W, 8);

    ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Barlow, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(companyName || 'Vi-Di-Sef', W / 2, 60);
    ctx.fillStyle = '#94A3B8'; ctx.font = '16px Barlow, sans-serif';
    ctx.fillText('Sustav evidencije radnog vremena', W / 2, 88);

    const qrSize = 380;
    const qrX = (W - qrSize) / 2, qrY = 130;
    ctx.shadowColor = 'rgba(217,93,8,0.3)'; ctx.shadowBlur = 40;
    ctx.fillStyle = '#0F172A';
    ctx.beginPath(); ctx.roundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 24); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(217,93,8,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 24); ctx.stroke();

    const qrData = `VIDISEF:${project.id}`;
    const matrix = QR.encode(qrData);
    const modules = matrix.length;
    const quiet = 3;
    const totalMod = modules + quiet * 2;
    const modSize = qrSize / totalMod;
    ctx.fillStyle = '#D95D08';
    for (let r = 0; r < modules; r++) {
        for (let c = 0; c < modules; c++) {
            if (!matrix[r][c]) continue;
            const x = qrX + (c + quiet) * modSize;
            const y = qrY + (r + quiet) * modSize;
            ctx.beginPath(); ctx.roundRect(x + 0.3, y + 0.3, modSize - 0.6, modSize - 0.6, modSize * 0.3); ctx.fill();
        }
    }
    const logoR = qrSize * 0.09;
    ctx.fillStyle = '#0F172A';
    ctx.beginPath(); ctx.arc(qrX + qrSize / 2, qrY + qrSize / 2, logoR + 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#D95D08';
    ctx.beginPath(); ctx.arc(qrX + qrSize / 2, qrY + qrSize / 2, logoR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${logoR * 0.7}px Barlow, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('VDS', qrX + qrSize / 2, qrY + qrSize / 2);

    const infoY = qrY + qrSize + 60;
    ctx.fillStyle = 'rgba(217,93,8,0.08)';
    ctx.beginPath(); ctx.roundRect(60, infoY, W - 120, 200, 16); ctx.fill();
    ctx.strokeStyle = 'rgba(217,93,8,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(60, infoY, W - 120, 200, 16); ctx.stroke();

    ctx.fillStyle = '#D95D08'; ctx.font = 'bold 11px Barlow, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('GRADILIŠTE / PROJEKT', 90, infoY + 30);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px Barlow, sans-serif';
    ctx.fillText(project.name || '—', 90, infoY + 62);
    if (project.location) {
        ctx.fillStyle = '#94A3B8'; ctx.font = '16px Barlow, sans-serif';
        ctx.fillText('📍 ' + project.location, 90, infoY + 90);
    }
    if (project.client) {
        ctx.fillStyle = '#64748B'; ctx.font = '14px Barlow, sans-serif';
        ctx.fillText('🏢 Klijent: ' + project.client, 90, infoY + 118);
    }
    ctx.fillStyle = project.status === 'aktivan' ? '#10B981' : '#F59E0B';
    ctx.font = 'bold 13px Barlow, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText((project.status || 'aktivan').toUpperCase(), W - 90, infoY + 30);

    ctx.fillStyle = '#64748B'; ctx.font = '13px Barlow, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('📅 Generirano: ' + new Date().toLocaleDateString('hr-HR'), 90, infoY + 160);
    ctx.textAlign = 'right';
    ctx.fillText('Kod: ' + qrData, W - 90, infoY + 160);

    const instY = infoY + 240;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Barlow, sans-serif';
    ctx.fillText(' SKENIRAJ ZA CHECK-IN', W / 2, instY);
    ctx.fillStyle = '#94A3B8'; ctx.font = '15px Barlow, sans-serif';
    ctx.fillText('Otvori Vi-Di-Sef aplikaciju → QR Check-in → Skeniraj', W / 2, instY + 32);

    const steps = ['1. Otvori aplikaciju', '2. Klikni "QR Check-in"', '3. Skeniraj ovaj kod', '4. Potvrdi check-in'];
    const stepY = instY + 70;
    const stepW = 150;
    const startX = (W - steps.length * stepW) / 2;
    steps.forEach((s, i) => {
        const sx = startX + i * stepW + stepW / 2;
        ctx.fillStyle = 'rgba(217,93,8,0.15)';
        ctx.beginPath(); ctx.arc(sx, stepY, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#D95D08'; ctx.font = 'bold 14px Barlow, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), sx, stepY + 5);
        ctx.fillStyle = '#CBD5E1'; ctx.font = '11px Barlow, sans-serif';
        ctx.fillText(s.replace(/^\d+\.\s/, ''), sx, stepY + 38);
    });

    ctx.fillStyle = '#334155'; ctx.fillRect(0, H - 50, W, 50);
    ctx.fillStyle = '#64748B'; ctx.font = '12px Barlow, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Vi-Di-Sef • www.vi-di.me • Sustav za upravljanje gradilištima', W / 2, H - 22);
}
