import type {
  Connection,
  PlexConnectionMode,
  PlexServer
} from '../../shared/types'

export const PLEX_CONNECTION_PROBE_TIMEOUT_MS = 2_500

type OrderPlexConnectionsOptions = {
  mode?: PlexConnectionMode
  preferredUri?: string | null
  lastKnownGoodUri?: string | null
  excludedUris?: Iterable<string>
}

type ProbePlexConnectionOptions = {
  token: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export function orderPlexConnections(
  server: PlexServer,
  {
    mode = 'auto',
    preferredUri,
    lastKnownGoodUri,
    excludedUris = []
  }: OrderPlexConnectionsOptions = {}
): Connection[] {
  const excluded = new Set(excludedUris)
  const connections = server.connections.filter(
    (connection) => connection.uri && !excluded.has(connection.uri)
  )
  const allowed =
    mode === 'auto'
      ? connections
      : connections.filter((connection) =>
          connectionMatchesMode(connection, mode)
        )
  const ordered: Connection[] = []

  const add = (items: Connection[]) => {
    for (const connection of items) {
      if (!ordered.some((candidate) => candidate.uri === connection.uri)) {
        ordered.push(connection)
      }
    }
  }

  addByUri(allowed, ordered, preferredUri)
  addByUri(allowed, ordered, lastKnownGoodUri)

  if (mode === 'auto') {
    add(allowed.filter((connection) => connection.local && !connection.relay))
    add(allowed.filter((connection) => !connection.local && !connection.relay))
    add(allowed.filter((connection) => connection.relay))
  }

  add(allowed)
  return ordered
}

export async function probePlexConnection(
  uri: string,
  {
    token,
    timeoutMs = PLEX_CONNECTION_PROBE_TIMEOUT_MS,
    fetchImpl = fetch
  }: ProbePlexConnectionOptions
): Promise<boolean> {
  if (!token) return false

  try {
    const response = await fetchImpl(new URL('/identity', uri), {
      headers: {
        'X-Plex-Token': token
      },
      signal: AbortSignal.timeout(timeoutMs)
    })
    return response.ok
  } catch {
    return false
  }
}

export async function findReachablePlexConnection(
  candidates: Connection[],
  probe: (connection: Connection) => Promise<boolean>
): Promise<Connection | null> {
  for (const connection of candidates) {
    if (await probe(connection)) return connection
  }
  return null
}

function addByUri(
  connections: Connection[],
  ordered: Connection[],
  uri?: string | null
): void {
  if (!uri) return
  const connection = connections.find((candidate) => candidate.uri === uri)
  if (connection && !ordered.some((candidate) => candidate.uri === uri)) {
    ordered.push(connection)
  }
}

function connectionMatchesMode(
  connection: Connection,
  mode: Exclude<PlexConnectionMode, 'auto'>
): boolean {
  if (mode === 'local') return connection.local && !connection.relay
  if (mode === 'remote') return !connection.local && !connection.relay
  return connection.relay
}
