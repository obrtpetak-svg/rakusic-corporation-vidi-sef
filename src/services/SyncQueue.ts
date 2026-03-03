// ═══════════════════════════════════════════════════════
// SyncQueue — IndexedDB-based offline queue for GPS data
// Persists writes that fail when offline, auto-flushes
// when connectivity is restored with exponential backoff.
// H-8: Now deduplicates by type + workerId before enqueue.
// ═══════════════════════════════════════════════════════
import { log, warn } from '../utils/logger';

const DB_NAME = 'vidisef-sync';
const DB_VERSION = 2; // bumped for new index
const STORE_NAME = 'pendingWrites';
const MAX_BATCH = 10;
const MAX_RETRIES = 5;

interface SyncEntry { id?: number; type: string; payload: Record<string, unknown>; dedupKey: string; createdAt: number; retries: number; }

let _db: IDBDatabase | null = null;

// ── Open IndexedDB ──
function openDB(): Promise<IDBDatabase> {
    if (_db) return Promise.resolve(_db);
    return new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            let store;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('createdAt', 'createdAt');
            } else {
                store = req.transaction!.objectStore(STORE_NAME);
            }
            // H-8: Index for dedup lookups
            if (!store.indexNames.contains('typeWorker')) {
                store.createIndex('typeWorker', 'dedupKey');
            }
        };
        req.onsuccess = () => { _db = req.result; resolve(_db); };
        req.onerror = () => reject(req.error);
    });
}

// ── Enqueue a failed write (with deduplication) ──
export async function enqueue(type: string, payload: Record<string, unknown>) {
    try {
        const db = await openDB();
        const dedupKey = `${type}:${payload?.workerId || 'unknown'}`;

        // H-8: Check for existing entry with same type + workerId
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('typeWorker');
        const existing = await idbRequest(index.get(dedupKey));

        const entry = {
            type,
            payload,
            dedupKey,
            createdAt: Date.now(),
            retries: 0,
        };

        if (existing) {
            // Replace existing entry (keep same id, update payload)
            (entry as SyncEntry & { id: number }).id = (existing as SyncEntry).id!;
            store.put(entry);
            log(`[SyncQueue] Replaced existing ${type} for worker ${payload?.workerId}`);
        } else {
            store.add(entry);
            log(`[SyncQueue] Enqueued ${type}`);
        }

        await txComplete(tx);
        return true;
    } catch (err) {
        warn('[SyncQueue] Enqueue failed:', err);
        return false;
    }
}

// ── Get pending count ──
export async function getPendingCount() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        return new Promise((resolve) => {
            const req = tx.objectStore(STORE_NAME).count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(0);
        });
    } catch { return 0; }
}

// ── Flush queue — process pending writes ──
export async function flush(writeFn: (type: string, payload: Record<string, unknown>) => Promise<void>) {
    if (!navigator.onLine) return 0;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const items = await getAllFromStore(store, MAX_BATCH) as SyncEntry[];
        if (!items.length) return 0;

        let processed = 0;
        for (const item of items) {
            try {
                await writeFn(item.type, item.payload);
                // Success — remove from queue
                const delTx = db.transaction(STORE_NAME, 'readwrite');
                delTx.objectStore(STORE_NAME).delete(item.id!);
                await txComplete(delTx);
                processed++;
            } catch (err) {
                // Increment retry count, remove if maxed out
                const updTx = db.transaction(STORE_NAME, 'readwrite');
                if (item.retries >= MAX_RETRIES) {
                    updTx.objectStore(STORE_NAME).delete(item.id!);
                    warn(`[SyncQueue] Dropped item after ${MAX_RETRIES} retries:`, item.type);
                } else {
                    updTx.objectStore(STORE_NAME).put({ ...item, retries: item.retries + 1 });
                }
                await txComplete(updTx);
            }
        }
        log(`[SyncQueue] Flushed ${processed}/${items.length} items`);
        return processed;
    } catch (err) {
        warn('[SyncQueue] Flush error:', err);
        return 0;
    }
}

// ── Auto-flush on online event ──
let _autoFlushBound = false;
export function startAutoFlush(writeFn: (type: string, payload: Record<string, unknown>) => Promise<void>) {
    if (_autoFlushBound) return;
    _autoFlushBound = true;
    const doFlush = () => {
        setTimeout(() => flush(writeFn), 2000); // 2s delay after coming online
    };
    window.addEventListener('online', doFlush);
    // Also try flushing on init if online
    if (navigator.onLine) doFlush();
}

// ── Helpers ──
function txComplete(tx: IDBTransaction) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

function idbRequest(req: IDBRequest) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function getAllFromStore(store: IDBObjectStore, limit: number) {
    return new Promise((resolve) => {
        const items: Record<string, unknown>[] = [];
        const req = store.openCursor();
        req.onsuccess = (e: Event) => {
            const cursor = (e.target as IDBRequest).result;
            if (cursor && items.length < limit) {
                items.push(cursor.value);
                cursor.continue();
            } else {
                resolve(items);
            }
        };
        req.onerror = () => resolve([]);
    });
}
