// ── Excel Export Utility ──────────────────────────────────────────────────
// Provides exportToExcel() for any data table → .xlsx download
import * as XLSX from 'xlsx';

type RowData = Record<string, unknown>;
interface ColumnDef { key: string; label?: string; width?: number; }
interface EntityRow { id: string;[key: string]: unknown; }

 * Export array of objects to Excel(.xlsx)
    * @param { Object[] } data - Array of row objects
        * @param { string } filename - Name without extension
            * @param { string } sheetName - Sheet tab name
                * @param { Object[] } columns - Optional[{ key, label, width }] to control column order / names
                    */
export function exportToExcel(data: RowData[], filename = 'export', sheetName = 'Podaci', columns: ColumnDef[] | null = null) {
    if (!data || data.length === 0) {
        alert('Nema podataka za export');
        return;
    }

    let exportData;
    let colWidths;

    if (columns) {
        // Map data using column definitions
        exportData = data.map(row => {
            const mapped: RowData = {};
            columns.forEach((col: ColumnDef) => {
                mapped[col.label || col.key] = row[col.key] ?? '';
            });
            return mapped;
        });
        colWidths = columns.map((col: ColumnDef) => ({ wch: col.width || 18 }));
    } else {
        exportData = data;
        const keys = Object.keys(data[0]);
        colWidths = keys.map(k => ({ wch: Math.max(k.length + 2, 14) }));
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export timesheets for a specific period
 */
export function exportTimesheets(timesheets: EntityRow[], workers: EntityRow[], projects: EntityRow[], dateFrom: string, dateTo: string) {
    const data = timesheets.map((t: EntityRow) => {
        const w = workers.find((x: EntityRow) => x.id === t.workerId);
        const p = projects.find((x: EntityRow) => x.id === t.projectId);
        const start = t.startTime || '';
        const end = t.endTime || '';
        const breakMins = t.breakMins || 0;
        // Calculate duration
        let durationH = 0;
        if (start && end) {
            const [sh, sm] = start.split(':').map(Number);
            const [eh, em] = end.split(':').map(Number);
            let diff = eh * 60 + em - (sh * 60 + sm);
            if (diff < 0) diff += 1440;
            durationH = ((diff - breakMins) / 60).toFixed(1);
        }
        return {
            'Radnik': w?.name || '—',
            'Projekt': p?.name || '—',
            'Datum': t.date || '',
            'Početak': start,
            'Završetak': end,
            'Pauza (min)': breakMins,
            'Neto sati': parseFloat(durationH),
            'Tip': t.type || 'normalan',
            'Status': t.status || '',
            'Opis': t.description || '',
            'GPS': t.gpsLocation || '',
        };
    });

    const period = dateFrom && dateTo ? `_${dateFrom}_${dateTo}` : '';
    exportToExcel(data, `Vi-Di-Sef_Sati${period}`, 'Radni sati');
}

/**
 * Export workers summary for a period
 */
export function exportWorkersSummary(hoursByWorker: RowData[], dateFrom: string, dateTo: string) {
    const data = hoursByWorker.map((w: RowData) => ({
        'Radnik': w.name,
        'Ukupno sati': w.sati,
        'Normalan': w.normalan || 0,
        'Prekovremeni': w.prekovremeni || 0,
        'Noćni': w.nocni || 0,
        'Vikend': w.vikend || 0,
        'Broj unosa': w.unosa || 0,
    }));

    const period = dateFrom && dateTo ? `_${dateFrom}_${dateTo}` : '';
    exportToExcel(data, `Vi-Di-Sef_Radnici${period}`, 'Radnici');
}

/**
 * Export invoices
 */
export function exportInvoices(invoices: EntityRow[], workers: EntityRow[], projects: EntityRow[]) {
    const data = invoices.map((i: EntityRow) => {
        const w = workers.find((x: EntityRow) => x.id === i.workerId);
        const p = projects.find((x: EntityRow) => x.id === i.projectId);
        return {
            'Br. računa': i.invoiceNumber || '',
            'Dobavljač': i.supplier || w?.name || '—',
            'Projekt': p?.name || '—',
            'Datum': i.date || '',
            'Iznos (€)': parseFloat(i.amount) || 0,
            'Status': i.status || '',
            'Opis': i.description || '',
        };
    });

    exportToExcel(data, 'Vi-Di-Sef_Racuni', 'Računi');
}

/**
 * Export projects overview
 */
export function exportProjects(projects: EntityRow[], workers: EntityRow[]) {
    const data = projects.filter((p: EntityRow) => p.status !== 'obrisan').map((p: EntityRow) => ({
        'Naziv': p.name || '',
        'Lokacija': p.location || '',
        'Status': p.status || '',
        'Radnici': ((p.workers as string[]) || []).map((wId: string) => workers.find((w: EntityRow) => w.id === wId)?.name || '?').join(', '),
        'Broj radnika': ((p.workers as string[]) || []).length,
        'Početak': p.startDate || '',
        'Završetak': p.endDate || '',
    }));

    exportToExcel(data, 'Vi-Di-Sef_Projekti', 'Projekti');
}
