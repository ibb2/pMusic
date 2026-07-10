import { afterEach, describe, expect, test } from "bun:test";
import type {
  BassManager,
  BassPlaybackEvent,
  BassPlaybackListener,
} from "../bass";
import type Authentication from "./authentication";
import { PlexTimelineReporter } from "./timeline";
import type { PlayerTrack } from "../../shared/rpc";
import type { PlexServer } from "../../shared/types";

const runningServers: Array<ReturnType<typeof Bun.serve>> = [];
const reporters: PlexTimelineReporter[] = [];

afterEach(() => {
  reporters.splice(0).forEach((reporter) => reporter.dispose());
  runningServers.splice(0).forEach((server) => void server.stop(true));
});

describe("Plex timeline reporting", () => {
  test("uses the track playback session identifier", async () => {
    let resolveRequest: ((request: Request) => void) | null = null;
    const requestReceived = new Promise<Request>((resolve) => {
      resolveRequest = resolve;
    });
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        resolveRequest?.(request);
        return new Response(null, { status: 200 });
      },
    });
    runningServers.push(server);

    const connection = {
      uri: `http://127.0.0.1:${server.port}`,
      local: true,
      relay: false,
    };
    const plexServer = {
      accessToken: "fixture-token",
      connections: [connection],
    } as PlexServer;
    const auth = {
      plexClientId: "client-id",
      plexProduct: "Rayna",
      plexUserAccessToken: "fixture-token",
      getUserSelectedServer: async () => plexServer,
      getConnectionCandidates: () => [connection],
      setLastKnownGoodConnection: () => {},
    } as unknown as Authentication;
    const playbackListeners: BassPlaybackListener[] = [];
    const bass = {
      onPlaybackEvent: (listener: BassPlaybackListener) => {
        playbackListeners.push(listener);
        return () => {
          const index = playbackListeners.indexOf(listener);
          if (index >= 0) playbackListeners.splice(index, 1);
        };
      },
      getPlaybackStatus: () => ({ position: 0, duration: 180 }),
    } as unknown as BassManager;
    const reporter = new PlexTimelineReporter(auth, bass, () => ({
      transcodeAudio: true,
      enableTimelineReporting: true,
    }));
    reporters.push(reporter);
    reporter.start();

    const track: PlayerTrack = {
      title: "Track",
      artist: "Artist",
      artistRatingKey: "artist",
      album: "Album",
      albumRatingKey: "album",
      ratingKey: "123",
      plexSessionId: "playback-session",
      duration: 180_000,
    };
    const playbackListener = playbackListeners[0];
    if (!playbackListener)
      throw new Error("Playback listener was not attached");
    playbackListener({
      type: "track-started",
      track,
      position: 0,
      duration: 180,
    } as BassPlaybackEvent);

    const request = await requestReceived;
    const url = new URL(request.url);
    expect(url.pathname).toBe("/:/timeline");
    expect(url.searchParams.get("X-Plex-Session-Identifier")).toBe(
      "playback-session",
    );
    expect(request.headers.get("X-Plex-Session-Identifier")).toBe(
      "playback-session",
    );
  });
});
