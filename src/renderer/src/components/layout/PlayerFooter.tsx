import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  Volume1,
  Volume,
  VolumeX,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Progress } from "../ui/progress";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  NextIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  Repeat1,
  RepeatIcon,
  ShuffleIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMute01Icon,
  VolumeMute02Icon,
} from "@hugeicons/core-free-icons";

export function PlayerFooter() {
  const { data: status, refetch } = useQuery({
    queryKey: ["playerStatus"],
    queryFn: () => window.api.player.getStatus(),
    refetchInterval: 1000,
  });

  const [position, setPosition] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [mute, toggleMute] = useState(false);

  useEffect(() => {
    // Reset position immediately when the track changes to avoid showing old progress
    setPosition(0);
  }, [status?.current_track?.ratingKey]);

  useEffect(() => {
    if (status?.position !== undefined && status.duration > 0 && !isSeeking) {
      setPosition(status.position);
    }
  }, [status?.position, status?.duration, isSeeking]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    // Only run optimistic timer if we are playing AND we have a valid duration
    // This avoids progressing before the track is actually loaded and ready
    if (status?.is_playing && status?.duration && status.duration > 0) {
      interval = setInterval(() => {
        setPosition((prev) => Math.min(prev + 0.1, status.duration));
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status?.is_playing, status?.duration]);

  const handlePlayPause = async () => {
    if (status?.is_playing) {
      await window.api.player.pause();
    } else {
      await window.api.player.play();
    }
    refetch();
  };

  const handleNext = async () => {
    await window.api.player.next();
    refetch();
  };

  const handlePrev = async () => {
    await window.api.player.prev();
    refetch();
  };

  const handleSeek = async (pos: number) => {
    const duration = status?.duration || 0;
    const nextPosition =
      duration > 0 ? Math.max(0, Math.min(pos, duration)) : Math.max(0, pos);
    await window.api.player.seek(nextPosition);
    setPosition(nextPosition);
    setIsSeeking(false);
    refetch();
  };

  const handleVolume = async (newVolume: number) => {
    await window.api.player.setVolume(newVolume);
    refetch();
  };

  const handleMute = async () => {
    await window.api.player.setMuted(!mute);
    toggleMute(!mute);
    refetch();
  };

  const currentTrack = status?.current_track;
  const volume = status?.volume ?? 1;

  return (
    <div className="grid grid-cols-[minmax(auto,0.5fr)_1fr_minmax(auto,0.5fr)] p-2">
      {/* Now Playing Info */}
      <div className="flex flex-row items-center gap-2">
        <div className="h-14 w-14 rounded-md flex items-center justify-center overflow-hidden">
          {currentTrack?.thumb && (
            <img
              src={currentTrack.thumb}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="flex flex-col ">
          {currentTrack?.albumRatingKey && (
            <Link
              to={`/app/album/$ratingKey`}
              params={{ ratingKey: currentTrack.albumRatingKey }}
              className="text-sm font-semibold hover:underline cursor-pointer truncate max-w-32"
            >
              <span>{currentTrack?.title || ""}</span>
            </Link>
          )}
          {currentTrack?.artistRatingKey && (
            <Link
              to={`/app/artist/$ratingKey`}
              params={{ ratingKey: currentTrack.artistRatingKey }}
              className="text-xs text-muted-foreground hover:underline cursor-pointer truncate max-w-32"
            >
              <span>{currentTrack?.artist || ""}</span>
            </Link>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col justify-center items-center w-full">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={ShuffleIcon} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={handlePrev}
          >
            <HugeiconsIcon icon={PreviousIcon} className="fill-current" />
          </Button>
          <Button
            size="icon-lg"
            className="rounded-full"
            onClick={handlePlayPause}
          >
            {status?.is_playing ? (
              <HugeiconsIcon icon={PauseIcon} className="fill-current" />
            ) : (
              <HugeiconsIcon icon={PlayIcon} className="fill-current" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={handleNext}
          >
            <HugeiconsIcon icon={NextIcon} className="fill-current" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={RepeatIcon} />
          </Button>
        </div>
        <div className="w-full max-w-sm flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-8">
            {dayjs.duration(position * 1000).format("m:ss")}
          </span>
          <div className="group relative w-full h-6 flex items-center">
            {/* Progress (default visible) */}
            <Progress
              value={position}
              max={status?.duration || 100}
              className="w-full transition-opacity duration-150 group-hover:opacity-0"
            />

            {/* Slider (visible on hover) */}
            <div className="absolute inset-0 flex items-center opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto">
              <Slider
                value={position}
                min={0}
                max={status?.duration || 100}
                step={0.1}
                disabled={!currentTrack || !status?.duration}
                onValueChange={(pos) => {
                  setIsSeeking(true);
                  setPosition(pos as number);
                }}
                onValueCommitted={(pos) => {
                  handleSeek(pos as number);
                }}
                className="w-full"
              />
            </div>
          </div>
          <span className="w-8">
            {status?.duration
              ? dayjs.duration(status.duration * 1000).format("m:ss")
              : "0:00"}
          </span>
        </div>
      </div>

      {/* Volume & Extra Controls */}
      <div className="flex flex-row items-center justify-end gap-2">
        {/*<Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Mic2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <ListMusic className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Laptop2 className="h-4 w-4" />
        </Button>*/}
        <div className="flex items-center gap-x-1 w-32">
          <div>
            {volume === 0 ? (
              <Button variant={"ghost"} size={"icon"} onClick={handleMute}>
                <HugeiconsIcon
                  icon={VolumeMute02Icon}
                  className="text-muted-foreground"
                />
              </Button>
            ) : (
              <Button variant={"ghost"} size={"icon"} onClick={handleMute}>
                {volume < 0.3 ? (
                  <HugeiconsIcon
                    icon={VolumeMute01Icon}
                    className="text-muted-foreground"
                  />
                ) : volume < 0.7 ? (
                  <HugeiconsIcon
                    icon={VolumeLowIcon}
                    className="text-muted-foreground"
                  />
                ) : (
                  <HugeiconsIcon
                    icon={VolumeHighIcon}
                    className="text-muted-foreground"
                  />
                )}
              </Button>
            )}
          </div>
          <>
            <Slider
              defaultValue={[volume]}
              max={1}
              step={1 / 100}
              onValueCommitted={(value) => {
                handleVolume(value as number);
              }}
              className="mx-auto w-full max-w-xs"
            />
          </>
        </div>
      </div>
    </div>
  );
}
