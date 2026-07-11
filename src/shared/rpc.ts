import type {
  AlbumPageRequest,
  DownloadItem,
  DownloadProgress,
  DownloadTargetType,
  LyricsResult,
  MediaAlbum,
  MediaPage,
  MediaTrack,
  OfflineStorageStatus,
  PlexConnectionMode,
  PlexLibrary,
  PlexLibrarySelection,
  PlexServer,
  ServerChangeResult,
  SyncStatus,
  TrackPageRequest,
} from "./types";

/**
 * Typed request contracts for roadmap features. These are kept separate from
 * `RaynaRPC` until their Bun handlers land, allowing each implementation phase
 * to opt in without weakening the existing RPC handler exhaustiveness check.
 */
export type RoadmapRPCRequests = {
  mediaGetFilteredAlbumsPage: {
    params: AlbumPageRequest;
    response: MediaPage<MediaAlbum>;
  };
  mediaGetTracksPage: {
    params: TrackPageRequest;
    response: MediaPage<MediaTrack>;
  };
  mediaGetLyrics: {
    params: { ratingKey: string };
    response: LyricsResult;
  };
  downloadsCreate: {
    params: { targetType: DownloadTargetType; ratingKey: string };
    response: DownloadItem[];
  };
  downloadsList: {
    params: { states?: DownloadItem["state"][] };
    response: DownloadItem[];
  };
  downloadsRetry: {
    params: { downloadId: string };
    response: DownloadItem;
  };
  downloadsRemove: {
    params: { downloadId: string; deleteFile?: boolean };
    response: void;
  };
  downloadsGetProgress: {
    params: { downloadIds?: string[] };
    response: DownloadProgress[];
  };
  offlineGetStorageStatus: {
    params: void;
    response: OfflineStorageStatus;
  };
  syncStart: {
    params: void;
    response: SyncStatus;
  };
  syncGetStatus: {
    params: void;
    response: SyncStatus;
  };
  authChangeServer: {
    params: { server: PlexServer; mode?: PlexConnectionMode };
    response: ServerChangeResult;
  };
};

type RPCSchema<
  I extends {
    requests?: Record<string, unknown>;
    messages?: Record<string, unknown>;
  } = object,
> = {
  requests: I extends { requests: infer Requests }
    ? Requests
    : Record<never, never>;
  messages: I extends { messages: infer Messages }
    ? Messages
    : Record<never, never>;
};

export type BassStatus = {
  available: boolean;
  version: string | null;
  libraryPath: string | null;
  plugins: Array<{
    name: string;
    path: string;
    loaded: boolean;
    error: string | null;
  }>;
  error: string | null;
};

export type PlayerTrack = {
  title: string;
  artist: string;
  artistRatingKey: string;
  album: string;
  albumRatingKey: string;
  ratingKey: string;
  plexSessionId?: string;
  duration?: number;
  thumb?: string | null;
};

export type PlayerQueue = {
  previous_track: PlayerTrack | null;
  current_track: PlayerTrack | null;
  tracks: PlayerTrack[];
};

export type PlayerStatus = {
  is_playing: boolean;
  current_track: PlayerTrack | null;
  queue_len: number;
  position: number;
  duration: number;
  volume: number;
  connection_state: "connected" | "reconnecting" | "failed";
  connection_error: string | null;
};

export type PlaybackSettings = {
  transcodeAudio: boolean;
  enableUltraBlur?: boolean;
  enableTimelineReporting?: boolean;
};

export type PlaybackSettingsPatch = Partial<PlaybackSettings>;

export type UserProfile = {
  id: string;
  username: string;
  title: string;
  email: string;
  thumb: string;
};

export type SearchResult = {
  type: "artist" | "album" | "track" | "playlist";
  ratingKey: string;
  title: string;
  subtitle: string;
  thumb: string | null;
};

export type SearchResults = {
  artists: SearchResult[];
  albums: SearchResult[];
  tracks: SearchResult[];
  playlists: SearchResult[];
};

