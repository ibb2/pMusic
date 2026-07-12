import BlankImage from "@/assets/512px-Black_colour.jpg";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSelectedServerId } from "@/hooks/use-selected-server-id";

export const Route = createFileRoute("/app/library/artists")({
  component: RouteComponent,
});

function RouteComponent() {
  const selectedServer = useSelectedServerId();
  const [sortField, setSortField] = useState<"title" | "dateAdded">("title");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [initial, setInitial] = useState("all");

  const { data, error, status } = useQuery({
    queryKey: [selectedServer.data, "artists", "complete"],
    queryFn: fetchAllArtists,
    enabled: Boolean(selectedServer.data),
    staleTime: 60_000,
  });

  const artists = useMemo(() => {
    return (data ?? [])
      .filter((artist: any) =>
        initial === "all"
          ? true
          : String(artist.title ?? "")
              .toLocaleUpperCase()
              .startsWith(initial),
      )
      .sort((left: any, right: any) => {
        const comparison =
          sortField === "dateAdded"
            ? Number(left.addedAt ?? 0) - Number(right.addedAt ?? 0)
            : String(left.title ?? "").localeCompare(
                String(right.title ?? ""),
                undefined,
                { sensitivity: "base" },
              );
        return direction === "asc" ? comparison : -comparison;
      });
  }, [data, direction, initial, sortField]);

  if (status === "pending") {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-full items-center justify-center px-6 text-sm text-muted-foreground">
        Error loading artists: {error.message}
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col px-6">
      <header className="sticky top-0 z-10 space-y-3 bg-background py-3">
        <div>
          <h1 className="text-2xl font-bold">Artists</h1>
          <p className="text-sm text-muted-foreground">
            Browse artists across your selected libraries.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <select
            aria-label="Filter artists by initial"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={initial}
            onChange={(event) => setInitial(event.target.value)}
          >
            <option value="all">All artists</option>
            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => (
              <option key={letter} value={letter}>
                Starts with {letter}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort artists"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={sortField}
            onChange={(event) =>
              setSortField(event.target.value as "title" | "dateAdded")
            }
          >
            <option value="title">Name</option>
            <option value="dateAdded">Date added</option>
          </select>
          <select
            aria-label="Sort direction"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={direction}
            onChange={(event) =>
              setDirection(event.target.value as "asc" | "desc")
            }
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </header>

      {artists.length > 0 ? (
        <div className="flex w-full flex-wrap">
          {artists.map((artist: any) => (
            <ArtistCard key={artist.ratingKey} artist={artist} />
          ))}
        </div>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          No artists found
        </div>
      )}
    </div>
  );
}

async function fetchAllArtists(): Promise<any[]> {
  const artists: any[] = [];
  let cursor = "";
  const seenCursors = new Set<string>();

  do {
    if (seenCursors.has(cursor)) {
      throw new Error("Artist pagination returned a repeated cursor");
    }
    seenCursors.add(cursor);
    const page = (await window.api.media.getArtistsPage(cursor, 200)) as {
      items?: any[];
      nextCursor?: string | null;
    };
    artists.push(...(page.items ?? []));
    cursor = page.nextCursor ?? "";
  } while (cursor);

  return artists;
}

function ArtistCard({ artist }: { artist: any }) {
  return (
    <Link
      to={`/app/artist/$ratingKey`}
      params={{ ratingKey: String(artist.ratingKey) }}
      className="h-fit"
    >
      <Card className="flex w-40 shrink-0 justify-center border-0 bg-transparent p-3 shadow-none ring-0 hover:rounded-lg hover:bg-zinc-300/60 dark:hover:bg-zinc-800/60">
        <CardHeader className="gap-0 p-0">
          <img
            src={artist.thumb ?? BlankImage}
            alt={artist.title}
            className="mb-2 aspect-square w-full rounded-full object-cover"
          />
          <CardTitle className="mb-0.5 overflow-hidden text-ellipsis text-nowrap text-sm leading-tight">
            <p className="truncate hover:underline">{artist.title}</p>
          </CardTitle>
          <p className="truncate text-xs leading-tight text-black/80 dark:text-muted-foreground">
            Artist
          </p>
        </CardHeader>
      </Card>
    </Link>
  );
}
