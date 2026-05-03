import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { MusicNote03Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";

export default function Libraries({
  complete,
  selectedServer,
  selectedLibraries,
  selectLibrary,
}) {
  const { isPending, error, data } = useQuery({
    queryKey: ["libraries", selectedServer?.clientIdentifier],
    queryFn: () => window.api.auth.getLibraries(),
    enabled: Boolean(selectedServer),
    staleTime: 30 * 60 * 1000,
    retry: true,
  });

  if (!selectedServer) return null;

  if (isPending)
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Spinner className="size-8" />
      </div>
    );

  if (error) return "An error has occurred: " + error?.message;

  return (
    <div className="flex flex-1 flex-col gap-12 overflow-y-auto p-4 h-full">
      <h1 className="scroll-m-20 text-center text-4xl font-bold tracking-tight text-balance">
        Libraries
      </h1>
      <div className="flex flex-col gap-2">
        {(data ?? []).map((library) => (
          <div key={library.uuid}>
            {library.type === "artist" ? (
              <Item
                variant={
                  selectedLibraries.some((l) => l.uuid === library.uuid)
                    ? "muted"
                    : "outline"
                }
                size="sm"
                asChild
                onClick={() => selectLibrary(library)}
              >
                <div className="w-full h-full">
                  <ItemMedia>
                    <HugeiconsIcon icon={MusicNote03Icon} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{library.title}</ItemTitle>
                    <ItemDescription>{library.type}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {selectedLibraries.some((l) => l.uuid === library.uuid) && (
                      <HugeiconsIcon icon={Tick01Icon} />
                    )}
                  </ItemActions>
                </div>
              </Item>
            ) : (
              <div></div>
            )}
          </div>
        ))}
      </div>
      <Button onClick={complete}>Complete</Button>
    </div>
  );
}
