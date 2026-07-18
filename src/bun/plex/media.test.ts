import { describe, expect, test } from "bun:test";
import type { BassManager } from "../bass";
import { DatabaseManager } from "../database";
import type { LocalPlaybackServer } from "../local-playback-server";
import type { ArtworkCacheServer } from "../artwork-cache-server";
import type Authentication from "./authentication";
import {
  createAudioTranscodeSource,
  buildLibraryFacets,
  MediaService,
  normalizePlaybackSettings,
  pageAlbumCorpus,
  pageTrackCorpus,
  selectPopularArtistTracks,
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

  test("does not delegate album facets to unreliable Plex parameters", () => {
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
      sort: "addedAt:desc",
    });
  });

  test("does not delegate track facets to unreliable Plex parameters", () => {
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
      sort: "album.titleSort:asc",
    });
  });
});

describe("complete library paging", () => {
  const albums = [
    album("a1", "Blonde", "Frank Ocean", "frank", 2016, 20),
    album("a2", "Channel Orange", "Frank Ocean", "frank", 2012, 10),
    album("a3", "After Hours", "The Weeknd", "weeknd", 2020, null),
    album("a4", "Endless", "Frank Ocean", "frank", null, 30),
  ];
  const tracks = [
    track("t1", "Nikes", "Frank Ocean", "frank", "Blonde", "a1", 20),
    track("t2", "Ivy", "Frank Ocean", "frank", "Blonde", "a1", 30),
    track(
      "t3",
      "Blinding Lights",
      "The Weeknd",
      "weeknd",
      "After Hours",
      "a3",
      10,
    ),
    track(
      "t4",
      "Thinkin Bout You",
      "Frank Ocean",
      "frank",
      "Channel Orange",
      "a2",
      null,
    ),
  ];

  test("filters albums locally by exact artist id and year", () => {
    const result = pageAlbumCorpus(albums, {
      pageSize: 40,
      filters: { artistRatingKeys: ["frank"], years: [2016] },
      sort: { field: "title", direction: "asc" },
    });
    expect(result.items.map((item) => item.ratingKey)).toEqual(["a1"]);
    expect(result.total).toBe(1);
    expect(result.nextCursor).toBeNull();
  });

  test("sorts null album values last and paginates the filtered corpus stably", () => {
    const first = pageAlbumCorpus(albums, {
      pageSize: 2,
      filters: { artistRatingKeys: ["frank"] },
      sort: { field: "year", direction: "asc" },
    });
    expect(first.items.map((item) => item.ratingKey)).toEqual(["a2", "a1"]);
    expect(first.total).toBe(3);
    expect(first.nextCursor).not.toBeNull();

    const second = pageAlbumCorpus(albums, {
      cursor: first.nextCursor ?? undefined,
      pageSize: 2,
      filters: { artistRatingKeys: ["frank"] },
      sort: { field: "year", direction: "asc" },
    });
    expect(second.items.map((item) => item.ratingKey)).toEqual(["a4"]);
    expect(second.nextCursor).toBeNull();
  });

  test("combines track artist and album filters and applies descending sort", () => {
    const result = pageTrackCorpus(tracks, {
      pageSize: 50,
      filters: { artistRatingKeys: ["frank"], albumRatingKeys: ["a1"] },
      sort: { field: "title", direction: "desc" },
    });
    expect(result.items.map((item) => item.ratingKey)).toEqual(["t1", "t2"]);
    expect(result.total).toBe(2);
  });

  test("invalid cursors restart safely and never skip matching tracks", () => {
    const result = pageTrackCorpus(tracks, {
      cursor: "not-a-cursor",
      pageSize: 1,
      filters: { artistRatingKeys: ["weeknd"] },
      sort: { field: "album", direction: "asc" },
    });
    expect(result.items.map((item) => item.ratingKey)).toEqual(["t3"]);
    expect(result.nextCursor).toBeNull();
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

describe("artist popular tracks", () => {
  test("filters by artist and ranks tracks by Plex play count", () => {
    const tracks = [
      {
        ...track("t1", "One", "Artist", "artist", "Album", "a1", 30),
        viewCount: 2,
      },
      {
        ...track("t2", "Two", "Artist", "artist", "Album", "a1", 10),
        viewCount: 20,
      },
      {
        ...track("t3", "Other", "Other", "other", "Album", "a2", 40),
        viewCount: 100,
      },
    ];

    expect(
      selectPopularArtistTracks(tracks, "artist").map((item) => item.ratingKey),
    ).toEqual(["t2", "t1"]);
  });

  test("falls back to recently added order when cached tracks lack play counts", () => {
    const tracks = [
      track("t1", "Older", "Artist", "artist", "Album", "a1", 10),
      track("t2", "Newer", "Artist", "artist", "Album", "a1", 20),
    ];

    expect(
      selectPopularArtistTracks(tracks, "artist").map((item) => item.ratingKey),
    ).toEqual(["t2", "t1"]);
  });
});

describe("offline library and playback", () => {
  const server = {
    clientIdentifier: "server",
    accessToken: "token",
    connections: [{ uri: "http://127.0.0.1:9" }],
  };
  const selectedLibrary = { key: "1", uuid: "music", type: "artist" };

  function createOfflineMedia(
    selectedLibraries = [selectedLibrary],
    forceOffline = true,
  ) {
    const database = new DatabaseManager({ path: ":memory:" });
    const played: Array<{ track: unknown; source: unknown }> = [];
    const bass = {
      setStreamResolver: () => {},
      playTrack: (trackValue: unknown, source: unknown) =>
        played.push({ track: trackValue, source }),
      getPlaybackStatus: () => ({ current_track: null }),
    } as unknown as BassManager;
    const auth = {
      selectedServer: server,
      plexProduct: "Rayna",
      plexClientId: "client",
      plexUserAccessToken: "token",
      getUserSelectedServer: async () => server,
      getUserSelectedLibraries: async () => selectedLibraries,
    } as unknown as Authentication;
    const media = new MediaService(auth, bass, database);
    media.setLocalPlaybackServer({
      register: () => ({ url: "http://127.0.0.1:1234/media/downloaded" }),
    } as unknown as LocalPlaybackServer);
    media.setOffline(forceOffline);
    return { database, media, played };
  }

  test("browses saved albums, tracks, playlists, and album details offline", async () => {
    const { database, media } = createOfflineMedia();
    database.setMediaCache({
      serverId: "server",
      cacheKey: "albums-complete-corpus:v2:music",
      value: [album("a1", "Saved Album", "Artist", "artist", 2024, 1)],
      updatedAt: 1,
      expiresAt: 2,
    });
    database.setMediaCache({
      serverId: "server",
      cacheKey: "tracks-complete-corpus:v2:music",
      value: [
        track("t1", "Saved Track", "Artist", "artist", "Saved Album", "a1", 1),
      ],
      updatedAt: 1,
      expiresAt: 2,
    });
    database.setMediaCache({
      serverId: "server",
      cacheKey: "playlists:v1",
      value: [{ ratingKey: "p1", title: "Saved Playlist" }],
      updatedAt: 1,
      expiresAt: 2,
    });

    const albums = await media.getAlbumsPage({ pageSize: 40 });
    const tracks = await media.getTracksPage({ pageSize: 40 });
    const playlists = (await media.getPlaylists()) as Array<{ title: string }>;
    const home = await media.getHomeData();
    const popular = (await media.getArtistPopularTracks("artist")) as {
      tracks: Array<{ ratingKey: string }>;
    };
    const detail = (await media.getAlbum("a1")) as {
      freshness: string;
      tracks: Array<{ ratingKey: string }>;
    };

    expect(albums.items[0]?.title).toBe("Saved Album");
    expect(albums.freshness).toBe("stale");
    expect(tracks.items[0]?.title).toBe("Saved Track");
    expect(tracks.freshness).toBe("stale");
    expect(playlists[0]?.title).toBe("Saved Playlist");
    expect(home.freshness).toBe("stale");
    expect(home.recentlyAdded[0]?.title).toBe("Saved Album");
    expect(home.playlists[0]?.title).toBe("Saved Playlist");
    expect(popular.tracks.map((item) => item.ratingKey)).toEqual(["t1"]);
    expect(detail.freshness).toBe("stale");
    expect(detail.tracks.map((item) => item.ratingKey)).toEqual(["t1"]);
    database.close();
  });

  test("plays a completed local track and rejects an unavailable track offline", async () => {
    const { database, media, played } = createOfflineMedia();
    const cachedTrack = {
      ...track(
        "t1",
        "Downloaded Track",
        "Artist",
        "artist",
        "Saved Album",
        "a1",
        1,
      ),
      duration: 123_000,
      thumb: "http://127.0.0.1:9999/artwork/server/cached-cover",
    };
    database.setMediaCache({
      serverId: "server",
      cacheKey: "tracks-complete-corpus:v2:music",
      value: [cachedTrack],
      updatedAt: 1,
      expiresAt: 2,
    });
    media.setArtworkCacheServer({
      revive: (value: string) => value.replace(":9999", ":8888"),
    } as unknown as ArtworkCacheServer);
    database.upsertDownload({
      id: "download-t1",
      serverId: "server",
      ratingKey: "t1",
      mediaType: "track",
      title: "Downloaded Track",
      filePath: "/music/downloaded.flac",
      partialPath: null,
      status: "completed",
      bytesDownloaded: 10,
      totalBytes: 10,
      error: null,
      metadata: {
        targetType: "album",
        targetRatingKey: "a1",
        artist: "Artist",
      },
    });

    await media.playTrack("t1");
    expect(played).toHaveLength(1);
    expect(played[0]?.track).toMatchObject({
      title: "Downloaded Track",
      artist: "Artist",
      album: "Saved Album",
      artistRatingKey: "artist",
      albumRatingKey: "a1",
      duration: 123_000,
      thumb: "http://127.0.0.1:8888/artwork/server/cached-cover",
    });
    expect(played[0]?.source).toMatchObject({
      localPath: "/music/downloaded.flac",
    });
    await expect(media.playTrack("not-downloaded")).rejects.toThrow(
      "not downloaded",
    );
    database.close();
  });

  test("reuses the newest saved corpus when no library selection is persisted", async () => {
    const { database, media } = createOfflineMedia([], false);
    database.setMediaCache({
      serverId: "server",
      cacheKey: "albums-complete-corpus:v2:previous-library-selection",
      value: [album("a1", "Saved Album", "Artist", "artist", 2024, 1)],
      updatedAt: 10,
      expiresAt: 20,
    });

    const albums = await media.getAlbumsPage({ pageSize: 40 });
    expect(albums.items[0]?.title).toBe("Saved Album");
    expect(albums.freshness).toBe("stale");
    database.close();
  });
});

describe("playlist detail caching", () => {
  test("saves playlist tracks while refreshing the online playlist list", async () => {
    const database = new DatabaseManager({ path: ":memory:" });
    const server = {
      clientIdentifier: "server",
      accessToken: "token",
      connections: [{ uri: "https://plex.test" }],
    };
    const auth = {
      selectedServer: server,
      plexProduct: "Rayna",
      plexClientId: "client",
      plexUserAccessToken: "token",
      getUserSelectedServer: async () => server,
      getConnectionCandidates: () => server.connections,
      setLastKnownGoodConnection: () => {},
    } as unknown as Authentication;
    const bass = {
      setStreamResolver: () => {},
      getPlaybackStatus: () => ({ current_track: null }),
    } as unknown as BassManager;
    const media = new MediaService(auth, bass, database);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/playlists") {
        return Response.json({
          MediaContainer: {
            Metadata: [
              {
                key: "/playlists/p1/items",
                ratingKey: "p1",
                title: "Saved Playlist",
                leafCount: 1,
              },
            ],
          },
        });
      }
      if (path === "/playlists/p1/items") {
        return Response.json({
          MediaContainer: {
            Metadata: [
              {
                ratingKey: "t1",
                title: "Saved Track",
                duration: 123_000,
                parentTitle: "Saved Album",
                parentRatingKey: "a1",
                grandparentTitle: "Saved Artist",
                grandparentRatingKey: "artist-1",
              },
            ],
          },
        });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    try {
      const playlists = (await media.getPlaylists()) as Array<{
        title: string;
        freshness: string;
      }>;
      expect(playlists).toEqual([
        expect.objectContaining({ title: "Saved Playlist", freshness: "live" }),
      ]);
      expect(
        database.getMediaCache<{ tracks: Array<{ ratingKey: string }> }>(
          "server",
          "playlist-detail:v1:p1",
        )?.value.tracks,
      ).toEqual([expect.objectContaining({ ratingKey: "t1" })]);

      media.setOffline(true);
      await expect(media.getPlaylist("p1")).resolves.toEqual(
        expect.objectContaining({
          title: "Saved Playlist",
          freshness: "stale",
          tracks: [expect.objectContaining({ ratingKey: "t1" })],
        }),
      );
    } finally {
      globalThis.fetch = originalFetch;
      database.close();
    }
  });
});

function album(
  ratingKey: string,
  title: string,
  artist: string,
  artistRatingKey: string,
  year: number | null,
  addedAt: number | null,
) {
  return {
    ratingKey,
    title,
    artist,
    artistRatingKey,
    year,
    thumb: null,
    trackCount: null,
    addedAt,
  };
}

function track(
  ratingKey: string,
  title: string,
  artist: string,
  artistRatingKey: string,
  albumTitle: string,
  albumRatingKey: string,
  addedAt: number | null,
) {
  return {
    ratingKey,
    title,
    artist,
    artistRatingKey,
    album: albumTitle,
    albumRatingKey,
    duration: null,
    index: null,
    disc: null,
    thumb: null,
    addedAt,
  };
}

class FakeDatabase {
  constructor(private readonly values: Record<string, unknown>) {}

  get(key: string): unknown {
    return this.values[key];
  }

  set(key: string, value: unknown): void {
    this.values[key] = value;
  }
}
