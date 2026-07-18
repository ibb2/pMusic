import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const playbackHistory = sqliteTable("playback_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trackId: text("track_id"),
  playedAt: text("played_at").default("CURRENT_TIMESTAMP"),
});

export const mediaCache = sqliteTable(
  "media_cache",
  {
    serverId: text("server_id").notNull(),
    cacheKey: text("cache_key").notNull(),
    value: text("value").notNull(),
    updatedAt: integer("updated_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.serverId, table.cacheKey] }),
    index("media_cache_expiry_idx").on(table.expiresAt),
  ],
);

export const downloads = sqliteTable(
  "downloads",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id").notNull(),
    ratingKey: text("rating_key").notNull(),
    mediaType: text("media_type", {
      enum: ["track", "album", "playlist"],
    }).notNull(),
    title: text("title").notNull(),
    filePath: text("file_path"),
    partialPath: text("partial_path"),
    status: text("status", {
      enum: ["queued", "downloading", "paused", "completed", "failed"],
    }).notNull(),
    bytesDownloaded: integer("bytes_downloaded").notNull().default(0),
    totalBytes: integer("total_bytes"),
    error: text("error"),
    metadata: text("metadata").notNull().default("null"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("downloads_server_status_idx").on(table.serverId, table.status),
    index("downloads_server_rating_idx").on(table.serverId, table.ratingKey),
  ],
);

export const syncStatus = sqliteTable(
  "sync_status",
  {
    serverId: text("server_id").notNull(),
    libraryKey: text("library_key").notNull(),
    status: text("status", {
      enum: ["idle", "running", "completed", "failed"],
    }).notNull(),
    cursor: text("cursor"),
    lastStartedAt: integer("last_started_at"),
    lastCompletedAt: integer("last_completed_at"),
    error: text("error"),
    details: text("details").notNull().default("null"),
  },
  (table) => [
    primaryKey({ columns: [table.serverId, table.libraryKey] }),
    index("sync_status_server_idx").on(table.serverId),
  ],
);

export const databaseSchema = {
  settings,
  playbackHistory,
  mediaCache,
  downloads,
  syncStatus,
};
