import { ApplicationMenu, BrowserView, BrowserWindow, Utils } from "electrobun";
import { BassManager } from "./bass";
import { DatabaseManager } from "./database";
import Authentication from "./plex/authentication";
import { MediaService } from "./plex/media";
import { PlexTimelineReporter } from "./plex/timeline";
import { DownloadManager } from "./download-manager";
import { LocalPlaybackServer } from "./local-playback-server";
import { homedir } from "node:os";
import { join } from "node:path";
import { SyncService } from "./sync-service";
import { selectMusicLibraries } from "./plex/library-selection";
import { ArtworkCacheServer } from "./artwork-cache-server";
import type { ApplicationMenuItemConfig } from "electrobun";
import type { RaynaRPC } from "../shared/rpc";
import type { PlexLibrarySelection, PlexServer } from "../shared/types";
import { defaultDownloadDirectory } from "./app-paths";

const db = new DatabaseManager();
const auth = new Authentication();
const bass = new BassManager();
const media = new MediaService(auth, bass, db);
const localPlayback = new LocalPlaybackServer();
media.setLocalPlaybackServer(localPlayback);
const artworkCache = new ArtworkCacheServer(
  join(homedir(), ".rayna", "artwork-cache"),
);
media.setArtworkCacheServer(artworkCache);
const downloads = new DownloadManager({
  database: db,
  resolver: media,
  storageDirectory: defaultDownloadDirectory(),
});
const sync = new SyncService({
  database: db,
  resolver: media,
  selectedLibraries: async (serverId) => {
    const server = await auth.getUserSelectedServer();
    if (server?.clientIdentifier !== serverId) return [];
    const libraries = await auth.getLibraries();
    const selected = (await auth.getUserSelectedLibraries()) || [];
    return selectMusicLibraries(libraries, selected).map(
      (library) => library.key,
    );
  },
});
media.setNetworkRestoredCallback(() => {
  void auth.getUserSelectedServer().then((server) => {
    if (server) void sync.networkRestored(server.clientIdentifier);
  });
});
void auth.getUserSelectedServer().then((server) => {
  if (server) void sync.startup(server.clientIdentifier);
});
const timeline = new PlexTimelineReporter(auth, bass, () =>
  media.getPlaybackSettings(),
);
timeline.start();

const isMac = process.platform === "darwin";

