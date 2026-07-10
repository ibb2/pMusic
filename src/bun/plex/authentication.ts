import crypto from 'node:crypto'
import qs from 'qs'
import { v4 as uuidv4 } from 'uuid'
import { LoopbackAuthServer } from './loopback'
import { JsonStore } from '../store'
import {
  PLEX_CONNECTION_PROBE_TIMEOUT_MS,
  findReachablePlexConnection,
  orderPlexConnections,
  probePlexConnection
} from './connections'
import type { UserProfile } from '../../shared/rpc'
import type {
  Connection,
  PlexConnectionMode,
  PlexLibrary,
  PlexLibrarySelection,
  PlexServer
} from '../../shared/types'

const USER_PROFILE_CACHE_TTL_MS = 24 * 60 * 60 * 1000
type CachedUserProfile = {
  profile: UserProfile
  fetchedAt: number
}

class Authentication {
  plexProduct = 'Rayna'
  plexClientId = ''
  plexUserAccessToken = ''
  plexId = ''
  plexCode = ''
  private loopbackServer: LoopbackAuthServer | null = null
  privateKey: string | null = null
  publicKey: string | null = null
  selectedServer: PlexServer | null = null
  selectedLibraries: PlexLibrarySelection[] | null = null
  private userProfileRefresh: Promise<UserProfile | null> | null = null
  store = new JsonStore('auth.json')

  constructor() {
    this.setUserInformation()
  }

  generateClientIdentifier(): string {
    let clientIdentifier = this.store.get<string>('clientIdentifier')

    if (clientIdentifier) {
      this.plexClientId = clientIdentifier
      return clientIdentifier
    }

    clientIdentifier = uuidv4()
    this.store.set('clientIdentifier', clientIdentifier)
    this.plexClientId = clientIdentifier
    return clientIdentifier
  }

