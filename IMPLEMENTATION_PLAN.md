# Rayna Roadmap Completion Plan

## Goal

Complete every practical unchecked desktop roadmap item, update the README feature documentation, capture current application screenshots, and mark each verified item complete. TV support is excluded from the desktop music-player scope and will be documented as a non-goal rather than marked complete.

## Working Rules

- Complete the phases in order; later phases depend on contracts established earlier.
- Use one sub-agent per workstream, with the primary agent owning shared types, RPC integration, conflict resolution, and final verification.
- Do not mark a roadmap checkbox complete until its end-to-end acceptance checks pass.
- Keep caches, downloads, and synchronization state isolated by Plex server ID.
- Keep authentication tokens and absolute media paths in the Bun process.
- Preserve unrelated working-tree changes.

## Phase 1 — Baseline and Shared Contracts

Owner: Primary agent

- [x] Record the initial results of `bun test`, `bun run lint`, `bun run typecheck`, and `bun run build:renderer`.
- [x] Inventory current roadmap behavior and distinguish existing partial implementations from missing functionality.
- [x] Define typed shared models for:
  - Album and track pages.
  - Library filters and sort orders.
  - Cache freshness and offline-unavailable states.
  - Downloads and download progress.
  - Sync status.
  - Plain and synchronized lyrics.
- [x] Define RPC operations for filtered library pages, lyrics, downloads, offline status, sync, and atomic server switching.
- [x] Define server-scoped React Query key conventions.
- [x] Assign non-overlapping files and interfaces to each sub-agent.

Baseline recorded 2026-07-11:

- `bun test`: 21 passed; three listener-based tests could not bind an ephemeral port in the managed sandbox (`EADDRINUSE` for port `0`).
- `bun run lint`: passed with two existing warnings.
- `bun run typecheck`: Bun target passed; web target reported existing errors in chart, data-table, mode-toggle, spinner, and toolbar components.
- `bun run build:renderer`: passed.
- Server-derived query keys use the selected Plex server ID followed by the resource name and normalized request/filter object.

Completion gate:

- [x] Shared contracts are type-safe and sufficiently stable for parallel implementation.
- [x] Existing tests still pass or all pre-existing failures are documented.

## Phase 2 — Database and Cache Foundation

Owner: Persistence/offline sub-agent

- [x] Add versioned, idempotent SQLite migrations.
- [x] Preserve the existing settings and playback-history data.
- [x] Add typed repositories for server-scoped media cache, downloads, and per-library sync state.
- [x] Index cache expiry and download/sync state fields.
- [x] Handle corrupt persisted JSON without crashing application startup.
- [x] Remove generic renderer-facing `dbGet` and `dbSet` access after confirming no renderer callers remain.
- [x] Implement read-through metadata caching:
  - Fresh cache hit returns immediately.
  - Stale data is refreshed from Plex.
  - Stale data is returned when Plex cannot be reached.
  - An uncached offline request returns a typed unavailable state.
- [ ] Cache artwork in server-scoped storage.
- [x] Add cache isolation and expiration tests.

Completion gate:

- [x] Migrations pass from an empty and existing database.
- [x] Cached metadata supports fresh, stale, offline-fallback, and unavailable paths.
- [x] Data from one Plex server cannot leak into another server's results.

## Phase 3 — Offline Downloads and Playback

Owner: Persistence/offline sub-agent

- [x] Implement explicit track downloads using original Plex audio files.
- [x] Add album and playlist download orchestration using the track download pipeline.
- [x] Stream downloads into resumable `.partial` files.
- [x] Validate completed downloads and atomically rename them.
- [x] Persist byte progress, completion state, errors, and required media metadata.
- [x] Implement retry, cancellation, and removal.
- [x] Add a restricted loopback file endpoint with `HEAD` and byte-range support.
- [x] Prevent path traversal and arbitrary local-file access.
- [x] Prefer completed local downloads during playback, then fall back to live Plex streaming.
- [x] Ensure offline queues can advance between downloaded tracks.
- [x] Add renderer controls for downloading tracks, albums, and playlists.
- [x] Add download progress, retry, remove, and storage-usage UI in Settings.

