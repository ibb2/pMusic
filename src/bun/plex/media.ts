import { Buffer } from "node:buffer";
import type { BassManager } from "../bass";
import type { DatabaseManager } from "../database";
import type Authentication from "./authentication";
import type { PlaybackSettings, PlayerTrack } from "../../shared/rpc";
import type { PlexLibrary, PlexServer } from "../../shared/types";

type PlexMetadata = Record<string, any>;

type PlexResponse = {
  MediaContainer?: {
    Metadata?: PlexMetadata[];
    Directory?: PlexMetadata[];
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

const PLEX_REQUEST_TIMEOUT_MS = 8_000;

export class MediaService {
  private activeBaseUrl: string | null = null;

  constructor(
    private readonly auth: Authentication,
    private readonly bass: BassManager,
    private readonly db: DatabaseManager,
  ) {}

  getPlaybackSettings(): PlaybackSettings {
    return (
      (this.db.get("playback") as PlaybackSettings | null) ?? {
        useOriginalFileUrl: true,
        enableUltraBlur: true,
      }
    );
  }

  setPlaybackSettings(settings: PlaybackSettings): PlaybackSettings {
    this.db.set("playback", settings);
    return settings;
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
    const album = await this.fetchMetadataItem(ratingKey)
    const [tracks, ultraBlur] = await Promise.all([
      this.fetchMetadataChildren(ratingKey),
      this.getUltraBlur(album.art || album.thumb, `album-${ratingKey}`),
    ])
    const artistKey =
      album.parentRatingKey || this.extractRatingKey(album.parentKey)

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
        ratingKey: track.ratingKey,
      })),
    }
  }

async getArtist(ratingKey: string): Promise<unknown> {
    const artist = await this.fetchMetadataItem(ratingKey)
    const ultraBlur = await this.getUltraBlur(artist.thumb, `artist-${ratingKey}`)

    return {
      id: artist.key,
      title: artist.title,
      ratingKey: artist.ratingKey,
      summary: artist.summary,
      thumb: this.plexUrl(artist.thumb),
      art: this.plexUrl(artist.art),
      ultraBlur,
      viewCount: artist.viewCount,
    }
  }

  async getUltraBlur(imagePath: string | null, cacheBuster?: string): Promise<string | null> {
    if (!imagePath) return null

    try {
      const colors = await this.fetchPlex('/services/ultrablur/colors', {
        url: imagePath,
      })
      const blurColors = colors.MediaContainer?.UltraBlurColors?.[0]
      if (!blurColors) return null

      const ultraBlurImagePath = `/services/ultrablur/image?topLeft=${blurColors.topLeft}&topRight=${blurColors.topRight}&bottomLeft=${blurColors.bottomLeft}&bottomRight=${blurColors.bottomRight}&width=1920&height=1080&noise=1`

      return this.plexUrl('/photo/:/transcode', {
        url: ultraBlurImagePath,
        width: '1920',
        height: '1080',
        ...(cacheBuster ? { v: cacheBuster } : {}),
      })
    } catch {
      return null
    }
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
    this.bass.playTrack(playableTrack.track, playableTrack.streamUrl);
    return { status: "playing", track: playableTrack.track.title };
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
    const selectedUuids = selectedLibraries
      .map((library) => {
        if (typeof library === "string") return library;
        if (library && typeof library === "object" && "uuid" in library) {
          return String((library as { uuid: unknown }).uuid);
        }
        return null;
      })
      .filter(Boolean);

    const musicLibraries = libraries.filter(
      (library) => library.type === "artist",
    );
    if (selectedUuids.length === 0) return musicLibraries;

    return musicLibraries.filter((library) =>
      selectedUuids.includes(library.uuid),
    );
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

  private async toPlayableTrack(
    track: PlexMetadata,
  ): Promise<{ track: PlayerTrack; streamUrl: string }> {
    const streamUrl = this.getPlaybackSettings().useOriginalFileUrl
      ? this.originalFileUrl(track)
      : this.transcodeUrl(track);
    if (!streamUrl)
      throw new Error(
        `Track ${track.ratingKey} does not have a playable stream`,
      );

    return {
      track: {
        title: track.title || "",
        artist: track.originalTitle || track.grandparentTitle || "",
        // albumTitle: track.parentTitle,
        albumRatingKey:
          track.parentRatingKey || this.extractRatingKey(track.parentKey),
        // artistTitle: track.grandparentTitle,
        artistRatingKey:
          track.grandparentRatingKey ||
          this.extractRatingKey(track.grandparentKey),
        ratingKey: String(track.ratingKey || ""),
        duration: track.duration,
        thumb: this.plexUrl(track.thumb),
      },
      streamUrl,
    };
  }

  private originalFileUrl(track: PlexMetadata): string | null {
    const part = track.Media?.[0]?.Part?.[0];
    return this.plexUrl(part?.key);
  }

  private transcodeUrl(track: PlexMetadata): string | null {
    return this.plexUrl("/music/:/transcode/universal/start.m3u8", {
      path: `/library/metadata/${track.ratingKey}`,
      protocol: "hls",
      directPlay: "0",
      directStream: "0",
      directStreamAudio: "0",
      hasMDE: "1",
      mediaIndex: "0",
      partIndex: "0",
      musicBitrate: "320",
      "X-Plex-Client-Profile-Name": "generic",
      "X-Plex-Client-Profile-Extra":
        "add-transcode-target(type=musicProfile&context=streaming&protocol=hls&container=mpegts&audioCodec=aac,mp3)",
    });
  }

  private async fetchPlex(
    path: string,
    params: Record<string, string> = {},
  ): Promise<PlexResponse> {
    const server = await this.getSelectedServer();
    const token = this.getServerToken(server);
    const connections = server.connections.filter(
      (connection) => connection.uri,
    );
    const orderedConnections = [
      ...connections.filter(
        (connection) => connection.uri === this.activeBaseUrl,
      ),
      ...connections.filter(
        (connection) =>
          connection.uri !== this.activeBaseUrl &&
          connection.local &&
          !connection.relay,
      ),
      ...connections.filter(
        (connection) =>
          connection.uri !== this.activeBaseUrl &&
          !connection.local &&
          !connection.relay,
      ),
      ...connections.filter(
        (connection) =>
          connection.uri !== this.activeBaseUrl && connection.relay,
      ),
    ];
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
