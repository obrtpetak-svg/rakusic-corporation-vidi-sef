import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp, add as addDoc, update as updateDoc } from '../context/AppContext';
import { Icon, Modal, Field, Input, Select, useIsMobile, StatusBadge } from './ui/SharedComponents';
import { C, styles, genId, today, nowTime, diffMins, fmtDate, fmtDateTime } from '../utils/helpers';
import { writeGpsLocation, parseGpsString } from '../services/GpsDataWriter';

// ══════════════════════════════════════════════════════════════════════════
// QR MATRIX ENCODER — Zero-dependency client-side QR code generator
// Supports alphanumeric mode, error correction level M, versions 1-10
// ══════════════════════════════════════════════════════════════════════════

const QR = (() => {
    // GF(256) arithmetic for Reed-Solomon
    const GF_EXP = new Uint8Array(512);
    const GF_LOG = new Uint8Array(256);
    (() => { let x = 1; for (let i = 0; i < 255; i++) { GF_EXP[i] = x; GF_LOG[x] = i; x = (x << 1) ^ (x >= 128 ? 0x11d : 0); } for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]; })();
    const gfMul = (a, b) => a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];

    function rsEncode(data, ecLen) {
        const gen = [1];
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

    // Version info for byte mode, EC level M
    const VERSION_INFO = [
        null,
        { totalCW: 26, ecCW: 10, groups: [[1, 16]] },      // v1
        { totalCW: 44, ecCW: 16, groups: [[1, 28]] },      // v2
        { totalCW: 70, ecCW: 26, groups: [[1, 44]] },      // v3
        { totalCW: 100, ecCW: 18, groups: [[2, 32]] },     // v4
        { totalCW: 134, ecCW: 24, groups: [[2, 43]] },     // v5
        { totalCW: 172, ecCW: 16, groups: [[4, 27]] },     // v6
        { totalCW: 196, ecCW: 18, groups: [[4, 31]] },     // v7
        { totalCW: 242, ecCW: 20, groups: [[2, 38], [2, 39]] }, // v8
        { totalCW: 292, ecCW: 24, groups: [[3, 36], [2, 37]] }, // v9
        { totalCW: 346, ecCW: 28, groups: [[4, 43], [1, 44]] }, // v10
    ];

    function encode(text) {
        const bytes = new TextEncoder().encode(text);
        // Determine version
        let ver = 1;
        for (let v = 1; v <= 10; v++) {
            const info = VERSION_INFO[v];
            const dataCW = info.groups.reduce((s, g) => s + g[0] * g[1], 0);
            if (bytes.length + 3 <= dataCW) { ver = v; break; }
            if (v === 10) ver = 10;
        }
        const info = VERSION_INFO[ver];
        const dataCW = info.groups.reduce((s, g) => s + g[0] * g[1], 0);

        // Build data stream: Mode(4) + CharCount(8 or 16) + Data + Terminator + Padding
        const bits = [];
        const pushBits = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
        pushBits(0b0100, 4); // Byte mode
        pushBits(bytes.length, ver <= 9 ? 8 : 16);
        for (const b of bytes) pushBits(b, 8);
        pushBits(0, Math.min(4, dataCW * 8 - bits.length)); // Terminator
        while (bits.length % 8 !== 0) bits.push(0);
        while (bits.length < dataCW * 8) {
            pushBits(0xEC, 8); if (bits.length < dataCW * 8) pushBits(0x11, 8);
        }

        // Split into codewords
        const codewords = [];
        for (let i = 0; i < bits.length; i += 8) {
            let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] || 0);
            codewords.push(b);
        }

        // RS encode each block
        const blocks = [], ecBlocks = [];
        let cwIdx = 0;
        for (const [count, dcCW] of info.groups) {
            for (let i = 0; i < count; i++) {
                const block = new Uint8Array(codewords.slice(cwIdx, cwIdx + dcCW));
                cwIdx += dcCW;
                blocks.push(block);
                ecBlocks.push(rsEncode(block, info.ecCW));
            }
        }

        // Interleave
        const final = [];
        const maxDC = Math.max(...blocks.map(b => b.length));
        for (let i = 0; i < maxDC; i++) for (const b of blocks) if (i < b.length) final.push(b[i]);
        for (let i = 0; i < info.ecCW; i++) for (const b of ecBlocks) if (i < b.length) final.push(b[i]);

        // Build matrix
        const size = 17 + ver * 4;
        const matrix = Array.from({ length: size }, () => new Int8Array(size)); // 0=empty, 1=black, -1=white
        const reserved = Array.from({ length: size }, () => new Uint8Array(size));

        // Finder patterns
        const setFinder = (r, c) => {
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

        // Timing patterns
        for (let i = 8; i < size - 8; i++) {
            matrix[6][i] = matrix[i][6] = i % 2 === 0 ? 1 : -1;
            reserved[6][i] = reserved[i][6] = 1;
        }

        // Alignment patterns (v2+)
        if (ver >= 2) {
            const positions = [6, [0, 18], [0, 22], [0, 26], [0, 26, 30], [0, 26, 34], [0, 26, 34, 38],
                [0, 28, 38], [0, 24, 32, 40], [0, 28, 36, 44]][ver];
            const pos = typeof positions === 'number' ? [6, size - 7] : positions.map(p => p === 0 ? 6 : p);
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

        // Reserve format info areas
        for (let i = 0; i < 8; i++) {
            reserved[8][i] = reserved[i][8] = 1;
            reserved[8][size - 1 - i] = reserved[size - 1 - i][8] = 1;
        }
        reserved[8][8] = 1;
        matrix[size - 8][8] = 1; reserved[size - 8][8] = 1; // Dark module

        // Place data
        const finalBits = [];
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

        // Apply mask 0 (checkerboard) and format info
        for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
            if (!reserved[r][c] && (r + c) % 2 === 0) matrix[r][c] = matrix[r][c] === 1 ? -1 : 1;
        }

        // Format info for mask 0, EC level M
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

        // Convert to boolean grid
        return matrix.map(row => Array.from(row).map(v => v === 1));
    }

    return { encode };
})();


