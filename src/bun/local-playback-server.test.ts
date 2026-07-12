import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalPlaybackServer } from "./local-playback-server";

const servers: LocalPlaybackServer[] = [];
const directories: string[] = [];

afterEach(async () => {
  servers.splice(0).forEach((server) => server.dispose());
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true })),
  );
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "rayna-local-playback-"));
  directories.push(directory);
  const path = join(directory, "track.flac");
  await writeFile(path, new Uint8Array([0, 1, 2, 3, 4, 5]));
  const server = new LocalPlaybackServer();
  servers.push(server);
  return { server, registered: server.register(path, "audio/flac") };
}

describe("local playback server", () => {
  test("keeps identifiers opaque while adding a decoder format hint", async () => {
    const { registered } = await fixture();
    const url = new URL(registered.url);
    expect(url.pathname).toBe(`/media/${registered.id}.flac`);
    expect(url.pathname).not.toContain("track.flac");

    const withoutHint = `${url.origin}/media/${registered.id}`;
    const wrongHint = `${url.origin}/media/${registered.id}.mp3`;
    expect((await fetch(withoutHint)).status).toBe(404);
    expect((await fetch(wrongHint)).status).toBe(404);
    expect((await fetch(registered.url)).status).toBe(200);
  });

  test("derives a safe format hint from content type when a path has none", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rayna-local-playback-"));
    directories.push(directory);
    const path = join(directory, "opaque-download");
    await writeFile(path, new Uint8Array([1, 2, 3]));
    const server = new LocalPlaybackServer();
    servers.push(server);

    const registered = server.register(path, "audio/flac; charset=binary");
    expect(new URL(registered.url).pathname).toBe(
      `/media/${registered.id}.flac`,
    );
  });

  test("serves registered files with correct metadata and HEAD semantics", async () => {
    const { registered } = await fixture();
    const head = await fetch(registered.url, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe("6");
    expect(head.headers.get("content-type")).toBe("audio/flac");
    expect(await head.arrayBuffer()).toHaveLength(0);

    const get = await fetch(registered.url);
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(
      new Uint8Array([0, 1, 2, 3, 4, 5]),
    );
  });

  test("supports bounded, open-ended, and suffix byte ranges", async () => {
    const { registered } = await fixture();
    for (const [range, expected, contentRange] of [
      ["bytes=2-4", [2, 3, 4], "bytes 2-4/6"],
      ["bytes=4-", [4, 5], "bytes 4-5/6"],
      ["bytes=-2", [4, 5], "bytes 4-5/6"],
    ] as const) {
      const response = await fetch(registered.url, {
        headers: { Range: range },
      });
      expect(response.status).toBe(206);
      expect(response.headers.get("content-range")).toBe(contentRange);
      expect(response.headers.get("content-length")).toBe(
        String(expected.length),
      );
      expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([
        ...expected,
      ]);
    }
  });

  test("rejects invalid ranges, traversal, arbitrary paths, and unknown IDs", async () => {
    const { registered } = await fixture();
    const invalidRange = await fetch(registered.url, {
      headers: { Range: "bytes=99-100" },
    });
    expect(invalidRange.status).toBe(416);
    expect(invalidRange.headers.get("content-range")).toBe("bytes */6");

    const base = new URL(registered.url).origin;
    expect((await fetch(`${base}/media/%2e%2e%2fetc%2fpasswd`)).status).toBe(
      404,
    );
    expect((await fetch(`${base}/media//etc/passwd`)).status).toBe(404);
    expect(
      (await fetch(`${base}/media/00000000-0000-4000-8000-000000000000`))
        .status,
    ).toBe(404);
  });

  test("unregisters targets and enforces lifecycle", async () => {
    const { server, registered } = await fixture();
    expect(server.unregister(registered.id)).toBe(true);
    expect((await fetch(registered.url)).status).toBe(404);
    server.dispose();
    expect(() => server.register("/tmp/anything")).toThrow("disposed");
    expect(() => server.unregister(registered.id)).toThrow("disposed");
    server.dispose();
  });
});
