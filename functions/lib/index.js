"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldBackups = exports.scheduledBackup = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();
// ═══════════════════════════════════════════════════════════════
// SCHEDULED FIRESTORE BACKUP — runs every day at 3:00 AM (Europe/Zagreb)
// Exports all collections to Firebase Storage as JSON
// ═══════════════════════════════════════════════════════════════
exports.scheduledBackup = functions
    .region('europe-west1')
    .pubsub
    .schedule('0 3 * * *')
    .timeZone('Europe/Zagreb')
    .onRun(async () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const collections = [
        'users', 'workers', 'projects', 'timesheets', 'invoices',
        'otpremnice', 'vehicles', 'smjestaj', 'obaveze', 'auditLog',
        'dailyLogs', 'production', 'config', 'safetyTemplates',
        'safetyChecklists', 'leaveRequests', 'fuelLogs',
    ];
    const backup = {};
    let totalDocs = 0;
    for (const name of collections) {
        try {
            const snap = await db.collection(name).get();
            backup[name] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            totalDocs += snap.size;
        }
        catch (e) {
            console.warn(`[Backup] Skipping ${name}:`, e);
            backup[name] = [];
        }
    }
    const json = JSON.stringify({
        version: '3.0.0',
        createdAt: new Date().toISOString(),
        type: 'scheduled-backup',
        totalDocs,
        ...backup,
    }, null, 2);
    // Save to Storage
    const filePath = `backups/vidisef-backup-${timestamp}.json`;
    const file = bucket.file(filePath);
    await file.save(json, { contentType: 'application/json' });
    // Log it
    await db.collection('auditLog').add({
        action: 'SCHEDULED_BACKUP',
        user: 'System',
        timestamp: new Date().toISOString(),
        details: `Auto backup: ${totalDocs} docs → ${filePath} (${(json.length / 1024).toFixed(0)} KB)`,
    });
    console.log(`[Backup] ✅ ${totalDocs} docs exported to ${filePath}`);
    return null;
});
// ═══════════════════════════════════════════════════════════════
// CLEANUP OLD BACKUPS — runs weekly, keeps last 30 backups
// ═══════════════════════════════════════════════════════════════
exports.cleanupOldBackups = functions
    .region('europe-west1')
    .pubsub
    .schedule('0 4 * * 0') // Sunday at 4 AM
    .timeZone('Europe/Zagreb')
    .onRun(async () => {
    const [files] = await bucket.getFiles({ prefix: 'backups/' });
    if (files.length <= 30) {
        console.log(`[Cleanup] Only ${files.length} backups, no cleanup needed`);
        return null;
    }
    // Sort by name (date-based), keep last 30
    const sorted = files.sort((a, b) => a.name.localeCompare(b.name));
    const toDelete = sorted.slice(0, sorted.length - 30);
    for (const file of toDelete) {
        await file.delete();
        console.log(`[Cleanup] Deleted ${file.name}`);
    }
    console.log(`[Cleanup] ✅ Deleted ${toDelete.length} old backups`);
    return null;
});
//# sourceMappingURL=index.js.map