  async generateKeyPair(): Promise<[string, string]> {
    const storedPublicKey = this.store.get<string>('publicKey')
    const storedPrivateKey = this.store.get<string>('privateKey')

    if (storedPublicKey && storedPrivateKey) {
      this.privateKey = storedPrivateKey
      this.publicKey = storedPublicKey
      return [this.publicKey, this.privateKey]
    }

    return new Promise((resolve, reject) => {
      crypto.generateKeyPair(
        'ed25519',
        {
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
          }
        },
        (err, publicKey, privateKey) => {
          if (err) {
            reject(err)
            return
          }

          const publicKeyStr = publicKey as unknown as string
          const privateKeyStr = privateKey as unknown as string

          this.store.set('publicKey', publicKeyStr)
          this.store.set('privateKey', privateKeyStr)
          this.publicKey = publicKeyStr
          this.privateKey = privateKeyStr
          resolve([publicKeyStr, privateKeyStr])
        }
      )
    })
  }

  async generatePin(): Promise<unknown> {
    const url = 'https://plex.tv/api/v2/pins?strong=true'
    const headers = {
      Accept: 'application/json',
      'X-Plex-Product': this.plexProduct,
      'X-Plex-Client-Identifier':
        this.plexClientId || this.generateClientIdentifier()
    }

    const response = await fetch(url, { headers, method: 'POST' })
    const data = (await response.json()) as { id: string; code: string }

    this.plexId = data.id
    this.plexCode = data.code
    this.store.set('plexId', this.plexId)

    return data
  }

  async checkPin(): Promise<{
    authUrl: string
    plexId: string
    plexCode: string
  }> {
    this.loopbackServer = new LoopbackAuthServer()
    this.loopbackServer.onRedirect = () => {
      void this.checkPinStatus(this.plexId)
    }

    const port = await this.loopbackServer.listen()
    const forwardUrl = `http://127.0.0.1:${port}/callback`
    const authUrl =
      'https://app.plex.tv/auth#?' +
      qs.stringify({
        clientID: this.plexClientId,
        code: this.plexCode,
        forwardUrl,
        context: {
          device: {
            product: this.plexProduct
          }
        }
      })

    return {
      authUrl,
      plexId: this.plexId,
      plexCode: this.plexCode
    }
  }

  async closeLoopbackServer(): Promise<void> {
    this.loopbackServer?.close()
    this.loopbackServer = null
  }

  async checkPinStatus(id: string): Promise<unknown> {
    const url = `https://plex.tv/api/v2/pins/${id}`
    const headers = {
      Accept: 'application/json',
      'X-Plex-Product': this.plexProduct,
      'X-Plex-Client-Identifier':
        this.plexClientId || this.generateClientIdentifier()
    }

    const response = await fetch(url, { headers })
    const data = (await response.json()) as {
      authToken?: string
      auth_token?: string
    }
    const token = data.authToken || data.auth_token

    if (token) {
      this.plexUserAccessToken = token
      this.store.set('plexUserAccessToken', this.plexUserAccessToken)
      this.store.delete('userProfile')
      void this.getUserProfile()
      await this.closeLoopbackServer()
    }

    return data
  }

  isUserSignedIn(): boolean {
    return Boolean(this.store.get<string>('plexUserAccessToken'))
  }

  async logout(): Promise<boolean> {
    try {
      this.store.delete('plexUserAccessToken')
      this.store.delete('plexId')
      this.store.delete('plexCode')
      this.store.delete('selectedServer')
      this.store.delete('selectedLibraries')
      this.store.delete('userProfile')
      this.store.delete('lastKnownGoodConnection')
      this.store.delete('lastKnowGoodConnection')
      this.plexUserAccessToken = ''
      this.plexId = ''
      this.plexCode = ''
      this.selectedServer = null
      this.selectedLibraries = null
      await this.closeLoopbackServer()
      return true
    } catch {
      return false
    }
  }

  async getServers(): Promise<PlexServer[]> {
    const url =
      'https://clients.plex.tv/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1'
    const headers = {
      Accept: 'application/json',
      'X-Plex-Product': this.plexProduct,
      'X-Plex-Client-Identifier':
        this.plexClientId || this.generateClientIdentifier(),
      'X-Plex-Token': this.plexUserAccessToken
    }

    const response = await fetch(url, { headers })
    const data = (await response.json()) as PlexServer[]

    return data.filter((server) => server.product === 'Plex Media Server')
  }

  async getLibraries(): Promise<PlexLibrary[]> {
    const selectedServer =
      this.selectedServer || this.store.get<PlexServer>('selectedServer')
    const token =
      selectedServer?.accessToken ||
      this.plexUserAccessToken ||
      this.store.get<string>('plexUserAccessToken') ||
      ''
    const connections = selectedServer
      ? this.getConnectionCandidates('auto', selectedServer)
      : []

    if (connections.length === 0 || !token) {
      return []
    }

    let lastError: unknown = null

    for (const connection of connections) {
      try {
        const url = new URL('/library/sections', connection.uri)
        url.searchParams.set('X-Plex-Token', token)

        const response = await fetch(url, {
          signal: AbortSignal.timeout(PLEX_CONNECTION_PROBE_TIMEOUT_MS),
          headers: {
            Accept: 'application/json',
            'X-Plex-Product': this.plexProduct,
            'X-Plex-Client-Identifier':
              this.plexClientId || this.generateClientIdentifier(),
            'X-Plex-Token': token
          }
        })

        if (!response.ok) {
          lastError = new Error(
            `Plex library request failed at ${connection.uri}: ${response.status}`
          )
          continue
        }

        this.setLastKnownGoodConnection(connection.uri)

        const data = (await response.json()) as {
          MediaContainer?: {
            Directory?: Array<Record<string, unknown>>
          }
        }

        return (data.MediaContainer?.Directory || []).map((library) =>
          this.normalizeLibrary(library, connection.uri, token)
        )
      } catch (error) {
        lastError = error
      }
    }

    throw new Error(
      `Failed to fetch Plex libraries${lastError instanceof Error ? `: ${lastError.message}` : ''}`
    )
  }

  async selectServer(server: PlexServer): Promise<void> {
    const selectedServer =
      this.selectedServer || this.store.get<PlexServer>('selectedServer')
    if (selectedServer?.clientIdentifier !== server.clientIdentifier) {
      this.clearLastKnownGoodConnection()
    }
    this.selectedServer = server
    this.store.set('selectedServer', server)
  }

  async resolveServerConnection(
    mode: PlexConnectionMode = 'auto'
  ): Promise<string> {
    const selectedServer =
      this.selectedServer || this.store.get<PlexServer>('selectedServer')

    if (!selectedServer) {
      throw new Error('No Plex server connection is available')
    }

    const candidates = this.getConnectionCandidates(mode, selectedServer)

    if (candidates.length === 0) {
      throw new Error('No Plex server connection is available')
    }

    const reachable = await findReachablePlexConnection(
      candidates,
      (connection) => this.canReachConnection(connection.uri, selectedServer)
    )

    if (reachable) {
      this.setLastKnownGoodConnection(reachable.uri)
      return reachable.uri
    }

    throw new Error('No reachable Plex server connection found')
  }

  getConnectionCandidates(
    mode: PlexConnectionMode = 'auto',
    server: PlexServer | null = this.selectedServer,
    preferredUri?: string | null
  ): Connection[] {
    if (!server) return []

    return orderPlexConnections(server, {
      mode,
      preferredUri,
      lastKnownGoodUri: this.getLastKnownGoodConnection()
    })
  }

  setLastKnownGoodConnection(uri: string): void {
    this.store.set('lastKnownGoodConnection', uri)
    this.store.delete('lastKnowGoodConnection')
  }

  async selectLibraries(libraries: PlexLibrarySelection[]): Promise<void> {
    this.selectedLibraries = libraries
    this.store.set('selectedLibraries', libraries)
  }

  isServerSelected(): boolean {
    return Boolean(this.store.get<PlexServer>('selectedServer'))
  }

  async getUserSelectedServer(): Promise<PlexServer | null> {
    return this.selectedServer
  }

  async getUserSelectedLibraries(): Promise<PlexLibrarySelection[] | null> {
    return this.selectedLibraries
  }

  async getUserAccessToken(): Promise<string> {
    return this.plexUserAccessToken
  }

  async getUserProfile(): Promise<UserProfile | null> {
    const cached = this.store.get<CachedUserProfile>('userProfile')
    const isFresh = cached
      ? Date.now() - cached.fetchedAt < USER_PROFILE_CACHE_TTL_MS
      : false

    if (cached?.profile && isFresh) {
      return cached.profile
    }

    if (cached?.profile) {
      void this.refreshUserProfile()
      return cached.profile
    }

    return this.refreshUserProfile()
  }

  private async refreshUserProfile(): Promise<UserProfile | null> {
    if (this.userProfileRefresh) {
      return this.userProfileRefresh
    }

    this.userProfileRefresh = this.fetchUserProfile()
      .catch((error) => {
        const cached = this.store.get<CachedUserProfile>('userProfile')
        if (cached?.profile) return cached.profile
        throw error
      })
      .finally(() => {
        this.userProfileRefresh = null
      })

    return this.userProfileRefresh
  }

  private async fetchUserProfile(): Promise<UserProfile | null> {
    const token =
      this.plexUserAccessToken ||
      this.store.get<string>('plexUserAccessToken') ||
      ''

    if (!token) {
      return null
    }

    const response = await fetch('https://plex.tv/api/v2/user', {
      headers: {
        Accept: 'application/json',
        'X-Plex-Product': this.plexProduct,
        'X-Plex-Client-Identifier':
          this.plexClientId || this.generateClientIdentifier(),
        'X-Plex-Token': token
      }
    })

    if (!response.ok) {
      throw new Error(`Plex user profile request failed: ${response.status}`)
    }

    const data = (await response.json()) as Record<string, unknown>
    const profile = this.normalizeUserProfile(data)
    this.store.set('userProfile', {
      profile,
      fetchedAt: Date.now()
    } satisfies CachedUserProfile)
    return profile
  }

  private clearLastKnownGoodConnection(): void {
    this.store.delete('lastKnownGoodConnection')
    this.store.delete('lastKnowGoodConnection')
  }

  private getLastKnownGoodConnection(): string | null {
    const stored =
      this.store.get<string>('lastKnownGoodConnection') ??
      this.store.get<string>('lastKnowGoodConnection')

    if (!stored) return null

    try {
      const parsed = JSON.parse(stored) as unknown
      return typeof parsed === 'string' ? parsed : stored
    } catch {
      return stored
    }
  }

  private async canReachConnection(
    uri: string,
    server: PlexServer
  ): Promise<boolean> {
    const token = server.accessToken || this.plexUserAccessToken
    if (!token) return false

    return probePlexConnection(uri, { token })
  }

  private normalizeUserProfile(data: Record<string, unknown>): UserProfile {
    const username = String(
      data.username || data.title || data.email || 'Rayna User'
    )

    return {
      id: String(data.id || data.uuid || ''),
      username,
      title: String(data.title || username),
      email: String(data.email || ''),
      thumb: String(data.thumb || '')
    }
  }

  private normalizeLibrary(
    library: Record<string, unknown>,
    baseUrl: string,
    token: string
  ): PlexLibrary {
    const withToken = (path: unknown): string | undefined => {
      if (typeof path !== 'string' || !path) return undefined
      const url = new URL(path, baseUrl)
      url.searchParams.set('X-Plex-Token', token)
      return url.toString()
    }

    const locations = Array.isArray(library.Location)
      ? library.Location.map((location) => {
          const record = location as Record<string, unknown>
          return {
            id: typeof record.id === 'number' ? record.id : undefined,
            path: typeof record.path === 'string' ? record.path : ''
          }
        }).filter((location) => location.path)
      : undefined

    return {
      key: String(library.key || ''),
      title: String(library.title || ''),
      type: String(library.type || ''),
      uuid: String(library.uuid || library.key || ''),
      agent: typeof library.agent === 'string' ? library.agent : undefined,
      allowSync:
        typeof library.allowSync === 'boolean' ? library.allowSync : undefined,
      art: withToken(library.art),
      composite: withToken(library.composite),
      createdAt:
        typeof library.createdAt === 'number' ? library.createdAt : undefined,
      language:
        typeof library.language === 'string' ? library.language : undefined,
      locations,
      refreshing:
        typeof library.refreshing === 'boolean'
          ? library.refreshing
          : undefined,
      scanner:
        typeof library.scanner === 'string' ? library.scanner : undefined,
      thumb: withToken(library.thumb),
      updatedAt:
        typeof library.updatedAt === 'number' ? library.updatedAt : undefined
    }
  }

  private setUserInformation(): void {
    this.plexClientId = this.generateClientIdentifier()
    this.plexUserAccessToken =
      this.store.get<string>('plexUserAccessToken') || ''
    this.plexId = this.store.get<string>('plexId') || ''
    this.privateKey = this.store.get<string>('privateKey') || null
    this.publicKey = this.store.get<string>('publicKey') || null
    this.selectedServer = this.store.get<PlexServer>('selectedServer') || null
    this.selectedLibraries =
      this.store.get<PlexLibrarySelection[]>('selectedLibraries') || null
  }
}

export default Authentication
