import Libraries from "@/components/setup/libraries";
import SelectServer from "@/components/setup/server";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import type { PlexLibrary, PlexServer } from "@/types";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/setup")({
  component: RouteComponent,
});

function RouteComponent() {
  const router = useRouter();

  const [progression, setProgression] = useState(0);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [load, onLoad] = useState(false);
  const [servers, setServers] = useState<PlexServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<PlexServer | null>(null);
  const [selectedLibraries, setSelectedLibraries] = useState<PlexLibrary[]>([]);

  const getServers = async () => {
    const s = await window.api.auth.getServers();
    setServers(s);
  };

  const selectServer = (server: PlexServer) => {
    setSelectedServer(server);
  };

  const selectLibrary = (library: PlexLibrary) => {
    if (selectedLibraries.some(({ uuid }) => uuid === library.uuid)) {
      const selectedItemRemoved = selectedLibraries.filter((s) => {
        return s.uuid !== library.uuid;
      });
      setSelectedLibraries([...selectedItemRemoved]);

      return;
    }

    setSelectedLibraries([...selectedLibraries, library]);
  };

  const progressForwards = () => {
    setProgression(progression + 1);
    api?.scrollNext();
  };

  const complete = async () => {
    if (selectedServer) {
      await window.api.auth.selectServer(selectedServer);
      await window.api.auth.selectLibraries(selectedLibraries);
      router.navigate({ to: "/app" });
    }
  };

  useEffect(() => {
    if (!api) {
      return;
    }
    setCurrent(api.selectedScrollSnap() + 1);
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  useEffect(() => {
    const checkSetupComplete = async () => {
      const isServerSelected = await window.api.auth.isServerSelected();
      if (isServerSelected) {
        try {
          await window.api.auth.resolveServerConnection("auto");
          router.navigate({ to: "/app" });
        } catch {
          // Keep setup visible so the user can choose another reachable route.
        }
      }
    };
    checkSetupComplete();
  }, [router]);

  useEffect(() => {
    if (!load) {
      getServers();
      onLoad(true);
    }
  }, [load]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-screen p-16">
      <Carousel className="w-full h-full" setApi={setApi}>
        <CarouselContent className="w-full">
          <CarouselItem>
            <SelectServer
              progress={progressForwards}
              servers={servers}
              selectServer={selectServer}
            />
          </CarouselItem>
          <CarouselItem>
            <Libraries
              complete={complete}
              selectedServer={selectedServer}
              selectedLibraries={selectedLibraries}
              selectLibrary={selectLibrary}
            />
          </CarouselItem>
        </CarouselContent>
        {current === 2 && <CarouselPrevious />}
        {/* {current === 1 && <CarouselNext />} */}
      </Carousel>
      <div className="flex flex-row justify-self-end gap-1 text-muted-foreground py-2 text-center text-sm">
        {[1, 2].map((item: number, index) => (
          <div
            className={cn(
              "h-2 w-8 rounded-2xl",
              item === current
                ? "bg-zinc-800 dark:bg-gray-300"
                : "bg-zinc-500/20 dark:bg-gray-100/20",
            )}
            key={index}
          ></div>
        ))}
      </div>
    </div>
  );
}
