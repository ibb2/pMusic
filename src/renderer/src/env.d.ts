/// <reference types="vite/client" />

import type {
  BassStatus,
  PlaybackSettings,
  PlaybackSettingsPatch,
  PlayerQueue,
  PlayerStatus,
  UserProfile,
} from "../../shared/rpc";
import type {
  PlexConnectionMode,
  PlexLibrary,
  PlexLibrarySelection,
  PlexServer,
} from "../../shared/types";

declare global {
  interface Window {
    api: {
      db: {
        get: (key: string) => Promise<unknown>;
        set: (key: string, value: unknown) => Promise<void>;
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
        }>;
        getTopEight: () => Promise<any[]>;
        getRecentlyPlayedAlbums: () => Promise<any[]>;
        getRecentlyAddedAlbums: () => Promise<any[]>;
        getPlaylists: () => Promise<any[]>;
        getAlbumsPage: (cursor: string, pageSize: number) => Promise<any>;
        getArtistsPage: (cursor: string, pageSize: number) => Promise<any>;
        getAlbum: (ratingKey: string) => Promise<any>;
        getArtist: (ratingKey: string) => Promise<any>;
        getArtistAlbums: (ratingKey: string) => Promise<any[]>;
        getArtistPopularTracks: (ratingKey: string) => Promise<any>;
        getPlaylist: (ratingKey: string) => Promise<any>;
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
