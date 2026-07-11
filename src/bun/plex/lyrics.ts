import type { LyricsLine } from "../../shared/types";

const TIMESTAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/;

export function parseLyrics(input: string): {
  format: "plain" | "lrc";
  lines: LyricsLine[];
} {
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

export function findLyricsStreamKey(
  metadata: Record<string, any>,
): string | null {
  const streams = (metadata.Media || []).flatMap((media: Record<string, any>) =>
    (media.Part || []).flatMap(
      (part: Record<string, any>) => part.Stream || [],
    ),
  );
  const stream = streams.find(
    (candidate: Record<string, any>) =>
      Number(candidate.streamType) === 4 &&
      typeof candidate.key === "string" &&
      candidate.key,
  );
  return stream?.key || null;
}
