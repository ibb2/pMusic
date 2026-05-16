import { useUltraBlur } from "@/components/layout/UltraBlurProvider";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { PlaybackSettings } from "../../../../shared/rpc";
import { PlexServer } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { MusicNote03Icon, Tick01Icon } from "@hugeicons/core-free-icons";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

export function SettingsPage() {
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
  const [playbackUpdated, setPlaybackUpdated] = useState(false);

  // queries
  const { isPending, error, data } = useQuery({
    queryKey: ["libraries"],
    queryFn: () => window.api.auth.getLibraries(),
    staleTime: 30 * 60 * 1000,
    retry: true,
  });

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

  const setTranscodeAudio = async (transcodeAudio: boolean) => {
    const next = { ...playbackSettings, transcodeAudio };
    setPlaybackSettings(next);
    await window.api.settings.setPlayback(next).catch((e) => console.error(e));
    setPlaybackUpdated(true);

    setTimeout(() => {
      setPlaybackUpdated(false);
    }, 1500);
  };

  const setEnableUltraBlur = async (enableUltraBlur: boolean) => {
    const next = { ...playbackSettings, enableUltraBlur };
    setPlaybackSettings(next);
    setEnabled(enableUltraBlur);
    await window.api.settings.setPlayback(next).catch((e) => console.error(e));
    setPlaybackUpdated(true);

    setTimeout(() => {
      setPlaybackUpdated(false);
    }, 1500);
  };

  const setEnableTimelineReporting = async (
    enableTimelineReporting: boolean,
  ) => {
    const next = { ...playbackSettings, enableTimelineReporting };
    setPlaybackSettings(next);
    await window.api.settings.setPlayback(next).catch((e) => console.error(e));
    setPlaybackUpdated(true);

    setTimeout(() => {
      setPlaybackUpdated(false);
    }, 1500);
  };

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

  if (isPending)
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Spinner className="size-8" />
      </div>
    );

  if (error) return "An error has occurred: " + error.message;

  return (
    <div className="flex min-h-full flex-col gap-2 p-6 pb-10">
      <div className="flex-1">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl mb-2">Settings</h1>
            <p>Manage your preferences</p>
          </div>

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
                    When enabled, Rayna asks Plex Media Server to convert tracks
                    to a 320 kbps Opus stream. Off uses direct play from the
                    original file.
                  </Label>
                </div>
                <div className="flex items-center gap-4">
                  {playbackUpdated && (
                    <p className="text-green-700 dark:text-green-300">
                      Updated
                    </p>
                  )}
                  <Switch
                    checked={playbackSettings.transcodeAudio}
                    onCheckedChange={setTranscodeAudio}
                    aria-label="Transcode Audio"
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
                  {playbackUpdated && (
                    <p className="text-green-700 dark:text-green-300">
                      Updated
                    </p>
                  )}
                  <Switch
                    checked={playbackSettings.enableUltraBlur !== false}
                    onCheckedChange={setEnableUltraBlur}
                    aria-label="UltraBlur Background"
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
                  {playbackUpdated && (
                    <p className="text-green-700 dark:text-green-300">
                      Updated
                    </p>
                  )}
                  <Switch
                    checked={playbackSettings.enableTimelineReporting !== false}
                    onCheckedChange={setEnableTimelineReporting}
                    aria-label="Report playback to Plex"
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
                {loading ? (
                  <div className=" text-sm">Loading libraries...</div>
                ) : data && data.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {data?.map((library) => (
                      <>
                        {library.type === "artist" ? (
                          <Item
                            variant={"outline"}
                            size="sm"
                            asChild
                            onClick={() => selectLibrary(library)}
                            className={cn(
                              "hover:border-zinc-400 hover:bg-zinc-50/50",
                              selectedLibraries?.some(
                                (l) => l.uuid === library.uuid,
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
                                {selectedLibraries?.some(
                                  (l) => l.uuid === library.uuid,
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
