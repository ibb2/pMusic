import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";

import noPlaylistCover from "../../assets/no-playlist-cover.png";
import { Spinner } from "@/components/ui/spinner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Clock01Icon,
  FavouriteIcon,
  MoreVerticalIcon,
  PlayIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { DownloadButton, downloadsApi } from "@/components/downloads";

export const Route = createFileRoute("/app/playlist/$ratingKey")({
  component: PlaylistPage,
});

function PlaylistPage() {
  const { ratingKey } = Route.useParams();
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
  const queryPlaylist = useQuery({
    queryKey: ["playlist", ratingKey],
    queryFn: () => window.api.media.getPlaylist(ratingKey),
  });

  if (queryPlaylist.isLoading)
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Spinner className="size-8" />
      </div>
    );
  if (queryPlaylist.isError)
    return "Error loading playlist" + queryPlaylist.error.message;

  const playlist = queryPlaylist.data;
  if (!playlist) {
    return (
      <div className="m-6 rounded-lg border border-dashed p-10 text-center text-muted-foreground">
        Playlist data is unavailable.
      </div>
    );
  }
  const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];

  return (
    <div className="flex min-h-full flex-col p-6 pb-10">
      {/* playlist Header */}
      <div className="flex gap-6 mb-6">
        <img
          src={playlist.composite || noPlaylistCover}
          alt={playlist.title}
          className="w-48 h-48 rounded-lg shadow-xl"
        />
        <div className="flex flex-col justify-between py-2">
          <div>
            <div className="text-slate-600 dark:text-slate-100 text-sm mb-2 uppercase">
              playlist
            </div>
            <h1 className="text-5xl font-bold mb-3">{playlist.title}</h1>
            <div>{playlist.summary}</div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span>{dayjs(playlist.addedAt).format("YYYY")}</span>
            <span>•</span>
            <span>{playlist.leafCount ?? tracks.length} tracks</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          className="rounded-full h-14 w-14"
          onClick={async () => {
            await window.api.player.playPlaylist(ratingKey);
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
            await window.api.player.queuePlaylist(ratingKey);
            invalidatePlayerQueries();
          }}
          aria-label="Queue playlist"
        >
          <HugeiconsIcon icon={PlusSignIcon} />
        </Button>
        <Button variant="ghost" size="icon">
          <HugeiconsIcon icon={MoreVerticalIcon} />
        </Button>
        <DownloadButton
          api={downloadsApi}
          target={{ type: "playlist", ratingKey, title: playlist.title }}
        />
      </div>

      {/* Track List */}
      <div className="bg-slate-300/10 rounded-lg">
        <div className="grid grid-cols-[auto_auto_1fr_auto_auto_auto] gap-4 px-4 py-2 text-sm border-b">
          <div className="w-8 text-center">#</div>
          <div></div>
          <div>Title</div>
          <div></div>
          <div></div>
          <div className="w-16 text-right">
            <HugeiconsIcon size={16} icon={Clock01Icon} className="inline" />
          </div>
        </div>

        {tracks.map((track: any, index: number) => (
          <div
            key={track.id}
            className="grid grid-cols-[auto_auto_1fr_auto_auto_auto] gap-4 px-4 py-3 rounded group hover:bg-slate-200/50 transition-colors"
          >
            <div className="text-center w-8 group-hover:hidden self-center">
              {index + 1}
            </div>
            <button
              className="hidden group-hover:block"
              onClick={(event) => {
                event.stopPropagation();
                void playTrack(String(track.ratingKey));
              }}
              aria-label={`Play ${track.title}`}
            >
              <HugeiconsIcon icon={PlayIcon} className="fill-inherit w-8" />
            </button>
            <img
              src={track.albumThumb}
              alt={track.albumTitle}
              className="w-12 rounded-lg"
            />
            <div>
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
              <div className="flex flex-row items-center gap-2">
                <Link
                  to={"/app/artist/$ratingKey"}
                  params={{ ratingKey: track.artistRatingKey }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="text-slate-400 text-sm hover:text-slate-700/50 hover:underline">
                    {track.artistTitle}
                  </div>
                </Link>
                <div className="pb-1 text-slate-400 ">{"  -  "}</div>
                <Link
                  to={"/app/album/$ratingKey"}
                  params={{ ratingKey: track.albumRatingKey }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="text-slate-400 text-sm hover:text-slate-700/50 hover:underline">
                    {track.albumTitle}
                  </div>
                </Link>
              </div>
            </div>
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
            <div className="text-zinc-400 text-sm text-right self-center">
              {dayjs.duration(track.duration).format("m:ss")}
            </div>
          </div>
        ))}
        {tracks.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            This smart playlist currently has no available tracks.
          </div>
        ) : null}
      </div>
    </div>
  );
}
