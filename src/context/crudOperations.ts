import { genId } from '../utils/helpers';
import { getDb } from './firebaseCore';

// ═══════════════════════════════════════════════════════════════════════════
// CRUD OPERATIONS — Firestore document operations
// Separated for clarity and reusability. All exported functions are
// standalone (not hooks) — they can be called from any context.
// ═══════════════════════════════════════════════════════════════════════════

// TODO: Replace with typed Firestore SDK when available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FirestoreDb = any;

interface FirestoreError extends Error {
    code?: string;
}

function handleError(e: FirestoreError, op: string): void {
    if (e.code === 'permission-denied' || (e.message && e.message.includes('permissions'))) {
        throw new Error("FIRESTORE_PERMISSION: Firestore rules blokiraju. Firebase Console → Firestore → Rules → allow read, write: if true;");
    }
    console.error(`Firestore ${op} error:`, e);
}

export async function add(collection: string, data: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const db: FirestoreDb = getDb(); if (!db) return null;
    const id = (data.id as string) || genId();
    const doc = { ...data, id };
    try { await db.collection(collection).doc(id).set(doc); return doc; }
    catch (e) { handleError(e as FirestoreError, 'add'); throw e; }
}

export async function update(collection: string, id: string, updates: Record<string, unknown>): Promise<void> {
    const db: FirestoreDb = getDb(); if (!db) return;
    try { await db.collection(collection).doc(id).update(updates); }
    catch (e) { handleError(e as FirestoreError, 'update'); throw e; }
}

// H-6: Optimistic locking — prevents concurrent write conflicts
export async function updateWithLock(collection: string, id: string, updates: Record<string, unknown> & { _expectedLastModified?: string }): Promise<void> {
    const db: FirestoreDb = getDb(); if (!db) return;
    try {
        await db.runTransaction(async (transaction: FirestoreDb) => {
            const docRef = db.collection(collection).doc(id);
            const snap = await transaction.get(docRef);
            if (!snap.exists) throw new Error('Document not found');
            const current = snap.data();
            if (current.lastModified && updates._expectedLastModified) {
                if (current.lastModified !== updates._expectedLastModified) {
                    const err: FirestoreError = new Error('CONFLICT: Dokument je upravo promijenjen od drugog korisnika');
                    err.code = 'CONFLICT';
                    throw err;
                }
            }
            const { _expectedLastModified, ...cleanUpdates } = updates;
            transaction.update(docRef, { ...cleanUpdates, lastModified: new Date().toISOString() });
        });
    } catch (e) {
        if ((e as FirestoreError).code === 'CONFLICT') throw e;
        handleError(e as FirestoreError, 'updateWithLock');
        throw e;
    }
}

export async function remove(collection: string, id: string): Promise<void> {
    const db: FirestoreDb = getDb(); if (!db) return;
    try { await db.collection(collection).doc(id).delete(); }
    catch (e) { handleError(e as FirestoreError, 'remove'); throw e; }
}

export async function setDoc(collection: string, docId: string, data: Record<string, unknown>): Promise<void> {
    const db: FirestoreDb = getDb(); if (!db) return;
    try { await db.collection(collection).doc(docId).set(data); }
    catch (e) { handleError(e as FirestoreError, 'setDoc'); throw e; }
}

// Batch operations for backup/restore
export async function batchSet(collection: string, items: Record<string, unknown>[]): Promise<void> {
    const db: FirestoreDb = getDb(); if (!db) return;
    for (let i = 0; i < items.length; i += 450) {
        const batch = db.batch();
        items.slice(i, i + 450).forEach((item: Record<string, unknown>) => {
            const id = (item.id as string) || genId();
            batch.set(db.collection(collection).doc(id), { ...item, id });
        });
        await batch.commit();
    }
}

export async function clearCollection(collection: string): Promise<void> {
    const db: FirestoreDb = getDb(); if (!db) return;
    const snap = await db.collection(collection).get();
    for (let i = 0; i < snap.docs.length; i += 450) {
        const batch = db.batch();
        snap.docs.slice(i, i + 450).forEach((doc: { ref: unknown }) => batch.delete(doc.ref));
        await batch.commit();
    }
}
