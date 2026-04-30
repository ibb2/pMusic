import { createRPC, Electroview } from 'electrobun/view'
import type { PlaybackSettings, RaynaRPC } from '../../shared/rpc'
import type { PlexServer } from '../../shared/types'

const rpc = createRPC<RaynaRPC['webview'], RaynaRPC['bun']>({
  maxRequestTime: 30_000
})

new Electroview({ rpc })

window.api = {
  db: {
    get: (key: string) => rpc.request.dbGet({ key }),
    set: (key: string, value: unknown) => rpc.request.dbSet({ key, value })
  },
  settings: {
    getPlayback: () => rpc.request.settingsGetPlayback(),
    setPlayback: (settings: PlaybackSettings) => rpc.request.settingsSetPlayback({ settings })
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
    selectServer: (server: PlexServer) => rpc.request.authSelectServer({ server }),
    selectLibraries: (libraries: unknown[]) => rpc.request.authSelectLibraries({ libraries }),
    isServerSelected: () => rpc.request.authIsServerSelected(),
    getUserSelectedServer: () => rpc.request.authGetUserSelectedServer(),
    getUserAccessToken: () => rpc.request.authGetUserAccessToken(),
    getUserSelectedLibraries: () => rpc.request.authGetUserSelectedLibraries(),
    closeLoopbackServer: () => rpc.request.authCloseLoopbackServer()
  },
  bass: {
    getStatus: () => rpc.request.bassGetStatus()
  },
  media: {
    getHomeData: () => rpc.request.mediaGetHomeData(),
    getTopEight: () => rpc.request.mediaGetTopEight(),
    getRecentlyPlayedAlbums: () => rpc.request.mediaGetRecentlyPlayedAlbums(),
    getRecentlyAddedAlbums: () => rpc.request.mediaGetRecentlyAddedAlbums(),
    getPlaylists: () => rpc.request.mediaGetPlaylists(),
    getAlbumsPage: (cursor: string, pageSize: number) =>
      rpc.request.mediaGetAlbumsPage({ cursor, pageSize }),
    getAlbum: (ratingKey: string) => rpc.request.mediaGetAlbum({ ratingKey }),
    getArtist: (ratingKey: string) => rpc.request.mediaGetArtist({ ratingKey }),
    getArtistAlbums: (ratingKey: string) => rpc.request.mediaGetArtistAlbums({ ratingKey }),
    getArtistPopularTracks: (ratingKey: string) =>
      rpc.request.mediaGetArtistPopularTracks({ ratingKey }),
    getPlaylist: (ratingKey: string) => rpc.request.mediaGetPlaylist({ ratingKey })
  },
  player: {
    getStatus: () => rpc.request.playerGetStatus(),
    playAlbum: (ratingKey: string) => rpc.request.playerPlayAlbum({ ratingKey }),
    playPlaylist: (ratingKey: string) => rpc.request.playerPlayPlaylist({ ratingKey }),
    playArtist: (ratingKey: string) => rpc.request.playerPlayArtist({ ratingKey }),
    playTrack: (ratingKey: string) => rpc.request.playerPlayTrack({ ratingKey }),
    play: () => rpc.request.playerPlay(),
    pause: () => rpc.request.playerPause(),
    next: () => rpc.request.playerNext(),
    prev: () => rpc.request.playerPrev(),
    seek: (position: number) => rpc.request.playerSeek({ position }),
    setVolume: (volume: number) => rpc.request.playerSetVolume({ volume }),
    setMuted: (muted: boolean) => rpc.request.playerSetMuted({ muted })
  }
}
