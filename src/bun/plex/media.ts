import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { hostname, release } from "node:os";
import type {
  BassManager,
  PlayableTrack,
  PlexStreamSource,
  StreamCandidate,
} from "../bass";
import type { DatabaseManager } from "../database";
import { CacheService } from "../cache";
import type {
  DownloadMediaResolver,
  ResolvedDownloadTrack,
} from "../download-manager";
import type { LocalPlaybackServer } from "../local-playback-server";
import type { SyncResolver, LibraryRefreshResult } from "../sync-service";
import type { ArtworkCacheServer } from "../artwork-cache-server";
import type Authentication from "./authentication";
import { selectMusicLibraries } from "./library-selection";
import { findLyricsStreamKey, parseLyrics } from "./lyrics";
import type {
  PlaybackSettings,
  PlaybackSettingsPatch,
  PlayerQueue,
  PlayerTrack,
  SearchResult,
  SearchResults,
} from "../../shared/rpc";
import type {
  AlbumPageRequest,
  CacheFreshness,
  MediaAlbum,
  MediaPage,
  MediaTrack,
  PlexLibrary,
  PlexServer,
  TrackPageRequest,
  LyricsResult,
  LibraryFacets,
} from "../../shared/types";

type PlexMetadata = Record<string, any>;

type PlexResponse = {
  MediaContainer?: {
    Metadata?: PlexMetadata[];
    Directory?: PlexMetadata[];
    Hub?: Array<{
      type?: string;
      Metadata?: PlexMetadata[];
      Directory?: PlexMetadata[];
    }>;
    totalSize?: number;
    UltraBlurColors?: Array<{
      topLeft: string;
      topRight: string;
      bottomLeft: string;
      bottomRight: string;
    }>;
  };
};

type HomeData = {
  topEight: Array<Record<string, any>>;
  recentlyPlayed: Array<Record<string, any>>;
  recentlyAdded: Array<Record<string, any>>;
  playlists: Array<Record<string, any>>;
  freshness: CacheFreshness;
  cachedAt: string | null;
};

type HomeContent = Omit<HomeData, "freshness" | "cachedAt">;

type UltraBlurVariantUrls = {
  light: string;
  dark: string;
};

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

type HslColor = {
  h: number;
  s: number;
  l: number;
};

export function buildLibraryFacets(
  albums: MediaAlbum[],
  tracks: MediaTrack[],
): Omit<LibraryFacets, "freshness" | "cachedAt"> {
  const options = <T extends { ratingKey: string; title: string }>(
    entries: T[],
  ) =>
    [...new Map(entries.map((entry) => [entry.ratingKey, entry])).values()]
      .map(({ ratingKey, title }) => ({ ratingKey, title }))
      .sort((left, right) =>
        left.title.localeCompare(right.title, undefined, {
          sensitivity: "base",
        }),
      );

  return {
    albumArtists: options(
      albums.flatMap((album) =>
        album.artistRatingKey
          ? [{ ratingKey: album.artistRatingKey, title: album.artist }]
          : [],
      ),
    ),
    albumYears: [
      ...new Set(
        albums.flatMap((album) => (album.year === null ? [] : [album.year])),
      ),
    ].sort((left, right) => right - left),
    trackArtists: options(
      tracks.flatMap((track) =>
        track.artistRatingKey
          ? [{ ratingKey: track.artistRatingKey, title: track.artist }]
          : [],
      ),
    ),
    trackAlbums: options(
      tracks.flatMap((track) =>
        track.albumRatingKey
          ? [{ ratingKey: track.albumRatingKey, title: track.album }]
          : [],
      ),
    ),
  };
}

type LocallyPageableMedia = MediaAlbum | MediaTrack;

export function selectPopularArtistTracks(
  tracks: MediaTrack[],
  artistRatingKey: string,
  limit = 10,
): MediaTrack[] {
  return tracks
    .filter((track) => track.artistRatingKey === artistRatingKey)
    .sort((left, right) => {
      const popularity =
        Number(right.viewCount ?? right.ratingCount ?? 0) -
        Number(left.viewCount ?? left.ratingCount ?? 0);
      if (popularity !== 0) return popularity;

      const recency = Number(right.addedAt ?? 0) - Number(left.addedAt ?? 0);
      if (recency !== 0) return recency;

      return compareText(left.title, right.title);
    })
    .slice(0, Math.max(0, limit));
}

/**
 * Apply library controls to a complete, stable media corpus. Plex's advanced
 * filter parameters differ between server versions and agents, so library
 * pages deliberately filter and sort locally instead of trusting those
 * parameters to be honoured by `/library/sections/:key/all`.
 */
export function pageAlbumCorpus(
  corpus: MediaAlbum[],
  request: AlbumPageRequest,
): Pick<MediaPage<MediaAlbum>, "items" | "nextCursor" | "total"> {
  const artistKeys = new Set(request.filters?.artistRatingKeys ?? []);
  const years = new Set(request.filters?.years ?? []);
  const query = request.query?.trim().toLocaleLowerCase() ?? "";
  const filtered = corpus.filter(
    (album) =>
      (!query || album.title.toLocaleLowerCase().includes(query)) &&
      (!artistKeys.size ||
        (album.artistRatingKey !== null &&
          artistKeys.has(album.artistRatingKey))) &&
      (!years.size || (album.year !== null && years.has(album.year))),
  );

  if (request.sort) {
    const { field, direction } = request.sort;
    filtered.sort((left, right) => {
      const compared =
        field === "title"
          ? compareText(left.title, right.title)
          : field === "artist"
            ? compareText(left.artist, right.artist)
            : field === "year"
              ? compareNullableNumber(left.year, right.year)
              : compareNullableNumber(left.addedAt, right.addedAt);
      return (
        (compared || compareText(left.ratingKey, right.ratingKey)) *
        (direction === "desc" ? -1 : 1)
      );
    });
  }

  return paginateLocalCorpus(filtered, request);
}

export function pageTrackCorpus(
  corpus: MediaTrack[],
  request: TrackPageRequest,
): Pick<MediaPage<MediaTrack>, "items" | "nextCursor" | "total"> {
  const artistKeys = new Set(request.filters?.artistRatingKeys ?? []);
  const albumKeys = new Set(request.filters?.albumRatingKeys ?? []);
  const query = request.query?.trim().toLocaleLowerCase() ?? "";
  const filtered = corpus.filter(
    (track) =>
      (!query || track.title.toLocaleLowerCase().includes(query)) &&
      (!artistKeys.size ||
        (track.artistRatingKey !== null &&
          artistKeys.has(track.artistRatingKey))) &&
      (!albumKeys.size ||
        (track.albumRatingKey !== null && albumKeys.has(track.albumRatingKey))),
  );

  if (request.sort) {
    const { field, direction } = request.sort;
    filtered.sort((left, right) => {
      const compared =
        field === "title"
          ? compareText(left.title, right.title)
          : field === "artist"
            ? compareText(left.artist, right.artist)
            : field === "album"
              ? compareText(left.album, right.album)
              : compareNullableNumber(left.addedAt, right.addedAt);
      return (
        (compared || compareText(left.ratingKey, right.ratingKey)) *
        (direction === "desc" ? -1 : 1)
      );
    });
  }

  return paginateLocalCorpus(filtered, request);
}

function paginateLocalCorpus<T extends LocallyPageableMedia>(
  corpus: T[],
  request: { cursor?: string; pageSize: number },
): Pick<MediaPage<T>, "items" | "nextCursor" | "total"> {
  const pageSize = Math.min(Math.max(request.pageSize, 1), 100);
  const offset = decodeLocalOffset(request.cursor);
  const nextOffset = Math.min(offset + pageSize, corpus.length);
  return {
    items: corpus.slice(offset, nextOffset),
    nextCursor:
      nextOffset < corpus.length
        ? Buffer.from(JSON.stringify({ aggregateOffset: nextOffset })).toString(
            "base64url",
          )
        : null,
    total: corpus.length,
  };
}

function decodeLocalOffset(cursor?: string): number {
  if (!cursor) return 0;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString()) as {
      aggregateOffset?: unknown;
    };
    return typeof decoded.aggregateOffset === "number" &&
      Number.isSafeInteger(decoded.aggregateOffset) &&
      decoded.aggregateOffset >= 0
      ? decoded.aggregateOffset
      : 0;
  } catch {
    return 0;
  }
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function compareNullableNumber(
  left: number | null,
  right: number | null,
): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return left - right;
}

const PLEX_REQUEST_TIMEOUT_MS = 8_000;

type StoredPlaybackSettings = Partial<PlaybackSettings> & {
  useOriginalFileUrl?: unknown;
};

type AudioTranscodeSourceOptions = {
  ratingKey: string;
  transcodeSessionId: string;
  plexSessionId: string;
  product: string;
  clientIdentifier: string;
  device: string;
  platformVersion: string;
};

