import { homedir } from "node:os";
import { join } from "node:path";

/** Default location for user-managed offline media. */
export function defaultDownloadDirectory(
  platform = process.platform,
  homeDirectory = homedir(),
): string {
  if (platform === "darwin" || platform === "win32")
    return join(homeDirectory, "Music", "Rayna");

  return join(homeDirectory, ".rayna", "downloads");
}
