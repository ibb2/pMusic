import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtworkCacheServer } from "./artwork-cache-server";

const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

describe("ArtworkCacheServer", () => {
  test("downloads artwork once and serves the server-scoped cached file", async () => {
    let requests = 0;
    const upstream = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () => {
        requests += 1;
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Type": "image/png" },
        });
      },
    });
    const directory = mkdtempSync(join(tmpdir(), "rayna-artwork-"));
    const cache = new ArtworkCacheServer(directory);
    cleanups.push(
      () => upstream.stop(true),
      () => cache.dispose(),
      () => rmSync(directory, { recursive: true, force: true }),
    );

    const first = cache.register(
      "server-a",
      `http://127.0.0.1:${upstream.port}/cover`,
    );
    expect(
      Array.from(new Uint8Array(await (await fetch(first)).arrayBuffer())),
    ).toEqual([1, 2, 3]);
    const second = cache.register(
      "server-a",
      `http://127.0.0.1:${upstream.port}/cover`,
    );
    expect((await fetch(second)).status).toBe(200);
    expect(requests).toBe(1);

    cache.dispose();
    const restarted = new ArtworkCacheServer(directory);
    cleanups.push(() => restarted.dispose());
    expect((await fetch(restarted.revive(first))).status).toBe(200);
    expect(requests).toBe(1);
  });
});
