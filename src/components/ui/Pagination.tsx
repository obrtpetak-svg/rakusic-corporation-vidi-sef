import React, { useState, useEffect } from 'react';
import { C } from '../../utils/helpers';

export const usePagination = (totalItems, deps = [], defaultPageSize = 50) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(defaultPageSize);
    const depsKey = JSON.stringify(deps);
    useEffect(() => { setCurrentPage(1); }, [depsKey]);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    return {
        currentPage: safeCurrentPage, pageSize, totalPages, startIndex, endIndex, setCurrentPage,
        setPageSize: (size) => { setPageSize(size); setCurrentPage(1); },
        paginate: (items) => items.slice(startIndex, endIndex),
    };
};

export const Pagination = ({ currentPage, totalPages, pageSize, setCurrentPage, setPageSize, startIndex, endIndex, totalItems, label = 'stavki' }) => {
    if (totalItems <= 0) return null;
    const showingFrom = startIndex + 1, showingTo = Math.min(endIndex, totalItems);
    const pageNumbers = [];
    const maxButtons = 5;
    let startP = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endP = Math.min(totalPages, startP + maxButtons - 1);
    if (endP - startP < maxButtons - 1) startP = Math.max(1, endP - maxButtons + 1);
    for (let i = startP; i <= endP; i++) pageNumbers.push(i);
    const btnBase = { background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: C.textDim, fontWeight: 600, transition: 'all 0.15s' };
    const btnActive = { ...btnBase, background: C.accent, color: '#fff', borderColor: C.accent };
    const btnDisabled = { ...btnBase, opacity: 0.4, cursor: 'default' };
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap', gap: 8 }}>
            <div className="u-fs-12" className="u-text-muted">Prikazano <b className="u-color-text">{showingFrom}–{showingTo}</b> od <b className="u-color-text">{totalItems}</b> {label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => setCurrentPage(1)} disabled={currentPage <= 1} style={currentPage <= 1 ? btnDisabled : btnBase} title="Prva">«</button>
                <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage <= 1} style={currentPage <= 1 ? btnDisabled : btnBase} title="Prethodna">‹</button>
                {startP > 1 && <span style={{ fontSize: 12, color: C.textMuted, padding: '0 4px' }}>…</span>}
                {pageNumbers.map(p => (<button key={p} onClick={() => setCurrentPage(p)} style={p === currentPage ? btnActive : btnBase}>{p}</button>))}
                {endP < totalPages && <span style={{ fontSize: 12, color: C.textMuted, padding: '0 4px' }}>…</span>}
                <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage >= totalPages} style={currentPage >= totalPages ? btnDisabled : btnBase} title="Sljedeća">›</button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages} style={currentPage >= totalPages ? btnDisabled : btnBase} title="Zadnja">»</button>
                <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={{ ...btnBase, marginLeft: 8, padding: '5px 8px', cursor: 'pointer' }}>
                    <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value={200}>200</option>
                </select>
            </div>
        </div>
    );
};
