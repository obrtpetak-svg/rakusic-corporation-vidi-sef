/**
 * Standalone CRUD module — works WITHOUT React context.
 * 
 * These functions use the shared Firebase singleton (getDb) from AuthContext.
 * They are re-exported via AppContext for backward compatibility.
 */
import { genId } from '../utils/helpers';
import { validateOrThrow } from '../utils/validate';
import { getDb } from './AuthContext';

// ── Error handler ────────────────────────────────────────────────────────
function handleError(e: any, op: string) {
    if (e.code === 'permission-denied' || (e.message && e.message.includes('permissions'))) {
        throw new Error('Nemate dozvolu za ovu operaciju. Kontaktirajte administratora.');
    }
    console.error(`Firestore ${op} error:`, e);
}

// ── Global setter registry for optimistic updates ────────────────────────
const _setterMap: Record<string, any> = {};
export function _registerSetters(map: Record<string, any>) { Object.assign(_setterMap, map); }

// ── CRUD Operations ──────────────────────────────────────────────────────
export async function add(collection: string, data: any) {
    const db = getDb(); if (!db) return null;
    const id = data.id || genId();
    const doc = { ...data, id };
    try {
        validateOrThrow(collection, doc);
        await db.collection(collection).doc(id).set(doc);
        if (_setterMap[collection]) _setterMap[collection]((prev: any[]) => [...prev, doc]);
        return doc;
    }
    catch (e) { handleError(e, 'add'); throw e; }
}

export async function update(collection: string, id: string, updates: any) {
    const db = getDb(); if (!db) return;
    try {
        const stamped = { ...updates, updatedAt: new Date().toISOString() };
        await db.collection(collection).doc(id).update(stamped);
        if (_setterMap[collection]) _setterMap[collection]((prev: any[]) => prev.map((d: any) => d.id === id ? { ...d, ...stamped } : d));
    }
    catch (e) { handleError(e, 'update'); throw e; }
}

export async function remove(collection: string, id: string) {
    if (collection === 'auditLog') { console.warn('Audit log entries cannot be deleted'); return; }
    const db = getDb(); if (!db) return;
    try {
        const deletedAt = new Date().toISOString();
        await db.collection(collection).doc(id).update({ deletedAt });
        if (_setterMap[collection]) _setterMap[collection]((prev: any[]) => prev.filter((d: any) => d.id !== id));
        _lastDeleted = { collection, id, deletedAt };
    }
    catch (e) { handleError(e, 'remove'); throw e; }
}

// Undo last soft delete
let _lastDeleted: { collection: string; id: string; deletedAt: string } | null = null;
export function getLastDeleted() { return _lastDeleted; }

export async function restoreItem(collection: string, id: string) {
    const db = getDb(); if (!db) return;
    try {
        const doc = await db.collection(collection).doc(id).get();
        if (!doc.exists) return;
        const data = doc.data();
        delete data.deletedAt;
        await db.collection(collection).doc(id).set(data);
        if (_setterMap[collection]) _setterMap[collection]((prev: any[]) => [...prev, { ...data, id }]);
        _lastDeleted = null;
    }
    catch (e) { handleError(e, 'restore'); throw e; }
}

export async function permanentDelete(collection: string, id: string) {
    const db = getDb(); if (!db) return;
    try { await db.collection(collection).doc(id).delete(); }
    catch (e) { handleError(e, 'permanentDelete'); throw e; }
}

export async function setDoc(collection: string, docId: string, data: any) {
    const db = getDb(); if (!db) return;
    try { await db.collection(collection).doc(docId).set(data); }
    catch (e) { handleError(e, 'setDoc'); throw e; }
}

// Batch operations for backup/restore
export async function batchSet(collection: string, items: any[]) {
    const db = getDb(); if (!db) return;
    for (let i = 0; i < items.length; i += 450) {
        const batch = db.batch();
        items.slice(i, i + 450).forEach((item: any) => {
            const id = item.id || genId();
            batch.set(db.collection(collection).doc(id), { ...item, id });
        });
        await batch.commit();
    }
}

export async function clearCollection(collection: string) {
    const db = getDb(); if (!db) return;
    const snap = await db.collection(collection).get();
    for (let i = 0; i < snap.docs.length; i += 450) {
        const batch = db.batch();
        snap.docs.slice(i, i + 450).forEach((doc: any) => batch.delete(doc.ref));
        await batch.commit();
    }
}
