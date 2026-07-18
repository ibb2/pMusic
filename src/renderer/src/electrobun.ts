import { createRPC, Electroview } from "electrobun/view";
import type { PlaybackSettingsPatch, RaynaRPC } from "../../shared/rpc";
import type {
  AlbumPageRequest,
  PlexConnectionMode,
  PlexLibrarySelection,
  PlexServer,
  TrackPageRequest,
} from "../../shared/types";

const rpc = createRPC<RaynaRPC["webview"], RaynaRPC["bun"]>({
  maxRequestTime: 30_000,
});

new Electroview({ rpc });

window.api = {
  network: {
    setOffline: (offline: boolean) =>
      rpc.request.networkSetOffline({ offline }),
  },
  settings: {
    getPlayback: () => rpc.request.settingsGetPlayback(),
    setPlayback: (settings: PlaybackSettingsPatch) =>
      rpc.request.settingsSetPlayback({ settings }),
  },
  auth: {
    generateClientIdentifier: () => rpc.request.authGenerateClientIdentifier(),
    generateKeyPair: () => rpc.request.authGenerateKeyPair(),
    generatePin: () => rpc.request.authGeneratePin(),
    checkPin: () => rpc.request.authCheckPin(),
    checkPinStatus: (id: string) => rpc.request.authCheckPinStatus({ id }),
    isUserSignedIn: () => rpc.request.authIsUserSignedIn(),
    logout: () => rpc.request.authLogout(),
    getServers: () => rpc.request.authGetServers(),
    getLibraries: () => rpc.request.authGetLibraries(),
    selectServer: (server: PlexServer) =>
      rpc.request.authSelectServer({ server }),
    changeServer: (server: PlexServer, mode?: PlexConnectionMode) =>
      rpc.request.authChangeServer({ server, mode }),
    selectLibraries: (libraries: PlexLibrarySelection[]) =>
      rpc.request.authSelectLibraries({ libraries }),
    resolveServerConnection: (mode?: PlexConnectionMode) =>
      rpc.request.authResolveServerConnection({ mode }),
    isServerSelected: () => rpc.request.authIsServerSelected(),
    getUserSelectedServer: () => rpc.request.authGetUserSelectedServer(),
    getUserAccessToken: () => rpc.request.authGetUserAccessToken(),
    getUserProfile: () => rpc.request.authGetUserProfile(),
    getUserSelectedLibraries: () => rpc.request.authGetUserSelectedLibraries(),
    closeLoopbackServer: () => rpc.request.authCloseLoopbackServer(),
  },
  bass: {
    getStatus: () => rpc.request.bassGetStatus(),
  },
  media: {
    getHomeData: () => rpc.request.mediaGetHomeData(),
    getTopEight: () => rpc.request.mediaGetTopEight(),
    getRecentlyPlayedAlbums: () => rpc.request.mediaGetRecentlyPlayedAlbums(),
    getRecentlyAddedAlbums: () => rpc.request.mediaGetRecentlyAddedAlbums(),
    getPlaylists: () => rpc.request.mediaGetPlaylists(),
    getAlbumsPage: (request: AlbumPageRequest) =>
      rpc.request.mediaGetAlbumsPage(request),
    getTracksPage: (request: TrackPageRequest) =>
      rpc.request.mediaGetTracksPage(request),
    getLibraryFacets: () => rpc.request.mediaGetLibraryFacets(),
    getArtistsPage: (cursor: string, pageSize: number) =>
      rpc.request.mediaGetArtistsPage({ cursor, pageSize }),
    getAlbum: (ratingKey: string) => rpc.request.mediaGetAlbum({ ratingKey }),
    getArtist: (ratingKey: string) => rpc.request.mediaGetArtist({ ratingKey }),
    getArtistAlbums: (ratingKey: string) =>
      rpc.request.mediaGetArtistAlbums({ ratingKey }),
    getArtistPopularTracks: (ratingKey: string) =>
      rpc.request.mediaGetArtistPopularTracks({ ratingKey }),
    getPlaylist: (ratingKey: string) =>
      rpc.request.mediaGetPlaylist({ ratingKey }),
    search: (query: string, limit = 8) =>
      rpc.request.mediaSearch({ query, limit }),
    getLyrics: (ratingKey: string) => rpc.request.mediaGetLyrics({ ratingKey }),
  },
  downloads: {
    create: (targetType, ratingKey, targetTitle) =>
      rpc.request.downloadsCreate({ targetType, ratingKey, targetTitle }),
    list: (states) => rpc.request.downloadsList({ states }),
    retry: (downloadId) => rpc.request.downloadsRetry({ downloadId }),
    pause: (downloadId) => rpc.request.downloadsPause({ downloadId }),
    resume: (downloadId) => rpc.request.downloadsResume({ downloadId }),
    getActivity: () => rpc.request.downloadsGetActivity(),
    clearActivity: (downloadIds) =>
      rpc.request.downloadsClearActivity({ downloadIds }),
    getStatus: (targets) => rpc.request.downloadsGetStatus({ targets }),
    remove: (downloadId) => rpc.request.downloadsRemove({ downloadId }),
    getProgress: (downloadIds) =>
      rpc.request.downloadsGetProgress({ downloadIds }),
    getStorageStatus: () => rpc.request.offlineGetStorageStatus(),
    setStorageDirectory: (directory) =>
      rpc.request.offlineSetStorageDirectory({ directory }),
  },
  sync: {
    start: () => rpc.request.syncStart(),
    getStatus: () => rpc.request.syncGetStatus(),
  },
  player: {
    getStatus: () => rpc.request.playerGetStatus(),
    getQueue: () => rpc.request.playerGetQueue(),
    playAlbum: (ratingKey: string) =>
      rpc.request.playerPlayAlbum({ ratingKey }),
    playPlaylist: (ratingKey: string) =>
      rpc.request.playerPlayPlaylist({ ratingKey }),
    playArtist: (ratingKey: string) =>
      rpc.request.playerPlayArtist({ ratingKey }),
    playTrack: (ratingKey: string) =>
      rpc.request.playerPlayTrack({ ratingKey }),
    queueAlbum: (ratingKey: string) =>
      rpc.request.playerQueueAlbum({ ratingKey }),
    queuePlaylist: (ratingKey: string) =>
      rpc.request.playerQueuePlaylist({ ratingKey }),
    queueTrack: (ratingKey: string) =>
      rpc.request.playerQueueTrack({ ratingKey }),
    clearQueue: () => rpc.request.playerClearQueue(),
    play: () => rpc.request.playerPlay(),
    pause: () => rpc.request.playerPause(),
    next: () => rpc.request.playerNext(),
    prev: () => rpc.request.playerPrev(),
    seek: (position: number) => rpc.request.playerSeek({ position }),
    setVolume: (volume: number) => rpc.request.playerSetVolume({ volume }),
    setMuted: (muted: boolean) => rpc.request.playerSetMuted({ muted }),
  },
};
