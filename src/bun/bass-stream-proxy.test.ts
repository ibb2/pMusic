import { afterEach, describe, expect, test } from "bun:test";
import { BassStreamProxy } from "./bass-stream-proxy";

const runningServers: Array<ReturnType<typeof Bun.serve>> = [];
const runningProxies: BassStreamProxy[] = [];

afterEach(() => {
  runningServers.splice(0).forEach((server) => void server.stop(true));
  runningProxies.splice(0).forEach((proxy) => proxy.dispose());
});

describe("BASS stream proxy", () => {
  test("forwards authenticated audio and range requests", async () => {
    const audio = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const upstream = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        if (url.searchParams.get("X-Plex-Token") !== "fixture-token") {
          return new Response("Unauthorized", { status: 401 });
        }
        if (request.headers.get("range") === "bytes=2-4") {
          return new Response(audio.slice(2, 5), {
            status: 206,
            headers: {
              "Accept-Ranges": "bytes",
              "Content-Range": "bytes 2-4/6",
              "Content-Type": "audio/flac",
            },
          });
        }
        return new Response(audio, {
          headers: { "Content-Type": "audio/flac" },
        });
      },
    });
    runningServers.push(upstream);

    const proxy = new BassStreamProxy();
    runningProxies.push(proxy);
    const target = `http://127.0.0.1:${upstream.port}/audio.flac?X-Plex-Token=fixture-token`;
    const response = await fetch(proxy.urlFor(target), {
      headers: { Range: "bytes=2-4" },
    });

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-4/6");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([2, 3, 4]),
    );
  });

  test("prepares a Plex music transcode once before streaming", async () => {
    const audio = new Uint8Array([4, 3, 2, 1]);
    let decisionRequests = 0;
    let startRequests = 0;
    const upstream = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        expect(url.searchParams.get("session")).toBe("transcode-session");
        expect(url.searchParams.get("X-Plex-Session-Identifier")).toBe(
          "playback-session",
        );

        if (url.pathname.endsWith("/decision")) {
          decisionRequests += 1;
          return Response.json({ MediaContainer: { size: 1 } });
        }

        startRequests += 1;
        if (decisionRequests === 0) {
          return new Response("Decision required", { status: 400 });
        }
        return new Response(audio, {
          headers: { "Content-Type": "application/octet-stream" },
        });
      },
    });
    runningServers.push(upstream);

    const proxy = new BassStreamProxy();
    runningProxies.push(proxy);
    const target = new URL(
      "/music/:/transcode/universal/start",
      `http://127.0.0.1:${upstream.port}`,
    );
    target.searchParams.set("session", "transcode-session");
    target.searchParams.set("X-Plex-Session-Identifier", "playback-session");
    const proxyUrl = proxy.urlFor(target.toString());

    const first = await fetch(proxyUrl);
    const second = await fetch(proxyUrl, { headers: { Range: "bytes=0-3" } });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(new Uint8Array(await first.arrayBuffer())).toEqual(audio);
    expect(new Uint8Array(await second.arrayBuffer())).toEqual(audio);
    expect(decisionRequests).toBe(1);
    expect(startRequests).toBe(2);
  });
});
