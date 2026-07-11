import { AlbumCard } from "@/components/music/albumcard";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { AlbumSortField } from "../../../../../shared/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/app/library/albums")({
  component: AlbumsPage,
});

function AlbumsPage() {
  const [query, setQuery] = useState("");
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
    queryKey: ["albums", query, filters, sortField, direction],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      window.api.media.getAlbumsPage({
        cursor: pageParam,
        pageSize: 40,
        query: query || undefined,
        filters,
        sort: { field: sortField, direction },
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const albums = result.data?.pages.flatMap((page) => page.items) ?? [];
  const isStale = result.data?.pages.some((page) => page.freshness === "stale");
  const artists = [
    ...new Map(
      albums
        .filter((a) => a.artistRatingKey)
        .map((a) => [a.artistRatingKey!, a.artist]),
    ).entries(),
  ];
  const availableYears = [
    ...new Set(
      albums.map((a) => a.year).filter((year): year is number => year !== null),
    ),
  ].sort((a, b) => b - a);

  return (
    <div className="flex min-h-full flex-col gap-4 px-6 pb-8">
      <header className="sticky top-0 z-10 space-y-3 bg-background py-3">
        <div>
          <h1 className="text-2xl font-bold">Albums</h1>
          <p className="text-sm text-muted-foreground">
            Browse every selected music library.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <Input
            aria-label="Search albums"
            placeholder="Search albums"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="Filter by artist"
            className="rounded-md border bg-background px-3 text-sm"
            value={artistKeys}
            onChange={(e) => setArtistKeys(e.target.value)}
          >
            <option value="">All artists</option>
            {artists.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by year"
            className="rounded-md border bg-background px-3 text-sm"
            value={years}
            onChange={(e) => setYears(e.target.value)}
          >
            <option value="">All years</option>
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort albums"
            className="rounded-md border bg-background px-3 text-sm"
            value={sortField}
            onChange={(e) => setSortField(e.target.value as AlbumSortField)}
          >
            <option value="title">Title</option>
            <option value="artist">Artist</option>
            <option value="year">Year</option>
            <option value="dateAdded">Date added</option>
          </select>
          <select
            aria-label="Sort direction"
            className="rounded-md border bg-background px-3 text-sm"
            value={direction}
            onChange={(e) => setDirection(e.target.value as "asc" | "desc")}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
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