export type RaynaRPC = {
  bun: RPCSchema<{
    requests: {
      settingsGetPlayback: {
        params: void;
        response: PlaybackSettings;
      };
      settingsSetPlayback: {
        params: { settings: PlaybackSettingsPatch };
        response: PlaybackSettings;
      };
      authGenerateClientIdentifier: {
        params: void;
        response: string;
      };
      authGenerateKeyPair: {
        params: void;
        response: [string, string];
      };
      authGeneratePin: {
        params: void;
        response: unknown;
      };
      authCheckPin: {
        params: void;
        response: { authUrl: string; plexId: string; plexCode: string };
      };
      authCheckPinStatus: {
        params: { id: string };
        response: unknown;
      };
      authIsUserSignedIn: {
        params: void;
        response: boolean;
      };
      authLogout: {
        params: void;
        response: boolean;
      };
      authGetServers: {
        params: void;
        response: PlexServer[];
      };
      authGetLibraries: {
        params: void;
        response: PlexLibrary[];
      };
      authSelectServer: {
        params: { server: PlexServer };
        response: void;
      };
      authSelectLibraries: {
        params: { libraries: PlexLibrarySelection[] };
        response: void;
      };
      authResolveServerConnection: {
        params: { mode?: PlexConnectionMode };
        response: string;
      };
      authIsServerSelected: {
        params: void;
        response: boolean;
      };
      authGetUserSelectedServer: {
        params: void;
        response: PlexServer | null;
      };
      authGetUserAccessToken: {
        params: void;
        response: string;
      };
      authGetUserProfile: {
        params: void;
        response: UserProfile | null;
      };
      authGetUserSelectedLibraries: {
        params: void;
        response: PlexLibrarySelection[] | null;
      };
      authCloseLoopbackServer: {
        params: void;
        response: void;
      };
      bassGetStatus: {
        params: void;
        response: BassStatus;
      };
      mediaGetTopEight: {
        params: void;
        response: unknown[];
      };
      mediaGetHomeData: {
        params: void;
        response: {
          topEight: unknown[];
          recentlyPlayed: unknown[];
          recentlyAdded: unknown[];
          playlists: unknown[];
        };
      };
      mediaGetRecentlyPlayedAlbums: {
        params: void;
        response: unknown[];
      };
      mediaGetRecentlyAddedAlbums: {
        params: void;
        response: unknown[];
      };
      mediaGetPlaylists: {
        params: void;
        response: unknown[];
      };
      mediaGetAlbumsPage: {
        params: AlbumPageRequest;
        response: MediaPage<MediaAlbum>;
      };
      mediaGetTracksPage: {
        params: TrackPageRequest;
        response: MediaPage<MediaTrack>;
      };
      mediaGetArtistsPage: {
        params: { cursor?: string; pageSize: number };
        response: unknown;
      };
      mediaGetAlbum: {
        params: { ratingKey: string };
        response: unknown;
      };
      mediaGetArtist: {
        params: { ratingKey: string };
        response: unknown;
      };
      mediaGetArtistAlbums: {
        params: { ratingKey: string };
        response: unknown[];
      };
      mediaGetArtistPopularTracks: {
        params: { ratingKey: string };
        response: unknown;
      };
      mediaGetPlaylist: {
        params: { ratingKey: string };
        response: unknown;
      };
      mediaSearch: {
        params: { query: string; limit?: number };
        response: SearchResults;
      };
      downloadsCreate: RoadmapRPCRequests["downloadsCreate"];
      downloadsList: RoadmapRPCRequests["downloadsList"];
      downloadsRetry: RoadmapRPCRequests["downloadsRetry"];
      downloadsRemove: RoadmapRPCRequests["downloadsRemove"];
      downloadsGetProgress: RoadmapRPCRequests["downloadsGetProgress"];
      offlineGetStorageStatus: RoadmapRPCRequests["offlineGetStorageStatus"];
      playerGetStatus: {
        params: void;
        response: PlayerStatus;
      };
      playerGetQueue: {
        params: void;
        response: PlayerQueue;
      };
      playerPlayAlbum: {
        params: { ratingKey: string };
        response: unknown;
      };
      playerPlayPlaylist: {
        params: { ratingKey: string };
        response: unknown;
      };
      playerPlayArtist: {
        params: { ratingKey: string };
        response: unknown;
      };
      playerPlayTrack: {
        params: { ratingKey: string };
        response: unknown;
      };
      playerQueueAlbum: {
        params: { ratingKey: string };
        response: unknown;
      };
      playerQueuePlaylist: {
        params: { ratingKey: string };
        response: unknown;
      };
      playerQueueTrack: {
        params: { ratingKey: string };
        response: unknown;
      };
      playerClearQueue: {
        params: void;
        response: unknown;
      };
      playerPlay: {
        params: void;
        response: unknown;
      };
      playerPause: {
        params: void;
        response: unknown;
      };
      playerNext: {
        params: void;
        response: unknown;
      };
      playerPrev: {
        params: void;
        response: unknown;
      };
      playerSeek: {
        params: { position: number };
        response: unknown;
      };
      playerSetVolume: {
        params: { volume: number };
        response: unknown;
      };
      playerSetMuted: {
        params: { muted: boolean };
        response: unknown;
      };
    };
  }>;
  webview: RPCSchema;
};