type PlexPlaybackIdentityOptions = Omit<
  AudioTranscodeSourceOptions,
  "ratingKey" | "transcodeSessionId"
>;

export function normalizePlaybackSettings(saved: unknown): PlaybackSettings {
  const stored =
    saved && typeof saved === "object" ? (saved as StoredPlaybackSettings) : {};

  return {
    transcodeAudio:
      typeof stored.transcodeAudio === "boolean"
        ? stored.transcodeAudio
        : typeof stored.useOriginalFileUrl === "boolean"
          ? !stored.useOriginalFileUrl
          : false,
    enableUltraBlur:
      typeof stored.enableUltraBlur === "boolean"
        ? stored.enableUltraBlur
        : true,
    enableTimelineReporting:
      typeof stored.enableTimelineReporting === "boolean"
        ? stored.enableTimelineReporting
        : true,
  };
}

export function createAudioTranscodeSource({
  ratingKey,
  transcodeSessionId,
  plexSessionId,
  product,
  clientIdentifier,
  device,
  platformVersion,
}: AudioTranscodeSourceOptions): PlexStreamSource {
  return {
    path: "/music/:/transcode/universal/start",
    params: {
      path: `/library/metadata/${ratingKey}`,
      protocol: "http",
      directPlay: "0",
      directStream: "0",
      directStreamAudio: "0",
      hasMDE: "1",
      mediaIndex: "0",
      partIndex: "0",
      download: "0",
      location: "lan",
      mediaBufferSize: "102400",
      musicBitrate: "320",
      session: transcodeSessionId,
      ...createPlexPlaybackIdentity({
        plexSessionId,
        product,
        clientIdentifier,
        device,
        platformVersion,
      }),
      "X-Plex-Client-Profile-Name": "generic",
      "X-Plex-Client-Profile-Extra":
        "add-transcode-target(replace=true&type=musicProfile&context=streaming&protocol=http&container=ogg&audioCodec=opus)",
    },
  };
}

export function createPlexPlaybackIdentity({
  plexSessionId,
  product,
  clientIdentifier,
  device,
  platformVersion,
}: PlexPlaybackIdentityOptions): Record<string, string> {
  return {
    "X-Plex-Product": product,
    "X-Plex-Client-Identifier": clientIdentifier,
    "X-Plex-Session-Identifier": plexSessionId,
    "X-Plex-Device": device,
    "X-Plex-Device-Name": device,
    "X-Plex-Platform": "Generic",
    "X-Plex-Platform-Version": platformVersion,
  };
}

export class MediaService implements DownloadMediaResolver, SyncResolver {
  private activeBaseUrl: string | null = null;
  private forcedOffline = false;
  private readonly cache: CacheService;
  private localPlaybackServer: LocalPlaybackServer | null = null;
  private networkRestored: (() => void) | null = null;
  private artworkCache: ArtworkCacheServer | null = null;

  constructor(
    private readonly auth: Authentication,
    private readonly bass: BassManager,
    private readonly db: DatabaseManager,
  ) {
    this.cache = new CacheService(db);
    this.bass.setStreamResolver(
      (source, excludedConnectionUris) =>
        this.resolveStreamCandidates(source, excludedConnectionUris),
      (connectionUri) => {
        this.activeBaseUrl = connectionUri;
        this.auth.setLastKnownGoodConnection(connectionUri);
        this.networkRestored?.();
      },
    );
  }

  setLocalPlaybackServer(server: LocalPlaybackServer): void {
    this.localPlaybackServer = server;
  }

  setNetworkRestoredCallback(callback: () => void): void {
    this.networkRestored = callback;
  }

  setArtworkCacheServer(server: ArtworkCacheServer): void {
    this.artworkCache = server;
  }

  setOffline(offline: boolean): void {
    this.forcedOffline = offline;
    if (offline) this.activeBaseUrl = null;
  }

