import { usePageUltraBlur } from "@/components/layout/UltraBlurProvider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Clock01Icon,
  FavouriteIcon,
  MoreVerticalIcon,
  PlayIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useEffect } from "react";

export const Route = createFileRoute("/app/album/$ratingKey")({
  component: AlbumPage,
});

export function AlbumPage() {
  const { ratingKey } = Route.useParams();
  const { setBlur } = usePageUltraBlur(`album-${ratingKey}`);
  const queryClient = useQueryClient();

  const invalidatePlayerQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["playerStatus"] });
    queryClient.invalidateQueries({ queryKey: ["playerQueue"] });
  };

  const playTrack = async (trackRatingKey: string) => {
    await window.api.player.playTrack(trackRatingKey);
    invalidatePlayerQueries();
  };

  // queries
  const queryAlbum = useQuery({
    queryKey: ["album", ratingKey],
    queryFn: () => window.api.media.getAlbum(ratingKey),
  });

  useEffect(() => {
    if (queryAlbum.data?.ultraBlur) {
      setBlur(queryAlbum.data.ultraBlur);
    }
  }, [queryAlbum.data?.ultraBlur, setBlur]);

  if (queryAlbum.isLoading)
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Spinner className="size-8" />
      </div>
    );
  if (queryAlbum.isError)
    return "Error loading album" + queryAlbum.error.message;

  const album = queryAlbum.data;

  return (
    <div className="flex min-h-full flex-col p-6">
      {/* Album Header */}
      <div className="flex gap-6 mb-6 items-stretch">
        <img
          src={album.thumb}
          alt={album.title}
          className="w-48 h-48 rounded-lg shadow-xl self-start"
        />
        <div className="flex flex-col justify-between py-2 flex-1 min-w-0 h-48">
          <div className="flex-1 flex flex-col justify-center min-h-0">
            <div className="text-zinc-800/90 dark:text-slate-100 text-md mb-2">
              ALBUM
            </div>
            <h1
              className="font-bold leading-tight break-words line-clamp-3"
              style={{ fontSize: "clamp(1.5rem, 3.5vw, 3rem)" }}
            >
              {album.title}
            </h1>
          </div>
          <div className="shrink-0">
            <Link
              to={`/app/artist/$ratingKey`}
              params={{ ratingKey: album.artistKey }}
              className="hover:underline text-lg"
            >
              {album.artist}
            </Link>
            <div className="flex items-center gap-2 text-sm mt-1">
              <span>{album.year}</span>
              <span>•</span>
              <span>{album.leafCount} tracks</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          className="rounded-full h-14 w-14"
          onClick={async () => {
            await window.api.player.playAlbum(ratingKey);
            invalidatePlayerQueries();
          }}
        >
          <HugeiconsIcon icon={PlayIcon} className="fill-current" />
        </Button>
        <Button variant={"secondary"} size="icon-lg" className="rounded-full">
          <HugeiconsIcon icon={FavouriteIcon} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            await window.api.player.queueAlbum(ratingKey);
            invalidatePlayerQueries();
          }}
          aria-label="Queue album"
        >
          <HugeiconsIcon icon={PlusSignIcon} />
        </Button>
        <Button variant="ghost" size="icon">
          <HugeiconsIcon icon={MoreVerticalIcon} />
        </Button>
      </div>

      {/* Track List */}
      <div className="bg-white/60 dark:bg-slate-300/10 rounded-lg">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-2 text-sm border-b">
          <div className="w-8 text-center">#</div>
          <div>Title</div>
          <div></div>
          <div></div>
          <div className="w-16 text-right">
            <HugeiconsIcon size={16} icon={Clock01Icon} className="inline" />
          </div>
        </div>

        {album.tracks.map((track: any, index: number) => (
          <div
            key={track.id}
            className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-3 rounded group hover:bg-slate-200/50 dark:hover:bg-slate-200/50 transition-colors"
          >
            <div className="text-center w-8 group-hover:hidden">
              {index + 1}
            </div>
            <button
              className="hidden group-hover:block w-8"
              onClick={(event) => {
                event.stopPropagation();
                void playTrack(String(track.ratingKey));
              }}
              aria-label={`Play ${track.title}`}
            >
              <HugeiconsIcon icon={PlayIcon} className="fill-inherit w-8" />
            </button>
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
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={async (event) => {
                event.stopPropagation();
                await window.api.player.queueTrack(String(track.ratingKey));
                invalidatePlayerQueries();
              }}
              aria-label={`Queue ${track.title}`}
            >
              <HugeiconsIcon icon={PlusSignIcon} />
            </button>
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(event) => event.stopPropagation()}
            >
              <HugeiconsIcon icon={FavouriteIcon} />
            </button>
            <div className="text-sm w-16 text-right">
              {dayjs.duration(track.duration).format("m:ss")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
