import BlankImage from "@/assets/512px-Black_colour.jpg";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { MediaTrack, TrackSortField } from "../../../../../shared/types";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { DownloadButton, downloadsApi } from "@/components/downloads";
import { useSelectedServerId } from "@/hooks/use-selected-server-id";

export const Route = createFileRoute("/app/library/tracks")({
  component: TracksPage,
});

function TracksPage() {
  const selectedServer = useSelectedServerId();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [artistKeys, setArtistKeys] = useState("");
  const [albumKeys, setAlbumKeys] = useState("");
  const [sortField, setSortField] = useState<TrackSortField>("title");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const filters = useMemo(
    () => ({
      artistRatingKeys: split(artistKeys),
      albumRatingKeys: split(albumKeys),
    }),
    [artistKeys, albumKeys],
  );
  const result = useInfiniteQuery({
    queryKey: [selectedServer.data, "tracks", filters, sortField, direction],
    enabled: Boolean(selectedServer.data),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      window.api.media.getTracksPage({
        cursor: pageParam,
        pageSize: 50,
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
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = result;
  const tracks = result.data?.pages.flatMap((page) => page.items) ?? [];
  const isStale = result.data?.pages.some((page) => page.freshness === "stale");
  const artists = facets.data?.trackArtists ?? [];
  const albums = facets.data?.trackAlbums ?? [];

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div className="flex min-h-full flex-col gap-4 px-6 pb-8">
      <header className="sticky top-0 z-10 space-y-3 bg-background py-3">
        <div>
          <h1 className="text-2xl font-bold">Tracks</h1>
          <p className="text-sm text-muted-foreground">
            Play or queue tracks across your selected libraries.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <Select
            value={artistKeys || "all"}
            onValueChange={(value) =>
              setArtistKeys(!value || value === "all" ? "" : value)
            }
          >
            <SelectTrigger className="w-full" aria-label="Filter by artist">
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
            value={albumKeys || "all"}
            onValueChange={(value) =>
              setAlbumKeys(!value || value === "all" ? "" : value)
            }
          >
            <SelectTrigger className="w-full" aria-label="Filter by album">
              <SelectValue placeholder="All albums" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All albums</SelectItem>
              {albums.map((album) => (
                <SelectItem key={album.ratingKey} value={album.ratingKey}>
                  {album.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sortField}
            onValueChange={(value) => setSortField(value as TrackSortField)}
          >
            <SelectTrigger className="w-full" aria-label="Sort tracks">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="artist">Artist</SelectItem>
              <SelectItem value="album">Album</SelectItem>
              <SelectItem value="dateAdded">Date added</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={direction}
            onValueChange={(value) => setDirection(value as "asc" | "desc")}
          >
            <SelectTrigger className="w-full" aria-label="Sort direction">
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
          Showing saved track data while Plex is offline.
        </p>
      )}
      {result.isPending ? (
        <div className="flex items-center gap-2 py-12 text-muted-foreground">
          <Spinner className="size-4" /> Loading tracks…
        </div>
      ) : result.isError ? (
        <Empty title="Tracks unavailable" detail={result.error.message} />
      ) : tracks.length === 0 ? (
        <Empty
          title="No tracks found"
          detail="Try removing a filter or selecting another music library."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="divide-y">
            {tracks.map((track) => (
              <TrackRow key={track.ratingKey} track={track} />
            ))}
          </div>
        </div>
      )}
      {result.hasNextPage ? (
        <div
          ref={loadMoreRef}
          className="flex min-h-12 items-center justify-center text-sm text-muted-foreground"
          aria-live="polite"
        >
          {result.isFetchingNextPage ? (
            <span className="flex items-center gap-2">
              <Spinner className="size-4" /> Loading more tracks…
            </span>
          ) : (
            "More tracks load as you scroll"
          )}
        </div>
      ) : tracks.length > 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          End of library
        </p>
      ) : null}
    </div>
  );
}

function TrackRow({ track }: { track: MediaTrack }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-3 hover:bg-accent/50">
      <img
        className="size-11 rounded object-cover"
        src={track.thumb ?? BlankImage}
        alt=""
      />
      <div className="min-w-0">
        <p className="truncate font-medium">{track.title}</p>
        <p className="truncate text-sm text-muted-foreground">
          {track.artistRatingKey ? (
            <Link
              className="hover:underline"
              to="/app/artist/$ratingKey"
              params={{ ratingKey: track.artistRatingKey }}
            >
              {track.artist}
            </Link>
          ) : (
            track.artist
          )}{" "}
          ·{" "}
          {track.albumRatingKey ? (
            <Link
              className="hover:underline"
              to="/app/album/$ratingKey"
              params={{ ratingKey: track.albumRatingKey }}
            >
              {track.album}
            </Link>
          ) : (
            track.album
          )}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
          onClick={() => window.api.player.playTrack(track.ratingKey)}
        >
          Play
        </button>
        <button
          className="rounded-md border px-3 py-1.5 text-xs"
          onClick={() => window.api.player.queueTrack(track.ratingKey)}
        >
          Queue
        </button>
        <DownloadButton
          compact
          api={downloadsApi}
          target={{
            type: "track",
            ratingKey: track.ratingKey,
            title: track.title,
          }}
        />
      </div>
    </div>
  );
}
function split(value: string) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
