import { AlbumCard } from "@/components/music/albumcard";
import { usePageUltraBlur } from "@/components/layout/UltraBlurProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Disc3,
  Heart,
  MoreVertical,
  Music,
  Play,
} from "lucide-react";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/app/artist/$ratingKey")({
  component: ArtistPage,
});

export function ArtistPage() {
  const { ratingKey } = Route.useParams();
  const { setBlur } = usePageUltraBlur(`artist-${ratingKey}`);

  const albumRef = useRef<HTMLDivElement>(null);

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

  // queries
  const queryArtist = useQuery({
    queryKey: ["artist", ratingKey],
    queryFn: () => window.api.media.getArtist(ratingKey),
  });

  useEffect(() => {
    if (queryArtist.data?.ultraBlur) {
      setBlur(queryArtist.data.ultraBlur);
    }
  }, [queryArtist.data?.ultraBlur, setBlur]);
  const queryArtistAlbums = useQuery({
    queryKey: ["artistAlbum", ratingKey],
    queryFn: () => window.api.media.getArtistAlbums(ratingKey),
  });
  const queryArtistPopularTracks = useQuery({
    queryKey: ["artistPopularTrack", ratingKey],
    queryFn: () => window.api.media.getArtistPopularTracks(ratingKey),
  });

  if (queryArtist.isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (queryArtist.isError) {
    const message = queryArtist.error?.message || "Unknown artist error";
    return `Error loading artist: ${message}`;
  }

  const artist = queryArtist.data;
  const albums = queryArtistAlbums.data ?? [];
  const popularTracks = queryArtistPopularTracks.data?.tracks ?? [];

  return (
    <div className="flex min-h-full flex-col p-6">
      {/* Artist Header */}
      <div className="flex gap-6 mb-6">
        <img
          src={artist.thumb}
          alt={artist.title}
          className="w-48 h-48 rounded-full object-cover shadow-xl"
        />
        <div className="flex flex-col justify-end py-2">
          <div>
            {queryArtist.data.verified && (
              <div className="text-blue-400 text-sm mb-2">
                ✓ VERIFIED ARTIST
              </div>
            )}
            <h1
              className="text-5xl font-extrabold mb-2"
              style={{ fontSize: "clamp(2rem, 10vw, 6rem)" }}
            >
              {artist.title}
            </h1>
            {/*<div className="text-zinc-400">{queryArtist.data.followers} monthly listeners</div>*/}
            <div className="pl-2">{artist.viewCount ?? 0} plays</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          className="rounded-full h-14 w-14"
          onClick={() => {
            window.api.player.playArtist(ratingKey);
          }}
        >
          <Play size={24} fill="white" />
        </Button>
        <Button variant="secondary">
          <Heart size={18} className="mr-2" />
          Follow
        </Button>
        <Button variant="ghost" size="icon">
          <MoreVertical size={20} />
        </Button>
      </div>

      {/* Popular Tracks */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Popular Tracks</h2>
        <div className="bg-white/60 dark:bg-slate-300/10 rounded-lg">
          {queryArtistPopularTracks.isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Spinner className="size-5" />
            </div>
          ) : popularTracks.length > 0 ? (
            popularTracks.map((track: any, index: number) => (
              <div
                key={track.id}
                className="flex items-center gap-4 px-4 py-3 rounded group hover:bg-slate-200/50 dark:hover:bg-slate-200/50 transition-colors cursor-pointer"
              >
                <div className="text-center w-8 group-hover:hidden">
                  {index + 1}
                </div>
                <button
                  className="hidden group-hover:block"
                  onClick={() => {
                    window.api.player.playTrack(String(track.ratingKey));
                  }}
                >
                  <Play
                    size={16}
                    className="text-shadow-black w-8"
                    fill="black"
                  />
                </button>
                <div className="flex-1">
                  <div className="">{track.title}</div>
                  <div className="text-zinc-400 text-sm">
                    {Intl.NumberFormat("en-US", {
                      notation: "compact",
                      compactDisplay: "short",
                    }).format(track.ratingCount ?? 0)}
                  </div>
                </div>
                <div className="text-zinc-400 text-sm">
                  {dayjs.duration(track.duration).format("m:ss")}
                </div>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Heart size={16} className="text-zinc-400 hover:text-white" />
                </button>
              </div>
            ))
          ) : (
            <div className="flex h-24 items-center gap-3 px-4 text-sm text-muted-foreground">
              <Music className="size-5" />
              <div>
                {queryArtistPopularTracks.isError
                  ? "Popular tracks are unavailable"
                  : "No popular tracks found"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Albums */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Albums</h2>
        {queryArtistAlbums.isLoading ? (
          <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
            <Spinner className="size-5" />
          </div>
        ) : albums.length > 0 ? (
          <div className="relative group min-w-0 overflow-hidden">
            <div
              ref={albumRef}
              className="flex flex-row overflow-x-auto pb-2 scrollbar-hidden"
            >
              {albums.map((album: any) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </div>
            {albums.length > 4 && (
              <RowControls
                onLeft={() => scroll(albumRef, "left")}
                onRight={() => scroll(albumRef, "right")}
              />
            )}
          </div>
        ) : (
          <div className="flex h-24 items-center gap-3 rounded-md border border-dashed px-4 text-sm text-muted-foreground">
            <Disc3 className="size-5" />
            <div>
              {queryArtistAlbums.isError
                ? "Albums are unavailable"
                : "No albums found"}
            </div>
          </div>
        )}
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
