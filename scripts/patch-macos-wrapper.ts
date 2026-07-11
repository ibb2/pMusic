import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

if (process.platform !== "darwin") {
  process.exit(0);
}

const wrapperBundlePath = process.env.ELECTROBUN_WRAPPER_BUNDLE_PATH;
const buildDirectory = process.env.ELECTROBUN_BUILD_DIR;
const signingIdentity = process.env.ELECTROBUN_DEVELOPER_ID;

if (!wrapperBundlePath || !buildDirectory || !signingIdentity) {
  throw new Error(
    "The Electrobun wrapper path, build directory, and signing identity are required",
  );
}

const description =
  "Rayna connects to Plex Media Servers on your local network.";
const resourcesDirectory = join(wrapperBundlePath, "Contents", "Resources");
const embeddedArchiveName = readdirSync(resourcesDirectory).find((name) =>
  name.endsWith(".tar.zst"),
);
const standaloneArchiveName = readdirSync(buildDirectory).find((name) =>
  name.endsWith(".app.tar.zst"),
);

if (!embeddedArchiveName || !standaloneArchiveName) {
  throw new Error("Could not locate the packaged Rayna application archive");
}

const standaloneArchivePath = join(buildDirectory, standaloneArchiveName);
patchApplicationArchive(standaloneArchivePath);
copyFileSync(
  standaloneArchivePath,
  join(resourcesDirectory, embeddedArchiveName),
);
setLocalNetworkDescription(
  join(wrapperBundlePath, "Contents", "Info.plist"),
);

function patchApplicationArchive(archivePath: string): void {
  const workingDirectory = mkdtempSync(join(tmpdir(), "rayna-package-"));
  const tarPath = join(workingDirectory, "Rayna.app.tar");
  const zstd = resolve("node_modules/electrobun/dist-macos-arm64/zig-zstd");

  try {
    run(zstd, ["decompress", "-i", archivePath, "-o", tarPath, "--no-timing"]);
    run("tar", ["-xf", tarPath, "-C", workingDirectory]);

    const applicationName = readdirSync(workingDirectory).find((name) =>
      name.endsWith(".app"),
    );

    if (!applicationName) {
      throw new Error("The packaged Rayna application was not found");
    }

    const applicationPath = join(workingDirectory, applicationName);
    setLocalNetworkDescription(
      join(applicationPath, "Contents", "Info.plist"),
    );
    run("codesign", [
      "--force",
      "--options",
      "runtime",
      "--entitlements",
      join(buildDirectory!, "entitlements.plist"),
      "--sign",
      signingIdentity!,
      applicationPath,
    ]);
    run("tar", [
      "-cf",
      tarPath,
      "-C",
      workingDirectory,
      basename(applicationPath),
    ]);
    run(zstd, [
      "compress",
      "-i",
      tarPath,
      "-o",
      archivePath,
      "-l",
      "6",
      "--no-timing",
    ]);
  } finally {
    rmSync(workingDirectory, { recursive: true, force: true });
  }
}

function setLocalNetworkDescription(infoPlistPath: string): void {
  const result = spawnSync(
    "/usr/libexec/PlistBuddy",
    [
      "-c",
      `Add :NSLocalNetworkUsageDescription string ${description}`,
      infoPlistPath,
    ],
    { stdio: "ignore" },
  );

  if (result.status !== 0) {
    run("/usr/libexec/PlistBuddy", [
      "-c",
      `Set :NSLocalNetworkUsageDescription ${description}`,
      infoPlistPath,
    ]);
  }
}

function run(command: string, arguments_: string[]): void {
  const result = spawnSync(command, arguments_, { stdio: "inherit" });

  if (result.status !== 0) {
    throw new Error(`${command} failed with status ${result.status ?? "unknown"}`);
  }
}
