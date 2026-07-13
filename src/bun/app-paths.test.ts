import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { defaultDownloadDirectory } from "./app-paths";

describe("defaultDownloadDirectory", () => {
  test("uses the Music/Rayna folder on macOS", () => {
    expect(defaultDownloadDirectory("darwin", "/Users/rayna")).toBe(
      join("/Users/rayna", "Music", "Rayna"),
    );
  });

  test("uses the Music/Rayna folder on Windows", () => {
    expect(defaultDownloadDirectory("win32", "C:\\Users\\rayna")).toBe(
      join("C:\\Users\\rayna", "Music", "Rayna"),
    );
  });
});
