import { Database } from "bun:sqlite";
import { and, desc, eq, like, lte, sql } from "drizzle-orm";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  databaseSchema,
  downloads,
  mediaCache,
  settings,
  syncStatus,
} from "./database-schema";

export type MediaCacheEntry<T = unknown> = {
  serverId: string;
  cacheKey: string;
  value: T;
  updatedAt: number;
  expiresAt: number;
};

export type DownloadStatus =
  | "queued"
  | "downloading"
  | "paused"
  | "completed"
  | "failed";

export type DownloadRecord = {
  id: string;
  serverId: string;
  ratingKey: string;
  mediaType: "track" | "album" | "playlist";
  title: string;
  filePath: string | null;
  partialPath: string | null;
  status: DownloadStatus;
  bytesDownloaded: number;
  totalBytes: number | null;
  error: string | null;
  metadata: unknown;
  createdAt: number;
  updatedAt: number;
};

export type DownloadInput = Omit<DownloadRecord, "createdAt" | "updatedAt"> & {
  createdAt?: number;
  updatedAt?: number;
};

export type SyncStatus = "idle" | "running" | "completed" | "failed";

export type SyncRecord = {
  serverId: string;
  libraryKey: string;
  status: SyncStatus;
  cursor: string | null;
  lastStartedAt: number | null;
  lastCompletedAt: number | null;
  error: string | null;
  details: unknown;
};

type DatabaseManagerOptions = { path?: string };

type DatabaseSchema = typeof databaseSchema;
type DrizzleDatabase = BunSQLiteDatabase<DatabaseSchema>;

const SCHEMA_VERSION = 1;

export class DatabaseManager {
  private sqlite: Database;
  private db: DrizzleDatabase;
  private readonly dbPath: string;

  constructor(options: DatabaseManagerOptions = {}) {
    this.dbPath = options.path ?? join(this.userDataPath(), "rayna.db");
    if (this.dbPath !== ":memory:")
      mkdirSync(dirname(this.dbPath), { recursive: true });
    this.sqlite = this.openDatabase();
    this.db = drizzle(this.sqlite, { schema: databaseSchema });
    this.initializeSchema();
  }

  close(): void {
    this.sqlite.close();
  }

  getSchemaVersion(): number {
    return this.readSchemaVersion();
  }

