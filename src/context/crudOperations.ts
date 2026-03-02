import { genId } from '../utils/helpers';
import { getDb } from './firebaseCore';
import {
    doc, setDoc, updateDoc, deleteDoc, getDocs,
    collection, writeBatch, runTransaction,
} from 'firebase/firestore';
import type { Firestore, Transaction } from 'firebase/firestore';

// ═══════════════════════════════════════════════════════════════════════════
// CRUD OPERATIONS — Firestore document operations (Modular SDK)
// Separated for clarity and reusability. All exported functions are
// standalone (not hooks) — they can be called from any context.
// ═══════════════════════════════════════════════════════════════════════════

interface FirestoreError extends Error {
    code?: string;
}

function handleError(e: FirestoreError, op: string): void {
    if (e.code === 'permission-denied' || (e.message && e.message.includes('permissions'))) {
        throw new Error("FIRESTORE_PERMISSION: Firestore rules blokiraju. Firebase Console → Firestore → Rules → allow read, write: if true;");
    }
    console.error(`Firestore ${op} error:`, e);
}

export async function add(col: string, data: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const db = getDb(); if (!db) return null;
    const id = (data.id as string) || genId();
    const docData = { ...data, id };
    try { await setDoc(doc(db, col, id), docData); return docData; }
    catch (e) { handleError(e as FirestoreError, 'add'); throw e; }
}

export async function update(col: string, id: string, updates: Record<string, unknown>): Promise<void> {
    const db = getDb(); if (!db) return;
    try { await updateDoc(doc(db, col, id), updates); }
    catch (e) { handleError(e as FirestoreError, 'update'); throw e; }
}

// H-6: Optimistic locking — prevents concurrent write conflicts
export async function updateWithLock(col: string, id: string, updates: Record<string, unknown> & { _expectedLastModified?: string }): Promise<void> {
    const db = getDb(); if (!db) return;
    try {
        await runTransaction(db, async (transaction: Transaction) => {
            const docRef = doc(db, col, id);
            const snap = await transaction.get(docRef);
            if (!snap.exists()) throw new Error('Document not found');
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

export async function remove(col: string, id: string): Promise<void> {
    const db = getDb(); if (!db) return;
    try { await deleteDoc(doc(db, col, id)); }
    catch (e) { handleError(e as FirestoreError, 'remove'); throw e; }
}

export async function setDocument(col: string, docId: string, data: Record<string, unknown>): Promise<void> {
    const db = getDb(); if (!db) return;
    try { await setDoc(doc(db, col, docId), data); }
    catch (e) { handleError(e as FirestoreError, 'setDoc'); throw e; }
}

// Batch operations for backup/restore
export async function batchSet(col: string, items: Record<string, unknown>[]): Promise<void> {
    const db = getDb(); if (!db) return;
    for (let i = 0; i < items.length; i += 450) {
        const batch = writeBatch(db);
        items.slice(i, i + 450).forEach((item) => {
            const id = (item.id as string) || genId();
            batch.set(doc(db, col, id), { ...item, id });
        });
        await batch.commit();
    }
}

export async function clearCollection(col: string): Promise<void> {
    const db = getDb(); if (!db) return;
    const snap = await getDocs(collection(db, col));
    for (let i = 0; i < snap.docs.length; i += 450) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }
}
