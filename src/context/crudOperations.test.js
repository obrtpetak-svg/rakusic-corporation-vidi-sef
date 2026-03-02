import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Firebase Modular SDK ────────────────────────────────────────
const mockSetDoc = vi.fn().mockResolvedValue();
const mockUpdateDoc = vi.fn().mockResolvedValue();
const mockDeleteDoc = vi.fn().mockResolvedValue();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockDoc = vi.fn((db, col, id) => ({ _path: `${col}/${id}`, ref: `ref-${col}-${id}` }));
const mockCollection = vi.fn((db, col) => ({ _col: col }));
const mockWriteBatch = vi.fn(() => ({
    set: mockBatchSet,
    delete: mockBatchDelete,
    commit: mockBatchCommit,
}));
const mockRunTransaction = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchDelete = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue();

vi.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    collection: (...args) => mockCollection(...args),
    setDoc: (...args) => mockSetDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    deleteDoc: (...args) => mockDeleteDoc(...args),
    getDoc: (...args) => mockGetDoc(...args),
    getDocs: (...args) => mockGetDocs(...args),
    writeBatch: (...args) => mockWriteBatch(...args),
    runTransaction: (...args) => mockRunTransaction(...args),
}));

// ─── Mock firebaseCore.getDb ─────────────────────────────────────────
const mockDb = { type: 'firestore', _tag: 'mockDb' };
vi.mock('./firebaseCore', () => ({ getDb: () => mockDb }));
vi.mock('../utils/helpers', () => ({ genId: () => 'test-id-123' }));

import { add, update, updateWithLock, remove, setDocument, batchSet, clearCollection } from './crudOperations';

beforeEach(() => { vi.clearAllMocks(); });

// ═══════════════════════════════════════════════════════════════════════════
// add()
// ═══════════════════════════════════════════════════════════════════════════
describe('add', () => {
    it('creates doc with generated id when no id provided', async () => {
        const result = await add('workers', { name: 'Ivan' });
        expect(mockDoc).toHaveBeenCalledWith(mockDb, 'workers', 'test-id-123');
        expect(mockSetDoc).toHaveBeenCalledWith(
            expect.objectContaining({ _path: 'workers/test-id-123' }),
            { name: 'Ivan', id: 'test-id-123' }
        );
        expect(result).toEqual({ name: 'Ivan', id: 'test-id-123' });
    });

    it('uses provided id instead of generating one', async () => {
        const result = await add('workers', { name: 'Ana', id: 'custom-id' });
        expect(mockDoc).toHaveBeenCalledWith(mockDb, 'workers', 'custom-id');
        expect(result.id).toBe('custom-id');
    });

    it('throws and calls handleError on Firestore failure', async () => {
        mockSetDoc.mockRejectedValueOnce(new Error('network'));
        await expect(add('workers', { name: 'X' })).rejects.toThrow('network');
    });

    it('throws enriched message on permission-denied', async () => {
        const permErr = new Error('Missing permissions');
        permErr.code = 'permission-denied';
        mockSetDoc.mockRejectedValueOnce(permErr);
        await expect(add('workers', {})).rejects.toThrow();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// update()
// ═══════════════════════════════════════════════════════════════════════════
describe('update', () => {
    it('calls Firestore updateDoc with correct args', async () => {
        await update('workers', 'w1', { name: 'Updated' });
        expect(mockDoc).toHaveBeenCalledWith(mockDb, 'workers', 'w1');
        expect(mockUpdateDoc).toHaveBeenCalledWith(
            expect.objectContaining({ _path: 'workers/w1' }),
            { name: 'Updated' }
        );
    });

    it('throws on failure', async () => {
        mockUpdateDoc.mockRejectedValueOnce(new Error('fail'));
        await expect(update('workers', 'w1', {})).rejects.toThrow('fail');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateWithLock() — optimistic locking
// ═══════════════════════════════════════════════════════════════════════════
describe('updateWithLock', () => {
    it('succeeds when lastModified matches', async () => {
        mockRunTransaction.mockImplementation(async (db, fn) => {
            const transactionGet = vi.fn().mockResolvedValue({
                exists: () => true,
                data: () => ({ lastModified: '2024-01-01T00:00:00Z' }),
            });
            const transactionUpdate = vi.fn();
            await fn({ get: transactionGet, update: transactionUpdate });
            expect(transactionUpdate).toHaveBeenCalled();
        });

        await updateWithLock('workers', 'w1', {
            name: 'New',
            _expectedLastModified: '2024-01-01T00:00:00Z',
        });
        expect(mockRunTransaction).toHaveBeenCalled();
    });

    it('throws CONFLICT when lastModified differs', async () => {
        mockRunTransaction.mockImplementation(async (db, fn) => {
            const transactionGet = vi.fn().mockResolvedValue({
                exists: () => true,
                data: () => ({ lastModified: '2024-01-02T00:00:00Z' }),
            });
            await fn({ get: transactionGet, update: vi.fn() });
        });

        await expect(
            updateWithLock('workers', 'w1', {
                name: 'New',
                _expectedLastModified: '2024-01-01T00:00:00Z',
            })
        ).rejects.toThrow('CONFLICT');
    });

    it('throws when document does not exist', async () => {
        mockRunTransaction.mockImplementation(async (db, fn) => {
            const transactionGet = vi.fn().mockResolvedValue({ exists: () => false });
            await fn({ get: transactionGet, update: vi.fn() });
        });

        await expect(updateWithLock('workers', 'w1', {})).rejects.toThrow('Document not found');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// remove()
// ═══════════════════════════════════════════════════════════════════════════
describe('remove', () => {
    it('deletes document by id', async () => {
        await remove('workers', 'w1');
        expect(mockDoc).toHaveBeenCalledWith(mockDb, 'workers', 'w1');
        expect(mockDeleteDoc).toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// setDocument()
// ═══════════════════════════════════════════════════════════════════════════
describe('setDocument', () => {
    it('sets document with explicit id', async () => {
        await setDocument('settings', 'main', { theme: 'dark' });
        expect(mockDoc).toHaveBeenCalledWith(mockDb, 'settings', 'main');
        expect(mockSetDoc).toHaveBeenCalledWith(
            expect.objectContaining({ _path: 'settings/main' }),
            { theme: 'dark' }
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// batchSet()
// ═══════════════════════════════════════════════════════════════════════════
describe('batchSet', () => {
    it('batches items in groups of 450', async () => {
        const items = Array.from({ length: 500 }, (_, i) => ({ id: `id-${i}`, val: i }));
        await batchSet('workers', items);
        // 500 items → 2 batches (450 + 50)
        expect(mockWriteBatch).toHaveBeenCalledTimes(2);
        expect(mockBatchCommit).toHaveBeenCalledTimes(2);
        expect(mockBatchSet).toHaveBeenCalledTimes(500);
    });

    it('generates ids for items without id', async () => {
        await batchSet('workers', [{ name: 'Test' }]);
        expect(mockBatchSet).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ id: 'test-id-123', name: 'Test' })
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// clearCollection()
// ═══════════════════════════════════════════════════════════════════════════
describe('clearCollection', () => {
    it('deletes all docs in batches of 450', async () => {
        const docs = Array.from({ length: 5 }, (_, i) => ({ ref: `ref-${i}` }));
        mockGetDocs.mockResolvedValue({ docs });
        await clearCollection('workers');
        expect(mockBatchDelete).toHaveBeenCalledTimes(5);
        expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it('handles empty collection', async () => {
        mockGetDocs.mockResolvedValue({ docs: [] });
        await clearCollection('workers');
        expect(mockBatchDelete).not.toHaveBeenCalled();
    });
});
