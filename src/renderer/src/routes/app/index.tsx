import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";

import BlankImage from "@/assets/512px-Black_colour.jpg";
import { Spinner } from "@/components/ui/spinner";
import { useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon, Library } from "lucide-react";

dayjs.extend(duration);
dayjs.extend(relativeTime);

export const Route = createFileRoute("/app/")({
  component: Home,
});

export default function Home() {
  // Refs for the scrollable containers
  const recentRef = useRef<HTMLDivElement>(null);
  const addedRef = useRef<HTMLDivElement>(null);
  const recommendedRef = useRef<HTMLDivElement>(null);

  const scroll = (
    ref: React.RefObject<HTMLDivElement | null>,
    direction: "left" | "right",
  ) => {
    if (!ref.current) {
      return;
    }

    const scrollAmount = 300; // width of ~2 cards
    const scrollLeft = direction === "left" ? -scrollAmount : scrollAmount;

    ref.current.scrollBy({
      left: scrollLeft,
      behavior: "smooth",
    });
  };

  const queryHome = useQuery({
    queryKey: ["home"],
    queryFn: () => window.api.media.getHomeData(),
    staleTime: 60_000,
  });

  const topEight = queryHome.data?.topEight ?? [];
  const recentlyPlayed = queryHome.data?.recentlyPlayed ?? [];
  const recentlyAdded = queryHome.data?.recentlyAdded ?? [];
  const playlists = queryHome.data?.playlists ?? [];

  if (queryHome.isLoading)
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Spinner className="size-8" />
      </div>
    );
  if (queryHome.isError)
    return `An error has occurred: ${queryHome.error?.message ?? "Unknown home error"}`;

  return (
    <div className="flex min-h-full flex-col p-6 pb-10">
      {/* Quick Access Grid */}
      {topEight.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 mb-8 w-full">
          {topEight.map((x) => (
            <Link
              key={x.id}
              to={
                x.type === "album"
                  ? `/app/album/$ratingKey`
                  : `/app/playlist/$ratingKey`
              }
              params={{ ratingKey: x.ratingKey }}
            >
              <Item
                variant={"muted"}
                className="flex flex-row hover:bg-slate-300/40 overflow-hidden p-0"
              >
                <ItemMedia className="rounded-l-md rounded-r-none">
                  <img
                    src={x.thumb ?? BlankImage}
                    alt={x.title}
                    className="size-12 object-cover"
                  />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="line-clamp-2">{x.title}</ItemTitle>
                </ItemContent>
              </Item>
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-12">
        {/* Recently Played */}
        <div>
          <h2 className="text-2xl mb-4 font-semibold">Recently Played</h2>

          {/* Wrapper - relative positioning context */}
          <div className="relative group">
            {/* Scrollable container */}
            <div
              ref={recentRef}
              className="flex min-h-48 flex-row overflow-x-auto overflow-y-hidden -ml-2 scrollbar-hidden scroll-smooth gap-1 px-2"
            >
              {recentlyPlayed.length > 0 ? (
                recentlyPlayed.map((album) => (
                  <AlbumCard key={album.id} album={album} />
                ))
              ) : (
                <EmptyRow title="No recently played albums" />
              )}
            </div>

            {/* Buttons OUTSIDE the scrolling div but INSIDE relative wrapper */}
            {recentlyPlayed.length > 0 && (
              <RowControls
                onLeft={() => scroll(recentRef, "left")}
                onRight={() => scroll(recentRef, "right")}
              />
            )}
          </div>
        </div>

        {/* Recently Added - Same Pattern */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Recently Added</h2>
          <div className="relative group">
            <div
              ref={addedRef}
              className="flex min-h-48 flex-row overflow-x-auto overflow-y-hidden -ml-2 scrollbar-hidden scroll-smooth gap-1 px-2"
            >
              {recentlyAdded.length > 0 ? (
                recentlyAdded.map((album) => (
                  <AlbumCard key={album.id} album={album} />
                ))
              ) : (
                <EmptyRow title="No recently added albums" />
              )}
            </div>

            {recentlyAdded.length > 0 && (
              <RowControls
                onLeft={() => scroll(addedRef, "left")}
                onRight={() => scroll(addedRef, "right")}
              />
            )}
          </div>
        </div>

        {/* Recommended - Same Pattern */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Recommended for You</h2>
          <div className="relative group">
            <div
              ref={recommendedRef}
              className="flex min-h-48 flex-row overflow-x-auto overflow-y-hidden -ml-2 scrollbar-hidden scroll-smooth gap-1 px-2"
            >
              {playlists.length > 0 ? (
                playlists.map((playlist) => (
                  <PlaylistCard key={playlist.id} playlist={playlist} />
                ))
              ) : (
                <EmptyRow title="No playlists found" />
              )}
            </div>

            {playlists.length > 0 && (
              <RowControls
                onLeft={() => scroll(recommendedRef, "left")}
                onRight={() => scroll(recommendedRef, "right")}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlbumCard({ album }: { album: any }) {
  return (
    <Link
      key={album.id}
      to={`/app/album/$ratingKey`}
      params={{ ratingKey: album.ratingKey }}
    >
      <Card className="flex justify-center w-40 shrink-0 border-0 shadow-none hover:bg-zinc-100 dark:hover:bg-zinc-800/30 dark:bg-transparent p-2 rounded-md">
        <CardHeader className="p-0">
          <img
            src={album.thumb ?? BlankImage}
            alt={album.title}
            className="w-full object-cover rounded-lg aspect-square"
          />
          <CardTitle className="overflow-hidden text-ellipsis text-nowrap text-sm">
            {album.title}
          </CardTitle>
          <CardDescription className="text-xs truncate">
            {album.artist}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

function PlaylistCard({ playlist }: { playlist: any }) {
  return (
    <Link
      key={playlist.id}
      to={`/app/playlist/$ratingKey`}
      params={{ ratingKey: playlist.ratingKey }}
    >
      <Card className="flex justify-center w-40 shrink-0 border-0 shadow-none hover:bg-zinc-100 dark:hover:bg-zinc-800/30 dark:bg-transparent p-2 rounded-md">
        <CardHeader className="p-0">
          <img
            src={playlist.composite?.length > 0 ? playlist.composite : BlankImage}
            alt={playlist.title}
            className="w-full object-cover rounded-lg aspect-square"
          />
          <CardTitle className="overflow-hidden text-ellipsis text-nowrap text-sm">
            {playlist.title}
          </CardTitle>
          <CardDescription className="text-xs">
            {playlist.duration
              ? `${dayjs.duration(playlist.duration).hours()}hr ${dayjs.duration(playlist.duration).minutes()}min`
              : "0hr 0min"}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

function EmptyRow({ title }: { title: string }) {
  return (
    <div className="flex h-40 min-w-full items-center rounded-md border border-dashed border-zinc-300 bg-zinc-50/60 px-6 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400">
      <div className="flex items-center gap-3">
        <Library className="size-5" />
        <span className="text-sm">{title}</span>
      </div>
    </div>
  );
}

function RowControls({
  onLeft,
  onRight,
}: {
  onLeft: () => void;
  onRight: () => void;
}) {
  return (
    <>
      <button
        className="absolute left-2 top-2/5 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/50 dark:bg-neutral-800/90 hover:bg-black/70 dark:hover:bg-neutral-900/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
        onClick={onLeft}
        aria-label="Scroll left"
      >
        <ChevronLeftIcon className="w-4 h-4" />
      </button>
      <button
        className="absolute right-2 top-2/5 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/50 dark:bg-neutral-800/90 hover:bg-black/70 dark:hover:bg-neutral-900/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
        onClick={onRight}
        aria-label="Scroll right"
      >
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </>
  );
}
