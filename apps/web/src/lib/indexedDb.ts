import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const RECENT_PLAYS_CAP = 100;

interface RadioDb extends DBSchema {
  recentPlays: {
    key: number;
    value: { trackId: string; playedAt: number };
    indexes: { "by-trackId": string };
  };
  favorites: {
    key: string;
    value: { trackId: string; cachedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<RadioDb>> | null = null;

function getDb(): Promise<IDBPDatabase<RadioDb>> {
  dbPromise ??= openDB<RadioDb>("audius-radio", 1, {
    upgrade(db) {
      const plays = db.createObjectStore("recentPlays", { autoIncrement: true });
      plays.createIndex("by-trackId", "trackId");
      db.createObjectStore("favorites", { keyPath: "trackId" });
    },
  });
  return dbPromise;
}

/** Appends a play and trims the store to the newest RECENT_PLAYS_CAP entries (ring buffer). */
export async function recordPlay(trackId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("recentPlays", "readwrite");
  await tx.store.add({ trackId, playedAt: Date.now() });
  const excess = (await tx.store.count()) - RECENT_PLAYS_CAP;
  if (excess > 0) {
    let cursor = await tx.store.openCursor();
    for (let i = 0; i < excess && cursor; i++) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  }
  await tx.done;
}

/** Track ids, most recently played first, de-duplicated. */
export async function getRecentTrackIds(limit = RECENT_PLAYS_CAP): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAll("recentPlays");
  return [...new Set(rows.reverse().map((r) => r.trackId))].slice(0, limit);
}

/** Replaces the cached set of favorite track ids (powers the "In your favorites" badge). */
export async function cacheFavorites(trackIds: string[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("favorites", "readwrite");
  await tx.store.clear();
  const cachedAt = Date.now();
  await Promise.all(trackIds.map((trackId) => tx.store.put({ trackId, cachedAt })));
  await tx.done;
}

export async function isCachedFavorite(trackId: string): Promise<boolean> {
  const db = await getDb();
  return (await db.get("favorites", trackId)) !== undefined;
}

export async function getCachedFavoriteIds(): Promise<string[]> {
  const db = await getDb();
  return db.getAllKeys("favorites");
}