const rpc = BrowserView.defineRPC<RaynaRPC>({
  maxRequestTime: 30_000,
  handlers: {
    requests: {
      settingsGetPlayback: () => media.getPlaybackSettings(),
      settingsSetPlayback: ({ settings }) =>
        media.setPlaybackSettings(settings),
      authGenerateClientIdentifier: () => auth.generateClientIdentifier(),
      authGenerateKeyPair: () => auth.generateKeyPair(),
      authGeneratePin: () => auth.generatePin(),
      authCheckPin: async () => {
        const result = await auth.checkPin();
        Utils.openExternal(result.authUrl);
        return result;
      },
      authCheckPinStatus: ({ id }) => auth.checkPinStatus(id),
      authIsUserSignedIn: () => auth.isUserSignedIn(),
      authLogout: () => auth.logout(),
      authGetServers: () => auth.getServers(),
      authGetLibraries: () => auth.getLibraries(),
      authSelectServer: ({ server }: { server: PlexServer }) =>
        auth.selectServer(server),
      authChangeServer: ({ server, mode }) =>
        auth.changeServer(server, mode, () => media.resetForServerChange()),
      authSelectLibraries: ({
        libraries,
      }: {
        libraries: PlexLibrarySelection[];
      }) => auth.selectLibraries(libraries),
      authResolveServerConnection: ({ mode }) =>
        auth.resolveServerConnection(mode),
      authIsServerSelected: () => auth.isServerSelected(),
      authGetUserSelectedServer: () => auth.getUserSelectedServer(),
      authGetUserAccessToken: () => auth.getUserAccessToken(),
      authGetUserProfile: () => auth.getUserProfile(),
      authGetUserSelectedLibraries: () => auth.getUserSelectedLibraries(),
      authCloseLoopbackServer: () => auth.closeLoopbackServer(),
      bassGetStatus: () => bass.getStatus(),
      mediaGetHomeData: () => media.getHomeData(),
      mediaGetTopEight: () => media.getTopEight(),
      mediaGetRecentlyPlayedAlbums: () => media.getRecentlyPlayedAlbums(),
      mediaGetRecentlyAddedAlbums: () => media.getRecentlyAddedAlbums(),
      mediaGetPlaylists: () => media.getPlaylists(),
      mediaGetAlbumsPage: (request) => media.getAlbumsPage(request),
      mediaGetTracksPage: (request) => media.getTracksPage(request),
      mediaGetLibraryFacets: () => media.getLibraryFacets(),
      mediaGetArtistsPage: ({ cursor, pageSize }) =>
        media.getArtistsPage(cursor, pageSize),
      mediaGetAlbum: ({ ratingKey }) => media.getAlbum(ratingKey),
      mediaGetArtist: ({ ratingKey }) => media.getArtist(ratingKey),
      mediaGetArtistAlbums: ({ ratingKey }) => media.getArtistAlbums(ratingKey),
      mediaGetArtistPopularTracks: ({ ratingKey }) =>
        media.getArtistPopularTracks(ratingKey),
      mediaGetPlaylist: ({ ratingKey }) => media.getPlaylist(ratingKey),
      mediaSearch: ({ query, limit }) => media.search(query, limit),
      mediaGetLyrics: ({ ratingKey }) => media.getLyrics(ratingKey),
      downloadsCreate: async ({ targetType, ratingKey, targetTitle }) => {
        const server = await auth.getUserSelectedServer();
        if (!server) throw new Error("Select a Plex server before downloading");
        return downloads.enqueue(
          server.clientIdentifier,
          targetType,
          ratingKey,
          targetTitle,
        );
      },
      downloadsList: async ({ states }) => {
        const server = await auth.getUserSelectedServer();
        if (!server) return [];
        const items = downloads.list(server.clientIdentifier);
        return states?.length
          ? items.filter((item) => states.includes(item.state))
          : items;
      },
      downloadsRetry: ({ downloadId }) => downloads.retry(downloadId),
      downloadsPause: ({ downloadId }) => downloads.pause(downloadId),
      downloadsResume: ({ downloadId }) => downloads.resume(downloadId),
      downloadsGetActivity: async () => {
        const server = await auth.getUserSelectedServer();
        return server
          ? downloads.activity(server.clientIdentifier)
          : { items: [], activeCount: 0, failedCount: 0 };
      },
      downloadsClearActivity: async ({ downloadIds }) => {
        const server = await auth.getUserSelectedServer();
        if (server)
          downloads.clearActivity(server.clientIdentifier, downloadIds);
      },
      downloadsGetStatus: async ({ targets }) => {
        const server = await auth.getUserSelectedServer();
        return server
          ? downloads.statuses(server.clientIdentifier, targets)
          : targets.map((target) => ({
              ...target,
              state: "not-downloaded" as const,
              activeState: null,
              completedTracks: 0,
              totalTracks: 0,
            }));
      },
      downloadsRemove: ({ downloadId }) => downloads.remove(downloadId),
      downloadsGetProgress: async ({ downloadIds }) => {
        const server = await auth.getUserSelectedServer();
        if (!server) return [];
        return downloads
          .list(server.clientIdentifier)
          .filter((item) => !downloadIds || downloadIds.includes(item.id))
          .map(
            ({ id, state, bytesDownloaded, bytesTotal, error, updatedAt }) => ({
              id,
              state,
              bytesDownloaded,
              bytesTotal,
              error,
              updatedAt,
            }),
          );
      },
      offlineGetStorageStatus: async () => {
        const server = await auth.getUserSelectedServer();
        if (!server) return downloads.storageStatus("");
        return downloads.storageStatus(server.clientIdentifier);
      },
      offlineSetStorageDirectory: async ({ directory }) => {
        await downloads.setStorageDirectory(directory);
        const server = await auth.getUserSelectedServer();
        return downloads.storageStatus(server?.clientIdentifier ?? "");
      },
      syncStart: async () => {
        const server = await auth.getUserSelectedServer();
        if (!server) throw new Error("Select a Plex server before syncing");
        return sync.manual(server.clientIdentifier);
      },
      syncGetStatus: async () => {
        const server = await auth.getUserSelectedServer();
        return server
          ? sync.getStatus(server.clientIdentifier)
          : {
              serverId: null,
              state: "idle" as const,
              trigger: null,
              startedAt: null,
              completedAt: null,
              refreshedLibraries: 0,
              failedLibraries: 0,
              reconciledDownloads: 0,
              error: null,
            };
      },
      playerGetStatus: () => bass.getPlaybackStatus(),
      playerGetQueue: () => media.getQueue(),
      playerPlayAlbum: ({ ratingKey }) => media.playAlbum(ratingKey),
      playerPlayPlaylist: ({ ratingKey }) => media.playPlaylist(ratingKey),
      playerPlayArtist: ({ ratingKey }) => media.playArtist(ratingKey),
      playerPlayTrack: ({ ratingKey }) => media.playTrack(ratingKey),
      playerQueueAlbum: ({ ratingKey }) => media.queueAlbum(ratingKey),
      playerQueuePlaylist: ({ ratingKey }) => media.queuePlaylist(ratingKey),
      playerQueueTrack: ({ ratingKey }) => media.queueTrack(ratingKey),
      playerClearQueue: () => media.clearQueue(),
      playerPlay: () => bass.resume(),
      playerPause: () => bass.pause(),
      playerNext: () => bass.playNext(),
      playerPrev: () => bass.playPrev(),
      playerSeek: ({ position }) => bass.seek(position),
      playerSetVolume: ({ volume }) => bass.setVolume(volume),
      playerSetMuted: ({ muted }) => bass.setMuted(muted),
    },
  },
});

