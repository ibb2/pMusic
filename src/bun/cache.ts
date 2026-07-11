export interface CacheEntry<T> {
  value: T
  updatedAt: number
  expiresAt: number
}

export interface CacheRepository {
  getCacheEntry<T>(serverId: string, key: string): CacheEntry<T> | null
  setCacheEntry<T>(
    serverId: string,
    key: string,
    entry: CacheEntry<T>,
  ): void
}

export type CacheResult<T> = {
  value: T
  source: 'cache' | 'network' | 'stale-cache'
  isStale: boolean
}

export class OfflineUnavailableError extends Error {
  readonly code = 'OFFLINE_UNAVAILABLE' as const

  constructor(
    readonly serverId: string,
    readonly key: string,
    options?: ErrorOptions,
  ) {
    super(`No cached data is available for ${key}`, options)
    this.name = 'OfflineUnavailableError'
  }
}

export interface CacheReadOptions<T> {
  serverId: string
  key: string
  ttlMs: number
  fetch: () => Promise<T>
}

export class CacheService {
  constructor(
    private readonly repository: CacheRepository,
    private readonly now: () => number = Date.now,
  ) {}

  async readThrough<T>(options: CacheReadOptions<T>): Promise<CacheResult<T>> {
    const cached = this.repository.getCacheEntry<T>(
      options.serverId,
      options.key,
    )
    const now = this.now()

    if (cached && cached.expiresAt > now) {
      return { value: cached.value, source: 'cache', isStale: false }
    }

    try {
      const value = await options.fetch()
      this.repository.setCacheEntry(options.serverId, options.key, {
        value,
        updatedAt: now,
        expiresAt: now + Math.max(0, options.ttlMs),
      })
      return { value, source: 'network', isStale: false }
    } catch (error) {
      if (cached) {
        return { value: cached.value, source: 'stale-cache', isStale: true }
      }

      throw new OfflineUnavailableError(options.serverId, options.key, {
        cause: error,
      })
    }
  }
}
