import { useQuery } from "@tanstack/react-query";
import type { PlayerStatus } from "../../../../shared/rpc";

export function LyricsPanel({ status }: { status: PlayerStatus | undefined }) {
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

  const { lyrics } = query.data;
  const positionMs = (status?.position || 0) * 1000;
  const timedLines = lyrics.lines.filter((line) => line.startTimeMs !== null);
  let activeTime: number | null = null;
  for (const line of timedLines) {
    if ((line.startTimeMs ?? Infinity) <= positionMs)
      activeTime = line.startTimeMs;
    else break;
  }

  return (
    <section
      aria-label="Lyrics"
      className="absolute bottom-full right-2 z-50 mb-2 flex h-96 w-[min(28rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl"
    >
      <header className="border-b px-4 py-3">
        <h2 className="font-semibold">Lyrics</h2>
        <p className="truncate text-xs text-muted-foreground">
          {status?.current_track?.title}
        </p>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {lyrics.lines.map((line, index) => {
          const active =
            lyrics.format === "lrc" && line.startTimeMs === activeTime;
          return (
            <p
              key={`${line.startTimeMs ?? "plain"}-${index}`}
              className={
                active
                  ? "text-base font-semibold text-foreground"
                  : "text-sm text-muted-foreground"
              }
            >
              {line.text || "♪"}
            </p>
          );
        })}
      </div>
      {lyrics.freshness === "stale" && (
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
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
      className="absolute bottom-full right-2 z-50 mb-2 flex h-48 w-[min(28rem,calc(100vw-1rem))] items-center justify-center rounded-xl border bg-popover p-6 text-center text-sm text-muted-foreground shadow-xl"
    >
      {children}
    </section>
  );
}
