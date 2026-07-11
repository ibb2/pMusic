import { describe, expect, test } from 'bun:test'
import {
  CacheService,
  OfflineUnavailableError,
  type CacheEntry,
  type CacheRepository,
} from './cache'

class MemoryCacheRepository implements CacheRepository {
  readonly entries = new Map<string, CacheEntry<unknown>>()

  getCacheEntry<T>(serverId: string, key: string): CacheEntry<T> | null {
    return (this.entries.get(`${serverId}:${key}`) as CacheEntry<T>) ?? null
  }

  setCacheEntry<T>(serverId: string, key: string, entry: CacheEntry<T>): void {
    this.entries.set(`${serverId}:${key}`, entry)
  }
}

describe('CacheService', () => {
  test('returns a fresh server-scoped hit without fetching', async () => {
    const repository = new MemoryCacheRepository()
    repository.setCacheEntry('server-a', 'albums', {
      value: ['cached'],
      updatedAt: 900,
      expiresAt: 1_100,
    })
    repository.setCacheEntry('server-b', 'albums', {
      value: ['other-server'],
      updatedAt: 900,
      expiresAt: 1_100,
    })
    let fetches = 0

    const result = await new CacheService(repository, () => 1_000).readThrough<string[]>({
      serverId: 'server-a',
      key: 'albums',
      ttlMs: 500,
      fetch: async () => {
        fetches += 1
        return ['network']
      },
    })

    expect(result).toEqual({
      value: ['cached'],
      source: 'cache',
      isStale: false,
    })
    expect(fetches).toBe(0)
  })

  test('refreshes a stale entry and persists the result', async () => {
    const repository = new MemoryCacheRepository()
    repository.setCacheEntry('server-a', 'artists', {
      value: ['old'],
      updatedAt: 100,
      expiresAt: 999,
    })

    const result = await new CacheService(repository, () => 1_000).readThrough({
      serverId: 'server-a',
      key: 'artists',
      ttlMs: 200,
      fetch: async () => ['new'],
    })

    expect(result).toEqual({
      value: ['new'],
      source: 'network',
      isStale: false,
    })
    expect(repository.getCacheEntry('server-a', 'artists')).toEqual({
      value: ['new'],
      updatedAt: 1_000,
      expiresAt: 1_200,
    })
  })

  test('falls back to stale data when refresh fails', async () => {
    const repository = new MemoryCacheRepository()
    repository.setCacheEntry('server-a', 'tracks', {
      value: ['offline track'],
      updatedAt: 100,
      expiresAt: 200,
    })

    const result = await new CacheService(repository, () => 1_000).readThrough({
      serverId: 'server-a',
      key: 'tracks',
      ttlMs: 200,
      fetch: async () => {
        throw new Error('network unavailable')
      },
    })

    expect(result).toEqual({
      value: ['offline track'],
      source: 'stale-cache',
      isStale: true,
    })
  })

  test('throws a typed unavailable error when offline without cached data', async () => {
    const repository = new MemoryCacheRepository()
    const service = new CacheService(repository, () => 1_000)

    try {
      await service.readThrough({
        serverId: 'server-a',
        key: 'lyrics:42',
        ttlMs: 200,
        fetch: async () => {
          throw new Error('network unavailable')
        },
      })
      throw new Error('expected readThrough to reject')
    } catch (error) {
      expect(error).toBeInstanceOf(OfflineUnavailableError)
      expect(error).toMatchObject({
        code: 'OFFLINE_UNAVAILABLE',
        serverId: 'server-a',
        key: 'lyrics:42',
      })
      expect((error as Error).cause).toEqual(
        new Error('network unavailable'),
      )
    }
  })
})
