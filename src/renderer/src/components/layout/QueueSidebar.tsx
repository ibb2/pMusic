import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Cancel01Icon, MusicNote03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { PlayerTrack } from "../../../../shared/rpc";

const DEFAULT_QUEUE_WIDTH = "18rem";
const MIN_QUEUE_WIDTH = "16rem";
const MAX_QUEUE_WIDTH = "24rem";

function remToPixels(rem: string) {
  const rootFontSize = Number.parseFloat(
    window.getComputedStyle(document.documentElement).fontSize,
  );
  return Number.parseFloat(rem) * rootFontSize;
}

type QueueSidebarProps = {
  open: boolean;
};

export function QueueSidebar({ open }: QueueSidebarProps) {
  const queryClient = useQueryClient();
  const [width, setWidth] = useState(remToPixels(DEFAULT_QUEUE_WIDTH));
  const [isResizing, setIsResizing] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const { data: queue } = useQuery({
    queryKey: ["playerQueue"],
    queryFn: () => window.api.player.getQueue(),
    refetchInterval: 1000,
    enabled: open,
  });

  const currentTrack = queue?.current_track ?? null;
  const queuedTracks = queue?.tracks ?? [];

  const handleClearQueue = async () => {
    await window.api.player.clearQueue();
    queryClient.invalidateQueries({ queryKey: ["playerQueue"] });
    queryClient.invalidateQueries({ queryKey: ["playerStatus"] });
  };

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsResizing(true);
      const startX = event.clientX;
      const startWidth = width;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      let nextWidth = startWidth;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const applyWidth = () => {
        asideRef.current?.style.setProperty("width", `${nextWidth}px`);
        contentRef.current?.style.setProperty("width", `${nextWidth}px`);
        frameRef.current = null;
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        nextWidth = Math.max(
          remToPixels(MIN_QUEUE_WIDTH),
          Math.min(
            remToPixels(MAX_QUEUE_WIDTH),
            startWidth + startX - moveEvent.clientX,
          ),
        );
        if (frameRef.current === null) {
          frameRef.current = window.requestAnimationFrame(applyWidth);
        }
      };

      const handlePointerUp = () => {
        if (frameRef.current !== null) {
          window.cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        applyWidth();
        setWidth(nextWidth);
        setIsResizing(false);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [width],
  );

  return (
    <aside
      ref={asideRef}
      className={cn(
        "relative z-10 h-full min-h-0 shrink-0 overflow-hidden bg-sidebar text-sidebar-foreground",
        !isResizing && "transition-[width,opacity] duration-200",
        open ? "opacity-100" : "w-0 opacity-0",
      )}
      style={{ width: open ? width : 0 }}
      aria-hidden={!open}
    >
      <div
        className="absolute inset-y-3 left-0 z-10 w-2 cursor-col-resize rounded-full bg-transparent transition-colors hover:bg-sidebar-accent"
        onPointerDown={handleResizeStart}
        aria-label="Resize queue"
        role="separator"
      />
      <div
        ref={contentRef}
        className="flex h-full min-h-0 flex-col"
        style={{ width }}
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">Queue</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {queuedTracks.length} up next
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleClearQueue}
            disabled={queuedTracks.length === 0}
            aria-label="Clear queue"
          >
            <HugeiconsIcon icon={Cancel01Icon} />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2">
          {currentTrack ? (
            <section className="mb-7">
              <h3 className="mb-3 px-2 text-xs font-medium uppercase text-muted-foreground">
                Now Playing
              </h3>
              <QueueTrackRow track={currentTrack} active />
            </section>
          ) : null}

          <section>
            <h3 className="mb-3 px-2 text-xs font-medium uppercase text-muted-foreground">
              Up Next
            </h3>
            {queuedTracks.length > 0 ? (
              <div className="space-y-1">
                {queuedTracks.map((track, index) => (
                  <QueueTrackRow
                    key={`${track.ratingKey}-${index}`}
                    track={track}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-16 items-center gap-2 px-2 text-sm text-muted-foreground">
                <HugeiconsIcon icon={MusicNote03Icon} className="shrink-0" />
                <span>No tracks queued</span>
              </div>
            )}
          </section>
        </div>
      </div>
    </aside>
  );
}

function QueueTrackRow({
  track,
  active = false,
}: {
  track: PlayerTrack;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-md px-2 py-2 transition-colors",
        active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/70",
      )}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {track.thumb ? (
          <img
            src={track.thumb}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <HugeiconsIcon
            icon={MusicNote03Icon}
            className="text-muted-foreground"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{track.title}</div>
        <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          {track.artistRatingKey ? (
            <Link
              to="/app/artist/$ratingKey"
              params={{ ratingKey: track.artistRatingKey }}
              className="truncate hover:text-foreground hover:underline"
            >
              {track.artist || "Unknown artist"}
            </Link>
          ) : (
            <span className="truncate">{track.artist || "Unknown artist"}</span>
          )}
          <span className="shrink-0">-</span>
          {track.albumRatingKey ? (
            <Link
              to="/app/album/$ratingKey"
              params={{ ratingKey: track.albumRatingKey }}
              className="truncate hover:text-foreground hover:underline"
            >
              {track.album || "Unknown album"}
            </Link>
          ) : (
            <span className="truncate">{track.album || "Unknown album"}</span>
          )}
        </div>
      </div>
      <div className="shrink-0 self-center text-xs text-muted-foreground">
        {track.duration ? dayjs.duration(track.duration).format("m:ss") : ""}
      </div>
    </div>
  );
}