const mainWindow = new BrowserWindow({
  title: "Rayna",
  frame: {
    x: 120,
    y: 120,
    width: 900,
    height: 670,
  },
  url: rendererRoute(),
  titleBarStyle: isMac ? "hiddenInset" : "default",
  rpc,
});

createApplicationMenu(mainWindow);

mainWindow.webview.on("new-window-open" as never, (event: unknown) => {
  const url = extractUrl(event);
  if (url) {
    Utils.openExternal(url);
  }
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function rendererRoute(route = ""): string {
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  const hash = normalizedRoute === "/" ? "" : `#${normalizedRoute}`;
  return `${process.env.RAYNA_RENDERER_URL || "views://main/index.html"}${hash}`;
}

function createApplicationMenu(window: BrowserWindow): void {
  const isMac = process.platform === "darwin";
  const menu: ApplicationMenuItemConfig[] = [];

  if (isMac) {
    menu.push({
      label: "Rayna",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "showAll" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  menu.push(
    {
      label: "File",
      submenu: [
        {
          label: "Sign Out",
          action: "sign-out",
          accelerator: "CommandOrControl+Shift+L",
        },
        { type: "separator" },
        { role: isMac ? "close" : "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [{ role: "toggleFullScreen" }],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "bringAllToFront" },
      ],
    },
  );

  ApplicationMenu.setApplicationMenu(menu);

  ApplicationMenu.on("application-menu-clicked", (event: unknown) => {
    if (getApplicationMenuAction(event) === "sign-out") {
      void signOut(window);
    }
  });
}

async function signOut(window: BrowserWindow): Promise<void> {
  const logoutSuccessful = await auth.logout();
  if (!logoutSuccessful) return;
  bass.stop();
  window.webview.loadURL(rendererRoute("/auth"));
}

function getApplicationMenuAction(event: unknown): string | null {
  const action = (event as { data?: { action?: unknown } })?.data?.action;
  return typeof action === "string" ? action : null;
}

function extractUrl(event: unknown): string | null {
  const detail = (event as { data?: { detail?: unknown } }).data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (detail && typeof detail === "object" && "url" in detail) {
    const url = (detail as { url?: unknown }).url;
    return typeof url === "string" ? url : null;
  }

  return null;
}

function shutdown(): void {
  artworkCache.dispose();
  localPlayback.dispose();
  bass.free();
  timeline.dispose();
  Utils.quit();
}
