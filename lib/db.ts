import { openDB, type IDBPDatabase } from 'idb';
import type { CapturedRequest } from '../types';

const DB_NAME = 'snaprequest';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('requests')) {
          const store = database.createObjectStore('requests', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('status', 'status');
          store.createIndex('tabId', 'tabId');
        }
      },
    });
  }
  return dbPromise;
}

export async function addRequest(request: CapturedRequest): Promise<void> {
  const db = await getDB();
  await db.add('requests', request);
}

export async function cleanupOldRequests(bufferMs: number): Promise<number> {
  const db = await getDB();
  const cutoff = Date.now() - bufferMs;
  const tx = db.transaction('requests', 'readwrite');
  const index = tx.store.index('timestamp');
  const oldKeys = await index.getAllKeys(IDBKeyRange.upperBound(cutoff));
  for (const key of oldKeys) await tx.store.delete(key);
  await tx.done;
  return oldKeys.length;
}

export async function getRequestsForTab(tabId: number): Promise<CapturedRequest[]> {
  const db = await getDB();
  const all = (await db.getAllFromIndex('requests', 'tabId', tabId)) as CapturedRequest[];
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

export async function getRecentRequests(limit = 20): Promise<CapturedRequest[]> {
  const db = await getDB();
  const all = (await db.getAll('requests')) as CapturedRequest[];
  return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

export async function getLatestFailedRequests(limit = 20): Promise<CapturedRequest[]> {
  const db = await getDB();
  const all = (await db.getAll('requests')) as CapturedRequest[];
  return all
    .filter((r) => r.status >= 400 || r.status === 0)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export async function getLatestRequest(): Promise<CapturedRequest | null> {
  const failed = await getLatestFailedRequests(1);
  return failed[0] ?? null;
}

export async function clearRequests(): Promise<void> {
  const db = await getDB();
  await db.clear('requests');
}