Completion gate:

- [ ] Downloaded media plays, seeks, pauses, resumes, and advances without Plex connectivity.
- [ ] Interrupted downloads resume safely.
- [ ] Restarting Rayna preserves completed downloads and progress state.
- [ ] Local playback endpoints reject unregistered paths.

## Phase 4 — Library Browsing and Filtering

Owner: Library sub-agent

- [x] Extend album paging with typed server-side filter and sort parameters.
- [x] Add track paging across all selected music libraries.
- [x] Add server-side text search for albums and tracks.
- [x] Add common sort options appropriate to each media type.
- [x] Add album facets for artist and year.
- [x] Add track facets for artist and album.
- [x] Include all filters in React Query keys and reset pagination when they change.
- [x] Replace the Tracks placeholder route with a paginated track table.
- [x] Support playing and queueing individual tracks.
- [x] Add Tracks to the library sidebar.
- [x] Provide loading, empty, error, stale-offline, and end-of-list states.
- [x] Reuse shared filter and track-row components where practical.

Completion gate:

- [x] Filters apply to the complete Plex library rather than only loaded pages.
- [x] Pagination remains stable across multiple selected libraries.
- [x] Tracks can be browsed, played, and queued.
- [x] Albums and Tracks expose search, sorting, and the required facets.

## Phase 5 — Lyrics

Owner: Lyrics sub-agent

- [x] Discover Plex lyric or text streams from track metadata.
- [x] Fetch lyric streams through the authenticated, failover-capable Plex connection.
- [x] Normalize plain text and LRC-style timestamps into a shared lyric model.
- [x] Cache lyrics for offline access.
- [x] Add a lyrics panel accessible from the player.
- [x] Display loading, unavailable, error, plain-text, and synchronized states.
- [x] Highlight and scroll synchronized lines during playback.
- [x] Reset lyric state when the current track changes.
- [x] Do not introduce a third-party lyrics provider.

Completion gate:

- [x] Plain and timed lyrics render correctly.
- [x] Missing and malformed lyric streams fail gracefully.
- [x] Cached lyrics remain available offline.
- [x] Lyrics update correctly when playback changes tracks.

## Phase 6 — Safe Server Switching and Settings

Owner: Settings/server sub-agent

- [x] Add an atomic server-change operation in the Bun process.
- [x] Validate that the destination server is reachable before committing the switch.
- [x] Stop playback and clear the queue during a successful switch.
- [x] Clear old selected libraries and active connection state.
- [x] Reset the media service's active server route.
- [x] Preserve server-scoped downloads and caches for later switching back.
- [x] Roll back to the original state when the destination cannot be reached.
- [x] Invalidate all server-derived renderer queries after a successful switch.
- [x] Require explicit music-library selection on the new server.
- [x] Finish the Settings page with:
  - Connected server and server-change controls.
  - Library selection.
  - Existing playback preferences.
  - Download storage and management.
  - Sync status and actions.
- [x] Centralize selected-library checks so UUID strings and full library objects render consistently.

Completion gate:

- [x] Failed switching leaves the original server usable.
- [x] Successful switching cannot show stale media from the previous server.
- [x] Playback and queue state are cleared before browsing the new server.
- [x] Switching back exposes that server's preserved downloads and cache.

## Phase 7 — Startup and Manual Sync

Owner: Persistence/offline sub-agent

- [x] Refresh cached metadata for selected libraries.
- [x] Reconcile explicitly downloaded items without mirroring the entire library.
- [x] Run synchronization at startup and after network recovery.
- [x] Add a manual “Sync Now” action.
- [x] Enforce single-flight execution.
- [x] Persist last-run time, state, and partial errors.
- [x] Preserve local downloads when Plex items disappear; mark them orphaned instead of deleting them silently.
- [x] Display current and last sync state in Settings.

Completion gate:

