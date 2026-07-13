import { AlbumCard } from "@/components/music/albumcard";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AlbumSortField } from "../../../../../shared/types";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSelectedServerId } from "@/hooks/use-selected-server-id";

export const Route = createFileRoute("/app/library/albums")({
  component: AlbumsPage,
});

function AlbumsPage() {
  const selectedServer = useSelectedServerId();
  const [artistKeys, setArtistKeys] = useState("");
  const [years, setYears] = useState("");
  const [sortField, setSortField] = useState<AlbumSortField>("title");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const filters = useMemo(
    () => ({
      artistRatingKeys: splitStrings(artistKeys),
      years: splitStrings(years).map(Number).filter(Number.isFinite),
    }),
    [artistKeys, years],
  );

  const result = useInfiniteQuery({
    queryKey: [selectedServer.data, "albums", filters, sortField, direction],
    enabled: Boolean(selectedServer.data),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      window.api.media.getAlbumsPage({
        cursor: pageParam,
        pageSize: 40,
        filters,
        sort: { field: sortField, direction },
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const facets = useQuery({
    queryKey: ["library-facets"],
    queryFn: () => window.api.media.getLibraryFacets(),
    staleTime: 5 * 60_000,
  });
  const albums = result.data?.pages.flatMap((page) => page.items) ?? [];
  const isStale = result.data?.pages.some((page) => page.freshness === "stale");
  const artists = facets.data?.albumArtists ?? [];
  const availableYears = facets.data?.albumYears ?? [];

  return (
    <div className="flex min-h-full flex-col gap-4 px-6 pb-8">
      <header className="sticky top-0 z-10 space-y-3 bg-background py-3">
        <div>
          <h1 className="text-2xl font-bold">Albums</h1>
          <p className="text-sm text-muted-foreground">
            Browse every selected music library.
          </p>
        </div>
        <div className="flex flex-row gap-2">
          <Select
            value={artistKeys || "all artists"}
            onValueChange={(value) =>
              setArtistKeys(!value || value === "all" ? "" : value)
            }
          >
            <SelectTrigger aria-label="Filter by artist">
              <SelectValue placeholder="All artists" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All artists</SelectItem>
              {artists.map((artist) => (
                <SelectItem key={artist.ratingKey} value={artist.ratingKey}>
                  {artist.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={years || "all years"}
            onValueChange={(value) =>
              setYears(!value || value === "all" ? "" : value)
            }
          >
            <SelectTrigger aria-label="Filter by year">
              <SelectValue placeholder="All years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sortField}
            onValueChange={(value) => setSortField(value as AlbumSortField)}
          >
            <SelectTrigger aria-label="Sort albums">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="artist">Artist</SelectItem>
              <SelectItem value="year">Year</SelectItem>
              <SelectItem value="dateAdded">Date added</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={direction}
            onValueChange={(value) => setDirection(value as "asc" | "desc")}
          >
            <SelectTrigger aria-label="Sort direction">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Ascending</SelectItem>
              <SelectItem value="desc">Descending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>
      {isStale && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          Showing saved album data while Plex is offline.
        </p>
      )}
      {result.isPending ? (
        <Loading />
      ) : result.isError ? (
        <State title="Albums unavailable" detail={result.error.message} />
      ) : albums.length === 0 ? (
        <State
          title="No albums found"
          detail="Try removing a filter or selecting another music library."
        />
      ) : (
        <>
          <div className="flex flex-wrap">
            {albums.map((album) => (
              <AlbumCard key={album.ratingKey} album={album} />
            ))}
          </div>
          <PageFooter result={result} />
        </>
      )}
    </div>
  );
}

function splitStrings(value: string) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}
function Loading() {
  return (
    <div className="flex items-center gap-2 py-12 text-muted-foreground">
      <Spinner className="size-4" /> Loading albums…
    </div>
  );
}
function State({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
function PageFooter({ result }: { result: any }) {
  return (
    <div className="flex justify-center py-4">
      {result.hasNextPage ? (
        <button
          className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          disabled={result.isFetchingNextPage}
          onClick={() => result.fetchNextPage()}
        >
          {result.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">End of library</p>
      )}
    </div>
  );
}
