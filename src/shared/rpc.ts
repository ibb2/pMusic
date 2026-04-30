import type { PlexLibrary, PlexServer } from './types'

type RPCSchema<I extends { requests?: Record<string, unknown>; messages?: Record<string, unknown> } = object> = {
  requests: I extends { requests: infer Requests } ? Requests : Record<never, never>
  messages: I extends { messages: infer Messages } ? Messages : Record<never, never>
}

export type BassStatus = {
  available: boolean
  version: string | null
  libraryPath: string | null
  plugins: Array<{ name: string; path: string; loaded: boolean; error: string | null }>
  error: string | null
}

export type PlayerTrack = {
  title: string
  artist: string
  ratingKey: string
  duration?: number
  thumb?: string | null
}

export type PlayerStatus = {
  is_playing: boolean
  current_track: PlayerTrack | null
  queue_len: number
  position: number
  duration: number
  volume: number
}

export type PlaybackSettings = {
  useOriginalFileUrl: boolean
}

export type RaynaRPC = {
  bun: RPCSchema<{
    requests: {
      dbGet: {
        params: { key: string }
        response: unknown
      }
      dbSet: {
        params: { key: string; value: unknown }
        response: void
      }
      settingsGetPlayback: {
        params: void
        response: PlaybackSettings
      }
      settingsSetPlayback: {
        params: { settings: PlaybackSettings }
        response: PlaybackSettings
      }
      authGenerateClientIdentifier: {
        params: void
        response: string
      }
      authGenerateKeyPair: {
        params: void
        response: [string, string]
      }
      authGeneratePin: {
        params: void
        response: unknown
      }
      authCheckPin: {
        params: void
        response: { authUrl: string; plexId: string; plexCode: string }
      }
      authCheckPinStatus: {
        params: { id: string }
        response: unknown
      }
      authIsUserSignedIn: {
        params: void
        response: boolean
      }
      authLogout: {
        params: void
        response: boolean
      }
      authGetServers: {
        params: void
        response: PlexServer[]
      }
      authGetLibraries: {
        params: void
        response: PlexLibrary[]
      }
      authSelectServer: {
        params: { server: PlexServer }
        response: void
      }
      authSelectLibraries: {
        params: { libraries: unknown[] }
        response: void
      }
      authIsServerSelected: {
        params: void
        response: boolean
      }
      authGetUserSelectedServer: {
        params: void
        response: PlexServer | null
      }
      authGetUserAccessToken: {
        params: void
        response: string
      }
      authGetUserSelectedLibraries: {
        params: void
        response: unknown[] | null
      }
      authCloseLoopbackServer: {
        params: void
        response: void
      }
      bassGetStatus: {
        params: void
        response: BassStatus
      }
      mediaGetTopEight: {
        params: void
        response: unknown[]
      }
      mediaGetRecentlyPlayedAlbums: {
        params: void
        response: unknown[]
      }
      mediaGetRecentlyAddedAlbums: {
        params: void
        response: unknown[]
      }
      mediaGetPlaylists: {
        params: void
        response: unknown[]
      }
      mediaGetAlbumsPage: {
        params: { cursor?: string; pageSize: number }
        response: unknown
      }
      mediaGetAlbum: {
        params: { ratingKey: string }
        response: unknown
      }
      mediaGetArtist: {
        params: { ratingKey: string }
        response: unknown
      }
      mediaGetArtistAlbums: {
        params: { ratingKey: string }
        response: unknown[]
      }
      mediaGetArtistPopularTracks: {
        params: { ratingKey: string }
        response: unknown
      }
      mediaGetPlaylist: {
        params: { ratingKey: string }
        response: unknown
      }
      playerGetStatus: {
        params: void
        response: PlayerStatus
      }
      playerPlayAlbum: {
        params: { ratingKey: string }
        response: unknown
      }
      playerPlayTrack: {
        params: { ratingKey: string }
        response: unknown
      }
      playerPlay: {
        params: void
        response: unknown
      }
      playerPause: {
        params: void
        response: unknown
      }
      playerNext: {
        params: void
        response: unknown
      }
      playerPrev: {
        params: void
        response: unknown
      }
      playerSeek: {
        params: { position: number }
        response: unknown
      }
      playerSetVolume: {
        params: { volume: number }
        response: unknown
      }
      playerSetMuted: {
        params: { muted: boolean }
        response: unknown
      }
    }
  }>
  webview: RPCSchema
}