// ══════════════════════════════════════════════════════════════════════════
// QR CANVAS RENDERER — Premium branded QR codes
// ══════════════════════════════════════════════════════════════════════════

function renderQrToCanvas(canvas, data, options = {}) {
    const { size = 300, fgColor = '#D95D08', bgColor = '#0F172A', quiet = 4, rounded = true } = options;
    const matrix = QR.encode(data);
    const modules = matrix.length;
    const totalModules = modules + quiet * 2;
    const moduleSize = size / totalModules;
    const ctx = canvas.getContext('2d');
    canvas.width = size; canvas.height = size;

    // Background
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 16);
    ctx.fill();

    // Modules
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

    // Center logo circle
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

function renderPosterToCanvas(canvas, project, companyName) {
    const W = 800, H = 1100;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0F172A'); grad.addColorStop(1, '#1E293B');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    // Top accent bar
    ctx.fillStyle = '#D95D08';
    ctx.fillRect(0, 0, W, 8);

    // Company name
    ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Barlow, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(companyName || 'Vi-Di-Sef', W / 2, 60);
    ctx.fillStyle = '#94A3B8'; ctx.font = '16px Barlow, sans-serif';
    ctx.fillText('Sustav evidencije radnog vremena', W / 2, 88);

    // QR Code
    const qrSize = 380;
    const qrX = (W - qrSize) / 2, qrY = 130;
    // Glow effect
    ctx.shadowColor = 'rgba(217,93,8,0.3)'; ctx.shadowBlur = 40;
    ctx.fillStyle = '#0F172A';
    ctx.beginPath(); ctx.roundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 24); ctx.fill();
    ctx.shadowBlur = 0;
    // Border
    ctx.strokeStyle = 'rgba(217,93,8,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 24); ctx.stroke();

    // Draw QR inline
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
    // Center logo
    const logoR = qrSize * 0.09;
    ctx.fillStyle = '#0F172A';
    ctx.beginPath(); ctx.arc(qrX + qrSize / 2, qrY + qrSize / 2, logoR + 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#D95D08';
    ctx.beginPath(); ctx.arc(qrX + qrSize / 2, qrY + qrSize / 2, logoR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${logoR * 0.7}px Barlow, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('VDS', qrX + qrSize / 2, qrY + qrSize / 2);

    // Project info section
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
    // Status
    ctx.fillStyle = project.status === 'aktivan' ? '#10B981' : '#F59E0B';
    ctx.font = 'bold 13px Barlow, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText((project.status || 'aktivan').toUpperCase(), W - 90, infoY + 30);

    // Date
    ctx.fillStyle = '#64748B'; ctx.font = '13px Barlow, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('📅 Generirano: ' + new Date().toLocaleDateString('hr-HR'), 90, infoY + 160);
    ctx.textAlign = 'right';
    ctx.fillText('Kod: ' + qrData, W - 90, infoY + 160);

    // Instructions
    const instY = infoY + 240;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Barlow, sans-serif';
    ctx.fillText(' SKENIRAJ ZA CHECK-IN', W / 2, instY);
    ctx.fillStyle = '#94A3B8'; ctx.font = '15px Barlow, sans-serif';
    ctx.fillText('Otvori Vi-Di-Sef aplikaciju → QR Check-in → Skeniraj', W / 2, instY + 32);

    // Steps
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

    // Footer
    ctx.fillStyle = '#334155'; ctx.fillRect(0, H - 50, W, 50);
    ctx.fillStyle = '#64748B'; ctx.font = '12px Barlow, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Vi-Di-Sef • www.vi-di.me • Sustav za upravljanje gradilištima', W / 2, H - 22);
}


