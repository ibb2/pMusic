import { afterEach, describe, expect, test } from "bun:test";
import { DatabaseManager, type DownloadInput } from "./database";
import { SyncService, type SyncResolver } from "./sync-service";

const databases: DatabaseManager[] = [];

afterEach(() => {
  databases.splice(0).forEach((database) => database.close());
});

function fixture(
  options: {
    libraries?: string[];
    resolver?: Partial<SyncResolver>;
    now?: () => number;
  } = {},
) {
  const database = new DatabaseManager({ path: ":memory:" });
  databases.push(database);
  const calls = {
    libraries: [] as string[],
    tracks: [] as string[],
  };
  const resolver: SyncResolver = {
    refreshLibrary: async ({ libraryKey }) => {
      calls.libraries.push(libraryKey);
      return { cursor: `cursor-${libraryKey}`, refreshedItems: 2 };
    },
    trackExists: async ({ ratingKey }) => {
      calls.tracks.push(ratingKey);
      return true;
    },
    ...options.resolver,
  };
  const service = new SyncService({
    database,
    resolver,
    selectedLibraries: () => options.libraries ?? ["music-1", "music-2"],
    now: options.now,
  });
  return { database, service, calls };
}

function addDownload(
  database: DatabaseManager,
  overrides: Partial<DownloadInput> = {},
) {
  return database.upsertDownload({
    id: "download-1",
    serverId: "server-1",
    ratingKey: "track-1",
    mediaType: "track",
    title: "Track",
    filePath: "/kept/track.flac",
    partialPath: null,
    status: "completed",
    bytesDownloaded: 10,
    totalBytes: 10,
    error: null,
    metadata: { artist: "Artist" },
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  });
}

describe("SyncService", () => {
  test("startup refreshes only selected libraries and reconciles explicit downloads", async () => {
    let time = 1_000;
    const { database, service, calls } = fixture({
      libraries: ["music-2", "music-2"],
      now: () => time++,
    });
    addDownload(database);
    addDownload(database, {
      id: "other-server",
      serverId: "server-2",
      ratingKey: "not-visible",
    });

    const status = await service.startup("server-1");

    expect(status.state).toBe("succeeded");
    expect(status.trigger).toBe("startup");
    expect(status.refreshedLibraries).toBe(1);
    expect(status.reconciledDownloads).toBe(1);
    expect(calls.libraries).toEqual(["music-2"]);
    expect(calls.tracks).toEqual(["track-1"]);
    expect(database.getSync("server-1", "music-2")?.cursor).toBe(
      "cursor-music-2",
    );
  });

  test("manual and network recovery triggers are persisted", async () => {
    const { service } = fixture({ libraries: [] });
    expect((await service.manual("server-1")).trigger).toBe("manual");
    expect((await service.networkRestored("server-1")).trigger).toBe(
      "network-restored",
    );
    expect(service.getStatus("server-1").state).toBe("succeeded");
  });

  test("concurrent triggers share one single-flight job", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let refreshes = 0;
    const { service } = fixture({
      libraries: ["music"],
      resolver: {
        refreshLibrary: async () => {
          refreshes += 1;
          await gate;
          return {};
        },
      },
    });

    const startup = service.startup("server-1");
    const manual = service.manual("server-1");
    expect(manual).toBe(startup);
    expect(service.getStatus("server-1").state).toBe("running");
    release();
    expect((await startup).trigger).toBe("startup");
    expect(refreshes).toBe(1);
  });

  test("persists partial library failures and retries them on the next run", async () => {
    let shouldFail = true;
    const { database, service } = fixture({
      resolver: {
        refreshLibrary: async ({ libraryKey }) => {
          if (libraryKey === "music-2" && shouldFail)
            throw new Error("Plex unavailable");
          return { cursor: `next-${libraryKey}` };
        },
      },
    });

    const partial = await service.manual("server-1");
    expect(partial.state).toBe("partial");
    expect(partial.failedLibraries).toBe(1);
    expect(partial.error).toContain("music-2");
    expect(database.getSync("server-1", "music-2")?.status).toBe("failed");

    shouldFail = false;
    const retried = await service.manual("server-1");
    expect(retried.state).toBe("succeeded");
    expect(database.getSync("server-1", "music-2")?.status).toBe("completed");
  });

  test("marks missing Plex tracks orphaned without deleting local records", async () => {
    let exists = false;
    let time = 5_000;
    const { database, service } = fixture({
      libraries: [],
      now: () => time++,
      resolver: { trackExists: async () => exists },
    });
    addDownload(database);

    await service.manual("server-1");
    const orphan = database.getDownload("download-1")!;
    expect(orphan.filePath).toBe("/kept/track.flac");
    expect(orphan.status).toBe("completed");
    expect(orphan.metadata).toMatchObject({
      artist: "Artist",
      orphaned: true,
    });
    const orphanedAt = (orphan.metadata as { orphanedAt: number }).orphanedAt;

    exists = true;
    await service.networkRestored("server-1");
    expect(database.getDownload("download-1")?.metadata).toMatchObject({
      artist: "Artist",
      orphaned: false,
    });
    expect(
      (database.getDownload("download-1")?.metadata as { orphanedAt?: number })
        .orphanedAt,
    ).toBeUndefined();
    expect(orphanedAt).toBeGreaterThan(0);
  });

  test("download reconciliation failures remain visible and do not alter media", async () => {
    const { database, service } = fixture({
      libraries: [],
      resolver: {
        trackExists: async () => {
          throw new Error("offline");
        },
      },
    });
    addDownload(database);

    const status = await service.manual("server-1");
    expect(status.state).toBe("failed");
    expect(status.error).toContain("track-1");
    expect(database.getDownload("download-1")?.metadata).toEqual({
      artist: "Artist",
    });
  });
});
