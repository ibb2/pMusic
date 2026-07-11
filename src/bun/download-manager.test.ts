import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseManager } from "./database";
import {
  DownloadManager,
  type DownloadFetcher,
  type DownloadMediaResolver,
  type ResolvedDownloadTrack,
} from "./download-manager";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture(tracks: ResolvedDownloadTrack[], fetcher: DownloadFetcher) {
  const directory = mkdtempSync(join(tmpdir(), "rayna-downloads-"));
  temporaryDirectories.push(directory);
  const database = new DatabaseManager({ path: ":memory:" });
  const resolver: DownloadMediaResolver = {
    resolveTracks: async () => tracks,
  };
  const manager = new DownloadManager({
    database,
    resolver,
    storageDirectory: directory,
    fetch: fetcher,
  });
  return { manager, database, directory };
}

describe("DownloadManager", () => {
  test("expands an album, downloads originals, and atomically completes records", async () => {
    const tracks = [
      track("1", "First", "https://plex.test/one.flac"),
      track("2", "Second", "https://plex.test/two.flac"),
    ];
    const requested: string[] = [];
    const { manager, database } = fixture(tracks, async (input) => {
      requested.push(String(input));
      return new Response(`audio:${input}`, {
        status: 200,
        headers: { "Content-Length": String(`audio:${input}`.length) },
      });
    });

    const queued = await manager.enqueue("server/unsafe", "album", "album-7");
    expect(queued.every((item) => item.state === "queued")).toBe(true);
    const items = await waitForDownloads(manager, "server/unsafe", "completed");

    expect(items).toHaveLength(2);
    expect(items.every((item) => item.state === "completed")).toBe(true);
    expect(items.map((item) => item.targetRatingKey)).toEqual([
      "album-7",
      "album-7",
    ]);
    expect(requested).toEqual(tracks.map((item) => item.url));
    for (const item of items) {
      const record = database.getDownload(item.id)!;
      expect(record.filePath).not.toBeNull();
      expect(readFileSync(record.filePath!, "utf8")).toBe(
        `audio:${record.metadata && (record.metadata as { url: string }).url}`,
      );
      expect(record.partialPath && Bun.file(record.partialPath).size).toBe(0);
    }
    expect(manager.storageStatus("server/unsafe").completedCount).toBe(2);
    database.close();
  });

  test("persists failure and resumes a partial file with a byte range", async () => {
    const body = "abcdefghij";
    let attempt = 0;
    let resumeRange: string | null = null;
    const { manager, database } = fixture(
      [track("9", "Resume", "https://plex.test/resume.mp3")],
      async (_input, init) => {
        attempt += 1;
        if (attempt === 1) return new Response("no", { status: 503 });
        resumeRange = new Headers(init?.headers).get("Range");
        return new Response(body.slice(4), {
          status: 206,
          headers: {
            "Content-Length": String(body.length - 4),
            "Content-Range": `bytes 4-${body.length - 1}/${body.length}`,
          },
        });
      },
    );
    await manager.enqueue("server", "track", "9");
    const [failed] = await waitForDownloads(manager, "server", "failed");
    expect(failed.state).toBe("failed");
    const record = database.getDownload(failed.id)!;
    writeFileSync(record.partialPath!, body.slice(0, 4));

    const retrying = await manager.retry(failed.id);
    expect(retrying.state).toBe("queued");
    const [completed] = await waitForDownloads(manager, "server", "completed");

    expect(String(resumeRange)).toBe("bytes=4-");
    expect(completed.state).toBe("completed");
    expect(completed.bytesDownloaded).toBe(body.length);
    expect(
      readFileSync(database.getDownload(failed.id)!.filePath!, "utf8"),
    ).toBe(body);
    database.close();
  });

  test("rejects a server that ignores a resume range and preserves the partial", async () => {
    let attempt = 0;
    const { manager, database } = fixture(
      [track("3", "No Resume", "https://plex.test/no-resume.mp3")],
      async () => {
        attempt += 1;
        return attempt === 1
          ? new Response("unavailable", { status: 500 })
          : new Response("replacement", { status: 200 });
      },
    );
    await manager.enqueue("server", "track", "3");
    const [failed] = await waitForDownloads(manager, "server", "failed");
    const record = database.getDownload(failed.id)!;
    writeFileSync(record.partialPath!, "kept");

    await manager.retry(failed.id);
    const [retried] = await waitForDownloads(manager, "server", "failed");

    expect(retried.state).toBe("failed");
    expect(retried.error).toContain("resume range");
    expect(readFileSync(record.partialPath!, "utf8")).toBe("kept");
    database.close();
  });

  test("removes media and its persisted record", async () => {
    const { manager, database } = fixture(
      [track("4", "Remove", "https://plex.test/remove.ogg")],
      async () => new Response("sound"),
    );
    await manager.enqueue("server", "playlist", "playlist-2");
    const [item] = await waitForDownloads(manager, "server", "completed");
    const path = database.getDownload(item.id)!.filePath!;

    manager.remove(item.id);

    expect(database.getDownload(item.id)).toBeNull();
    expect(Bun.file(path).size).toBe(0);
    database.close();
  });
});

function track(
  ratingKey: string,
  title: string,
  url: string,
): ResolvedDownloadTrack {
  return {
    ratingKey,
    title,
    artist: "Artist",
    album: "Album",
    url,
    fileName: `${title}.flac`,
  };
}

async function waitForDownloads(
  manager: DownloadManager,
  serverId: string,
  state: "completed" | "failed",
) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const items = manager.list(serverId);
    if (items.length > 0 && items.every((item) => item.state === state))
      return items;
    await Bun.sleep(5);
  }
  throw new Error(`Downloads did not reach ${state}`);
}
