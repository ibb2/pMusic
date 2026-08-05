import type { LyricsLine } from "../../shared/types";

const TIMESTAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/;
const MAX_LYRICS_END_OVERFLOW_MS = 10_000;

export type ParsedLyrics = {
  format: "plain" | "lrc";
  lines: LyricsLine[];
};

export type LyricsCandidate = {
  text: string;
  parsed: ParsedLyrics;
};

export function parseLyrics(input: string): ParsedLyrics {
  const normalized = input
    .replace(/^\uFEFF/, "")
    .replaceAll("\r\n", "\n")
    .trim();
  if (!normalized) return { format: "plain", lines: [] };

  const lines: LyricsLine[] = [];
  let timed = false;
  for (const sourceLine of normalized.split("\n")) {
    const matches = [...sourceLine.matchAll(new RegExp(TIMESTAMP.source, "g"))];
    if (!matches.length) {
      if (/^\[[a-z]+:/i.test(sourceLine.trim())) continue;
      if (sourceLine.trim()) {
        lines.push({ text: sourceLine.trim(), startTimeMs: null });
      }
      continue;
    }

    timed = true;
    const text = sourceLine
      .replace(new RegExp(TIMESTAMP.source, "g"), "")
      .trim();
    for (const match of matches) {
      const fraction = match[3] || "0";
      const fractionMs = Number(fraction.padEnd(3, "0").slice(0, 3));
      lines.push({
        text,
        startTimeMs:
          (Number(match[1]) * 60 + Number(match[2])) * 1000 + fractionMs,
      });
    }
  }

  if (timed) {
    lines.sort((a, b) => (a.startTimeMs ?? 0) - (b.startTimeMs ?? 0));
  }
  return { format: timed ? "lrc" : "plain", lines };
}

export function findLyricsStreamKeys(metadata: Record<string, any>): string[] {
  const streams = (metadata.Media || []).flatMap((media: Record<string, any>) =>
    (media.Part || []).flatMap(
      (part: Record<string, any>) => part.Stream || [],
    ),
  );
  return streams
    .filter(
      (candidate: Record<string, any>) =>
        Number(candidate.streamType) === 4 &&
        typeof candidate.key === "string" &&
        candidate.key,
    )
    .map((candidate: Record<string, any>) => candidate.key);
}

export function findLyricsStreamKey(
  metadata: Record<string, any>,
): string | null {
  return findLyricsStreamKeys(metadata)[0] || null;
}

export function selectLyricsCandidate(
  candidates: LyricsCandidate[],
  trackDurationMs: number | null | undefined,
): LyricsCandidate | null {
  const usable = candidates.filter(
    (candidate) => candidate.parsed.lines.length,
  );
  if (!usable.length) return null;

  if (!trackDurationMs || !Number.isFinite(trackDurationMs)) {
    return usable[0] || null;
  }

  const timed = usable.filter((candidate) => candidate.parsed.format === "lrc");
  if (!timed.length) return usable[0] || null;

  const durationMatched = timed.find(
    (candidate) =>
      lastTimestampMs(candidate.parsed.lines) <=
      trackDurationMs + MAX_LYRICS_END_OVERFLOW_MS,
  );
  if (durationMatched) return durationMatched;

  // Do not show a clearly incompatible timed lyric source when Plex also
  // returned an untimed fallback. A wrong release is worse than no sync.
  return (
    usable.find((candidate) => candidate.parsed.format === "plain") || null
  );
}

function lastTimestampMs(lines: LyricsLine[]): number {
  return lines.reduce(
    (latest, line) => Math.max(latest, line.startTimeMs ?? 0),
    0,
  );
}
