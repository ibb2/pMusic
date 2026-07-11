import { describe, expect, test } from "bun:test";
import { findLyricsStreamKey, parseLyrics } from "./lyrics";

describe("parseLyrics", () => {
  test("parses plain text and ignores blank lines", () => {
    expect(parseLyrics(" First line\r\n\r\nSecond line ")).toEqual({
      format: "plain",
      lines: [
        { text: "First line", startTimeMs: null },
        { text: "Second line", startTimeMs: null },
      ],
    });
  });

  test("parses, expands, and sorts LRC timestamps", () => {
    expect(parseLyrics("[00:12.50]Later\n[00:01:250][00:02]Hello")).toEqual({
      format: "lrc",
      lines: [
        { text: "Hello", startTimeMs: 1250 },
        { text: "Hello", startTimeMs: 2000 },
        { text: "Later", startTimeMs: 12500 },
      ],
    });
  });

  test("handles an empty document", () => {
    expect(parseLyrics("\ufeff \n")).toEqual({ format: "plain", lines: [] });
  });
});

describe("findLyricsStreamKey", () => {
  test("selects Plex text streams and ignores audio streams", () => {
    expect(
      findLyricsStreamKey({
        Media: [
          {
            Part: [
              {
                Stream: [
                  { streamType: 2, key: "/audio" },
                  { streamType: "4", key: "/library/streams/lyrics.lrc" },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe("/library/streams/lyrics.lrc");
  });

  test("returns null when Plex exposes no lyric stream", () => {
    expect(findLyricsStreamKey({ Media: [{ Part: [{}] }] })).toBeNull();
  });
});
