import { describe, expect, test } from "bun:test";
import type { BassManager } from "../bass";
import type { DatabaseManager } from "../database";
import type Authentication from "./authentication";
import {
  createAudioTranscodeSource,
  MediaService,
  normalizePlaybackSettings,
} from "./media";

describe("Plex audio transcoding", () => {
  test("builds a forced 320 kbps Ogg Opus source", () => {
    const source = createAudioTranscodeSource({
      ratingKey: "123",
      transcodeSessionId: "transcode-session",
      plexSessionId: "playback-session",
      product: "Rayna",
      clientIdentifier: "client-id",
      device: "Rayna on test-host",
      platformVersion: "test-platform",
    });

    expect(source.path).toBe("/music/:/transcode/universal/start");
    expect(source.params).toMatchObject({
      path: "/library/metadata/123",
      protocol: "http",
      directPlay: "0",
      directStream: "0",
      directStreamAudio: "0",
      musicBitrate: "320",
      session: "transcode-session",
      "X-Plex-Session-Identifier": "playback-session",
    });
    expect(source.params?.["X-Plex-Client-Profile-Extra"]).toBe(
      "add-transcode-target(replace=true&type=musicProfile&context=streaming&protocol=http&container=ogg&audioCodec=opus)",
    );
  });

  test("migrates legacy settings and merges a one-field patch", async () => {
    const db = new FakeDatabase({
      playback: {
        useOriginalFileUrl: false,
        enableUltraBlur: false,
        enableTimelineReporting: true,
      },
    });
    const bass = {
      setStreamResolver: () => {},
      getPlaybackStatus: () => ({ current_track: null }),
    } as unknown as BassManager;
    const media = new MediaService(
      {} as Authentication,
      bass,
      db as unknown as DatabaseManager,
    );

    expect(normalizePlaybackSettings(db.get("playback"))).toEqual({
      transcodeAudio: true,
      enableUltraBlur: false,
      enableTimelineReporting: true,
    });

    const saved = await media.setPlaybackSettings({
      enableTimelineReporting: false,
    });

    expect(saved).toEqual({
      transcodeAudio: true,
      enableUltraBlur: false,
      enableTimelineReporting: false,
    });
    expect(db.get("playback")).toEqual(saved);
    expect("useOriginalFileUrl" in (db.get("playback") as object)).toBe(false);
  });

  test("does not persist a transcode toggle when source replacement fails", async () => {
    const db = new FakeDatabase({
      playback: {
        transcodeAudio: false,
        enableUltraBlur: true,
        enableTimelineReporting: true,
      },
    });
    let replacementSource: unknown = null;
    const bass = {
      setStreamResolver: () => {},
      getPlaybackStatus: () => ({
        current_track: { ratingKey: "123" },
      }),
      replaceCurrentSource: (source: unknown) => {
        replacementSource = source;
        return false;
      },
    } as unknown as BassManager;
    const media = new MediaService(
      {
        plexProduct: "Rayna",
        plexClientId: "client-id",
      } as Authentication,
      bass,
      db as unknown as DatabaseManager,
    );
    (
      media as unknown as {
        fetchMetadataItem: (
          ratingKey: string,
        ) => Promise<Record<string, unknown>>;
      }
    ).fetchMetadataItem = async (ratingKey) => ({ ratingKey });

    await expect(
      media.setPlaybackSettings({ transcodeAudio: true }),
    ).rejects.toThrow("Unable to switch the current playback source");
    expect(replacementSource).toMatchObject({
      path: "/music/:/transcode/universal/start",
    });
    expect(db.get("playback")).toEqual({
      transcodeAudio: false,
      enableUltraBlur: true,
      enableTimelineReporting: true,
    });
  });
});

class FakeDatabase {
  constructor(private readonly values: Record<string, unknown>) {}

  get(key: string): unknown {
    return this.values[key];
  }

  set(key: string, value: unknown): void {
    this.values[key] = value;
  }
}