  get(key: string): unknown {
    const row = this.db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, key))
      .get();
    return row ? safeParse(row.value) : null;
  }

  set(key: string, value: unknown): void {
    this.db
      .insert(settings)
      .values({ key, value: JSON.stringify(value) })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: JSON.stringify(value) },
      })
      .run();
  }

  getMediaCache<T = unknown>(
    serverId: string,
    cacheKey: string,
  ): MediaCacheEntry<T> | null {
    const row = this.db
      .select()
      .from(mediaCache)
      .where(
        and(
          eq(mediaCache.serverId, serverId),
          eq(mediaCache.cacheKey, cacheKey),
        ),
      )
      .get();
    if (!row) return null;
    const value = safeParse(row.value, CORRUPT_JSON);
    if (value === CORRUPT_JSON) {
      this.deleteMediaCache(serverId, cacheKey);
      return null;
    }
    return { ...row, value: value as T };
  }

  getLatestMediaCacheByPrefix<T = unknown>(
    serverId: string,
    cacheKeyPrefix: string,
  ): MediaCacheEntry<T> | null {
    const row = this.db
      .select()
      .from(mediaCache)
      .where(
        and(
          eq(mediaCache.serverId, serverId),
          like(mediaCache.cacheKey, `${cacheKeyPrefix}%`),
        ),
      )
      .orderBy(desc(mediaCache.updatedAt))
      .limit(1)
      .get();
    if (!row) return null;
    const value = safeParse(row.value, CORRUPT_JSON);
    if (value === CORRUPT_JSON) {
      this.deleteMediaCache(serverId, row.cacheKey);
      return null;
    }
    return { ...row, value: value as T };
  }

  setMediaCache<T>(entry: MediaCacheEntry<T>): void {
    this.db
      .insert(mediaCache)
      .values({ ...entry, value: JSON.stringify(entry.value) })
      .onConflictDoUpdate({
        target: [mediaCache.serverId, mediaCache.cacheKey],
        set: {
          value: JSON.stringify(entry.value),
          updatedAt: entry.updatedAt,
          expiresAt: entry.expiresAt,
        },
      })
      .run();
  }

  getCacheEntry<T>(
    serverId: string,
    cacheKey: string,
  ): Omit<MediaCacheEntry<T>, "serverId" | "cacheKey"> | null {
    const entry = this.getMediaCache<T>(serverId, cacheKey);
    if (!entry) return null;
    return {
      value: entry.value,
      updatedAt: entry.updatedAt,
      expiresAt: entry.expiresAt,
    };
  }

  setCacheEntry<T>(
    serverId: string,
    cacheKey: string,
    entry: Omit<MediaCacheEntry<T>, "serverId" | "cacheKey">,
  ): void {
    this.setMediaCache({ serverId, cacheKey, ...entry });
  }

  deleteMediaCache(serverId: string, cacheKey?: string): void {
    this.db
      .delete(mediaCache)
      .where(
        cacheKey === undefined
          ? eq(mediaCache.serverId, serverId)
          : and(
              eq(mediaCache.serverId, serverId),
              eq(mediaCache.cacheKey, cacheKey),
            ),
      )
      .run();
  }

  deleteExpiredMediaCache(now = Date.now()): number {
    const expired = this.db
      .select({ count: sql<number>`count(*)` })
      .from(mediaCache)
      .where(lte(mediaCache.expiresAt, now))
      .get();
    this.db.delete(mediaCache).where(lte(mediaCache.expiresAt, now)).run();
    return Number(expired?.count ?? 0);
  }

  upsertDownload(input: DownloadInput): DownloadRecord {
    const now = Date.now();
    const row = {
      ...input,
      metadata: JSON.stringify(input.metadata ?? null),
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };
    this.db
      .insert(downloads)
      .values(row)
      .onConflictDoUpdate({
        target: downloads.id,
        set: {
          serverId: row.serverId,
          ratingKey: row.ratingKey,
          mediaType: row.mediaType,
          title: row.title,
          filePath: row.filePath,
          partialPath: row.partialPath,
          status: row.status,
          bytesDownloaded: row.bytesDownloaded,
          totalBytes: row.totalBytes,
          error: row.error,
          metadata: row.metadata,
          updatedAt: row.updatedAt,
        },
      })
      .run();
    return this.getDownload(input.id)!;
  }

  getDownload(id: string): DownloadRecord | null {
    const row = this.db
      .select()
      .from(downloads)
      .where(eq(downloads.id, id))
      .get();
    return row ? mapDownload(row) : null;
  }

  getCompletedDownload(
    serverId: string,
    ratingKey: string,
  ): DownloadRecord | null {
    const row = this.db
      .select()
      .from(downloads)
      .where(
        and(
          eq(downloads.serverId, serverId),
          eq(downloads.ratingKey, ratingKey),
          eq(downloads.status, "completed"),
        ),
      )
      .orderBy(desc(downloads.updatedAt))
      .limit(1)
      .get();
    return row ? mapDownload(row) : null;
  }

  listDownloads(serverId: string): DownloadRecord[] {
    return this.db
      .select()
      .from(downloads)
      .where(eq(downloads.serverId, serverId))
      .orderBy(desc(downloads.createdAt))
      .all()
      .map(mapDownload);
  }

  listDownloadsAll(): DownloadRecord[] {
    return this.db
      .select()
      .from(downloads)
      .orderBy(desc(downloads.createdAt))
      .all()
      .map(mapDownload);
  }

  deleteDownload(id: string): void {
    this.db.delete(downloads).where(eq(downloads.id, id)).run();
  }

  relocateDownloads(
    entries: Array<{
      id: string;
      filePath: string | null;
      partialPath: string | null;
    }>,
    storageDirectory: string,
  ): void {
    this.db.transaction((tx) => {
      const now = Date.now();
      for (const entry of entries) {
        tx.update(downloads)
          .set({
            filePath: entry.filePath,
            partialPath: entry.partialPath,
            updatedAt: now,
          })
          .where(eq(downloads.id, entry.id))
          .run();
      }
      tx.insert(settings)
        .values({
          key: "downloads.storageDirectory",
          value: JSON.stringify(storageDirectory),
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: JSON.stringify(storageDirectory) },
        })
        .run();
    });
  }

  getDownloadStorageBytes(serverId?: string): number {
    const where = serverId
      ? and(eq(downloads.serverId, serverId), eq(downloads.status, "completed"))
      : eq(downloads.status, "completed");
    const row = this.db
      .select({
        total: sql<number>`coalesce(sum(${downloads.bytesDownloaded}), 0)`,
      })
      .from(downloads)
      .where(where)
      .get();
    return Number(row?.total ?? 0);
  }

  upsertSync(record: SyncRecord): void {
    const row = { ...record, details: JSON.stringify(record.details ?? null) };
    this.db
      .insert(syncStatus)
      .values(row)
      .onConflictDoUpdate({
        target: [syncStatus.serverId, syncStatus.libraryKey],
        set: {
          status: row.status,
          cursor: row.cursor,
          lastStartedAt: row.lastStartedAt,
          lastCompletedAt: row.lastCompletedAt,
          error: row.error,
          details: row.details,
        },
      })
      .run();
  }

  getSync(serverId: string, libraryKey: string): SyncRecord | null {
    const row = this.db
      .select()
      .from(syncStatus)
      .where(
        and(
          eq(syncStatus.serverId, serverId),
          eq(syncStatus.libraryKey, libraryKey),
        ),
      )
      .get();
    return row ? mapSync(row) : null;
  }

  listSync(serverId: string): SyncRecord[] {
    return this.db
      .select()
      .from(syncStatus)
      .where(eq(syncStatus.serverId, serverId))
      .orderBy(syncStatus.libraryKey)
      .all()
      .map(mapSync);
  }

  private openDatabase(): Database {
    const sqlite = new Database(this.dbPath);
    sqlite.run("PRAGMA foreign_keys = ON");
    sqlite.run("PRAGMA journal_mode = WAL");
    return sqlite;
  }

  private initializeSchema(): void {
    if (this.isIncompatibleDatabase()) this.recreateDatabase();
    this.sqlite.run(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS playback_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id TEXT,
        played_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS media_cache (
        server_id TEXT NOT NULL,
        cache_key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (server_id, cache_key)
      );
      CREATE INDEX IF NOT EXISTS media_cache_expiry_idx ON media_cache(expires_at);
      CREATE TABLE IF NOT EXISTS downloads (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        rating_key TEXT NOT NULL,
        media_type TEXT NOT NULL,
        title TEXT NOT NULL,
        file_path TEXT,
        partial_path TEXT,
        status TEXT NOT NULL,
        bytes_downloaded INTEGER NOT NULL DEFAULT 0,
        total_bytes INTEGER,
        error TEXT,
        metadata TEXT NOT NULL DEFAULT 'null',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS downloads_server_status_idx ON downloads(server_id, status);
      CREATE INDEX IF NOT EXISTS downloads_server_rating_idx ON downloads(server_id, rating_key);
      CREATE TABLE IF NOT EXISTS sync_status (
        server_id TEXT NOT NULL,
        library_key TEXT NOT NULL,
        status TEXT NOT NULL,
        cursor TEXT,
        last_started_at INTEGER,
        last_completed_at INTEGER,
        error TEXT,
        details TEXT NOT NULL DEFAULT 'null',
        PRIMARY KEY (server_id, library_key)
      );
      CREATE INDEX IF NOT EXISTS sync_status_server_idx ON sync_status(server_id);
      PRAGMA user_version = ${SCHEMA_VERSION};
    `);
  }

  private isIncompatibleDatabase(): boolean {
    const version = this.readSchemaVersion();
    if (version !== 0) return version !== SCHEMA_VERSION;
    const row = this.sqlite
      .query(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .get() as { count: number };
    return row.count > 0;
  }

  private readSchemaVersion(): number {
    return (
      this.sqlite.query("PRAGMA user_version").get() as { user_version: number }
    ).user_version;
  }

  private recreateDatabase(): void {
    this.sqlite.close();
    if (this.dbPath !== ":memory:") {
      for (const path of [
        this.dbPath,
        `${this.dbPath}-wal`,
        `${this.dbPath}-shm`,
      ])
        if (existsSync(path)) rmSync(path, { force: true });
    }
    this.sqlite = this.openDatabase();
    this.db = drizzle(this.sqlite, { schema: databaseSchema });
  }

  private userDataPath(): string {
    const id = "com.ib.rayna";
    if (process.platform === "darwin")
      return join(homedir(), "Library", "Application Support", id);
    if (process.platform === "win32")
      return join(
        process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"),
        id,
      );
    return join(
      process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"),
      id,
    );
  }
}

const CORRUPT_JSON = Symbol("corrupt-json");

function safeParse(value: string, fallback: unknown = null): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

type DownloadRow = typeof downloads.$inferSelect;
type SyncRow = typeof syncStatus.$inferSelect;

function mapDownload(row: DownloadRow): DownloadRecord {
  return { ...row, metadata: safeParse(row.metadata) };
}

function mapSync(row: SyncRow): SyncRecord {
  return { ...row, details: safeParse(row.details) };
}
