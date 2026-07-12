import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

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

type DatabaseManagerOptions = {
  path?: string;
};

type CacheRow = {
  server_id: string;
  cache_key: string;
  value: string;
  updated_at: number;
  expires_at: number;
};

type DownloadRow = {
  id: string;
  server_id: string;
  rating_key: string;
  media_type: DownloadRecord["mediaType"];
  title: string;
  file_path: string | null;
  partial_path: string | null;
  status: DownloadStatus;
  bytes_downloaded: number;
  total_bytes: number | null;
  error: string | null;
  metadata: string;
  created_at: number;
  updated_at: number;
};

type SyncRow = {
  server_id: string;
  library_key: string;
  status: SyncStatus;
  cursor: string | null;
  last_started_at: number | null;
  last_completed_at: number | null;
  error: string | null;
  details: string;
};

const SCHEMA_VERSION = 3;

export class DatabaseManager {
  private readonly db: Database;

  constructor(options: DatabaseManagerOptions = {}) {
    const dbPath = options.path ?? join(this.userDataPath(), "rayna.db");
    if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.run("PRAGMA foreign_keys = ON");
    this.db.run("PRAGMA journal_mode = WAL");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  getSchemaVersion(): number {
    const row = this.db.query("PRAGMA user_version").get() as {
      user_version: number;
    };
    return row.user_version;
  }

  get(key: string): unknown {
    const row = this.db
      .query("SELECT value FROM settings WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row ? safeParse(row.value) : null;
  }

  set(key: string, value: unknown): void {
    this.db
      .query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
      .run(key, JSON.stringify(value));
  }

  getMediaCache<T = unknown>(
    serverId: string,
    cacheKey: string,
  ): MediaCacheEntry<T> | null {
    const row = this.db
      .query("SELECT * FROM media_cache WHERE server_id = ? AND cache_key = ?")
      .get(serverId, cacheKey) as CacheRow | undefined;
    if (!row) return null;
    const value = safeParse(row.value, CORRUPT_JSON);
    if (value === CORRUPT_JSON) {
      this.deleteMediaCache(serverId, cacheKey);
      return null;
    }
    return {
      serverId: row.server_id,
      cacheKey: row.cache_key,
      value: value as T,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
    };
  }

  setMediaCache<T>(entry: MediaCacheEntry<T>): void {
    this.db
      .query(
        `
      INSERT INTO media_cache (server_id, cache_key, value, updated_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(server_id, cache_key) DO UPDATE SET
        value = excluded.value, updated_at = excluded.updated_at, expires_at = excluded.expires_at
    `,
      )
      .run(
        entry.serverId,
        entry.cacheKey,
        JSON.stringify(entry.value),
        entry.updatedAt,
        entry.expiresAt,
      );
  }

  /** CacheRepository-compatible facade used by the read-through cache service. */
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
    if (cacheKey === undefined) {
      this.db
        .query("DELETE FROM media_cache WHERE server_id = ?")
        .run(serverId);
    } else {
      this.db
        .query("DELETE FROM media_cache WHERE server_id = ? AND cache_key = ?")
        .run(serverId, cacheKey);
    }
  }

  deleteExpiredMediaCache(now = Date.now()): number {
    return Number(
      this.db.query("DELETE FROM media_cache WHERE expires_at <= ?").run(now)
        .changes,
    );
  }

  upsertDownload(input: DownloadInput): DownloadRecord {
    const now = Date.now();
    const createdAt = input.createdAt ?? now;
    const updatedAt = input.updatedAt ?? now;
    this.db
      .query(
        `
      INSERT INTO downloads (
        id, server_id, rating_key, media_type, title, file_path, partial_path, status,
        bytes_downloaded, total_bytes, error, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        server_id = excluded.server_id, rating_key = excluded.rating_key,
        media_type = excluded.media_type, title = excluded.title, file_path = excluded.file_path,
        partial_path = excluded.partial_path, status = excluded.status,
        bytes_downloaded = excluded.bytes_downloaded, total_bytes = excluded.total_bytes,
        error = excluded.error, metadata = excluded.metadata, updated_at = excluded.updated_at
    `,
      )
      .run(
        input.id,
        input.serverId,
        input.ratingKey,
        input.mediaType,
        input.title,
        input.filePath,
        input.partialPath,
        input.status,
        input.bytesDownloaded,
        input.totalBytes,
        input.error,
        JSON.stringify(input.metadata ?? null),
        createdAt,
        updatedAt,
      );
    return this.getDownload(input.id)!;
  }

  getDownload(id: string): DownloadRecord | null {
    const row = this.db
      .query("SELECT * FROM downloads WHERE id = ?")
      .get(id) as DownloadRow | undefined;
    return row ? mapDownload(row) : null;
  }

  getCompletedDownload(
    serverId: string,
    ratingKey: string,
  ): DownloadRecord | null {
    const row = this.db
      .query(
        `
      SELECT * FROM downloads
      WHERE server_id = ? AND rating_key = ? AND status = 'completed'
      ORDER BY updated_at DESC LIMIT 1
    `,
      )
      .get(serverId, ratingKey) as DownloadRow | undefined;
    return row ? mapDownload(row) : null;
  }

  listDownloads(serverId: string): DownloadRecord[] {
    return (
      this.db
        .query(
          "SELECT * FROM downloads WHERE server_id = ? ORDER BY created_at DESC",
        )
        .all(serverId) as DownloadRow[]
    ).map(mapDownload);
  }

  listDownloadsAll(): DownloadRecord[] {
    return (
      this.db
        .query("SELECT * FROM downloads ORDER BY created_at DESC")
        .all() as DownloadRow[]
    ).map(mapDownload);
  }

  deleteDownload(id: string): void {
    this.db.query("DELETE FROM downloads WHERE id = ?").run(id);
  }

  relocateDownloads(
    entries: Array<{
      id: string;
      filePath: string | null;
      partialPath: string | null;
    }>,
    storageDirectory: string,
  ): void {
    this.db.transaction(() => {
      const now = Date.now();
      const update = this.db.query(
        "UPDATE downloads SET file_path = ?, partial_path = ?, updated_at = ? WHERE id = ?",
      );
      for (const entry of entries)
        update.run(entry.filePath, entry.partialPath, now, entry.id);
      this.db
        .query(
          "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .run("downloads.storageDirectory", JSON.stringify(storageDirectory));
    })();
  }

  getDownloadStorageBytes(serverId?: string): number {
    const row = serverId
      ? this.db
          .query(
            "SELECT COALESCE(SUM(bytes_downloaded), 0) AS total FROM downloads WHERE server_id = ? AND status = 'completed'",
          )
          .get(serverId)
      : this.db
          .query(
            "SELECT COALESCE(SUM(bytes_downloaded), 0) AS total FROM downloads WHERE status = 'completed'",
          )
          .get();
    return Number((row as { total: number }).total);
  }

  upsertSync(record: SyncRecord): void {
    this.db
      .query(
        `
      INSERT INTO sync_status (
        server_id, library_key, status, cursor, last_started_at, last_completed_at, error, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(server_id, library_key) DO UPDATE SET
        status = excluded.status, cursor = excluded.cursor,
        last_started_at = excluded.last_started_at, last_completed_at = excluded.last_completed_at,
        error = excluded.error, details = excluded.details
    `,
      )
      .run(
        record.serverId,
        record.libraryKey,
        record.status,
        record.cursor,
        record.lastStartedAt,
        record.lastCompletedAt,
        record.error,
        JSON.stringify(record.details ?? null),
      );
  }

  getSync(serverId: string, libraryKey: string): SyncRecord | null {
    const row = this.db
      .query(
        "SELECT * FROM sync_status WHERE server_id = ? AND library_key = ?",
      )
      .get(serverId, libraryKey) as SyncRow | undefined;
    return row ? mapSync(row) : null;
  }

  listSync(serverId: string): SyncRecord[] {
    return (
      this.db
        .query(
          "SELECT * FROM sync_status WHERE server_id = ? ORDER BY library_key",
        )
        .all(serverId) as SyncRow[]
    ).map(mapSync);
  }

  private migrate(): void {
    const version = this.getSchemaVersion();
    if (version > SCHEMA_VERSION)
      throw new Error(
        `Database schema ${version} is newer than supported version ${SCHEMA_VERSION}`,
      );
    if (version < 1) this.migration1();
    if (version < 2) this.migration2();
    if (version < 3) this.migration3();
  }

  private migration1(): void {
    this.db.transaction(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS playback_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          track_id TEXT,
          played_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      this.db.run("PRAGMA user_version = 1");
    })();
  }

  private migration2(): void {
    this.db.transaction(() => {
      this.db.run(`
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
          media_type TEXT NOT NULL CHECK(media_type IN ('track', 'album', 'playlist')),
          title TEXT NOT NULL,
          file_path TEXT,
          partial_path TEXT,
          status TEXT NOT NULL CHECK(status IN ('queued', 'downloading', 'completed', 'failed')),
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
          status TEXT NOT NULL CHECK(status IN ('idle', 'running', 'completed', 'failed')),
          cursor TEXT,
          last_started_at INTEGER,
          last_completed_at INTEGER,
          error TEXT,
          details TEXT NOT NULL DEFAULT 'null',
          PRIMARY KEY (server_id, library_key)
        );
        CREATE INDEX IF NOT EXISTS sync_status_server_idx ON sync_status(server_id);
      `);
      this.db.run("PRAGMA user_version = 2");
    })();
  }

  private migration3(): void {
    this.db.transaction(() => {
      this.db.run(`
        CREATE TABLE downloads_v3 (
          id TEXT PRIMARY KEY, server_id TEXT NOT NULL, rating_key TEXT NOT NULL,
          media_type TEXT NOT NULL CHECK(media_type IN ('track', 'album', 'playlist')),
          title TEXT NOT NULL, file_path TEXT, partial_path TEXT,
          status TEXT NOT NULL CHECK(status IN ('queued', 'downloading', 'paused', 'completed', 'failed')),
          bytes_downloaded INTEGER NOT NULL DEFAULT 0, total_bytes INTEGER, error TEXT,
          metadata TEXT NOT NULL DEFAULT 'null', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        );
        INSERT INTO downloads_v3 SELECT id, server_id, rating_key, media_type, title, file_path, partial_path,
          CASE WHEN status = 'failed' AND error = 'Download paused' THEN 'paused' ELSE status END,
          bytes_downloaded, total_bytes, CASE WHEN error = 'Download paused' THEN NULL ELSE error END,
          metadata, created_at, updated_at FROM downloads;
        DROP TABLE downloads;
        ALTER TABLE downloads_v3 RENAME TO downloads;
        CREATE INDEX downloads_server_status_idx ON downloads(server_id, status);
        CREATE INDEX downloads_server_rating_idx ON downloads(server_id, rating_key);
      `);
      this.db.run("PRAGMA user_version = 3");
    })();
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

function mapDownload(row: DownloadRow): DownloadRecord {
  return {
    id: row.id,
    serverId: row.server_id,
    ratingKey: row.rating_key,
    mediaType: row.media_type,
    title: row.title,
    filePath: row.file_path,
    partialPath: row.partial_path,
    status: row.status,
    bytesDownloaded: row.bytes_downloaded,
    totalBytes: row.total_bytes,
    error: row.error,
    metadata: safeParse(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSync(row: SyncRow): SyncRecord {
  return {
    serverId: row.server_id,
    libraryKey: row.library_key,
    status: row.status,
    cursor: row.cursor,
    lastStartedAt: row.last_started_at,
    lastCompletedAt: row.last_completed_at,
    error: row.error,
    details: safeParse(row.details),
  };
}
