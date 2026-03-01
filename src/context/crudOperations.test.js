import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock firebaseCore.getDb ─────────────────────────────────────────
const mockSet = vi.fn().mockResolvedValue();
const mockUpdate = vi.fn().mockResolvedValue();
const mockDelete = vi.fn().mockResolvedValue();
const mockGet = vi.fn();
const mockDoc = vi.fn(() => ({ set: mockSet, update: mockUpdate, delete: mockDelete, ref: 'docRef' }));
const mockCollectionGet = vi.fn();
const mockCollection = vi.fn(() => ({ doc: mockDoc, get: mockCollectionGet }));
const mockBatchSet = vi.fn();
const mockBatchDelete = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue();
const mockBatch = vi.fn(() => ({ set: mockBatchSet, delete: mockBatchDelete, commit: mockBatchCommit }));
const mockRunTransaction = vi.fn();

const mockDb = {
    collection: mockCollection,
    batch: mockBatch,
    runTransaction: mockRunTransaction,
};

vi.mock('./firebaseCore', () => ({ getDb: () => mockDb }));
vi.mock('../utils/helpers', () => ({ genId: () => 'test-id-123' }));

import { add, update, updateWithLock, remove, setDoc, batchSet, clearCollection } from './crudOperations';

beforeEach(() => { vi.clearAllMocks(); });

// ═══════════════════════════════════════════════════════════════════════════
// add()
// ═══════════════════════════════════════════════════════════════════════════
describe('add', () => {
    it('creates doc with generated id when no id provided', async () => {
        const result = await add('workers', { name: 'Ivan' });
        expect(mockCollection).toHaveBeenCalledWith('workers');
        expect(mockDoc).toHaveBeenCalledWith('test-id-123');
        expect(mockSet).toHaveBeenCalledWith({ name: 'Ivan', id: 'test-id-123' });
        expect(result).toEqual({ name: 'Ivan', id: 'test-id-123' });
    });

    it('uses provided id instead of generating one', async () => {
        const result = await add('workers', { name: 'Ana', id: 'custom-id' });
        expect(mockDoc).toHaveBeenCalledWith('custom-id');
        expect(result.id).toBe('custom-id');
    });

    it('throws and calls handleError on Firestore failure', async () => {
        mockSet.mockRejectedValueOnce(new Error('network'));
        await expect(add('workers', { name: 'X' })).rejects.toThrow('network');
    });

    it('throws enriched message on permission-denied', async () => {
        const permErr = new Error('Missing permissions');
        permErr.code = 'permission-denied';
        mockSet.mockRejectedValueOnce(permErr);
        await expect(add('workers', {})).rejects.toThrow();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// update()
// ═══════════════════════════════════════════════════════════════════════════
describe('update', () => {
    it('calls Firestore update with correct args', async () => {
        await update('workers', 'w1', { name: 'Updated' });
        expect(mockCollection).toHaveBeenCalledWith('workers');
        expect(mockDoc).toHaveBeenCalledWith('w1');
        expect(mockUpdate).toHaveBeenCalledWith({ name: 'Updated' });
    });

    it('throws on failure', async () => {
        mockUpdate.mockRejectedValueOnce(new Error('fail'));
        await expect(update('workers', 'w1', {})).rejects.toThrow('fail');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateWithLock() — optimistic locking
// ═══════════════════════════════════════════════════════════════════════════
describe('updateWithLock', () => {
    it('succeeds when lastModified matches', async () => {
        mockRunTransaction.mockImplementation(async (fn) => {
            const transactionGet = vi.fn().mockResolvedValue({
                exists: true,
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
        mockRunTransaction.mockImplementation(async (fn) => {
            const transactionGet = vi.fn().mockResolvedValue({
                exists: true,
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
        mockRunTransaction.mockImplementation(async (fn) => {
            const transactionGet = vi.fn().mockResolvedValue({ exists: false });
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
        expect(mockCollection).toHaveBeenCalledWith('workers');
        expect(mockDoc).toHaveBeenCalledWith('w1');
        expect(mockDelete).toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// setDoc()
// ═══════════════════════════════════════════════════════════════════════════
describe('setDoc', () => {
    it('sets document with explicit id', async () => {
        await setDoc('settings', 'main', { theme: 'dark' });
        expect(mockDoc).toHaveBeenCalledWith('main');
        expect(mockSet).toHaveBeenCalledWith({ theme: 'dark' });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// batchSet()
// ═══════════════════════════════════════════════════════════════════════════
describe('batchSet', () => {
    it('batches items in groups of 450', async () => {
        const items = Array.from({ length: 500 }, (_, i) => ({ id: `id-${i}`, val: i }));
        mockCollectionGet.mockResolvedValue({ docs: [] });
        await batchSet('workers', items);
        // 500 items → 2 batches (450 + 50)
        expect(mockBatch).toHaveBeenCalledTimes(2);
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
        mockCollectionGet.mockResolvedValue({ docs });
        await clearCollection('workers');
        expect(mockBatchDelete).toHaveBeenCalledTimes(5);
        expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it('handles empty collection', async () => {
        mockCollectionGet.mockResolvedValue({ docs: [] });
        await clearCollection('workers');
        expect(mockBatchDelete).not.toHaveBeenCalled();
    });
});
