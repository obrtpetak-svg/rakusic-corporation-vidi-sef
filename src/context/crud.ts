/**
 * Standalone CRUD module — works WITHOUT React context.
 * 
 * These functions use the shared Firebase singleton (getDb) from firebaseCore.
 * They are re-exported via AppContext for backward compatibility.
 */
import { genId } from '../utils/helpers';
import { validateOrThrow } from '../utils/validate';
import { getDb } from './firebaseCore';
import {
    doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs,
    collection, writeBatch,
} from 'firebase/firestore';
import type { BaseDoc } from '../types';

/** Generic document type for CRUD ops — must have at least an id */
type DocData = Record<string, unknown> & { id?: string };

// ── Error handler ────────────────────────────────────────────────────────
function handleError(e: unknown, op: string) {
    const err = e as { code?: string; message?: string };
    if (err.code === 'permission-denied' || (err.message && err.message.includes('permissions'))) {
        throw new Error('Nemate dozvolu za ovu operaciju. Kontaktirajte administratora.');
    }
    console.error(`Firestore ${op} error:`, e);
}

// ── Global setter registry for optimistic updates ────────────────────────
type SetterFn = (updater: (prev: BaseDoc[]) => BaseDoc[]) => void;
const _setterMap: Record<string, SetterFn> = {};
export function _registerSetters(map: Record<string, SetterFn>) { Object.assign(_setterMap, map); }

// ── CRUD Operations ──────────────────────────────────────────────────────
export async function add(col: string, data: DocData) {
    const db = getDb(); if (!db) return null;
    const id = data.id || genId();
    const docData = { ...data, id };
    try {
        validateOrThrow(col, docData);
        await setDoc(doc(db, col, id), docData);
        if (_setterMap[col]) _setterMap[col]((prev) => [...prev, docData as BaseDoc]);
        return docData;
    }
    catch (e) { handleError(e, 'add'); throw e; }
}

export async function update(col: string, id: string, updates: Record<string, unknown>) {
    const db = getDb(); if (!db) return;
    try {
        const stamped = { ...updates, updatedAt: new Date().toISOString() };
        await updateDoc(doc(db, col, id), stamped);
        if (_setterMap[col]) _setterMap[col]((prev) => prev.map(d => d.id === id ? { ...d, ...stamped } : d));
    }
    catch (e) { handleError(e, 'update'); throw e; }
}

export async function remove(col: string, id: string) {
    if (col === 'auditLog') { console.warn('Audit log entries cannot be deleted'); return; }
    const db = getDb(); if (!db) return;
    try {
        const deletedAt = new Date().toISOString();
        await updateDoc(doc(db, col, id), { deletedAt });
        if (_setterMap[col]) _setterMap[col]((prev) => prev.filter(d => d.id !== id));
        _lastDeleted = { collection: col, id, deletedAt };
    }
    catch (e) { handleError(e, 'remove'); throw e; }
}

// Undo last soft delete
let _lastDeleted: { collection: string; id: string; deletedAt: string } | null = null;
export function getLastDeleted() { return _lastDeleted; }

export async function restoreItem(col: string, id: string) {
    const db = getDb(); if (!db) return;
    try {
        const snap = await getDoc(doc(db, col, id));
        if (!snap.exists()) return;
        const data = { ...snap.data() };
        delete data.deletedAt;
        await setDoc(doc(db, col, id), data);
        if (_setterMap[col]) _setterMap[col]((prev) => [...prev, { ...data, id } as BaseDoc]);
        _lastDeleted = null;
    }
    catch (e) { handleError(e, 'restore'); throw e; }
}

export async function permanentDelete(col: string, id: string) {
    const db = getDb(); if (!db) return;
    try { await deleteDoc(doc(db, col, id)); }
    catch (e) { handleError(e, 'permanentDelete'); throw e; }
}

export async function setDocument(col: string, docId: string, data: Record<string, unknown>) {
    const db = getDb(); if (!db) return;
    try { await setDoc(doc(db, col, docId), data); }
    catch (e) { handleError(e, 'setDoc'); throw e; }
}

// Batch operations for backup/restore
export async function batchSet(col: string, items: DocData[]) {
    const db = getDb(); if (!db) return;
    for (let i = 0; i < items.length; i += 450) {
        const batch = writeBatch(db);
        items.slice(i, i + 450).forEach((item) => {
            const id = item.id || genId();
            batch.set(doc(db, col, id), { ...item, id });
        });
        await batch.commit();
    }
}

export async function clearCollection(col: string) {
    const db = getDb(); if (!db) return;
    const snap = await getDocs(collection(db, col));
    for (let i = 0; i < snap.docs.length; i += 450) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }
}
