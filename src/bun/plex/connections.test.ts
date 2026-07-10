import { describe, expect, test } from 'bun:test'
import {
  findReachablePlexConnection,
  orderPlexConnections,
  probePlexConnection
} from './connections'
import type { Connection, PlexServer } from '../../shared/types'

const local = connection('http://local:32400', true, false)
const remote = connection('https://remote:32400', false, false)
const relay = connection('https://relay:443', false, true)

describe('Plex connection ordering', () => {
  test('prefers the active and last-known routes before the normal fallback order', () => {
    expect(
      orderPlexConnections(server([local, remote, relay]), {
        preferredUri: remote.uri,
        lastKnownGoodUri: relay.uri
      }).map(({ uri }) => uri)
    ).toEqual([remote.uri, relay.uri, local.uri])
  })

  test('orders local, direct remote, and relay routes by default', () => {
    expect(
      orderPlexConnections(server([relay, remote, local])).map(({ uri }) => uri)
    ).toEqual([local.uri, remote.uri, relay.uri])
  })

  test('filters explicit modes and excluded routes', () => {
    expect(
      orderPlexConnections(server([local, remote, relay]), {
        mode: 'remote',
        excludedUris: [local.uri]
      })
    ).toEqual([remote])
  })

  test('deduplicates repeated Plex route entries', () => {
    expect(orderPlexConnections(server([local, local, remote]))).toEqual([
      local,
      remote
    ])
  })
})

describe('Plex connection probing', () => {
  test('times out an unresponsive route', async () => {
    const reachable = await probePlexConnection(local.uri, {
      token: 'token',
      timeoutMs: 5,
      fetchImpl: ((_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason)
          )
        })) as typeof fetch
    })

    expect(reachable).toBe(false)
  })

  test('returns null after every route fails', async () => {
    const reachable = await findReachablePlexConnection(
      [local, remote, relay],
      async () => false
    )
    expect(reachable).toBeNull()
  })
})

function connection(uri: string, local: boolean, relay: boolean): Connection {
  const url = new URL(uri)
  return {
    protocol: url.protocol.replace(':', ''),
    address: url.hostname,
    port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
    uri,
    local,
    relay,
    IPv6: false
  }
}

function server(connections: Connection[]): PlexServer {
  return {
    name: 'Test Plex',
    product: 'Plex Media Server',
    productVersion: '1',
    platform: 'test',
    platformVersion: '1',
    device: 'test',
    clientIdentifier: 'server-id',
    provides: 'server',
    ownerId: null,
    sourceTitle: null,
    publicAddress: '',
    accessToken: 'token',
    searchEnabled: true,
    createdAt: '',
    lastSeenAt: '',
    owned: true,
    home: true,
    synced: false,
    relay: false,
    presence: true,
    httpsRequired: false,
    publicAddressMatches: false,
    connections
  }
}
