/// <reference types="vite/client" />

import type {
  AlbumPageRequest,
  MediaAlbum,
  MediaPage,
  MediaTrack,
  BassStatus,
  PlaybackSettings,
  PlaybackSettingsPatch,
  PlayerQueue,
  PlayerStatus,
  UserProfile,
  SearchResults,
} from "../../shared/rpc";
import type {
  PlexConnectionMode,
  PlexLibrary,
  PlexLibrarySelection,
  PlexServer,
  TrackPageRequest,
  DownloadItem,
  DownloadProgress,
  DownloadState,
  DownloadTargetType,
  DownloadActivity,
  DownloadedStatus,
  OfflineStorageStatus,
  SyncStatus,
  LyricsResult,
  LibraryFacets,
  ServerChangeResult,
} from "../../shared/types";

declare global {
  interface Window {
    api: {
      network: {
        setOffline: (offline: boolean) => Promise<void>;
      };
      settings: {
        getPlayback: () => Promise<PlaybackSettings>;
        setPlayback: (
          settings: PlaybackSettingsPatch,
        ) => Promise<PlaybackSettings>;
      };
      auth: {
        isUserSignedIn: () => Promise<boolean>;
        logout: () => Promise<boolean>;
        generateClientIdentifier: () => Promise<string>;
        generateKeyPair: () => Promise<[string, string]>;
        generatePin: () => Promise<unknown>;
        checkPin: () => Promise<{
          authUrl: string;
          plexId: string;
          plexCode: string;
        }>;
        checkPinStatus: (id: string) => Promise<any>;
        getServers: () => Promise<PlexServer[]>;
        getLibraries: () => Promise<PlexLibrary[]>;
        selectServer: (server: PlexServer) => Promise<void>;
        changeServer: (
          server: PlexServer,
          mode?: PlexConnectionMode,
        ) => Promise<ServerChangeResult>;
        selectLibraries: (libraries: PlexLibrarySelection[]) => Promise<void>;
        resolveServerConnection: (mode?: PlexConnectionMode) => Promise<string>;
        isServerSelected: () => Promise<boolean>;
        getUserSelectedServer: () => Promise<PlexServer | null>;
        getUserSelectedLibraries: () => Promise<PlexLibrarySelection[] | null>;
        getUserAccessToken: () => Promise<string>;
        getUserProfile: () => Promise<UserProfile | null>;
        closeLoopbackServer: () => Promise<void>;
      };
      bass: {
        getStatus: () => Promise<BassStatus>;
      };
      media: {
        getHomeData: () => Promise<{
          topEight: any[];
          recentlyPlayed: any[];
          recentlyAdded: any[];
          playlists: any[];
          freshness: "live" | "fresh" | "stale";
          cachedAt: string | null;
        }>;
        getTopEight: () => Promise<any[]>;
        getRecentlyPlayedAlbums: () => Promise<any[]>;
        getRecentlyAddedAlbums: () => Promise<any[]>;
        getPlaylists: () => Promise<any[]>;
        getAlbumsPage: (
          request: AlbumPageRequest,
        ) => Promise<MediaPage<MediaAlbum>>;
        getTracksPage: (
          request: TrackPageRequest,
        ) => Promise<MediaPage<MediaTrack>>;
        getLibraryFacets: () => Promise<LibraryFacets>;
        getArtistsPage: (cursor: string, pageSize: number) => Promise<any>;
        getAlbum: (ratingKey: string) => Promise<any>;
        getArtist: (ratingKey: string) => Promise<any>;
        getArtistAlbums: (ratingKey: string) => Promise<any[]>;
        getArtistPopularTracks: (ratingKey: string) => Promise<any>;
        getPlaylist: (ratingKey: string) => Promise<any>;
        search: (query: string, limit?: number) => Promise<SearchResults>;
        getLyrics: (ratingKey: string) => Promise<LyricsResult>;
      };
      downloads: {
        create: (
          targetType: DownloadTargetType,
          ratingKey: string,
          targetTitle?: string,
        ) => Promise<DownloadItem[]>;
        list: (states?: DownloadState[]) => Promise<DownloadItem[]>;
        retry: (downloadId: string) => Promise<DownloadItem>;
        pause: (downloadId: string) => Promise<DownloadItem>;
        resume: (downloadId: string) => Promise<DownloadItem>;
        getActivity: () => Promise<DownloadActivity>;
        clearActivity: (downloadIds?: string[]) => Promise<void>;
        getStatus: (
          targets: Array<{ targetType: DownloadTargetType; ratingKey: string }>,
        ) => Promise<DownloadedStatus[]>;
        remove: (downloadId: string) => Promise<void>;
        getProgress: (downloadIds?: string[]) => Promise<DownloadProgress[]>;
        getStorageStatus: () => Promise<OfflineStorageStatus>;
        setStorageDirectory: (
          directory: string,
        ) => Promise<OfflineStorageStatus>;
      };
      sync: {
        start: () => Promise<SyncStatus>;
        getStatus: () => Promise<SyncStatus>;
      };
      player: {
        getStatus: () => Promise<PlayerStatus>;
        getQueue: () => Promise<PlayerQueue>;
        playAlbum: (ratingKey: string) => Promise<unknown>;
        playPlaylist: (ratingKey: string) => Promise<unknown>;
        playArtist: (ratingKey: string) => Promise<unknown>;
        playTrack: (ratingKey: string) => Promise<unknown>;
        queueAlbum: (ratingKey: string) => Promise<unknown>;
        queuePlaylist: (ratingKey: string) => Promise<unknown>;
        queueTrack: (ratingKey: string) => Promise<unknown>;
        clearQueue: () => Promise<unknown>;
        play: () => Promise<unknown>;
        pause: () => Promise<unknown>;
        next: () => Promise<unknown>;
        prev: () => Promise<unknown>;
        seek: (position: number) => Promise<unknown>;
        setVolume: (volume: number) => Promise<unknown>;
        setMuted: (muted: boolean) => Promise<unknown>;
      };
    };
  }
}

export {};
