import { describe, expect, test } from "bun:test";
import {
  findLyricsStreamKey,
  findLyricsStreamKeys,
  parseLyrics,
  selectLyricsCandidate,
} from "./lyrics";

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
  test("returns all Plex lyric streams in server order", () => {
    expect(
      findLyricsStreamKeys({
        Media: [
          {
            Part: [
              {
                Stream: [
                  { streamType: 2, key: "/audio" },
                  { streamType: 4, key: "/lyrics/first" },
                  { streamType: "4", key: "/lyrics/second" },
                ],
              },
            ],
          },
        ],
      }),
    ).toEqual(["/lyrics/first", "/lyrics/second"]);
  });

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

describe("selectLyricsCandidate", () => {
  test("prefers a timed lyric source that fits the track duration", () => {
    const wrong = parseLyrics(
      "[00:01.00]Wrong release\n[05:01.00]Wrong release",
    );
    const correct = parseLyrics(
      "[00:01.00]Correct release\n[03:20.00]Correct release",
    );

    expect(
      selectLyricsCandidate(
        [
          { text: "wrong", parsed: wrong },
          { text: "correct", parsed: correct },
        ],
        214_515,
      )?.text,
    ).toBe("correct");
  });

  test("rejects timed sources that clearly outlive the track", () => {
    const wrong = parseLyrics("[05:01.00]Wrong release");

    expect(
      selectLyricsCandidate([{ text: "wrong", parsed: wrong }], 214_515),
    ).toBeNull();
  });
});
