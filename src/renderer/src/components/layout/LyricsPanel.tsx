import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import type { PlayerStatus } from "../../../../shared/rpc";
import type { TrackLyrics } from "../../../../shared/types";

export function LyricsPanel() {
  const { data: status } = useQuery({
    queryKey: ["playerStatus"],
    queryFn: () => window.api.player.getStatus(),
    refetchInterval: 1000,
  });
  const ratingKey = status?.current_track?.ratingKey;
  const query = useQuery({
    queryKey: ["trackLyrics", ratingKey],
    queryFn: () => window.api.media.getLyrics(ratingKey!),
    enabled: Boolean(ratingKey),
    retry: 1,
  });

  if (!ratingKey)
    return <PanelMessage>Select a track to view lyrics.</PanelMessage>;
  if (query.isPending) return <PanelMessage>Loading lyrics…</PanelMessage>;
  if (query.isError)
    return <PanelMessage>Lyrics could not be loaded.</PanelMessage>;
  if (!query.data || query.data.status === "unavailable") {
    return (
      <PanelMessage>
        {query.data?.reason === "offline-not-cached"
          ? "Lyrics are not cached for offline use."
          : "No lyrics are available for this track."}
      </PanelMessage>
    );
  }

  return <AvailableLyrics status={status} lyrics={query.data.lyrics} />;
}

function AvailableLyrics({
  status,
  lyrics,
}: {
  status: PlayerStatus;
  lyrics: TrackLyrics;
}) {
  const positionMs = (status?.position || 0) * 1000;
  const activeIndex = useMemo(() => {
    if (lyrics.format !== "lrc") return -1;
    let current = -1;
    lyrics.lines.forEach((line, index) => {
      if (line.startTimeMs !== null && line.startTimeMs <= positionMs) {
        current = index;
      }
    });
    return current;
  }, [lyrics, positionMs]);
  const activeLineRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    activeLineRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeIndex]);

  return (
    <section
      aria-label="Lyrics"
      className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-6 pb-24 pt-8 sm:px-10 lg:px-16"
    >
      <header className="mb-8 shrink-0">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Lyrics
        </p>
        <h1 className="mt-2 truncate text-2xl font-bold">
          {status.current_track?.title}
        </h1>
        <p className="truncate text-sm text-muted-foreground">
          {status.current_track?.artist}
        </p>
      </header>
      <div className="space-y-4 sm:space-y-5">
        {lyrics.lines.map((line, index) => {
          const active = index === activeIndex;
          return (
            <p
              key={`${line.startTimeMs ?? "plain"}-${index}`}
              ref={active ? activeLineRef : undefined}
              className={`max-w-4xl text-3xl font-bold leading-tight transition-all duration-300 sm:text-4xl lg:text-5xl lg:leading-tight ${
                lyrics.format === "lrc"
                  ? active
                    ? "text-foreground opacity-100"
                    : index < activeIndex
                      ? "text-foreground/30"
                      : "text-foreground/55"
                  : "text-foreground/85"
              }`}
            >
              {line.text || "♪"}
            </p>
          );
        })}
      </div>
      {lyrics.freshness === "stale" && (
        <p className="mt-10 text-xs text-muted-foreground">
          Showing cached lyrics while offline
        </p>
      )}
    </section>
  );
}

function PanelMessage({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="Lyrics"
      className="flex min-h-full items-center justify-center p-8 text-center text-sm text-muted-foreground"
    >
      {children}
    </section>
  );
}
