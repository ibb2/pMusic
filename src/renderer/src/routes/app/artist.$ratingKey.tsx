import { AlbumCard } from "@/components/music/albumcard";
import { usePageUltraBlur } from "@/components/layout/UltraBlurProvider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DiscIcon,
  FavouriteIcon,
  MoreVerticalIcon,
  MusicNote03Icon,
  NextIcon,
  PlayIcon,
  PlusSignIcon,
  PreviousIcon,
} from "@hugeicons/core-free-icons";

dayjs.extend(duration);

export const Route = createFileRoute("/app/artist/$ratingKey")({
  component: ArtistPage,
});

export function ArtistPage() {
  const { ratingKey } = Route.useParams();
  const { setBlur } = usePageUltraBlur(`artist-${ratingKey}`);
  const queryClient = useQueryClient();

  const albumRef = useRef<HTMLDivElement>(null);

  const invalidatePlayerQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["playerStatus"] });
    queryClient.invalidateQueries({ queryKey: ["playerQueue"] });
  };

  const playTrack = async (trackRatingKey: string) => {
    await window.api.player.playTrack(trackRatingKey);
    invalidatePlayerQueries();
  };

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
          onClick={async () => {
            await window.api.player.playArtist(ratingKey);
            invalidatePlayerQueries();
          }}
        >
          <HugeiconsIcon icon={PlayIcon} className="fill-current" />
        </Button>
        <Button variant="secondary">
          <HugeiconsIcon icon={FavouriteIcon} />
          Follow
        </Button>
        <Button variant="ghost" size="icon">
          <HugeiconsIcon icon={MoreVerticalIcon} />
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
                key={track.ratingKey}
                className="flex items-center gap-4 px-4 py-3 rounded group first:rounded-tl-lg first:rounded-tr-lg last:rounded-bl-lg last:rounded-br-lg hover:bg-slate-200/50 dark:hover:bg-slate-200/50 transition-colors"
              >
                <div className="text-center w-8 group-hover:hidden">
                  {index + 1}
                </div>
                <button
                  className="hidden group-hover:block w-8 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={(event) => {
                    event.stopPropagation();
                    void playTrack(String(track.ratingKey));
                  }}
                  aria-label={`Play ${track.title}`}
                >
                  <HugeiconsIcon icon={PlayIcon} className="fill-inherit w-8" />
                </button>
                <div className="flex-1">
                  <button
                    className="w-full text-left"
                    onClick={(event) => {
                      event.stopPropagation();
                      void playTrack(String(track.ratingKey));
                    }}
                    aria-label={`Play ${track.title}`}
                  >
                    {track.title}
                  </button>
                  <div className="text-zinc-400 text-sm">
                    {Intl.NumberFormat("en-US", {
                      notation: "compact",
                      compactDisplay: "short",
                    }).format(track.playCount ?? 0)}{" "}
                    plays
                  </div>
                </div>
                <div className="text-zinc-400 text-sm">
                  {track.duration
                    ? dayjs.duration(track.duration).format("m:ss")
                    : "--:--"}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={async (event) => {
                    event.stopPropagation();
                    await window.api.player.queueTrack(String(track.ratingKey));
                    invalidatePlayerQueries();
                  }}
                  aria-label={`Queue ${track.title}`}
                >
                  <HugeiconsIcon icon={PlusSignIcon} />
                </Button>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(event) => event.stopPropagation()}
                >
                  <HugeiconsIcon icon={FavouriteIcon} />
                </button>
              </div>
            ))
          ) : (
            <div className="flex h-24 items-center gap-3 px-4 text-sm text-muted-foreground">
              <HugeiconsIcon icon={MusicNote03Icon} />
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
            <HugeiconsIcon icon={DiscIcon} />
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
        <HugeiconsIcon icon={PreviousIcon} className="w-4 h-4" />
      </button>
      <button
        className="absolute right-2 top-2/5 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/50 dark:bg-neutral-800/90 hover:bg-black/70 dark:hover:bg-neutral-900/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
        onClick={onRight}
        aria-label="Scroll right"
      >
        <HugeiconsIcon icon={NextIcon} className="w-4 h-4" />
      </button>
    </>
  );
}
