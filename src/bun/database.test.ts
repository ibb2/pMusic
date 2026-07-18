import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { DatabaseManager } from "./database";

const cleanup: string[] = [];
afterEach(() =>
  cleanup
    .splice(0)
    .forEach((path) => rmSync(path, { recursive: true, force: true })),
);

function tempDatabase(): { manager: DatabaseManager; path: string } {
  const directory = mkdtempSync(join(tmpdir(), "rayna-db-"));
  cleanup.push(directory);
  const path = join(directory, "rayna.db");
  return { manager: new DatabaseManager({ path }), path };
}

describe("DatabaseManager", () => {
  test("initializes the Drizzle schema idempotently and preserves compatible data", () => {
    const { manager, path } = tempDatabase();
    manager.set("playback", { transcodeAudio: true });
    manager.close();

    const reopened = new DatabaseManager({ path });
    expect(reopened.getSchemaVersion()).toBe(1);
    expect(reopened.get("playback")).toEqual({ transcodeAudio: true });
    reopened.close();
  });

  test("recreates an incompatible pre-release database instead of failing startup", () => {
    const directory = mkdtempSync(join(tmpdir(), "rayna-incompatible-"));
    cleanup.push(directory);
    const path = join(directory, "rayna.db");
    const legacy = new Database(path);
    legacy.run("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)");
    legacy
      .query("INSERT INTO settings VALUES (?, ?)")
      .run("theme", JSON.stringify("dark"));
    legacy.run("PRAGMA user_version = 3");
    legacy.close();

    const manager = new DatabaseManager({ path });
    expect(manager.getSchemaVersion()).toBe(1);
    expect(manager.get("theme")).toBeNull();
    manager.close();
    const check = new Database(path, { readonly: true });
    expect(
      (
        check.query("SELECT COUNT(*) AS count FROM settings").get() as {
          count: number;
        }
      ).count,
    ).toBe(0);
    check.close();
  });

  test("isolates cache by server, expires entries, and removes corrupt JSON", () => {
    const { manager, path } = tempDatabase();
    manager.setMediaCache({
      serverId: "a",
      cacheKey: "albums",
      value: { title: "A" },
      updatedAt: 10,
      expiresAt: 20,
    });
    manager.setMediaCache({
      serverId: "b",
      cacheKey: "albums",
      value: { title: "B" },
      updatedAt: 10,
      expiresAt: 30,
    });
    expect(manager.getMediaCache("a", "albums")?.value).toEqual({ title: "A" });
    expect(manager.deleteExpiredMediaCache(25)).toBe(1);
    expect(manager.getMediaCache("a", "albums")).toBeNull();
    manager.close();

    const raw = new Database(path);
    raw
      .query("UPDATE media_cache SET value = ? WHERE server_id = ?")
      .run("{bad", "b");
    raw.close();
    const reopened = new DatabaseManager({ path });
    expect(reopened.getMediaCache("b", "albums")).toBeNull();
    expect(reopened.getMediaCache("b", "albums")).toBeNull();
    reopened.close();
  });

  test("implements the read-through cache repository contract", () => {
    const { manager } = tempDatabase();
    manager.setCacheEntry("server", "home", {
      value: ["item"],
      updatedAt: 5,
      expiresAt: 10,
    });
    expect(manager.getCacheEntry<string[]>("server", "home")).toEqual({
      value: ["item"],
      updatedAt: 5,
      expiresAt: 10,
    });
    manager.close();
  });

  test("finds the newest server-scoped cache entry by key prefix", () => {
    const { manager } = tempDatabase();
    manager.setMediaCache({
      serverId: "server",
      cacheKey: "albums-complete:v2:first",
      value: ["old"],
      updatedAt: 5,
      expiresAt: 10,
    });
    manager.setMediaCache({
      serverId: "server",
      cacheKey: "albums-complete:v2:second",
      value: ["new"],
      updatedAt: 8,
      expiresAt: 10,
    });
    manager.setMediaCache({
      serverId: "other",
      cacheKey: "albums-complete:v2:third",
      value: ["wrong server"],
      updatedAt: 9,
      expiresAt: 10,
    });

    expect(
      manager.getLatestMediaCacheByPrefix<string[]>(
        "server",
        "albums-complete:v2:",
      )?.value,
    ).toEqual(["new"]);
    manager.close();
  });

  test("persists and queries downloads with server isolation and storage totals", () => {
    const { manager } = tempDatabase();
    const base = {
      ratingKey: "track-1",
      mediaType: "track" as const,
      title: "Song",
      filePath: "/audio/song.flac",
      partialPath: null,
      status: "completed" as const,
      bytesDownloaded: 120,
      totalBytes: 120,
      error: null,
      metadata: { artist: "Artist" },
    };
    manager.upsertDownload({ ...base, id: "one", serverId: "a" });
    manager.upsertDownload({
      ...base,
      id: "two",
      serverId: "b",
      bytesDownloaded: 80,
    });
    expect(manager.listDownloads("a")).toHaveLength(1);
    expect(manager.getCompletedDownload("a", "track-1")?.metadata).toEqual({
      artist: "Artist",
    });
    expect(manager.getDownloadStorageBytes("a")).toBe(120);
    expect(manager.getDownloadStorageBytes()).toBe(200);
    manager.deleteDownload("one");
    expect(manager.getDownload("one")).toBeNull();
    manager.close();
  });

  test("persists independent per-library sync state", () => {
    const { manager } = tempDatabase();
    manager.upsertSync({
      serverId: "server",
      libraryKey: "1",
      status: "running",
      cursor: "20",
      lastStartedAt: 10,
      lastCompletedAt: null,
      error: null,
      details: { processed: 20 },
    });
    manager.upsertSync({
      serverId: "server",
      libraryKey: "2",
      status: "failed",
      cursor: null,
      lastStartedAt: 11,
      lastCompletedAt: null,
      error: "offline",
      details: null,
    });
    expect(manager.getSync("server", "1")?.details).toEqual({ processed: 20 });
    expect(manager.listSync("server").map((item) => item.libraryKey)).toEqual([
      "1",
      "2",
    ]);
    manager.close();
  });
});
