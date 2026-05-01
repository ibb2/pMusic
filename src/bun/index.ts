import { ApplicationMenu, BrowserView, BrowserWindow, Utils } from "electrobun";
import { BassManager } from "./bass";
import { DatabaseManager } from "./database";
import Authentication from "./plex/authentication";
import { MediaService } from "./plex/media";
import type { ApplicationMenuItemConfig } from "electrobun";
import type { RaynaRPC } from "../shared/rpc";
import type { PlexServer } from "../shared/types";

const db = new DatabaseManager();
const auth = new Authentication();
const bass = new BassManager();
const media = new MediaService(auth, bass, db);

const rpc = BrowserView.defineRPC<RaynaRPC>({
  maxRequestTime: 30_000,
  handlers: {
    requests: {
      dbGet: ({ key }) => db.get(key),
      dbSet: ({ key, value }) => db.set(key, value),
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
      authSelectLibraries: ({ libraries }: { libraries: unknown[] }) =>
        auth.selectLibraries(libraries),
      authIsServerSelected: () => auth.isServerSelected(),
      authGetUserSelectedServer: () => auth.getUserSelectedServer(),
      authGetUserAccessToken: () => auth.getUserAccessToken(),
      authGetUserSelectedLibraries: () => auth.getUserSelectedLibraries(),
      authCloseLoopbackServer: () => auth.closeLoopbackServer(),
      bassGetStatus: () => bass.getStatus(),
      mediaGetHomeData: () => media.getHomeData(),
      mediaGetTopEight: () => media.getTopEight(),
      mediaGetRecentlyPlayedAlbums: () => media.getRecentlyPlayedAlbums(),
      mediaGetRecentlyAddedAlbums: () => media.getRecentlyAddedAlbums(),
      mediaGetPlaylists: () => media.getPlaylists(),
      mediaGetAlbumsPage: ({ cursor, pageSize }) =>
        media.getAlbumsPage(cursor, pageSize),
      mediaGetAlbum: ({ ratingKey }) => media.getAlbum(ratingKey),
      mediaGetArtist: ({ ratingKey }) => media.getArtist(ratingKey),
      mediaGetArtistAlbums: ({ ratingKey }) => media.getArtistAlbums(ratingKey),
      mediaGetArtistPopularTracks: ({ ratingKey }) =>
        media.getArtistPopularTracks(ratingKey),
      mediaGetPlaylist: ({ ratingKey }) => media.getPlaylist(ratingKey),
      playerGetStatus: () => bass.getPlaybackStatus(),
      playerPlayAlbum: ({ ratingKey }) => media.playAlbum(ratingKey),
      playerPlayPlaylist: ({ ratingKey }) => media.playPlaylist(ratingKey),
      playerPlayArtist: ({ ratingKey }) => media.playArtist(ratingKey),
      playerPlayTrack: ({ ratingKey }) => media.playTrack(ratingKey),
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
  titleBarStyle: "hiddenInset",
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
  bass.free();
  Utils.quit();
}
