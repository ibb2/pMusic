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
import type Authentication from "./authentication";
import { selectMusicLibraries } from "./library-selection";
import type {
  PlaybackSettings,
  PlaybackSettingsPatch,
  PlayerQueue,
  PlayerTrack,
  SearchResult,
  SearchResults,
} from "../../shared/rpc";
import type { PlexLibrary, PlexServer } from "../../shared/types";

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
};

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

export class MediaService {
  private activeBaseUrl: string | null = null;

  constructor(
    private readonly auth: Authentication,
    private readonly bass: BassManager,
    private readonly db: DatabaseManager,
  ) {
    this.bass.setStreamResolver(
      (source, excludedConnectionUris) =>
        this.resolveStreamCandidates(source, excludedConnectionUris),
      (connectionUri) => {
        this.activeBaseUrl = connectionUri;
        this.auth.setLastKnownGoodConnection(connectionUri);
      },
    );
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

  async getAlbumsPage(cursor = "", pageSize = 20): Promise<unknown> {
    const sections = await this.getSelectedMusicSections();
    let { sectionIndex, offset } = this.decodeCursor(cursor);
    const initialSectionIndex = sectionIndex;
    const initialOffset = offset;
    const albums: PlexMetadata[] = [];

    while (albums.length < pageSize && sectionIndex < sections.length) {
      const section = sections[sectionIndex];
      const data = await this.fetchPlex(
        `/library/sections/${section.key}/all`,
        {
          type: "9",
          "X-Plex-Container-Start": String(offset),
          "X-Plex-Container-Size": String(pageSize - albums.length),
        },
      );
      const albumData = data.MediaContainer?.Metadata || [];

      if (albumData.length === 0) {
        sectionIndex += 1;
        offset = 0;
        continue;
      }

      albums.push(...albumData);
      offset += albumData.length;

      const totalSize = data.MediaContainer?.totalSize || 0;
      if (offset >= totalSize) {
        sectionIndex += 1;
        offset = 0;
      }
    }

    return {
      items: albums.map((album) => this.mapAlbum(album)),
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
    const [recentlyPlayed, recentlyAdded, playlists] = await Promise.all([
      this.getRecentlyPlayedAlbums() as Promise<Array<Record<string, any>>>,
      this.getRecentlyAddedAlbums() as Promise<Array<Record<string, any>>>,
      this.getPlaylists() as Promise<Array<Record<string, any>>>,
    ]);

    return {
      topEight: this.buildTopEight(recentlyPlayed, playlists),
      recentlyPlayed,
      recentlyAdded,
      playlists,
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
    const album = await this.fetchMetadataItem(ratingKey);
    const [tracks, ultraBlur] = await Promise.all([
      this.fetchMetadataChildren(ratingKey),
      this.getUltraBlur(album.thumb || album.art, `album-${ratingKey}`),
    ]);
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
    try {
      const data = await this.fetchPlex(
        `/library/metadata/${ratingKey}/popularTracks`,
      );

      return {
        tracks: (data.MediaContainer?.Metadata || []).map((track) => ({
          id: track.ratingKey,
          number: track.trackNumber,
          title: track.title,
          duration: track.duration,
          ratingCount: track.ratingCount,
          ratingKey: track.ratingKey,
        })),
      };
    } catch {
      return { tracks: [] };
    }
  }

  async getPlaylists(): Promise<unknown[]> {
    const data = await this.fetchPlex("/playlists", { playlistType: "audio" });

    return (data.MediaContainer?.Metadata || []).map((playlist) => ({
      id: playlist.key,
      title: playlist.title,
      addedAt: playlist.addedAt,
      ratingKey: playlist.ratingKey,
      composite: this.plexUrl(playlist.composite) || "",
      smart: playlist.smart,
      icon: playlist.icon,
      duration: playlist.duration,
    }));
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
    const playlist = await this.fetchMetadataItem(ratingKey);
    const tracks = await this.fetchPlaylistItems(ratingKey);

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
    const tracks = await this.fetchMetadataChildren(ratingKey);
    const playableTracks = await Promise.all(
      tracks.map((track) => this.toPlayableTrack(track)),
    );
    this.bass.playTracks(playableTracks);
    return { status: "playing", count: playableTracks.length };
  }

  async playPlaylist(ratingKey: string): Promise<unknown> {
    const tracks = await this.fetchPlaylistItems(ratingKey);
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
    const track = await this.fetchMetadataItem(ratingKey);
    const playableTrack = await this.toPlayableTrack(track);
    this.bass.playTrack(playableTrack.track, playableTrack.source);
    return { status: "playing", track: playableTrack.track.title };
  }

  getQueue(): PlayerQueue {
    return this.bass.getQueue();
  }

  async queueAlbum(ratingKey: string): Promise<unknown> {
    const tracks = await this.fetchMetadataChildren(ratingKey);
    const playableTracks = await Promise.all(
      tracks.map((track) => this.toPlayableTrack(track)),
    );
    this.bass.replaceQueue(playableTracks);
    return { status: "queued", count: playableTracks.length };
  }

  async queuePlaylist(ratingKey: string): Promise<unknown> {
    const tracks = await this.fetchPlaylistItems(ratingKey);
    const playableTracks = await Promise.all(
      tracks.map((track) => this.toPlayableTrack(track)),
    );
    this.bass.replaceQueue(playableTracks);
    return { status: "queued", count: playableTracks.length };
  }

  async queueTrack(ratingKey: string): Promise<unknown> {
    const track = await this.fetchMetadataItem(ratingKey);
    const playableTrack = await this.toPlayableTrack(track);
    this.bass.queueTrack(playableTrack.track, playableTrack.source);
    return { status: "queued", track: playableTrack.track.title };
  }

  clearQueue(): unknown {
    this.bass.clearQueue();
    return { status: "cleared" };
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

  private async toPlayableTrack(track: PlexMetadata): Promise<PlayableTrack> {
    const plexSessionId = randomUUID().replaceAll("-", "");
    const source = this.getPlaybackSettings().transcodeAudio
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
        thumb: this.plexUrl(track.thumb),
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

  private async getSelectedServer(): Promise<PlexServer> {
    const server = await this.auth.getUserSelectedServer();
    if (!server?.connections?.[0]?.uri) {
      throw new Error("No Plex server is selected");
    }
    return server;
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

    return this.buildPlexUrl(path, baseUrl, token, params);
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
            ? [item.grandparentTitle, item.parentTitle].filter(Boolean).join(" • ")
            : "Playlist";

    return {
      type,
      ratingKey,
      title: String(item.title || "Untitled"),
      subtitle: String(subtitle),
      thumb: this.plexUrl(item.thumb || item.parentThumb || item.grandparentThumb || item.composite),
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
