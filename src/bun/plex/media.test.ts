import { describe, expect, test } from "bun:test";
import type { BassManager } from "../bass";
import type { DatabaseManager } from "../database";
import type Authentication from "./authentication";
import {
  createAudioTranscodeSource,
  buildLibraryFacets,
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

describe("library page filters", () => {
  const createMedia = () =>
    new MediaService(
      {} as Authentication,
      { setStreamResolver: () => {} } as unknown as BassManager,
      new FakeDatabase({}) as unknown as DatabaseManager,
    );

  test("maps album search, facets, and sorting to Plex query parameters", () => {
    const media = createMedia() as unknown as {
      mediaPageParams: (request: unknown, type: "9") => Record<string, string>;
    };
    expect(
      media.mediaPageParams(
        {
          pageSize: 40,
          query: "Blue",
          filters: { artistRatingKeys: ["12", "34"], years: [2024] },
          sort: { field: "dateAdded", direction: "desc" },
        },
        "9",
      ),
    ).toEqual({
      type: "9",
      title: "Blue",
      artist: "12,34",
      year: "2024",
      sort: "addedAt:desc",
    });
  });

  test("maps track album facets and clamps page requests independently", () => {
    const media = createMedia() as unknown as {
      mediaPageParams: (request: unknown, type: "10") => Record<string, string>;
    };
    expect(
      media.mediaPageParams(
        {
          pageSize: 50,
          filters: { artistRatingKeys: ["7"], albumRatingKeys: ["9"] },
          sort: { field: "album", direction: "asc" },
        },
        "10",
      ),
    ).toEqual({
      type: "10",
      artist: "7",
      album: "9",
      sort: "album.titleSort:asc",
    });
  });
});

describe("library facets", () => {
  test("deduplicates and sorts options from the complete media corpus", () => {
    const facets = buildLibraryFacets(
      [
        {
          ratingKey: "album-2",
          title: "Zulu",
          artist: "Beta",
          artistRatingKey: "artist-2",
          year: 2020,
          thumb: null,
          trackCount: 1,
          addedAt: null,
        },
        {
          ratingKey: "album-1",
          title: "Alpha",
          artist: "alpha",
          artistRatingKey: "artist-1",
          year: 2024,
          thumb: null,
          trackCount: 1,
          addedAt: null,
        },
        {
          ratingKey: "album-3",
          title: "Another",
          artist: "Alpha duplicate",
          artistRatingKey: "artist-1",
          year: 2024,
          thumb: null,
          trackCount: 1,
          addedAt: null,
        },
      ],
      [
        {
          ratingKey: "track-1",
          title: "One",
          artist: "Beta",
          artistRatingKey: "artist-2",
          album: "Zulu",
          albumRatingKey: "album-2",
          duration: null,
          index: null,
          disc: null,
          thumb: null,
          addedAt: null,
        },
        {
          ratingKey: "track-2",
          title: "Two",
          artist: "Alpha",
          artistRatingKey: "artist-1",
          album: "Alpha",
          albumRatingKey: "album-1",
          duration: null,
          index: null,
          disc: null,
          thumb: null,
          addedAt: null,
        },
      ],
    );

    expect(facets.albumArtists.map((item) => item.ratingKey)).toEqual([
      "artist-1",
      "artist-2",
    ]);
    expect(facets.albumYears).toEqual([2024, 2020]);
    expect(facets.trackArtists.map((item) => item.ratingKey)).toEqual([
      "artist-1",
      "artist-2",
    ]);
    expect(facets.trackAlbums.map((item) => item.ratingKey)).toEqual([
      "album-1",
      "album-2",
    ]);
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