  async refreshLibrary({
    serverId,
    libraryKey,
  }: {
    serverId: string;
    libraryKey: string;
    cursor: string | null;
  }): Promise<LibraryRefreshResult> {
    const server = await this.getSelectedServer();
    if (server.clientIdentifier !== serverId) {
      throw new Error(
        "Cannot sync a library from a server that is not selected",
      );
    }
    const data = await this.fetchPlex(`/library/sections/${libraryKey}/all`, {
      type: "10",
      "X-Plex-Container-Start": "0",
      "X-Plex-Container-Size": "100",
      sort: "updatedAt:desc",
    });
    const items = data.MediaContainer?.Metadata || [];
    this.db.setMediaCache({
      serverId,
      cacheKey: `sync-library:${libraryKey}`,
      value: items.map((item) => this.mapTrack(item)),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    return { cursor: null, refreshedItems: items.length };
  }

  async trackExists({
    serverId,
    ratingKey,
  }: {
    serverId: string;
    ratingKey: string;
  }): Promise<boolean> {
    const server = await this.getSelectedServer();
    if (server.clientIdentifier !== serverId) return false;
    try {
      await this.fetchMetadataItem(ratingKey);
      return true;
    } catch {
      return false;
    }
  }

  async getLyrics(ratingKey: string): Promise<LyricsResult> {
    const server = await this.getSelectedServer();
    const cacheKey = `lyrics:${ratingKey}`;
    try {
      const cached = await this.cache.readThrough({
        serverId: server.clientIdentifier,
        key: cacheKey,
        ttlMs: 24 * 60 * 60 * 1000,
        fetch: async () => {
          const metadata = await this.fetchMetadataItem(ratingKey);
          const streamKey = findLyricsStreamKey(metadata);
          if (!streamKey) return null;
          return this.fetchPlexText(streamKey);
        },
      });
      if (cached.value === null)
        return { status: "unavailable", reason: "not-found" };
      const parsed = parseLyrics(cached.value);
      if (!parsed.lines.length)
        return { status: "unavailable", reason: "not-found" };
      return {
        status: "available",
        lyrics: {
          ratingKey,
          ...parsed,
          freshness:
            cached.source === "network"
              ? "live"
              : cached.isStale
                ? "stale"
                : "fresh",
          cachedAt:
            cached.source === "network" ? null : new Date().toISOString(),
        },
      };
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "OFFLINE_UNAVAILABLE"
      ) {
        return { status: "unavailable", reason: "offline-not-cached" };
      }
      throw error;
    }
  }

  async resolveTracks({
    serverId,
    targetType,
    ratingKey,
  }: {
    serverId: string;
    targetType: "track" | "album" | "playlist";
    ratingKey: string;
  }): Promise<ResolvedDownloadTrack[]> {
    const server = await this.getSelectedServer();
    if (server.clientIdentifier !== serverId) {
      throw new Error("Downloads can only be created for the selected server");
    }
    const tracks =
      targetType === "track"
        ? [await this.fetchMetadataItem(ratingKey)]
        : targetType === "playlist"
          ? await this.fetchPlaylistItems(ratingKey)
          : await this.fetchMetadataChildren(ratingKey);
    const token = this.getServerToken(server);
    const connections = this.auth.getConnectionCandidates(
      "auto",
      server,
      this.activeBaseUrl,
    );
    if (!connections.length)
      throw new Error("No reachable Plex connection is available");

    return tracks.map((track) => {
      const part = track.Media?.[0]?.Part?.[0];
      if (typeof part?.key !== "string" || !part.key) {
        throw new Error(`Track ${track.ratingKey} has no original media part`);
      }
      return {
        ratingKey: String(track.ratingKey || ""),
        title: String(track.title || "Untitled track"),
        artist: String(track.originalTitle || track.grandparentTitle || ""),
        album: String(track.parentTitle || ""),
        artistRatingKey:
          track.grandparentRatingKey ||
          this.extractRatingKey(track.grandparentKey),
        albumRatingKey:
          track.parentRatingKey || this.extractRatingKey(track.parentKey),
        duration: Number.isFinite(Number(track.duration))
          ? Number(track.duration)
          : null,
        thumb: this.plexUrl(
          track.thumb || track.parentThumb || track.grandparentThumb,
        ),
        url: this.buildPlexUrl(part.key, connections[0].uri, token),
        candidates: connections.map((connection) => ({
          url: this.buildPlexUrl(part.key, connection.uri, token),
        })),
        fileName: typeof part.file === "string" ? part.file : undefined,
      };
    });
  }

  getPlaybackSettings(): PlaybackSettings {
    return normalizePlaybackSettings(this.db.get("playback"));
  }

  async setPlaybackSettings(
    settings: PlaybackSettingsPatch,
  ): Promise<PlaybackSettings> {
    const current = this.getPlaybackSettings();
    const next = normalizePlaybackSettings({
      ...current,
      ...settings,
    });

    if (current.transcodeAudio !== next.transcodeAudio) {
      await this.replaceCurrentPlaybackSource(next.transcodeAudio);
    }

    this.db.set("playback", next);
    return next;
  }

  async getAlbumsPage(
    request: AlbumPageRequest,
  ): Promise<MediaPage<MediaAlbum>> {
    return this.getCachedMediaPage("albums", request, "9", (item) =>
      this.mapTypedAlbum(item),
    );
  }

  async getTracksPage(
    request: TrackPageRequest,
  ): Promise<MediaPage<MediaTrack>> {
    return this.getCachedMediaPage("tracks", request, "10", (item) =>
      this.mapTrack(item),
    );
  }

  async getLibraryFacets(): Promise<LibraryFacets> {
    const server = await this.getSelectedServer();
    const sectionKey = await this.selectedSectionCacheSuffix();
    const cacheKey = `library-facets:v2:${sectionKey}`;
    this.reuseLatestScopedCache(server.clientIdentifier, cacheKey);
    const result = await this.cache.readThrough({
      serverId: server.clientIdentifier,
      key: cacheKey,
      ttlMs: 5 * 60 * 1000,
      fetch: async () => {
        this.assertOnline();
        const [albums, tracks] = await Promise.all([
          this.getCompleteMediaCorpus("albums", "9", (item) =>
            this.mapTypedAlbum(item),
          ),
          this.getCompleteMediaCorpus("tracks", "10", (item) =>
            this.mapTrack(item),
          ),
        ]);
        return buildLibraryFacets(albums, tracks);
      },
    });

    return {
      ...result.value,
      freshness: this.forcedOffline
        ? "stale"
        : result.source === "network"
          ? "live"
          : result.isStale
            ? "stale"
            : "fresh",
      cachedAt: result.source === "network" ? null : new Date().toISOString(),
    };
  }

  private async getCachedMediaPage<T>(
    resource: string,
    request: AlbumPageRequest | TrackPageRequest,
    type: "9" | "10",
    mapper: (item: PlexMetadata) => T,
  ): Promise<MediaPage<T>> {
    const server = await this.getSelectedServer();
    const cacheKey = await this.completeCorpusCacheKey(resource);
    this.reuseLatestScopedCache(server.clientIdentifier, cacheKey);
    const result = await this.cache.readThrough({
      serverId: server.clientIdentifier,
      key: cacheKey,
      ttlMs: 5 * 60 * 1000,
      fetch: () => {
        this.assertOnline();
        return this.fetchCompleteMediaCorpus(type, mapper);
      },
    });

    const corpus = this.reviveArtwork(result.value);
    const page =
      resource === "albums"
        ? pageAlbumCorpus(
            corpus as unknown as MediaAlbum[],
            request as AlbumPageRequest,
          )
        : pageTrackCorpus(
            corpus as unknown as MediaTrack[],
            request as TrackPageRequest,
          );

    return {
      ...(page as unknown as Pick<
        MediaPage<T>,
        "items" | "nextCursor" | "total"
      >),
      freshness: this.forcedOffline
        ? "stale"
        : result.source === "network"
          ? "live"
          : result.isStale
            ? "stale"
            : "fresh",
      cachedAt: result.source === "network" ? null : new Date().toISOString(),
    };
  }

  private async getCompleteMediaCorpus<T>(
    resource: string,
    type: "9" | "10",
    mapper: (item: PlexMetadata) => T,
  ): Promise<T[]> {
    const server = await this.getSelectedServer();
    const cacheKey = await this.completeCorpusCacheKey(resource);
    this.reuseLatestScopedCache(server.clientIdentifier, cacheKey);
    const result = await this.cache.readThrough({
      serverId: server.clientIdentifier,
      key: cacheKey,
      ttlMs: 5 * 60 * 1000,
      fetch: () => {
        this.assertOnline();
        return this.fetchCompleteMediaCorpus(type, mapper);
      },
    });
    return this.reviveArtwork(result.value);
  }

  private async completeCorpusCacheKey(resource: string): Promise<string> {
    return `${resource}-complete-corpus:v2:${await this.selectedSectionCacheSuffix()}`;
  }

  private reuseLatestScopedCache(serverId: string, cacheKey: string): void {
    if (this.db.getMediaCache(serverId, cacheKey)) return;
    const prefix = cacheKey.slice(0, cacheKey.lastIndexOf(":") + 1);
    const fallback = this.db.getLatestMediaCacheByPrefix(serverId, prefix);
    if (fallback)
      this.db.setMediaCache({ ...fallback, cacheKey, expiresAt: 0 });
  }

  private async selectedSectionCacheSuffix(): Promise<string> {
    const selected = (await this.auth.getUserSelectedLibraries()) || [];
    if (!selected.length) return "all";
    return selected
      .map((section) =>
        typeof section === "string" ? section : section.uuid || section.key,
      )
      .sort()
      .join(",");
  }

  private async fetchCompleteMediaCorpus<T>(
    type: "9" | "10",
    mapper: (item: PlexMetadata) => T,
  ): Promise<T[]> {
    const items: T[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.getMediaPage(
        { cursor, pageSize: 100 },
        type,
        mapper,
      );
      items.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return items;
  }

  private async getMediaPage<T>(
    request: AlbumPageRequest | TrackPageRequest,
    type: "9" | "10",
    mapper: (item: PlexMetadata) => T,
  ): Promise<MediaPage<T>> {
    const sections = await this.getSelectedMusicSections();
    let { sectionIndex, offset } = this.decodeCursor(request.cursor);
    const items: PlexMetadata[] = [];
    const pageSize = Math.min(Math.max(request.pageSize, 1), 100);
    const params = this.mediaPageParams(request, type);

    while (items.length < pageSize && sectionIndex < sections.length) {
      const section = sections[sectionIndex];
      const data = await this.fetchPlex(
        `/library/sections/${section.key}/all`,
        {
          ...params,
          "X-Plex-Container-Start": String(offset),
          "X-Plex-Container-Size": String(pageSize - items.length),
        },
      );
      const pageItems = data.MediaContainer?.Metadata || [];

      if (pageItems.length === 0) {
        sectionIndex += 1;
        offset = 0;
        continue;
      }

      items.push(...pageItems);
      offset += pageItems.length;

      const totalSize = data.MediaContainer?.totalSize || 0;
      if (offset >= totalSize) {
        sectionIndex += 1;
        offset = 0;
      }
    }

    return {
      items: items.map(mapper),
      nextCursor:
        sectionIndex < sections.length
          ? this.encodeCursor(sectionIndex, offset)
          : null,
      total: null,
      freshness: "live",
      cachedAt: null,
    };
  }

  private mediaPageParams(
    request: AlbumPageRequest | TrackPageRequest,
    type: "9" | "10",
  ): Record<string, string> {
    const params: Record<string, string> = { type };
    if (request.query?.trim()) params.title = request.query.trim();

    if (request.sort) {
      const sortFields: Record<string, string> = {
        title: "titleSort",
        artist: "artist.titleSort",
        album: "album.titleSort",
        year: "year",
        dateAdded: "addedAt",
      };
      params.sort = `${sortFields[request.sort.field]}:${request.sort.direction}`;
    }
    return params;
  }

  async getArtistsPage(cursor = "", pageSize = 30): Promise<unknown> {
    const sections = await this.getSelectedMusicSections();
    let { sectionIndex, offset } = this.decodeCursor(cursor);
    const initialSectionIndex = sectionIndex;
    const initialOffset = offset;
    const artists: PlexMetadata[] = [];

    while (artists.length < pageSize && sectionIndex < sections.length) {
      const section = sections[sectionIndex];
      const data = await this.fetchPlex(
        `/library/sections/${section.key}/all`,
        {
          type: "8",
          "X-Plex-Container-Start": String(offset),
          "X-Plex-Container-Size": String(pageSize - artists.length),
        },
      );
      const artistData =
        data.MediaContainer?.Metadata || data.MediaContainer?.Directory || [];

      if (artistData.length === 0) {
        sectionIndex += 1;
        offset = 0;
        continue;
      }

      artists.push(...artistData);
      offset += artistData.length;

      const totalSize = data.MediaContainer?.totalSize || 0;
      if (offset >= totalSize) {
        sectionIndex += 1;
        offset = 0;
      }
    }

    return {
      items: artists.map((artist) => this.mapArtist(artist)),
      nextCursor:
        sectionIndex < sections.length
          ? this.encodeCursor(sectionIndex, offset)
          : null,
      prevCursor:
        initialOffset > 0 || initialSectionIndex > 0
          ? this.encodeCursor(
              initialSectionIndex,
              Math.max(0, initialOffset - pageSize),
            )
          : null,
      hasMore: sectionIndex < sections.length,
    };
  }

  async getRecentlyPlayedAlbums(): Promise<unknown[]> {
    const albums = await this.getAlbumsFromSections({
      sort: "lastViewedAt:desc",
      limit: 5,
    });

    return albums
      .filter((album) => album.lastViewedAt)
      .sort((a, b) => Number(b.lastViewedAt || 0) - Number(a.lastViewedAt || 0))
      .slice(0, 50)
      .map((album) => this.mapAlbum(album));
  }

  async getRecentlyAddedAlbums(): Promise<unknown[]> {
    const albums = await this.getAlbumsFromSections({
      sort: "addedAt:desc",
      limit: 50,
    });

    return albums
      .sort((a, b) => Number(b.addedAt || 0) - Number(a.addedAt || 0))
      .slice(0, 50)
      .map((album) => this.mapAlbum(album));
  }

  async getHomeData(): Promise<HomeData> {
    const server = await this.getSelectedServer();
    try {
      const result = await this.cache.readThrough<HomeContent>({
        serverId: server.clientIdentifier,
        key: "home:v1",
        ttlMs: 5 * 60 * 1000,
        fetch: async () => {
          this.assertOnline();
          const [recentlyPlayed, recentlyAdded, playlists] = await Promise.all([
            this.getRecentlyPlayedAlbums() as Promise<
              Array<Record<string, any>>
            >,
            this.getRecentlyAddedAlbums() as Promise<
              Array<Record<string, any>>
            >,
            this.getPlaylists() as Promise<Array<Record<string, any>>>,
          ]);
          return {
            topEight: this.buildTopEight(recentlyPlayed, playlists),
            recentlyPlayed,
            recentlyAdded,
            playlists,
          };
        },
      });
      return {
        ...this.reviveArtwork(result.value),
        freshness: this.forcedOffline
          ? "stale"
          : result.source === "network"
            ? "live"
            : result.isStale
              ? "stale"
              : "fresh",
        cachedAt: result.source === "network" ? null : new Date().toISOString(),
      };
    } catch {
      return this.getOfflineHomeData(server.clientIdentifier);
    }
  }

  private getOfflineHomeData(serverId: string): HomeData {
    const albumsEntry =
      this.db.getLatestMediaCacheByPrefix<MediaAlbum[]>(
        serverId,
        "albums-complete-corpus:v2:",
      );
    const playlistsEntry = this.db.getMediaCache<Array<Record<string, any>>>(
      serverId,
      "playlists:v1",
    );
    const recentlyAdded = this.reviveArtwork(albumsEntry?.value ?? [])
      .slice()
      .sort(
        (left, right) => Number(right.addedAt || 0) - Number(left.addedAt || 0),
      )
      .slice(0, 50)
      .map((album) => ({
        ...album,
        id: album.ratingKey,
        parentRatingKey: album.artistRatingKey,
      }));
    const playlists = this.reviveArtwork(playlistsEntry?.value ?? []).map(
      (playlist) => ({ ...playlist, freshness: "stale" }),
    );
    const cachedAt = Math.max(
      albumsEntry?.updatedAt ?? 0,
      playlistsEntry?.updatedAt ?? 0,
    );

    return {
      topEight: this.buildTopEight(recentlyAdded, playlists),
      recentlyPlayed: [],
      recentlyAdded,
      playlists,
      freshness: "stale",
      cachedAt: cachedAt ? new Date(cachedAt).toISOString() : null,
    };
  }

  async getTopEight(): Promise<unknown[]> {
    const [albums, playlists] = await Promise.all([
      this.getRecentlyPlayedAlbums() as Promise<Array<Record<string, any>>>,
      this.getPlaylists() as Promise<Array<Record<string, any>>>,
    ]);
    return this.buildTopEight(albums, playlists);
  }

  private buildTopEight(
    albums: Array<Record<string, any>>,
    playlists: Array<Record<string, any>>,
  ): Array<Record<string, any>> {
    return [
      ...albums.slice(0, 8).map((album) => ({
        ...album,
        type: "album",
        sortAt: Number(album.lastViewedAt || album.addedAt || 0),
      })),
      ...playlists.slice(0, 8).map((playlist) => ({
        ...playlist,
        type: "playlist",
        thumb: playlist.composite,
        sortAt: Number(playlist.lastViewedAt || playlist.addedAt || 0),
      })),
    ]
      .sort((a, b) => b.sortAt - a.sortAt)
      .slice(0, 8)
      .map(({ sortAt: _sortAt, ...item }) => item);
  }

  async getAlbum(ratingKey: string): Promise<unknown> {
    const server = await this.getSelectedServer();
    try {
      const result = await this.cache.readThrough({
        serverId: server.clientIdentifier,
        key: `album-detail:v1:${ratingKey}`,
        ttlMs: 5 * 60 * 1000,
        fetch: async () => {
          this.assertOnline();
          const album = await this.fetchMetadataItem(ratingKey);
          const [tracks, ultraBlur] = await Promise.all([
            this.fetchMetadataChildren(ratingKey),
            this.getUltraBlur(album.thumb || album.art, `album-${ratingKey}`),
          ]);
          return this.mapAlbumDetail(album, tracks, ultraBlur);
        },
      });
      return {
        ...this.reviveArtwork(result.value),
        freshness: this.forcedOffline || result.isStale ? "stale" : "live",
      };
    } catch (error) {
      const offline = await this.offlineAlbumDetail(ratingKey);
      if (offline) return offline;
      throw error;
    }
  }

  private mapAlbumDetail(
    album: PlexMetadata,
    tracks: PlexMetadata[],
    ultraBlur: UltraBlurVariantUrls | null,
  ): Record<string, unknown> {
    const artistKey =
      album.parentRatingKey || this.extractRatingKey(album.parentKey);

    return {
      id: album.key,
      title: album.title,
      year: album.year,
      artist: album.parentTitle,
      artistKey,
      ratingKey: album.ratingKey,
      leafCount: album.leafCount,
      thumb: this.plexUrl(album.thumb),
      art: this.plexUrl(album.art),
      ultraBlur,
      tracks: tracks.map((track) => ({
        id: track.ratingKey,
        number: track.trackNumber,
        title: track.title,
        duration: track.duration,
        albumThumb: this.plexUrl(track.thumb || album.thumb),
        albumTitle: track.parentTitle || album.title,
        albumRatingKey:
          track.parentRatingKey ||
          this.extractRatingKey(track.parentKey) ||
          album.ratingKey,
        artistTitle: track.grandparentTitle || album.parentTitle,
        artistRatingKey:
          track.grandparentRatingKey ||
          this.extractRatingKey(track.grandparentKey) ||
          artistKey,
        ratingKey: track.ratingKey,
      })),
    };
  }

  private async offlineAlbumDetail(
    ratingKey: string,
  ): Promise<Record<string, unknown> | null> {
    const server = await this.getSelectedServer();
    const suffix = await this.selectedSectionCacheSuffix();
    const albums = this.reviveArtwork(
      (
        this.db.getMediaCache<MediaAlbum[]>(
          server.clientIdentifier,
          `albums-complete-corpus:v2:${suffix}`,
        ) ||
        this.db.getLatestMediaCacheByPrefix<MediaAlbum[]>(
          server.clientIdentifier,
          "albums-complete-corpus:v2:",
        )
      )?.value,
    );
    const tracks = this.reviveArtwork(
      (
        this.db.getMediaCache<MediaTrack[]>(
          server.clientIdentifier,
          `tracks-complete-corpus:v2:${suffix}`,
        ) ||
        this.db.getLatestMediaCacheByPrefix<MediaTrack[]>(
          server.clientIdentifier,
          "tracks-complete-corpus:v2:",
        )
      )?.value,
    );
    const album = albums?.find((item) => item.ratingKey === ratingKey);
    if (!album || !tracks) return null;
    const albumTracks = tracks.filter(
      (track) => track.albumRatingKey === ratingKey,
    );
    return {
      id: ratingKey,
      title: album.title,
      year: album.year,
      artist: album.artist,
      artistKey: album.artistRatingKey,
      ratingKey,
      leafCount: album.trackCount ?? albumTracks.length,
      thumb: album.thumb,
      art: null,
      ultraBlur: null,
      freshness: "stale",
      tracks: albumTracks.map((track) => ({
        id: track.ratingKey,
        number: track.index,
        title: track.title,
        duration: track.duration,
        albumThumb: track.thumb || album.thumb,
        albumTitle: track.album,
        albumRatingKey: track.albumRatingKey,
        artistTitle: track.artist,
        artistRatingKey: track.artistRatingKey,
        ratingKey: track.ratingKey,
      })),
    };
  }

  async getArtist(ratingKey: string): Promise<unknown> {
    const artist = await this.fetchMetadataItem(ratingKey);
    const ultraBlur = await this.getUltraBlur(
      artist.thumb,
      `artist-${ratingKey}`,
    );

    return {
      id: artist.key,
      title: artist.title,
      ratingKey: artist.ratingKey,
      summary: artist.summary,
      thumb: this.plexUrl(artist.thumb),
      art: this.plexUrl(artist.art),
      ultraBlur,
      viewCount: artist.viewCount,
    };
  }

  async getUltraBlur(
    imagePath: string | null,
    cacheBuster?: string,
  ): Promise<UltraBlurVariantUrls | null> {
    if (!imagePath) return null;

    try {
      const colors = await this.fetchPlex("/services/ultrablur/colors", {
        url: imagePath,
      });
      const blurColors = colors.MediaContainer?.UltraBlurColors?.[0];
      if (!blurColors) return null;

      const variants = this.buildPlexampUltraBlurColors(blurColors);
      const light = this.ultraBlurImageUrl(variants.light, cacheBuster);
      const dark = this.ultraBlurImageUrl(variants.dark, cacheBuster);
      if (!light || !dark) return null;

      return { light, dark };
    } catch {
      return null;
    }
  }

  private ultraBlurImageUrl(
    colors: {
      topLeft: string;
      topRight: string;
      bottomLeft: string;
      bottomRight: string;
    },
    cacheBuster?: string,
  ): string | null {
    const params = new URLSearchParams({
      topLeft: colors.topLeft,
      topRight: colors.topRight,
      bottomLeft: colors.bottomLeft,
      bottomRight: colors.bottomRight,
      width: "1920",
      height: "1080",
      noise: "1",
    });

    return this.plexUrl("/photo/:/transcode", {
      url: `/services/ultrablur/image?${params.toString()}`,
      width: "1920",
      height: "1080",
      ...(cacheBuster ? { v: cacheBuster } : {}),
    });
  }

  private buildPlexampUltraBlurColors(colors: {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
  }): {
    light: {
      topLeft: string;
      topRight: string;
      bottomLeft: string;
      bottomRight: string;
    };
    dark: {
      topLeft: string;
      topRight: string;
      bottomLeft: string;
      bottomRight: string;
    };
  } {
    const corners = [
      colors.topLeft,
      colors.topRight,
      colors.bottomLeft,
      colors.bottomRight,
    ]
      .map((color) => this.parseHexColor(color))
      .filter((color): color is RgbColor => color !== null);

    if (corners.length === 0) {
      return {
        light: colors,
        dark: colors,
      };
    }

    const average = corners.reduce<RgbColor>(
      (sum, color) => ({
        r: sum.r + color.r / corners.length,
        g: sum.g + color.g / corners.length,
        b: sum.b + color.b / corners.length,
      }),
      { r: 0, g: 0, b: 0 },
    );
    const averageHsl = this.rgbToHsl(average);
    const lightBase = this.hslToRgb({
      h: averageHsl.h,
      s: this.clamp(averageHsl.s * 0.68, 0.36, 0.5),
      l: 0.9,
    });
    const darkBase = this.hslToRgb({
      h: averageHsl.h,
      s: this.clamp(averageHsl.s * 1.2, 0.38, 0.62),
      l: 0.31,
    });
    const cornerNames = [
      "topLeft",
      "topRight",
      "bottomLeft",
      "bottomRight",
    ] as const;

    const themed = cornerNames.reduce(
      (acc, name) => {
        const original = this.parseHexColor(colors[name]) ?? average;
        acc.light[name] = this.rgbToHex(this.mixRgb(lightBase, original, 0.08));
        acc.dark[name] = this.rgbToHex(this.mixRgb(darkBase, original, 0.18));
        return acc;
      },
      {
        light: {
          topLeft: "",
          topRight: "",
          bottomLeft: "",
          bottomRight: "",
        },
        dark: {
          topLeft: "",
          topRight: "",
          bottomLeft: "",
          bottomRight: "",
        },
      },
    );

    return themed;
  }

  private parseHexColor(color: string): RgbColor | null {
    const normalized = color.replace(/^#/, "").trim();
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;

    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16),
    };
  }

  private rgbToHex(color: RgbColor): string {
    return [color.r, color.g, color.b]
      .map((component) =>
        Math.round(this.clamp(component, 0, 255))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  }

  private mixRgb(
    base: RgbColor,
    accent: RgbColor,
    accentAmount: number,
  ): RgbColor {
    const baseAmount = 1 - accentAmount;
    return {
      r: base.r * baseAmount + accent.r * accentAmount,
      g: base.g * baseAmount + accent.g * accentAmount,
      b: base.b * baseAmount + accent.b * accentAmount,
    };
  }

  private rgbToHsl({ r, g, b }: RgbColor): HslColor {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const lightness = (max + min) / 2;

    if (max === min) {
      return { h: 0, s: 0, l: lightness };
    }

    const delta = max - min;
    const saturation =
      lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    let hue = 0;

    if (max === red) {
      hue = (green - blue) / delta + (green < blue ? 6 : 0);
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }

    return { h: hue / 6, s: saturation, l: lightness };
  }

  private hslToRgb({ h, s, l }: HslColor): RgbColor {
    if (s === 0) {
      const value = l * 255;
      return { r: value, g: value, b: value };
    }

    const hueToRgb = (p: number, q: number, t: number) => {
      let next = t;
      if (next < 0) next += 1;
      if (next > 1) next -= 1;
      if (next < 1 / 6) return p + (q - p) * 6 * next;
      if (next < 1 / 2) return q;
      if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    return {
      r: hueToRgb(p, q, h + 1 / 3) * 255,
      g: hueToRgb(p, q, h) * 255,
      b: hueToRgb(p, q, h - 1 / 3) * 255,
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  async getArtistAlbums(ratingKey: string): Promise<unknown[]> {
    let albums = await this.fetchMetadataChildren(ratingKey, { type: "9" });
    if (albums.length === 0) {
      albums = await this.fetchMetadataChildren(ratingKey);
    }
    if (albums.length === 0) {
      albums = await this.getArtistAlbumsFromSections(ratingKey);
    }

    return albums.map((album) => ({
      ...this.mapAlbum(album),
      artistKey:
        album.parentRatingKey || this.extractRatingKey(album.parentKey),
      leafCount: album.leafCount,
    }));
  }

  async getArtistPopularTracks(ratingKey: string): Promise<unknown> {
    const tracks = await this.getCompleteMediaCorpus("tracks", "10", (track) =>
      this.mapTrack(track),
    );

    return {
      tracks: selectPopularArtistTracks(tracks, ratingKey).map((track) => ({
        id: track.ratingKey,
        number: track.index,
        title: track.title,
        duration: track.duration,
        playCount: track.viewCount ?? track.ratingCount ?? 0,
        ratingKey: track.ratingKey,
      })),
    };
  }

  async getPlaylists(): Promise<unknown[]> {
    const server = await this.getSelectedServer();
    const result = await this.cache.readThrough({
      serverId: server.clientIdentifier,
      key: "playlists:v1",
      ttlMs: 5 * 60 * 1000,
      fetch: async () => {
        this.assertOnline();
        const data = await this.fetchPlex("/playlists", {
          playlistType: "audio",
        });
        const playlists = data.MediaContainer?.Metadata || [];
        await this.cachePlaylistDetails(server.clientIdentifier, playlists);
        return playlists.map((playlist) => this.mapPlaylistSummary(playlist));
      },
    });
    const freshness = this.forcedOffline || result.isStale ? "stale" : "live";
    return this.reviveArtwork(result.value).map((playlist) => ({
      ...playlist,
      freshness,
    }));
  }

  private async cachePlaylistDetails(
    serverId: string,
    playlists: PlexMetadata[],
  ): Promise<void> {
    const updatedAt = Date.now();
    await Promise.allSettled(
      playlists.map(async (playlist) => {
        const ratingKey = String(playlist.ratingKey || "");
        if (!ratingKey) return;
        const tracks = await this.fetchPlaylistItems(ratingKey);
        this.db.setMediaCache({
          serverId,
          cacheKey: `playlist-detail:v1:${ratingKey}`,
          value: this.mapPlaylistDetail(playlist, tracks),
          updatedAt,
          expiresAt: updatedAt + 5 * 60 * 1000,
        });
      }),
    );
  }

  private mapPlaylistSummary(playlist: PlexMetadata) {
    return {
      id: playlist.key,
      title: playlist.title,
      addedAt: playlist.addedAt,
      ratingKey: playlist.ratingKey,
      composite: this.plexUrl(playlist.composite) || "",
      smart: playlist.smart,
      icon: playlist.icon,
      duration: playlist.duration,
    };
  }

  async search(query: string, limit = 8): Promise<SearchResults> {
    const normalizedQuery = query.trim();
    const empty: SearchResults = {
      artists: [],
      albums: [],
      tracks: [],
      playlists: [],
    };
    if (!normalizedQuery) return empty;

    const safeLimit = Math.min(Math.max(limit, 1), 25);
    const data = await this.fetchPlex("/hubs/search", {
      query: normalizedQuery,
      limit: String(safeLimit),
      includeCollections: "0",
    });

    for (const hub of data.MediaContainer?.Hub || []) {
      for (const item of hub.Metadata || hub.Directory || []) {
        const result = this.mapSearchResult(item);
        if (!result) continue;
        const bucket = `${result.type}s` as keyof SearchResults;
        if (empty[bucket].length < safeLimit) empty[bucket].push(result);
      }
    }

    return empty;
  }

  async getPlaylist(ratingKey: string): Promise<unknown> {
    const server = await this.getSelectedServer();
    try {
      const result = await this.cache.readThrough({
        serverId: server.clientIdentifier,
        key: `playlist-detail:v1:${ratingKey}`,
        ttlMs: 5 * 60 * 1000,
        fetch: async () => {
          this.assertOnline();
          const playlist = await this.fetchMetadataItem(ratingKey);
          const tracks = await this.fetchPlaylistItems(ratingKey);
          return this.mapPlaylistDetail(playlist, tracks);
        },
      });
      return {
        ...this.reviveArtwork(result.value),
        freshness: this.forcedOffline || result.isStale ? "stale" : "live",
      };
    } catch (error) {
      const offline = await this.offlinePlaylistDetail(ratingKey);
      if (offline) return offline;
      throw error;
    }
  }

  private async offlinePlaylistDetail(
    ratingKey: string,
  ): Promise<Record<string, unknown> | null> {
    const server = await this.getSelectedServer();
    const tracks = await this.offlineTracks("playlist", ratingKey);
    if (!tracks.length) return null;
    const summary = this.db
      .getMediaCache<
        Array<Record<string, any>>
      >(server.clientIdentifier, "playlists:v1")
      ?.value.find((playlist) => String(playlist.ratingKey) === ratingKey);
    return {
      id: ratingKey,
      title: summary?.title || "Downloaded playlist",
      summary: summary?.summary || "Available offline",
      addedAt: summary?.addedAt,
      ratingKey,
      composite: summary?.composite || "",
      smart: summary?.smart,
      icon: summary?.icon,
      duration: summary?.duration,
      leafCount: tracks.length,
      freshness: "stale",
      tracks: tracks.map((track, index) => ({
        id: track.ratingKey,
        number: index + 1,
        title: track.title,
        duration: track.duration,
        albumThumb: null,
        albumTitle: track.parentTitle,
        albumRatingKey: null,
        artistTitle: track.originalTitle,
        artistRatingKey: null,
        ratingKey: track.ratingKey,
      })),
    };
  }

  private mapPlaylistDetail(
    playlist: PlexMetadata,
    tracks: PlexMetadata[],
  ): Record<string, unknown> {
    return {
      id: playlist.key,
      title: playlist.title,
      summary: playlist.summary,
      addedAt: playlist.addedAt,
      ratingKey: playlist.ratingKey,
      composite: this.plexUrl(playlist.composite) || "",
      smart: playlist.smart,
      icon: playlist.icon,
      duration: playlist.duration,
      leafCount: playlist.leafCount || tracks.length,
      tracks: tracks.map((track) => ({
        id: track.ratingKey,
        number: track.trackNumber,
        title: track.title,
        duration: track.duration,
        albumThumb: this.plexUrl(track.parentThumb),
        albumTitle: track.parentTitle,
        albumRatingKey:
          track.parentRatingKey || this.extractRatingKey(track.parentKey),
        artistTitle: track.grandparentTitle,
        artistRatingKey:
          track.grandparentRatingKey ||
          this.extractRatingKey(track.grandparentKey),
        ratingKey: track.ratingKey,
      })),
    };
  }

  async playAlbum(ratingKey: string): Promise<unknown> {
    const tracks = await this.fetchTracksWithOfflineFallback(
      "album",
      ratingKey,
    );
    const playableTracks = await Promise.all(
      tracks.map((track) => this.toPlayableTrack(track)),
    );
    this.bass.playTracks(playableTracks);
    return { status: "playing", count: playableTracks.length };
  }

  async playPlaylist(ratingKey: string): Promise<unknown> {
    const tracks = await this.fetchTracksWithOfflineFallback(
      "playlist",
      ratingKey,
    );
    const playableTracks = await Promise.all(
      tracks.map((track) => this.toPlayableTrack(track)),
    );
    this.bass.playTracks(playableTracks);
    return { status: "playing", count: playableTracks.length };
  }

  async playArtist(ratingKey: string): Promise<unknown> {
    const data = await this.fetchPlex(
      `/library/metadata/${ratingKey}/popularTracks`,
    );
    const tracks = data.MediaContainer?.Metadata || [];
    const playableTracks = await Promise.all(
      tracks.map((track) => this.toPlayableTrack(track)),
    );
    this.bass.playTracks(playableTracks);
    return { status: "playing", count: playableTracks.length };
  }

  async playTrack(ratingKey: string): Promise<unknown> {
    const track = await this.fetchTrackWithOfflineFallback(ratingKey);
    const playableTrack = await this.toPlayableTrack(track);
    this.bass.playTrack(playableTrack.track, playableTrack.source);
    return { status: "playing", track: playableTrack.track.title };
  }

  getQueue(): PlayerQueue {
    return this.bass.getQueue();
  }

  async queueAlbum(ratingKey: string): Promise<unknown> {
    const tracks = await this.fetchTracksWithOfflineFallback(
      "album",
      ratingKey,
    );
    const playableTracks = await Promise.all(
      tracks.map((track) => this.toPlayableTrack(track)),
    );
    this.bass.queueTracks(playableTracks);
    return { status: "queued", count: playableTracks.length };
  }

  async queuePlaylist(ratingKey: string): Promise<unknown> {
    const tracks = await this.fetchTracksWithOfflineFallback(
      "playlist",
      ratingKey,
    );
    const playableTracks = await Promise.all(
      tracks.map((track) => this.toPlayableTrack(track)),
    );
    this.bass.queueTracks(playableTracks);
    return { status: "queued", count: playableTracks.length };
  }

  async queueTrack(ratingKey: string): Promise<unknown> {
    const track = await this.fetchTrackWithOfflineFallback(ratingKey);
    const playableTrack = await this.toPlayableTrack(track);
    this.bass.queueTrack(playableTrack.track, playableTrack.source);
    return { status: "queued", track: playableTrack.track.title };
  }

  clearQueue(): unknown {
    this.bass.clearQueue();
    return { status: "cleared" };
  }

  resetForServerChange(): void {
    this.bass.stop();
    this.bass.clearQueue();
    this.activeBaseUrl = null;
  }

  private async getAlbumsFromSections({
    sort,
    limit,
  }: {
    sort: string;
    limit: number;
  }): Promise<PlexMetadata[]> {
    const sections = await this.getSelectedMusicSections();
    const results = await Promise.all(
      sections.map(async (section) => {
        const data = await this.fetchPlex(
          `/library/sections/${section.key}/all`,
          {
            type: "9",
            sort,
            "X-Plex-Container-Size": String(limit),
          },
        );
        return data.MediaContainer?.Metadata || [];
      }),
    );

    return results.flat().slice(0, limit);
  }

  private async getArtistAlbumsFromSections(
    ratingKey: string,
  ): Promise<PlexMetadata[]> {
    const sections = await this.getSelectedMusicSections();
    const results = await Promise.all(
      sections.map(async (section) => {
        const data = await this.fetchPlex(
          `/library/sections/${section.key}/all`,
          {
            type: "9",
            "artist.id": ratingKey,
            "X-Plex-Container-Size": "100",
          },
        );
        return (
          data.MediaContainer?.Metadata || data.MediaContainer?.Directory || []
        );
      }),
    );

    return results.flat();
  }

  private async getSelectedMusicSections(): Promise<PlexLibrary[]> {
    const libraries = await this.auth.getLibraries();
    const selectedLibraries =
      (await this.auth.getUserSelectedLibraries()) || [];
    return selectMusicLibraries(libraries, selectedLibraries);
  }

  private async fetchMetadataItem(ratingKey: string): Promise<PlexMetadata> {
    const data = await this.fetchPlex(`/library/metadata/${ratingKey}`);
    const item = data.MediaContainer?.Metadata?.[0];
    if (!item) throw new Error(`Plex item ${ratingKey} was not found`);
    return item;
  }

  private async fetchMetadataChildren(
    ratingKey: string,
    params: Record<string, string> = {},
  ): Promise<PlexMetadata[]> {
    const data = await this.fetchPlex(
      `/library/metadata/${ratingKey}/children`,
      params,
    );
    return (
      data.MediaContainer?.Metadata || data.MediaContainer?.Directory || []
    );
  }

  private async fetchPlaylistItems(ratingKey: string): Promise<PlexMetadata[]> {
    const data = await this.fetchPlex(`/playlists/${ratingKey}/items`);
    return data.MediaContainer?.Metadata || [];
  }

  private async fetchTrackWithOfflineFallback(
    ratingKey: string,
  ): Promise<PlexMetadata> {
    if (this.forcedOffline) {
      const downloaded = await this.offlineTrackByRatingKey(ratingKey);
      if (downloaded) return downloaded;
      throw new Error("This track is not downloaded and cannot play offline");
    }
    try {
      return await this.fetchMetadataItem(ratingKey);
    } catch (error) {
      const tracks = await this.offlineTracks("track", ratingKey);
      if (tracks[0]) return tracks[0];
      throw error;
    }
  }

  private async fetchTracksWithOfflineFallback(
    targetType: "album" | "playlist",
    ratingKey: string,
  ): Promise<PlexMetadata[]> {
    if (this.forcedOffline) {
      const tracks = await this.offlineTracks(targetType, ratingKey);
      if (tracks.length) return tracks;
      throw new Error(
        `This ${targetType} is not downloaded and cannot play offline`,
      );
    }
    try {
      return targetType === "album"
        ? await this.fetchMetadataChildren(ratingKey)
        : await this.fetchPlaylistItems(ratingKey);
    } catch (error) {
      const tracks = await this.offlineTracks(targetType, ratingKey);
      if (tracks.length) return tracks;
      throw error;
    }
  }

  private async offlineTracks(
    targetType: "track" | "album" | "playlist",
    targetRatingKey: string,
  ): Promise<PlexMetadata[]> {
    const server = await this.getSelectedServer();
    const matching = this.db
      .listDownloads(server.clientIdentifier)
      .filter((record) => {
        const metadata = record.metadata as {
          targetType?: string;
          targetRatingKey?: string;
        };
        return (
          metadata.targetType === targetType &&
          metadata.targetRatingKey === targetRatingKey
        );
      });
    if (
      !matching.length ||
      matching.some((record) => record.status !== "completed")
    )
      return [];
    return matching.map((record) => this.downloadedTrackMetadata(record));
  }

  private async offlineTrackByRatingKey(
    ratingKey: string,
  ): Promise<PlexMetadata | null> {
    const server = await this.getSelectedServer();
    const record = this.db.getCompletedDownload(
      server.clientIdentifier,
      ratingKey,
    );
    if (!record) return null;
    return this.downloadedTrackMetadata(record);
  }

  private downloadedTrackMetadata(record: {
    serverId: string;
    ratingKey: string;
    title: string;
    metadata: unknown;
  }): PlexMetadata {
    const metadata = record.metadata as {
      artist?: string;
      album?: string;
      artistRatingKey?: string | null;
      albumRatingKey?: string | null;
      duration?: number | null;
      thumb?: string | null;
    };
    const cached = this.db
      .getLatestMediaCacheByPrefix<MediaTrack[]>(
        record.serverId,
        "tracks-complete-corpus:v2:",
      )
      ?.value.find((track) => track.ratingKey === record.ratingKey);
    const thumb = metadata.thumb || cached?.thumb || null;

    return {
      ratingKey: record.ratingKey,
      title: record.title || cached?.title || "",
      originalTitle: metadata.artist || cached?.artist || "",
      grandparentTitle: metadata.artist || cached?.artist || "",
      parentTitle: metadata.album || cached?.album || "",
      grandparentRatingKey:
        metadata.artistRatingKey || cached?.artistRatingKey || "",
      parentRatingKey:
        metadata.albumRatingKey || cached?.albumRatingKey || "",
      duration: metadata.duration ?? cached?.duration ?? undefined,
      thumb: thumb ? this.reviveArtwork(thumb) : null,
    };
  }

  private async toPlayableTrack(track: PlexMetadata): Promise<PlayableTrack> {
    const plexSessionId = randomUUID().replaceAll("-", "");
    const server = await this.getSelectedServer();
    const downloaded = this.db.getCompletedDownload(
      server.clientIdentifier,
      String(track.ratingKey || ""),
    );
    const completedPath = downloaded?.filePath ?? null;
    if (this.forcedOffline && !completedPath) {
      throw new Error("This track is not downloaded and cannot play offline");
    }
    const local =
      completedPath && this.localPlaybackServer
        ? this.localPlaybackServer.register(completedPath)
        : null;
    const source: PlexStreamSource | null =
      local && completedPath
        ? { path: local.url, localPath: completedPath }
        : this.getPlaybackSettings().transcodeAudio
          ? this.transcodeSource(track, plexSessionId)
          : this.originalFileSource(track, plexSessionId);
    if (!source)
      throw new Error(
        `Track ${track.ratingKey} does not have a playable stream`,
      );

    return {
      track: {
        title: track.title || "",
        artist: track.originalTitle || track.grandparentTitle || "",
        album: track.parentTitle || "",
        albumRatingKey:
          track.parentRatingKey || this.extractRatingKey(track.parentKey),
        artistRatingKey:
          track.grandparentRatingKey ||
          this.extractRatingKey(track.grandparentKey),
        ratingKey: String(track.ratingKey || ""),
        plexSessionId,
        duration: track.duration,
        thumb: this.playbackArtwork(track.thumb),
      },
      source,
    };
  }

  private async replaceCurrentPlaybackSource(
    transcodeAudio: boolean,
  ): Promise<void> {
    const currentTrack = this.bass.getPlaybackStatus().current_track;
    if (!currentTrack?.ratingKey) return;

    const metadata = await this.fetchMetadataItem(currentTrack.ratingKey);
    const plexSessionId =
      currentTrack.plexSessionId || randomUUID().replaceAll("-", "");
    currentTrack.plexSessionId = plexSessionId;
    const source = transcodeAudio
      ? this.transcodeSource(metadata, plexSessionId)
      : this.originalFileSource(metadata, plexSessionId);
    if (!source) {
      throw new Error(
        `Track ${currentTrack.ratingKey} does not have a playable stream`,
      );
    }

    if (!this.bass.replaceCurrentSource(source)) {
      throw new Error("Unable to switch the current playback source");
    }
  }

  private originalFileSource(
    track: PlexMetadata,
    plexSessionId: string,
  ): PlexStreamSource | null {
    const part = track.Media?.[0]?.Part?.[0];
    if (typeof part?.key !== "string" || !part.key) return null;
    return {
      path: part.key,
      params: createPlexPlaybackIdentity({
        plexSessionId,
        product: this.auth.plexProduct,
        clientIdentifier: this.auth.plexClientId,
        device: deviceName(),
        platformVersion: release(),
      }),
    };
  }

  private transcodeSource(
    track: PlexMetadata,
    plexSessionId: string,
  ): PlexStreamSource {
    return createAudioTranscodeSource({
      ratingKey: String(track.ratingKey || ""),
      transcodeSessionId: randomUUID().replaceAll("-", ""),
      plexSessionId,
      product: this.auth.plexProduct,
      clientIdentifier: this.auth.plexClientId,
      device: deviceName(),
      platformVersion: release(),
    });
  }

  private resolveStreamCandidates(
    source: PlexStreamSource,
    excludedConnectionUris: ReadonlySet<string>,
  ): StreamCandidate[] {
    if (source.path.startsWith("http://127.0.0.1:")) {
      return [
        {
          connectionUri: "offline",
          url: source.path,
          localPath: source.localPath,
        },
      ];
    }
    const server = this.auth.selectedServer;
    if (!server) return [];

    const token = this.getServerToken(server);
    if (!token) return [];

    return this.auth
      .getConnectionCandidates(
        "auto",
        server,
        this.activeBaseUrl,
        excludedConnectionUris,
      )
      .map((connection) => ({
        connectionUri: connection.uri,
        url: this.buildPlexUrl(
          source.path,
          connection.uri,
          token,
          source.params,
        ),
      }));
  }

  private async fetchPlex(
    path: string,
    params: Record<string, string> = {},
  ): Promise<PlexResponse> {
    this.assertOnline();
    const server = await this.getSelectedServer();
    const token = this.getServerToken(server);
    const orderedConnections = this.auth.getConnectionCandidates(
      "auto",
      server,
      this.activeBaseUrl,
    );
    let lastError: unknown = null;

    for (const connection of orderedConnections) {
      try {
        const url = new URL(path, connection.uri);

        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
        url.searchParams.set("X-Plex-Token", token);

        const response = await fetch(url, {
          signal: AbortSignal.timeout(PLEX_REQUEST_TIMEOUT_MS),
          headers: {
            Accept: "application/json",
            "X-Plex-Product": this.auth.plexProduct,
            "X-Plex-Client-Identifier": this.auth.plexClientId,
            "X-Plex-Token": token,
          },
        });

        if (!response.ok) {
          lastError = new Error(
            `Plex request failed at ${connection.uri}: ${response.status}`,
          );
          continue;
        }

        this.activeBaseUrl = connection.uri;
        this.auth.setLastKnownGoodConnection(connection.uri);
        return (await response.json()) as PlexResponse;
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(
      `Plex request failed${lastError instanceof Error ? `: ${lastError.message}` : ""}`,
    );
  }

  private async fetchPlexText(path: string): Promise<string> {
    const server = await this.getSelectedServer();
    const token = this.getServerToken(server);
    const connections = this.auth.getConnectionCandidates(
      "auto",
      server,
      this.activeBaseUrl,
    );
    let lastError: unknown = null;
    for (const connection of connections) {
      try {
        const url = new URL(path, connection.uri);
        url.searchParams.set("X-Plex-Token", token);
        const response = await fetch(url, {
          signal: AbortSignal.timeout(PLEX_REQUEST_TIMEOUT_MS),
          headers: {
            Accept: "text/plain, application/x-subrip, */*",
            "X-Plex-Product": this.auth.plexProduct,
            "X-Plex-Client-Identifier": this.auth.plexClientId,
          },
        });
        if (!response.ok) {
          lastError = new Error(
            `Plex lyrics request failed: ${response.status}`,
          );
          continue;
        }
        this.activeBaseUrl = connection.uri;
        this.auth.setLastKnownGoodConnection(connection.uri);
        return response.text();
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(
      `Plex lyrics request failed${lastError instanceof Error ? `: ${lastError.message}` : ""}`,
    );
  }

  private async getSelectedServer(): Promise<PlexServer> {
    const server = await this.auth.getUserSelectedServer();
    if (!server?.connections?.[0]?.uri) {
      throw new Error("No Plex server is selected");
    }
    return server;
  }

  private assertOnline(): void {
    if (this.forcedOffline) {
      throw new Error("Rayna is offline");
    }
  }

  private reviveArtwork<T>(value: T): T {
    if (!this.artworkCache || value === null || value === undefined)
      return value;
    if (typeof value === "string") return this.artworkCache.revive(value) as T;
    if (Array.isArray(value))
      return value.map((item) => this.reviveArtwork(item)) as T;
    if (typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key,
          this.reviveArtwork(item),
        ]),
      ) as T;
    }
    return value;
  }

  private plexUrl(
    path: unknown,
    params: Record<string, string> = {},
  ): string | null {
    if (typeof path !== "string" || !path) return null;

    const server = this.auth.selectedServer;
    const token = server
      ? this.getServerToken(server)
      : this.auth.plexUserAccessToken;
    const baseUrl = this.activeBaseUrl || server?.connections?.[0]?.uri;
    if (!baseUrl || !token) return null;

    const remoteUrl = this.buildPlexUrl(path, baseUrl, token, params);
    return server && this.artworkCache
      ? this.artworkCache.register(server.clientIdentifier, remoteUrl)
      : remoteUrl;
  }

  private playbackArtwork(value: unknown): string | null {
    if (typeof value !== "string" || !value) return null;
    try {
      if (new URL(value).pathname.startsWith("/artwork/")) {
        return this.reviveArtwork(value);
      }
    } catch {
      // Relative Plex paths are handled below.
    }
    return this.plexUrl(value);
  }

  private buildPlexUrl(
    path: string,
    baseUrl: string,
    token: string,
    params: Record<string, string> = {},
  ): string {
    const url = new URL(path, baseUrl);
    Object.entries(params).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    url.searchParams.set("X-Plex-Token", token);
    return url.toString();
  }

  private getServerToken(server: PlexServer): string {
    return server.accessToken || this.auth.plexUserAccessToken;
  }

  private mapAlbum(album: PlexMetadata): Record<string, unknown> {
    return {
      id: album.key,
      title: album.title,
      year: album.year,
      artist: album.parentTitle,
      ratingKey: album.ratingKey,
      parentRatingKey:
        album.parentRatingKey || this.extractRatingKey(album.parentKey),
      addedAt: album.addedAt,
      lastViewedAt: album.lastViewedAt,
      thumb: this.plexUrl(album.thumb),
    };
  }

  private mapTypedAlbum(album: PlexMetadata): MediaAlbum {
    return {
      ratingKey: String(
        album.ratingKey || this.extractRatingKey(album.key) || "",
      ),
      title: String(album.title || "Untitled album"),
      artist: String(album.parentTitle || "Unknown artist"),
      artistRatingKey:
        album.parentRatingKey || this.extractRatingKey(album.parentKey),
      year: Number.isFinite(Number(album.year)) ? Number(album.year) : null,
      thumb: this.plexUrl(album.thumb),
      trackCount: Number.isFinite(Number(album.leafCount))
        ? Number(album.leafCount)
        : null,
      addedAt: Number.isFinite(Number(album.addedAt))
        ? Number(album.addedAt)
        : null,
    };
  }

  private mapTrack(track: PlexMetadata): MediaTrack {
    return {
      ratingKey: String(
        track.ratingKey || this.extractRatingKey(track.key) || "",
      ),
      title: String(track.title || "Untitled track"),
      artist: String(
        track.grandparentTitle || track.originalTitle || "Unknown artist",
      ),
      artistRatingKey:
        track.grandparentRatingKey ||
        this.extractRatingKey(track.grandparentKey),
      album: String(track.parentTitle || "Unknown album"),
      albumRatingKey:
        track.parentRatingKey || this.extractRatingKey(track.parentKey),
      duration: Number.isFinite(Number(track.duration))
        ? Number(track.duration)
        : null,
      index: Number.isFinite(Number(track.index)) ? Number(track.index) : null,
      disc: Number.isFinite(Number(track.parentIndex))
        ? Number(track.parentIndex)
        : null,
      thumb: this.plexUrl(
        track.thumb || track.parentThumb || track.grandparentThumb,
      ),
      addedAt: Number.isFinite(Number(track.addedAt))
        ? Number(track.addedAt)
        : null,
      viewCount: Number.isFinite(Number(track.viewCount))
        ? Number(track.viewCount)
        : null,
      ratingCount: Number.isFinite(Number(track.ratingCount))
        ? Number(track.ratingCount)
        : null,
    };
  }

  private mapArtist(artist: PlexMetadata): Record<string, unknown> {
    return {
      id: artist.key,
      title: artist.title,
      ratingKey: artist.ratingKey || this.extractRatingKey(artist.key),
      addedAt: artist.addedAt,
      lastViewedAt: artist.lastViewedAt,
      thumb: this.plexUrl(artist.thumb),
      art: this.plexUrl(artist.art),
      albumCount: artist.childCount,
      trackCount: artist.leafCount,
      viewCount: artist.viewCount,
    };
  }

  private mapSearchResult(item: PlexMetadata): SearchResult | null {
    const type = item.type as SearchResult["type"];
    if (!["artist", "album", "track", "playlist"].includes(type)) return null;
    const ratingKey = String(
      item.ratingKey || this.extractRatingKey(item.key) || "",
    );
    if (!ratingKey) return null;

    const subtitle =
      type === "artist"
        ? "Artist"
        : type === "album"
          ? item.parentTitle || "Album"
          : type === "track"
            ? [item.grandparentTitle, item.parentTitle]
                .filter(Boolean)
                .join(" • ")
            : "Playlist";

    return {
      type,
      ratingKey,
      title: String(item.title || "Untitled"),
      subtitle: String(subtitle),
      thumb: this.plexUrl(
        item.thumb ||
          item.parentThumb ||
          item.grandparentThumb ||
          item.composite,
      ),
    };
  }

  private extractRatingKey(key: unknown): string | null {
    if (typeof key !== "string") return null;
    return key.split("/").filter(Boolean).at(-1) || null;
  }

  private encodeCursor(sectionIndex: number, offset: number): string {
    return Buffer.from(JSON.stringify({ s: sectionIndex, o: offset })).toString(
      "base64url",
    );
  }

  private decodeCursor(cursor?: string): {
    sectionIndex: number;
    offset: number;
  } {
    if (!cursor) return { sectionIndex: 0, offset: 0 };

    try {
      const value = JSON.parse(Buffer.from(cursor, "base64url").toString()) as {
        s?: number;
        o?: number;
      };
      return { sectionIndex: value.s || 0, offset: value.o || 0 };
    } catch {
      return { sectionIndex: 0, offset: 0 };
    }
  }
}

function deviceName(): string {
  const name = hostname();
  return name ? `Rayna on ${name}` : "Rayna";
}
