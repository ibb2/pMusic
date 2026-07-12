export type Connection = {
  protocol: string
  address: string
  port: number
  uri: string
  local: boolean
  relay: boolean
  IPv6: boolean
}

export type PlexConnectionMode = 'auto' | 'local' | 'remote' | 'relay'

export type PlexServer = {
  name: string
  product: string
  productVersion: string
  platform: string
  platformVersion: string
  device: string
  clientIdentifier: string
  provides: string
  ownerId: string | null
  sourceTitle: string | null
  publicAddress: string
  accessToken: string | null
  searchEnabled: boolean
  createdAt: string
  lastSeenAt: string
  owned: boolean
  home: boolean
  synced: boolean
  relay: boolean
  presence: boolean
  httpsRequired: boolean
  publicAddressMatches: boolean
  dnsRebindingProtection?: boolean
  natLoopbackSupported?: boolean
  connections: Connection[]
}

export type PlexLibrary = {
  key: string
  title: string
  type: string
  uuid: string
  agent?: string
  allowSync?: boolean
  art?: string
  composite?: string
  createdAt?: number
  language?: string
  locations?: Array<{ id?: number; path: string }>
  refreshing?: boolean
  scanner?: string
  thumb?: string
  updatedAt?: number
}

export type PlexLibrarySelection = PlexLibrary | string

export type CacheFreshness = 'live' | 'fresh' | 'stale'

export type CachedResult<T> = {
  data: T
  freshness: CacheFreshness
  cachedAt: string | null
}

export type MediaSortDirection = 'asc' | 'desc'

export type AlbumSortField = 'title' | 'artist' | 'year' | 'dateAdded'

export type TrackSortField = 'title' | 'artist' | 'album' | 'dateAdded'

export type MediaPageRequest<TFilters, TSortField extends string> = {
  cursor?: string
  pageSize: number
  query?: string
  filters?: TFilters
  sort?: {
    field: TSortField
    direction: MediaSortDirection
  }
}

export type MediaPage<T> = {
  items: T[]
  nextCursor: string | null
  total: number | null
  freshness: CacheFreshness
  cachedAt: string | null
}

export type AlbumFilters = {
  artistRatingKeys?: string[]
  years?: number[]
}

export type TrackFilters = {
  artistRatingKeys?: string[]
  albumRatingKeys?: string[]
}

export type AlbumPageRequest = MediaPageRequest<AlbumFilters, AlbumSortField>

export type TrackPageRequest = MediaPageRequest<TrackFilters, TrackSortField>

export type MediaAlbum = {
  ratingKey: string
  title: string
  artist: string
  artistRatingKey: string | null
  year: number | null
  thumb: string | null
  trackCount: number | null
  addedAt: number | null
}

export type MediaTrack = {
  ratingKey: string
  title: string
  artist: string
  artistRatingKey: string | null
  album: string
  albumRatingKey: string | null
  duration: number | null
  index: number | null
  disc: number | null
  thumb: string | null
  addedAt: number | null
}

export type LyricsLine = {
  text: string
  startTimeMs: number | null
}

export type TrackLyrics = {
  ratingKey: string
  format: 'plain' | 'lrc'
  lines: LyricsLine[]
  freshness: CacheFreshness
  cachedAt: string | null
}

export type LyricsResult =
  | { status: 'available'; lyrics: TrackLyrics }
  | { status: 'unavailable'; reason: 'not-found' | 'offline-not-cached' }

export type DownloadTargetType = 'track' | 'album' | 'playlist'

export type DownloadState =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'

export type DownloadItem = {
  id: string
  serverId: string
  targetType: DownloadTargetType
  targetRatingKey: string
  trackRatingKey: string
  title: string
  artist: string
  album: string
  state: DownloadState
  bytesDownloaded: number
  bytesTotal: number | null
  error: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export type DownloadProgress = Pick<
  DownloadItem,
  'id' | 'state' | 'bytesDownloaded' | 'bytesTotal' | 'error' | 'updatedAt'
>

export type DownloadActivity = {
  items: DownloadItem[]
  activeCount: number
  failedCount: number
}

export type DownloadedStatus = {
  targetType: DownloadTargetType
  ratingKey: string
  state: 'not-downloaded' | 'partial' | 'downloaded'
  completedTracks: number
  totalTracks: number
}

export type DownloadGroup = {
  targetType: DownloadTargetType
  targetRatingKey: string
  title: string
  artist: string
  items: DownloadItem[]
  bytesTotal: number
}

export type OfflineStorageStatus = {
  storageDirectory: string
  usedBytes: number
  completedBytes: number
  partialBytes: number
  downloadCount: number
  completedCount: number
  failedCount: number
}

export type SyncTrigger = 'startup' | 'network-restored' | 'manual'

export type SyncState = 'idle' | 'running' | 'succeeded' | 'partial' | 'failed'

export type SyncStatus = {
  serverId: string | null
  state: SyncState
  trigger: SyncTrigger | null
  startedAt: string | null
  completedAt: string | null
  refreshedLibraries: number
  failedLibraries: number
  reconciledDownloads: number
  error: string | null
}

export type ServerChangeResult =
  | {
      changed: true
      previousServerId: string | null
      server: PlexServer
      requiresLibrarySelection: true
    }
  | {
      changed: false
      previousServerId: string | null
      server: PlexServer | null
      error: string
    }
