import { useUltraBlur } from "@/components/layout/UltraBlurProvider";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type {
  PlaybackSettings,
  PlaybackSettingsPatch,
} from "../../../../shared/rpc";
import { PlexServer } from "@/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { MusicNote03Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { DownloadStorageLocation } from "@/components/downloads";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

type PlaybackSettingKey = keyof PlaybackSettings;
type PlaybackFieldState = Partial<Record<PlaybackSettingKey, boolean>>;

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { setEnabled } = useUltraBlur();
  const [selectedLibraries, setSelectedLibraries] = useState<any[] | null>(
    null,
  );
  const [selectedServer, setSelectedServer] = useState<PlexServer | null>(null);
  const [playbackSettings, setPlaybackSettings] = useState<PlaybackSettings>({
    transcodeAudio: false,
    enableUltraBlur: true,
    enableTimelineReporting: true,
  });
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(false);
  const [serverChanging, setServerChanging] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [playbackUpdated, setPlaybackUpdated] = useState<PlaybackFieldState>(
    {},
  );
  const [playbackPending, setPlaybackPending] = useState<PlaybackFieldState>(
    {},
  );
  const playbackUpdateTimers = useRef<
    Partial<Record<PlaybackSettingKey, ReturnType<typeof setTimeout>>>
  >({});

  // queries
  const librariesQuery = useQuery({
    queryKey: ["libraries"],
    queryFn: () => window.api.auth.getLibraries(),
    staleTime: 30 * 60 * 1000,
    retry: true,
  });
  const serversQuery = useQuery({
    queryKey: ["plex-servers"],
    queryFn: () => window.api.auth.getServers(),
    staleTime: 5 * 60 * 1000,
  });
  const syncQuery = useQuery({
    queryKey: ["sync-status", selectedServer?.clientIdentifier],
    queryFn: () => window.api.sync.getStatus(),
    refetchInterval: (query) =>
      query.state.data?.state === "running" ? 1000 : 10_000,
  });

  const startSync = async () => {
    await window.api.sync.start();
    await syncQuery.refetch();
  };

  const changeServer = async (server: PlexServer) => {
    if (server.clientIdentifier === selectedServer?.clientIdentifier) return;
    setServerChanging(server.clientIdentifier);
    setServerError(null);
    try {
      const result = await window.api.auth.changeServer(server);
      if (!result.changed) {
        setServerError(result.error);
        return;
      }
      setSelectedServer(result.server);
      setSelectedLibraries([]);
      // All media query data belongs to the previous server. Refetching the
      // libraries query exposes the mandatory selection step immediately.
      await queryClient.invalidateQueries();
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Failed to change Plex server",
      );
    } finally {
      setServerChanging(null);
    }
  };

  const selectLibrary = async (library) => {
    const exists = selectedLibraries?.some((l) =>
      typeof l === "string" ? l === library.uuid : l.uuid === library.uuid,
    );

    let updated;
    if (exists) {
      updated = (selectedLibraries || []).filter((s) =>
        typeof s === "string" ? s !== library.uuid : s.uuid !== library.uuid,
      );
    } else {
      updated = [...(selectedLibraries || []), library];
    }

    setSelectedLibraries(updated);

    // Persist selection in main process store
    await window.api.auth
      .selectLibraries(updated)
      .catch((e) => console.error(e));
    setUpdated(true);

    setTimeout(() => {
      setUpdated(false);
    }, 1500);
  };

  const markPlaybackUpdated = (key: PlaybackSettingKey) => {
    const existingTimer = playbackUpdateTimers.current[key];
    if (existingTimer) clearTimeout(existingTimer);

    setPlaybackUpdated((current) => ({ ...current, [key]: true }));
    playbackUpdateTimers.current[key] = setTimeout(() => {
      setPlaybackUpdated((current) => ({ ...current, [key]: false }));
      delete playbackUpdateTimers.current[key];
    }, 1500);
  };

  const updatePlaybackSetting = async <K extends PlaybackSettingKey>(
    key: K,
    value: PlaybackSettings[K],
  ) => {
    if (playbackPending[key]) return;

    const previousValue = playbackSettings[key];
    const patch = { [key]: value } as PlaybackSettingsPatch;
    setPlaybackSettings((current) => ({ ...current, [key]: value }));
    setPlaybackPending((current) => ({ ...current, [key]: true }));

    if (key === "enableUltraBlur") setEnabled(value !== false);

    try {
      await window.api.settings.setPlayback(patch);
      markPlaybackUpdated(key);
    } catch (error) {
      console.error(error);
      setPlaybackSettings((current) => ({
        ...current,
        [key]: previousValue,
      }));
      if (key === "enableUltraBlur") setEnabled(previousValue !== false);
    } finally {
      setPlaybackPending((current) => ({ ...current, [key]: false }));
    }
  };

  const setTranscodeAudio = (transcodeAudio: boolean) =>
    updatePlaybackSetting("transcodeAudio", transcodeAudio);

  const setEnableUltraBlur = (enableUltraBlur: boolean) =>
    updatePlaybackSetting("enableUltraBlur", enableUltraBlur);

  const setEnableTimelineReporting = async (enableTimelineReporting: boolean) =>
    updatePlaybackSetting("enableTimelineReporting", enableTimelineReporting);

  useEffect(
    () => () => {
      Object.values(playbackUpdateTimers.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    },
    [],
  );

  useEffect(() => {
    const fetchSelectedServer = async () => {
      try {
        const server = await window.api.auth.getUserSelectedServer();
        setSelectedServer(server);
      } catch (error) {
        console.error("Failed to fetch selected server:", error);
      }
    };
    const fetchSelectedLibraries = async () => {
      try {
        const libs = await window.api.auth.getUserSelectedLibraries();
        setSelectedLibraries(libs);
      } catch (error) {
        console.error("Failed to fetch selected libraries:", error);
      } finally {
        setLoading(false);
      }
    };
    const fetchPlaybackSettings = async () => {
      try {
        const settings = await window.api.settings.getPlayback();
        setPlaybackSettings(settings);
      } catch (error) {
        console.error("Failed to fetch playback settings:", error);
      }
    };
    fetchSelectedServer();
    fetchSelectedLibraries();
    fetchPlaybackSettings();
  }, []);

  return (
    <div className="flex min-h-full flex-col gap-2 p-6 pb-10">
      <div className="flex-1">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl mb-2">Settings</h1>
            <p>Manage your preferences</p>
          </div>

          <section className="space-y-4">
            <h2 className="text-xl">Plex Server</h2>
            <div className="border border-zinc-300 dark:border-zinc-700 rounded-lg p-6 space-y-4">
              <div>
                <Label className="mb-2 block">Connected server</Label>
                <p className="text-sm text-muted-foreground">
                  {selectedServer?.name || "No server selected"}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Changing server stops playback, clears the queue, and requires
                you to select music libraries below.
              </p>
              {serverError && (
                <p role="alert" className="text-sm text-destructive">
                  {serverError}
                </p>
              )}
              {serversQuery.isPending ? (
                <div className="flex items-center gap-2 text-sm">
                  <Spinner className="size-4" /> Loading servers…
                </div>
              ) : serversQuery.isError ? (
                <p className="text-sm text-destructive">
                  Unable to load Plex servers.
                </p>
              ) : (
                <div className="space-y-2">
                  {serversQuery.data?.map((server) => {
                    const active =
                      server.clientIdentifier ===
                      selectedServer?.clientIdentifier;
                    const changing = serverChanging === server.clientIdentifier;
                    return (
                      <div
                        key={server.clientIdentifier}
                        className="flex items-center justify-between gap-4 rounded-md border p-3"
                      >
                        <div>
                          <p className="font-medium">{server.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {server.platform} {server.productVersion}
                          </p>
                        </div>
                        <Button
                          variant={active ? "secondary" : "outline"}
                          disabled={active || serverChanging !== null}
                          onClick={() => changeServer(server)}
                        >
                          {active
                            ? "Connected"
                            : changing
                              ? "Connecting…"
                              : "Switch"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Account Section */}
          {/* <section className="space-y-4">
            <h2 className=" text-xl">Account</h2>
            <div className=" rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="">Username</div>
                  <div className=" text-sm">music_lover_2024</div>
                </div>
                <Button variant="outline" className="bg-transparent">
                  Edit Profile
                </Button>
              </div>
              <Separator className="" />
              <div className="flex items-center justify-between">
                <div>
                  <div className="">Plex Server</div>
                  <div className=" text-sm">
                    Connected to: home-server.local
                  </div>
                </div>
                <Button variant="outline" className="bg-transparent">
                  Change Server
                </Button>
              </div>
            </div>
          </section> */}

          {/* Playback Section */}
          <section className="space-y-4">
            <h2 className=" text-xl">Playback</h2>
            <div className="border border-zinc-300 dark:border-zinc-700 rounded-lg p-6 space-y-6">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <Label className="mb-2 block">Transcode Audio</Label>
                  <Label className="mb-2 block text-sm text-muted-foreground">
                    When enabled, Plex converts to a 320 kbps Opus stream.
                  </Label>
                </div>
                <div className="flex items-center gap-4">
                  {playbackUpdated.transcodeAudio && (
                    <p className="text-green-700 dark:text-green-300">
                      Updated
                    </p>
                  )}
                  <Switch
                    checked={playbackSettings.transcodeAudio}
                    onCheckedChange={setTranscodeAudio}
                    aria-label="Transcode Audio"
                    disabled={playbackPending.transcodeAudio}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-6">
                <div>
                  <Label className="mb-2 block">UltraBlur Background</Label>
                  <Label className="mb-2 block text-sm text-muted-foreground">
                    Show colorful artist and album backgrounds.
                  </Label>
                </div>
                <div className="flex items-center gap-4">
                  {playbackUpdated.enableUltraBlur && (
                    <p className="text-green-700 dark:text-green-300">
                      Updated
                    </p>
                  )}
                  <Switch
                    checked={playbackSettings.enableUltraBlur !== false}
                    onCheckedChange={setEnableUltraBlur}
                    aria-label="UltraBlur Background"
                    disabled={playbackPending.enableUltraBlur}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-6">
                <div>
                  <Label className="mb-2 block">Report playback to Plex</Label>
                  <Label className="mb-2 block text-sm text-muted-foreground">
                    Show Rayna in Plex and Tautulli active sessions.
                  </Label>
                </div>
                <div className="flex items-center gap-4">
                  {playbackUpdated.enableTimelineReporting && (
                    <p className="text-green-700 dark:text-green-300">
                      Updated
                    </p>
                  )}
                  <Switch
                    checked={playbackSettings.enableTimelineReporting !== false}
                    onCheckedChange={setEnableTimelineReporting}
                    aria-label="Report playback to Plex"
                    disabled={playbackPending.enableTimelineReporting}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Display Section */}
          {/* <section className="space-y-4">
            <h2 className=" text-xl">Display</h2>
            <div className=" rounded-lg p-6">
              <p className=" text-sm">Display settings coming soon</p>
            </div>
          </section> */}

          {/* Library Section */}
          <section className="space-y-4">
            <h2 className=" text-xl">Library</h2>
            <div className="border border-zinc-300 dark:border-zinc-700 rounded-lg p-6 space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-row">
                  <div className="w-full">
                    <Label className=" mb-2 block">Selected Libraries</Label>
                    <Label className=" mb-2 block text-sm text-muted-foreground">
                      Choose which libraries to display in your app
                    </Label>
                  </div>
                  {updated && (
                    <div className=" items-center self-center">
                      <p className="text-green-700 dark:text-green-300">
                        Updated
                      </p>
                    </div>
                  )}
                </div>
                {loading || librariesQuery.isPending ? (
                  <div className=" text-sm">Loading libraries...</div>
                ) : librariesQuery.isError ? (
                  <div className="text-sm text-destructive" role="alert">
                    Libraries unavailable: {librariesQuery.error.message}
                  </div>
                ) : librariesQuery.data && librariesQuery.data.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {librariesQuery.data.map((library) => (
                      <>
                        {library.type === "artist" ? (
                          <Item
                            variant={"outline"}
                            size="sm"
                            onClick={() => selectLibrary(library)}
                            className={cn(
                              "hover:border-zinc-400 hover:bg-zinc-50/50",
                              selectedLibraries?.some((l) =>
                                typeof l === "string"
                                  ? l === library.uuid
                                  : l.uuid === library.uuid,
                              )
                                ? "border-zinc-500 bg-zinc-100/20 dark:bg-zinc-600/20"
                                : "",
                            )}
                          >
                            <div className="flex flex-row gap-4 w-full h-full">
                              <ItemMedia>
                                <HugeiconsIcon icon={MusicNote03Icon} />{" "}
                              </ItemMedia>
                              <ItemContent>
                                <ItemTitle className="justify-self-start">
                                  {library.title}
                                </ItemTitle>
                              </ItemContent>
                              <ItemActions>
                                {selectedLibraries?.some((l) =>
                                  typeof l === "string"
                                    ? l === library.uuid
                                    : l.uuid === library.uuid,
                                ) && <HugeiconsIcon icon={Tick01Icon} />}
                              </ItemActions>
                            </div>
                          </Item>
                        ) : (
                          <div></div>
                        )}
                      </>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm mb-4">No libraries selected</div>
                )}
              </div>

              {/* Framework for future library features */}
              {/* <Separator className="bg-zinc-700" />

              <div className="text-zinc-500 text-sm space-y-2">
                <p className="">Additional library features coming soon:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Auto-organize Files</li>
                  <li>Download Metadata</li>
                  <li>Library Scan</li>
                </ul>
              </div> */}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl">Offline</h2>
            <div className="space-y-5 rounded-lg border border-zinc-300 p-6 dark:border-zinc-700">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Offline downloads</p>
                  <p className="text-sm text-muted-foreground">
                    Browse downloaded albums, playlists, and tracks on their own
                    page.
                  </p>
                </div>
                <Link
                  to="/app/downloads"
                  className="inline-flex h-8 items-center rounded-full border border-border bg-input/30 px-3 text-sm font-medium hover:bg-input/50"
                >
                  View downloads
                </Link>
              </div>
              <DownloadStorageLocation />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl">Library sync</h2>
            <div className="rounded-lg border border-zinc-300 p-6 dark:border-zinc-700">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium capitalize">
                    {syncQuery.data?.state || "Idle"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {syncQuery.data?.completedAt
                      ? `Last completed ${new Date(syncQuery.data.completedAt).toLocaleString()}`
                      : "Sync has not completed yet."}
                  </p>
                  {syncQuery.data?.error && (
                    <p className="mt-2 text-sm text-destructive">
                      {syncQuery.data.error}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  disabled={syncQuery.data?.state === "running"}
                  onClick={() => void startSync()}
                >
                  {syncQuery.data?.state === "running"
                    ? "Syncing…"
                    : "Sync Now"}
                </Button>
              </div>
            </div>
          </section>

          {/* <Separator className="" /> */}

          {/* Storage Section */}
          {/* <section className="space-y-4">
            <h2 className=" text-xl">Storage</h2>
            <div className=" rounded-lg p-6">
              <p className=" text-sm">Storage management coming soon</p>
            </div>
          </section>

          <div className="pb-8"></div> */}
        </div>
      </div>
    </div>
  );
}
