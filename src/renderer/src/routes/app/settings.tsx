import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { apiJson, initializePlexBackend } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Music, Check } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

export function SettingsPage() {
  const [selectedLibraries, setSelectedLibraries] = useState<any[] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(false);

  // queries
  const { isPending, error, data } = useQuery({
    queryKey: ["libraries"],
    queryFn: () => apiJson("/library/sections/all"),
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

    // Update backend immediately
    (async () => {
      try {
        await initializePlexBackend(updated);
        setUpdated(true);
      } catch (err) {
        console.error("Failed to update selected libraries:", err);
      }
    })();

    setTimeout(() => {
      setUpdated(false);
    }, 1500);
  };

  useEffect(() => {
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
    fetchSelectedLibraries();
  }, []);

  if (isPending)
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Spinner className="size-8" />
      </div>
    );

  if (error) return "An error has occurred: " + error.message;

  return (
    <div className="flex flex-col overflow-y-auto gap-2 p-6 mb-20">
      <div className="flex-1 overflow-y-auto scrollbar-hidden">
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
          {/* <section className="space-y-4">
            <h2 className=" text-xl">Playback</h2>
            <div className=" rounded-lg p-6">
              <p className=" text-sm">Playback settings coming soon</p>
            </div>
          </section> */}

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
                            <div className="w-full h-full">
                              <ItemMedia>
                                <Music className="size-5" />
                              </ItemMedia>
                              <ItemContent>
                                <ItemTitle className="justify-self-start">
                                  {library.title}
                                </ItemTitle>
                              </ItemContent>
                              <ItemActions>
                                {selectedLibraries?.some(
                                  (l) => l.uuid === library.uuid,
                                ) && <Check className="size-4" />}
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
