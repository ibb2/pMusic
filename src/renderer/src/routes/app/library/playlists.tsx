import BlankImage from "@/assets/512px-Black_colour.jpg";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSelectedServerId } from "@/hooks/use-selected-server-id";

dayjs.extend(duration);

export const Route = createFileRoute("/app/library/playlists")({
  component: RouteComponent,
});

const PLAYLIST_BATCH_SIZE = 80;

function RouteComponent() {
  const selectedServer = useSelectedServerId();
  const observerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(PLAYLIST_BATCH_SIZE);
  const [playlistType, setPlaylistType] = useState<"all" | "smart" | "manual">(
    "all",
  );
  const [sortField, setSortField] = useState<
    "title" | "dateAdded" | "duration"
  >("title");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");

  const queryPlaylists = useQuery({
    queryKey: [selectedServer.data, "playlists"],
    queryFn: () => window.api.media.getPlaylists(),
    enabled: Boolean(selectedServer.data),
    staleTime: 60_000,
  });

  const playlists = useMemo(() => {
    const items = (queryPlaylists.data ?? []).filter((playlist: any) =>
      playlistType === "all"
        ? true
        : playlistType === "smart"
          ? Boolean(playlist.smart)
          : !playlist.smart,
    );
    return [...items].sort((left: any, right: any) => {
      const comparison =
        sortField === "title"
          ? String(left.title ?? "").localeCompare(
              String(right.title ?? ""),
              undefined,
              {
                sensitivity: "base",
              },
            )
          : Number(left[sortField] ?? 0) - Number(right[sortField] ?? 0);
      return direction === "asc" ? comparison : -comparison;
    });
  }, [direction, playlistType, queryPlaylists.data, sortField]);
  const visiblePlaylists = useMemo(
    () => playlists.slice(0, visibleCount),
    [playlists, visibleCount],
  );
  const hasMore = visibleCount < playlists.length;

  useEffect(() => {
    setVisibleCount(PLAYLIST_BATCH_SIZE);
  }, [direction, playlistType, playlists.length, sortField]);

  useEffect(() => {
    if (!observerRef.current || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount((count) =>
          Math.min(count + PLAYLIST_BATCH_SIZE, playlists.length),
        );
      }
    });

    observer.observe(observerRef.current);

    return () => observer.disconnect();
  }, [hasMore, playlists.length]);

  if (queryPlaylists.isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (queryPlaylists.isError) {
    return (
      <div className="flex min-h-full flex-col px-6 py-4">
        <p className="text-2xl font-bold">Playlists</p>
        <p className="mt-4 text-sm text-destructive">
          Error: {queryPlaylists.error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col px-6 pb-8">
      <header className="sticky top-0 z-10 space-y-3 bg-background py-3">
        <div>
          <h1 className="text-2xl font-bold">Playlists</h1>
          <p className="text-sm text-muted-foreground">
            {playlists.length}{" "}
            {playlists.length === 1 ? "playlist" : "playlists"}
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <Select
            value={playlistType}
            onValueChange={(value) =>
              setPlaylistType(value as "all" | "smart" | "manual")
            }
          >
            <SelectTrigger
              className="w-full"
              aria-label="Filter playlists by type"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All playlists</SelectItem>
              <SelectItem value="manual">Manual playlists</SelectItem>
              <SelectItem value="smart">Smart playlists</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sortField}
            onValueChange={(value) =>
              setSortField(value as "title" | "dateAdded" | "duration")
            }
          >
            <SelectTrigger className="w-full" aria-label="Sort playlists">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="dateAdded">Date added</SelectItem>
              <SelectItem value="duration">Duration</SelectItem>
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

      {playlists.length === 0 ? (
        <div className="mt-4 flex min-h-32 items-center rounded-md border border-dashed border-zinc-300 bg-zinc-50/60 px-6 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400">
          <span className="text-sm">No playlists found</span>
        </div>
      ) : (
        <>
          <div className="flex w-full flex-wrap">
            {visiblePlaylists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
          <div ref={observerRef} className="flex h-12 items-center">
            {hasMore ? <Spinner className="size-4" /> : null}
          </div>
        </>
      )}
    </div>
  );
}

function PlaylistCard({ playlist }: { playlist: any }) {
  const image =
    playlist.composite?.length > 0 ? playlist.composite : BlankImage;
  const length = playlist.duration
    ? `${dayjs.duration(playlist.duration).hours()}hr ${dayjs
        .duration(playlist.duration)
        .minutes()}min`
    : "0hr 0min";

  return (
    <Link
      to="/app/playlist/$ratingKey"
      params={{ ratingKey: playlist.ratingKey }}
      preload="intent"
      className="h-fit"
    >
      <div className="relative flex w-40 shrink-0 justify-center rounded-md bg-transparent p-3 hover:bg-zinc-300/60 dark:hover:bg-zinc-800/60">
        <div className="min-w-0">
          <img
            src={image}
            alt={playlist.title}
            className="mb-1.5 aspect-square w-full rounded-lg object-cover"
            loading="lazy"
          />
          <p className="mb-0.5 truncate text-sm leading-tight hover:underline">
            {playlist.title}
          </p>
          <p className="truncate text-xs leading-tight text-black/80 dark:text-muted-foreground">
            {playlist.smart ? "Smart playlist" : "Playlist"} · {length}
          </p>
        </div>
      </div>
    </Link>
  );
}
