// ═══════════════════════════════════════════════════════
// Vi-Di-Sef v3 — Firebase Data Layer (Scalable)
// Each record = its own Firestore document in a collection
// ═══════════════════════════════════════════════════════
import { initializeApp } from 'firebase/app'
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    onSnapshot,
    enableIndexedDbPersistence
} from 'firebase/firestore'

let db = null
let app = null

// ── Collections ──
export const COLLECTIONS = {
    users: 'users',
    projects: 'projects',
    workers: 'workers',
    timesheets: 'timesheets',
    invoices: 'invoices',
    otpremnice: 'otpremnice',
    auditLog: 'auditLog',
    vehicles: 'vehicles',
    smjestaj: 'smjestaj',
    obaveze: 'obaveze',
    companyProfile: 'companyProfile',
    stats: 'stats'
}

// ── Initialize Firebase ──
export function initFirebase(config) {
    try {
        if (!config || !config.apiKey) return false
        app = initializeApp(config)
        db = getFirestore(app)
        enableIndexedDbPersistence(db).catch(() => { })
        return true
    } catch (e) {
        console.error('Firebase init error:', e)
        return false
    }
}

export function getDb() { return db }

// ── CRUD Operations ──

// Add a new item to a collection
export async function addItem(col, data) {
    if (!db) return null
    try {
        if (data.id) {
            await setDoc(doc(db, col, data.id), data)
            return data.id
        }
        const ref = await addDoc(collection(db, col), data)
        return ref.id
    } catch (e) {
        console.error('addItem error:', e)
        return null
    }
}

// Update an existing item
export async function updateItem(col, id, data) {
    if (!db) return false
    try {
        await updateDoc(doc(db, col, id), data)
        return true
    } catch (e) {
        console.error('updateItem error:', e)
        return false
    }
}

// Delete an item
export async function deleteItem(col, id) {
    if (!db) return false
    try {
        await deleteDoc(doc(db, col, id))
        return true
    } catch (e) {
        console.error('deleteItem error:', e)
        return false
    }
}

// Get a single document
export async function getItem(col, id) {
    if (!db) return null
    try {
        const snap = await getDoc(doc(db, col, id))
        return snap.exists() ? { ...snap.data(), id: snap.id } : null
    } catch (e) {
        console.error('getItem error:', e)
        return null
    }
}

// Fetch all items from a collection (for small collections like users, projects)
export async function fetchAll(col) {
    if (!db) return []
    try {
        const snap = await getDocs(collection(db, col))
        return snap.docs.map(d => ({ ...d.data(), id: d.id }))
    } catch (e) {
        console.error('fetchAll error:', e)
        return []
    }
}

// Fetch paginated results
export async function fetchPage(col, pageLimit = 50, lastDoc = null, orderField = 'createdAt', dir = 'desc') {
    if (!db) return { data: [], lastDoc: null }
    try {
        let q = query(
            collection(db, col),
            orderBy(orderField, dir),
            limit(pageLimit)
        )
        if (lastDoc) {
            q = query(
                collection(db, col),
                orderBy(orderField, dir),
                startAfter(lastDoc),
                limit(pageLimit)
            )
        }
        const snap = await q.get ? await getDocs(q) : await getDocs(q)
        const data = snap.docs.map(d => ({ ...d.data(), id: d.id }))
        const last = snap.docs[snap.docs.length - 1] || null
        return { data, lastDoc: last }
    } catch (e) {
        console.error('fetchPage error:', e)
        return { data: [], lastDoc: null }
    }
}

// Fetch with filters (server-side)
export async function fetchFiltered(col, filters = [], orderField = 'createdAt', dir = 'desc', pageLimit = 100) {
    if (!db) return []
    try {
        let constraints = filters.map(f => where(f.field, f.op, f.value))
        constraints.push(orderBy(orderField, dir))
        constraints.push(limit(pageLimit))
        const q = query(collection(db, col), ...constraints)
        const snap = await getDocs(q)
        return snap.docs.map(d => ({ ...d.data(), id: d.id }))
    } catch (e) {
        console.error('fetchFiltered error:', e)
        return []
    }
}

// Real-time subscription to a collection
export function subscribeCollection(col, callback, filters = []) {
    if (!db) return () => { }
    try {
        let q
        if (filters.length > 0) {
            const constraints = filters.map(f => where(f.field, f.op, f.value))
            q = query(collection(db, col), ...constraints)
        } else {
            q = collection(db, col)
        }
        return onSnapshot(q, snap => {
            const data = snap.docs.map(d => ({ ...d.data(), id: d.id }))
            callback(data)
        })
    } catch (e) {
        console.error('subscribe error:', e)
        return () => { }
    }
}

// ── Migration Helper ──
// Migrate old monolithic data (array in one doc) to individual documents
export async function migrateCollection(oldKey, newCol, data) {
    if (!db || !data || !Array.isArray(data)) return false
    try {
        let count = 0
        for (const item of data) {
            const id = item.id || `migrated_${Date.now()}_${count}`
            await setDoc(doc(db, newCol, id), { ...item, id, migratedAt: new Date().toISOString() })
            count++
        }
        console.log(`Migrated ${count} items to ${newCol}`)
        return true
    } catch (e) {
        console.error('Migration error:', e)
        return false
    }
}

// ── Config Persistence ──
const CONFIG_KEY = 'vidime-firebase-config-v9'

export function getSavedConfig() {
    try {
        const s = localStorage.getItem(CONFIG_KEY)
        return s ? JSON.parse(s) : null
    } catch { return null }
}

export function saveConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}

export function clearConfig() {
    localStorage.removeItem(CONFIG_KEY)
}
