/**
 * CivicFlow — Phase 3B: Offline Report Queue & Resilient Ingestion
 * 
 * Objectives:
 * 1. Store offline citizen reports in browser IndexedDB (civicflow_offline_db).
 * 2. Zero-token security: Never store auth tokens or credentials in IndexedDB.
 * 3. Client-generated UUIDs serve as idempotency keys (X-Idempotency-Key).
 * 4. Automatic background synchronization when the network reconnects.
 * 5. Handles validation errors gracefully without endless retry loops.
 */

import { api } from './api';

const DB_NAME = 'civicflow_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'report_queue';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function generateUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const offlineQueue = {
  /**
   * Saves a report locally into IndexedDB with client-generated UUID.
   * ZERO TOKENS are stored.
   */
  async enqueueReport(reportData) {
    const db = await openDatabase();
    const id = reportData.id || generateUuid();

    const entry = {
      id,
      category: reportData.category,
      description: reportData.description,
      latitude: reportData.latitude !== undefined ? reportData.latitude : null,
      longitude: reportData.longitude !== undefined ? reportData.longitude : null,
      accuracy: reportData.accuracy !== undefined ? reportData.accuracy : null,
      photoData: reportData.photoData || null,
      status: 'PENDING_SYNC',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      lastError: null,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(entry);

      req.onsuccess = () => resolve(entry);
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Retrieves all reports currently pending synchronization.
   */
  async getPendingReports() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const all = req.result || [];
        const pending = all.filter((r) => r.status === 'PENDING_SYNC');
        resolve(pending);
      };
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Retrieves all queued reports regardless of status.
   */
  async getAllReports() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Deletes a synced report from IndexedDB.
   */
  async removeReport(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Marks a report as FAILED_VALIDATION to prevent infinite retry loops.
   */
  async markReportFailed(id, errorMessage) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const item = getReq.result;
        if (item) {
          item.status = 'FAILED_VALIDATION';
          item.lastError = errorMessage;
          store.put(item);
        }
        resolve(item);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },

  /**
   * Synchronizes pending reports using the active session token in memory.
   * 
   * @param {string} token - Active in-memory session token
   * @param {Function} onProgress - Callback for sync events
   * @returns {Object} { total, synced, failed }
   */
  async syncQueue(token, onProgress = null) {
    if (!token) {
      console.warn('[OfflineQueue] Cannot sync without active session token');
      return { total: 0, synced: 0, failed: 0 };
    }

    const pending = await this.getPendingReports();
    if (pending.length === 0) {
      return { total: 0, synced: 0, failed: 0 };
    }

    let syncedCount = 0;
    let failedCount = 0;

    for (const report of pending) {
      try {
        const payload = {
          category: report.category,
          description: report.description,
          latitude: report.latitude,
          longitude: report.longitude,
          accuracy: report.accuracy,
          photoData: report.photoData,
          idempotencyKey: report.id,
        };

        const res = await api.createReport(payload, token, { idempotencyKey: report.id });

        if (res.ok) {
          await this.removeReport(report.id);
          syncedCount++;
          if (onProgress) {
            onProgress({ type: 'SUCCESS', reportId: report.id, serverData: res.data });
          }
        } else {
          // Client/validation error (e.g. 400 Bad Request / Content moderation)
          if (res.status >= 400 && res.status < 500) {
            const msg = res.data?.message || res.data?.error || 'Validation error';
            await this.markReportFailed(report.id, msg);
            failedCount++;
            if (onProgress) {
              onProgress({ type: 'VALIDATION_ERROR', reportId: report.id, message: msg });
            }
          } else {
            // Server error 5xx: keep as PENDING_SYNC for later retry
            failedCount++;
            if (onProgress) {
              onProgress({ type: 'SERVER_ERROR', reportId: report.id });
            }
          }
        }
      } catch (err) {
        console.warn(`[OfflineQueue] Network error while syncing Report ${report.id}:`, err.message);
        failedCount++;
        if (onProgress) {
          onProgress({ type: 'NETWORK_ERROR', reportId: report.id, error: err.message });
        }
      }
    }

    return { total: pending.length, synced: syncedCount, failed: failedCount };
  },

  /**
   * Sets up automatic sync upon network reconnection.
   */
  setupAutoSync(getToken, onComplete = null) {
    if (typeof window === 'undefined') return;

    const handleOnline = async () => {
      console.log('[OfflineQueue] Network restored. Initiating automatic sync...');
      const token = typeof getToken === 'function' ? getToken() : null;
      if (token) {
        const result = await this.syncQueue(token, (event) => {
          console.log('[OfflineQueue] Sync event:', event);
        });
        if (onComplete) onComplete(result);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  },
};
