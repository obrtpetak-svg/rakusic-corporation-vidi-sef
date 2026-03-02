import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();
const bucket = admin.storage().bucket();

// ═══════════════════════════════════════════════════════════════
// SCHEDULED FIRESTORE BACKUP — runs every day at 3:00 AM (Europe/Zagreb)
// Exports all collections to Firebase Storage as JSON
// ═══════════════════════════════════════════════════════════════

export const scheduledBackup = functions
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

        const backup: Record<string, unknown[]> = {};
        let totalDocs = 0;

        for (const name of collections) {
            try {
                const snap = await db.collection(name).get();
                backup[name] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                totalDocs += snap.size;
            } catch (e) {
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

export const cleanupOldBackups = functions
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