// ══════════════════════════════════════════════════════════════════════════
// QR ADMIN PAGE — Premium admin interface for QR management
// ══════════════════════════════════════════════════════════════════════════

export function QrAdminPage() {
    const { projects, workers, timesheets, companyProfile } = useApp();
    const [selectedProject, setSelectedProject] = useState('');
    const [showPoster, setShowPoster] = useState(false);
    const [showLog, setShowLog] = useState(false);
    const [showBatch, setShowBatch] = useState(false);
    const isMobile = useIsMobile();
    const qrCanvasRef = useRef(null);
    const posterCanvasRef = useRef(null);
    const batchContainerRef = useRef(null);

    const companyName = companyProfile?.companyName || 'Vi-Di-Sef';
    const activeProjects = useMemo(() => projects.filter(p => p.status === 'aktivan' || p.status === 'planiran'), [projects]);
    const project = useMemo(() => projects.find(p => p.id === selectedProject), [projects, selectedProject]);

    // QR check-in stats
    const qrTimesheets = useMemo(() => timesheets.filter(t => t.source === 'qr-checkin'), [timesheets]);
    const todayStr = today();
    const todayCheckins = useMemo(() => qrTimesheets.filter(t => t.date === todayStr), [qrTimesheets, todayStr]);
    const uniqueQrWorkers = useMemo(() => new Set(qrTimesheets.map(t => t.workerId)).size, [qrTimesheets]);
    const activeNow = useMemo(() => qrTimesheets.filter(t => t.date === todayStr && !t.endTime).length, [qrTimesheets, todayStr]);

    // Render QR when project changes
    useEffect(() => {
        if (!project || !qrCanvasRef.current) return;
        renderQrToCanvas(qrCanvasRef.current, `VIDISEF:${project.id}`, { size: 320 });
    }, [project]);

    const downloadQr = useCallback(() => {
        if (!qrCanvasRef.current || !project) return;
        const link = document.createElement('a');
        link.download = `QR-${project.name.replace(/\s+/g, '-')}.png`;
        link.href = qrCanvasRef.current.toDataURL('image/png');
        link.click();
    }, [project]);

    const downloadPoster = useCallback(() => {
        if (!project) return;
        const canvas = document.createElement('canvas');
        renderPosterToCanvas(canvas, project, companyName);
        const link = document.createElement('a');
        link.download = `Poster-${project.name.replace(/\s+/g, '-')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }, [project, companyName]);

    const openPoster = useCallback(() => {
        if (!project) return;
        setShowPoster(true);
        setTimeout(() => {
            if (posterCanvasRef.current) renderPosterToCanvas(posterCanvasRef.current, project, companyName);
        }, 50);
    }, [project, companyName]);

    const printPoster = useCallback(() => {
        if (!project) return;
        const canvas = document.createElement('canvas');
        renderPosterToCanvas(canvas, project, companyName);
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>QR Poster - ${project.name}</title><style>@page{size:A4;margin:0}body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fff}</style></head><body><img src="${canvas.toDataURL('image/png')}" style="max-width:100%;height:auto" onload="setTimeout(()=>window.print(),300)"></body></html>`);
        win.document.close();
    }, [project, companyName]);

    const downloadAllQr = useCallback(() => {
        activeProjects.forEach((p, i) => {
            setTimeout(() => {
                const canvas = document.createElement('canvas');
                renderQrToCanvas(canvas, `VIDISEF:${p.id}`, { size: 400 });
                const link = document.createElement('a');
                link.download = `QR-${p.name.replace(/\s+/g, '-')}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            }, i * 300);
        });
    }, [activeProjects]);

    const downloadAllPosters = useCallback(() => {
        activeProjects.forEach((p, i) => {
            setTimeout(() => {
                const canvas = document.createElement('canvas');
                renderPosterToCanvas(canvas, p, companyName);
                const link = document.createElement('a');
                link.download = `Poster-${p.name.replace(/\s+/g, '-')}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            }, i * 400);
        });
    }, [activeProjects, companyName]);

    // Recent QR log
    const recentLog = useMemo(() =>
        qrTimesheets
            .sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''))
            .slice(0, 50)
        , [qrTimesheets]);

    const getWorkerName = (id) => workers.find(w => w.id === id)?.name || '—';
    const getProjectName = (id) => projects.find(p => p.id === id)?.name || '—';

    const statCards = [
        { label: 'Danas check-in', value: todayCheckins.length, icon: '📷', color: C.accent },
        { label: 'Aktivni sada', value: activeNow, icon: '🟢', color: '#10B981' },
        { label: 'Ukupno QR unosa', value: qrTimesheets.length, icon: '📊', color: C.blue },
        { label: 'Radnika koristi QR', value: uniqueQrWorkers, icon: '👥', color: '#7C3AED' },
        { label: 'Aktivnih projekata', value: activeProjects.length, icon: '📁', color: '#F59E0B' },
    ];

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ background: C.accent, color: '#fff', borderRadius: 12, padding: '8px 12px', fontSize: 20 }}>📷</span>
                        QR Upravljanje
                    </div>
                    <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Generiraj, isprintaj i upravljaj QR kodovima za gradilišta</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => setShowLog(true)} style={styles.btnSecondary}><Icon name="history" size={16} /> Check-in log</button>
                    <button onClick={() => setShowBatch(true)} style={styles.btn}><Icon name="download" size={16} /> Batch preuzmi</button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${statCards.length}, 1fr)`, gap: 12, marginBottom: 24 }}>
                {statCards.map(s => (
                    <div key={s.label} style={{ ...styles.card, textAlign: 'center', padding: '16px 10px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 40, opacity: 0.06 }}>{s.icon}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Main content: Generator + Preview */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
                {/* Left: Project selector + actions */}
                <div>
                    <div style={styles.card}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Icon name="project" size={18} /> Odaberi projekt
                        </div>
                        <Select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={{ marginBottom: 16 }}>
                            <option value="">— Odaberi projekt za QR kod —</option>
                            {activeProjects.map(p => (
                                <option key={p.id} value={p.id}>📁 {p.name}{p.location ? ` (${p.location})` : ''}</option>
                            ))}
                        </Select>

                        {project && (
                            <div>
                                {/* Project info */}
                                <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(217,93,8,0.06)', border: '1px solid rgba(217,93,8,0.15)', marginBottom: 16 }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{project.name}</div>
                                    {project.location && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>📍 {project.location}</div>}
                                    {project.client && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>🏢 {project.client}</div>}
                                    <div style={{ fontSize: 11, color: C.accent, marginTop: 6, fontFamily: 'monospace' }}>VIDISEF:{project.id}</div>
                                </div>

                                {/* Action buttons */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <button onClick={downloadQr} style={{ ...styles.btn, width: '100%', justifyContent: 'center', padding: '14px 20px' }}>
                                        <Icon name="download" size={18} /> Preuzmi QR kod (PNG)
                                    </button>
                                    <button onClick={openPoster} style={{ ...styles.btn, width: '100%', justifyContent: 'center', padding: '14px 20px', background: '#1D4ED8' }}>
                                        🖼️ Poster za print (A4)
                                    </button>
                                    <button onClick={printPoster} style={{ ...styles.btnSecondary, width: '100%', justifyContent: 'center', padding: '14px 20px' }}>
                                        🖨️ Isprintaj poster
                                    </button>
                                </div>

                                {/* QR project stats */}
                                {(() => {
                                    const pQr = qrTimesheets.filter(t => t.projectId === project.id);
                                    const pToday = pQr.filter(t => t.date === todayStr);
                                    return pQr.length > 0 ? (
                                        <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: C.bgElevated, border: `1px solid ${C.border}` }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>QR statistika za ovaj projekt</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                                                <div><div style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>{pToday.length}</div><div style={{ fontSize: 10, color: C.textMuted }}>Danas</div></div>
                                                <div><div style={{ fontSize: 18, fontWeight: 800, color: C.blue }}>{pQr.length}</div><div style={{ fontSize: 10, color: C.textMuted }}>Ukupno</div></div>
                                                <div><div style={{ fontSize: 18, fontWeight: 800, color: '#7C3AED' }}>{new Set(pQr.map(t => t.workerId)).size}</div><div style={{ fontSize: 10, color: C.textMuted }}>Radnika</div></div>
                                            </div>
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                        )}

                        {!project && (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: C.textMuted }}>
                                <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>📷</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>Odaberi projekt za generiranje QR koda</div>
                                <div style={{ fontSize: 12, marginTop: 4 }}>QR kod služi za brzi check-in radnika na gradilištu</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: QR Preview */}
                <div>
                    <div style={{ ...styles.card, textAlign: 'center', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        {project ? (
                            <>
                                <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>QR KOD PREVIEW</div>
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                    <div style={{ position: 'absolute', inset: -12, borderRadius: 24, background: 'rgba(217,93,8,0.08)', border: '2px solid rgba(217,93,8,0.15)', zIndex: 0 }} />
                                    <canvas ref={qrCanvasRef} style={{ width: 280, height: 280, borderRadius: 16, position: 'relative', zIndex: 1 }} />
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginTop: 20 }}>{project.name}</div>
                                {project.location && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>📍 {project.location}</div>}
                                <div style={{ fontSize: 11, color: C.accent, marginTop: 8, fontFamily: 'monospace', background: C.accentLight, padding: '4px 12px', borderRadius: 6 }}>VIDISEF:{project.id}</div>
                            </>
                        ) : (
                            <div style={{ opacity: 0.2 }}>
                                <div style={{ fontSize: 80 }}>📷</div>
                                <div style={{ fontSize: 14, color: C.textMuted, marginTop: 8 }}>QR preview</div>
                            </div>
                        )}
                    </div>

                    {/* Quick tips */}
                    <div style={{ ...styles.card, marginTop: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>💡 Savjeti</div>
                        {['Isprintajte poster i postavite ga na vidljivo mjesto na gradilištu',
                            'Radnici skeniraju QR kod za automatski check-in/check-out',
                            'GPS lokacija se automatski bilježi uz svaki QR check-in',
                            'Koristite "Batch preuzmi" za preuzimanje svih QR kodova odjednom'
                        ].map((tip, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, fontSize: 12, color: C.textDim }}>
                                <span style={{ color: C.accent, fontWeight: 700, flexShrink: 0 }}>•</span> {tip}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Poster Preview Modal */}
            {showPoster && project && (
                <Modal title={`Poster — ${project.name}`} onClose={() => setShowPoster(false)} wide>
                    <div style={{ textAlign: 'center' }}>
                        <canvas ref={posterCanvasRef} style={{ maxWidth: '100%', height: 'auto', borderRadius: 12, border: `1px solid ${C.border}` }} />
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
                            <button onClick={downloadPoster} style={styles.btn}><Icon name="download" size={16} /> Preuzmi PNG</button>
                            <button onClick={printPoster} style={styles.btnSecondary}>🖨️ Isprintaj</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Check-in Log Modal */}
            {showLog && (
                <Modal title="📋 QR Check-in Log" onClose={() => setShowLog(false)} wide>
                    {recentLog.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>Nema QR check-in zapisa</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr>
                                    <th style={styles.th}>Datum</th><th style={styles.th}>Radnik</th><th style={styles.th}>Projekt</th>
                                    <th style={styles.th}>Check-in</th><th style={styles.th}>Check-out</th><th style={styles.th}>Sati</th><th style={styles.th}>Status</th>
                                </tr></thead>
                                <tbody>
                                    {recentLog.map(t => {
                                        const mins = diffMins(t.startTime, t.endTime);
                                        return (
                                            <tr key={t.id}>
                                                <td style={styles.td}>{fmtDate(t.date)}</td>
                                                <td style={styles.td}><span style={{ fontWeight: 600 }}>{getWorkerName(t.workerId)}</span></td>
                                                <td style={styles.td}>{getProjectName(t.projectId)}</td>
                                                <td style={styles.td}><span style={{ color: C.green, fontWeight: 600 }}>{t.startTime || '—'}</span></td>
                                                <td style={styles.td}><span style={{ color: t.endTime ? C.red : C.textMuted, fontWeight: 600 }}>{t.endTime || '🟢 aktivno'}</span></td>
                                                <td style={styles.td}>{t.endTime ? `${(mins / 60).toFixed(1)}h` : '—'}</td>
                                                <td style={styles.td}><StatusBadge status={t.endTime ? 'završen' : 'aktivno'} /></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Modal>
            )}

            {/* Batch Download Modal */}
            {showBatch && (
                <Modal title="📦 Batch preuzimanje QR kodova" onClose={() => setShowBatch(false)} wide>
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 14, color: C.textDim, marginBottom: 16 }}>Preuzmite QR kodove ili postere za sve aktivne projekte ({activeProjects.length})</div>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                            <button onClick={() => { downloadAllQr(); }} style={styles.btn}>
                                <Icon name="download" size={16} /> Svi QR kodovi ({activeProjects.length})
                            </button>
                            <button onClick={() => { downloadAllPosters(); }} style={{ ...styles.btn, background: '#1D4ED8' }}>
                                🖼️ Svi posteri ({activeProjects.length})
                            </button>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }} ref={batchContainerRef}>
                        {activeProjects.map(p => (
                            <div key={p.id} style={{ textAlign: 'center', padding: 12, borderRadius: 10, background: C.bgElevated, border: `1px solid ${C.border}` }}>
                                <BatchQrPreview project={p} />
                                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                {p.location && <div style={{ fontSize: 10, color: C.textMuted }}>{p.location}</div>}
                            </div>
                        ))}
                    </div>
                </Modal>
            )}
        </div>
    );
}

// Small QR preview for batch modal
function BatchQrPreview({ project }) {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current) renderQrToCanvas(ref.current, `VIDISEF:${project.id}`, { size: 140 });
    }, [project.id]);
    return <canvas ref={ref} style={{ width: 100, height: 100, borderRadius: 8 }} />;
}


// ══════════════════════════════════════════════════════════════════════════
// QR CHECK-IN — Worker scanner (unchanged)
// ══════════════════════════════════════════════════════════════════════════

export function QrCheckIn() {
    const { currentUser, projects, timesheets } = useApp();
    const [scanning, setScanning] = useState(false);
    const [manualCode, setManualCode] = useState('');
    const [result, setResult] = useState(null);
    const [gpsLocation, setGpsLocation] = useState('');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const isMobile = useIsMobile();
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const userId = currentUser?.workerId || currentUser?.id;

    const activeCheckin = useMemo(() => {
        const todayStr = today();
        return timesheets.find(t =>
            t.workerId === userId &&
            t.date === todayStr &&
            t.source === 'qr-checkin' &&
            !t.endTime
        );
    }, [timesheets, userId]);

    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => setGpsLocation(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
            () => { },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, []);

    const startScan = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
            });
            streamRef.current = stream;
            setScanning(true);
            if ('BarcodeDetector' in window) {
                const detector = new BarcodeDetector({ formats: ['qr_code'] });
                const interval = setInterval(async () => {
                    if (videoRef.current && videoRef.current.readyState >= 2) {
                        try {
                            const barcodes = await detector.detect(videoRef.current);
                            if (barcodes.length > 0) { clearInterval(interval); handleScanResult(barcodes[0].rawValue); }
                        } catch (e) { }
                    }
                }, 300);
                return () => clearInterval(interval);
            }
        } catch (err) { alert('Kamera nije dostupna: ' + err.message); }
    };

    const stopScan = () => {
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        setScanning(false);
    };

    useEffect(() => {
        if (scanning && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch(() => { });
        }
    }, [scanning]);

    useEffect(() => () => stopScan(), []);

    const handleScanResult = (code) => {
        stopScan();
        if (code?.startsWith('VIDISEF:')) {
            const projectId = code.replace('VIDISEF:', '');
            const project = projects.find(p => p.id === projectId);
            if (project) setResult({ projectId, projectName: project.name, location: project.location });
            else setResult({ error: 'Projekt nije pronađen' });
        } else { setResult({ error: 'Nevaljan QR kod' }); }
    };

    const handleManualSubmit = () => { if (manualCode.trim()) handleScanResult(manualCode.trim()); };

    const clockIn = async () => {
        if (!result?.projectId) return;
        setSaving(true);
        await addDoc('timesheets', {
            id: genId(), workerId: userId, projectId: result.projectId, date: today(),
            startTime: nowTime(), endTime: '', breakMins: 0, description: 'QR Check-in',
            type: 'normalan', gpsLocation, status: 'na čekanju', source: 'qr-checkin',
            createdAt: new Date().toISOString(), createdBy: currentUser?.name, editLog: [],
        });
        setSaving(false);
        setSuccess('✅ Check-in uspješan! Sati se broje...');
        setResult(null);
    };

    const clockOut = async () => {
        if (!activeCheckin) return;
        setSaving(true);
        await updateDoc('timesheets', activeCheckin.id, {
            endTime: nowTime(), gpsLocationEnd: gpsLocation, updatedAt: new Date().toISOString(),
        });
        setSaving(false);
        setSuccess('✅ Check-out! Smjena zabilježena.');
    };

    return (
        <div style={{ maxWidth: 500, margin: '0 auto' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 24 }}>📷 QR Check-in</div>
            {success && (
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, color: C.green, fontWeight: 600, fontSize: 14 }}>{success}</div>
            )}
            {activeCheckin && (
                <div style={{ ...styles.card, background: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.3)', marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>🟢 Smjena aktivna</div>
                            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                                Od: {activeCheckin.startTime} • {projects.find(p => p.id === activeCheckin.projectId)?.name || '—'}
                            </div>
                        </div>
                        <button onClick={clockOut} disabled={saving} style={{ ...styles.btn, background: C.red }}>
                            <Icon name="clock" size={16} /> Check-out
                        </button>
                    </div>
                </div>
            )}
            {!activeCheckin && (
                <div style={styles.card}>
                    {scanning ? (
                        <div>
                            <video ref={videoRef} style={{ width: '100%', borderRadius: 10, marginBottom: 12, background: '#000' }} autoPlay playsInline muted />
                            <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', marginBottom: 12 }}>📸 Usmjerite kameru prema QR kodu na gradilištu</div>
                            <button onClick={stopScan} style={{ ...styles.btnSecondary, width: '100%', justifyContent: 'center' }}>✕ Zatvori kameru</button>
                        </div>
                    ) : (
                        <div>
                            <button onClick={startScan} style={{ ...styles.btn, width: '100%', justifyContent: 'center', padding: '18px 24px', fontSize: 16, marginBottom: 16 }}>📷 Skeniraj QR kod</button>
                            <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', marginBottom: 16 }}>ili unesite kod ručno</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <Input value={manualCode} onChange={e => setManualCode(e.target.value)} placeholder="VIDISEF:project-id" style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleManualSubmit()} />
                                <button onClick={handleManualSubmit} disabled={!manualCode.trim()} style={styles.btn}><Icon name="check" size={16} /></button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {result && !result.error && (
                <div style={{ ...styles.card, marginTop: 16, background: 'rgba(249,115,22,0.06)', borderColor: 'rgba(249,115,22,0.3)' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>📍 {result.projectName}</div>
                    {result.location && <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>{result.location}</div>}
                    {gpsLocation && <div style={{ fontSize: 11, color: C.green, marginBottom: 12 }}>✅ GPS: {gpsLocation}</div>}
                    <button onClick={clockIn} disabled={saving} style={{ ...styles.btn, width: '100%', justifyContent: 'center', padding: '16px 24px', fontSize: 16 }}>
                        {saving ? 'Šaljem...' : '🟢 Check-in — Počni smjenu'}
                    </button>
                </div>
            )}
            {result?.error && (
                <div style={{ ...styles.card, marginTop: 16, background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.3)' }}>
                    <div style={{ color: C.red, fontWeight: 600 }}>❌ {result.error}</div>
                </div>
            )}
            <div style={{ textAlign: 'center', fontSize: 11, color: C.textMuted, marginTop: 16 }}>
                {gpsLocation ? `📍 GPS: ${gpsLocation}` : '📡 Tražim GPS lokaciju...'}
            </div>
        </div>
    );
}