- [x] Startup and manual sync both complete successfully.
- [x] Partial failures are visible and retryable.
- [x] Concurrent triggers do not create duplicate sync jobs.
- [x] Sync operates only on selected libraries and explicit downloads.

## Phase 8 — Integration and Regression Validation

Owner: Primary agent

- [x] Integrate all sub-agent changes against the locked shared contracts.
- [x] Resolve shared RPC, renderer bridge, and route-tree conflicts.
- [x] Regenerate the TanStack route tree when required.
- [x] Run `bun test`.
- [x] Run `bun run lint`.
- [x] Run `bun run typecheck`.
- [x] Run `bun run build:renderer`.
- [ ] Run the available desktop build.
- [ ] Smoke-test the authenticated desktop application against Plex.
- [ ] Verify albums and tracks filters against complete libraries.
- [ ] Verify download, restart, disconnected playback, lyrics, sync, and server switching.
- [ ] Confirm remote playback reconnection, queue behavior, transcoding, timeline reporting, and existing settings still work.

Completion gate:

- [x] Automated validation passes.
- [ ] Desktop runtime validation passes for every completed roadmap item.
- [ ] No roadmap item is marked complete based only on code presence.

## Phase 9 — Screenshots and README

Owner: Documentation/screenshot sub-agent; final review by primary agent

- [ ] Create `docs/screenshots/` for repository-owned images.
- [ ] Capture a consistently sized native application window from the authenticated local Plex session.
- [ ] Capture these states:
  - Home/player overview for the hero image.
  - Albums or Tracks with filters visible.
  - Lyrics or offline downloads.
  - Settings with server and sync controls.
- [ ] Exclude usernames, server addresses, tokens, desktop clutter, and other private information.
- [ ] Replace external GitHub attachment URLs with relative screenshot paths and meaningful alt text.
- [ ] Rewrite the README introduction to remove the online-only limitation.
- [ ] Expand Features into grouped, user-facing capabilities:
  - Library browsing and search.
  - Playback, queue, and lyrics.
  - Offline downloads, caching, and sync.
  - Server, library, and settings management.
  - Themes, transcoding, timeline reporting, and connection recovery.
  - Supported desktop platforms.
- [ ] Remove the outdated single-server footnote.
- [ ] Mark each implemented roadmap parent and child item `[x]`.
- [ ] Move TV support to a Non-goals note rather than representing it as completed.
- [ ] Confirm every feature claim corresponds to tested behavior.
- [ ] Confirm every relative screenshot exists and renders correctly.
- [ ] Confirm `rg '^- \[ \]' README.md` returns no practical desktop roadmap work.

Completion gate:

- [ ] README accurately describes the completed application.
- [ ] Screenshots are current, legible, repository-owned, and safe to publish.
- [ ] All practical roadmap items are checked only after verification.

## Final Definition of Done

- [ ] Albums and Tracks provide complete-library search, sorting, and facets.
- [ ] Tracks library playback and queueing work.
- [ ] SQLite-backed cache and download state survive restarts.
- [ ] Explicitly downloaded tracks, albums, and playlists work offline.
- [ ] Lyrics work online and from cache where available.
- [ ] Startup and manual synchronization work and expose status.
- [ ] Server switching is atomic, clears playback state, and requires library reselection.
- [ ] Settings exposes all completed controls.
- [ ] Existing playback and connection behavior has no regressions.
- [ ] Automated tests, type checks, renderer build, desktop build, and runtime smoke tests pass.
- [ ] README Features, Roadmap, limitations, and screenshots match the verified product.

## Chosen Product Defaults

- Offline media is user-managed; Rayna does not mirror an entire Plex library.
- Metadata, artwork, and lyrics use read-through caching.
- Audio is stored only when explicitly downloaded.
- Sync runs at startup, after network recovery, and on manual request; there is no scheduled interval in this milestone.
- Lyrics come only from Plex.
- Server changes stop playback, clear the queue, and require library reselection.
- TV/video and 10-foot interface support are outside Rayna's desktop music-player scope.
