import {
  createWriteStream,
  copyFileSync,
  constants,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { basename, extname, join, resolve, sep } from "node:path";
import { once } from "node:events";
import type {
  DownloadActivity,
  DownloadedStatus,
  DownloadItem,
  DownloadTargetType,
  OfflineStorageStatus,
} from "../shared/types";
import type { DatabaseManager, DownloadRecord } from "./database";

export type ResolvedDownloadTrack = {
  ratingKey: string;
  title: string;
  artist: string;
  album: string;
  artistRatingKey?: string | null;
  albumRatingKey?: string | null;
  duration?: number | null;
  thumb?: string | null;
  /** An authenticated URL for the original Plex media part (not a transcode). */
  url: string;
  headers?: Record<string, string>;
  /** Ordered authenticated alternatives for the same original media part. */
  candidates?: Array<{ url: string; headers?: Record<string, string> }>;
  fileName?: string;
};

/** Keeps Plex-specific expansion outside the download/file-system layer. */
export interface DownloadMediaResolver {
  resolveTracks(input: {
    serverId: string;
    targetType: DownloadTargetType;
    ratingKey: string;
  }): Promise<ResolvedDownloadTrack[]>;
}

export type DownloadManagerOptions = {
  database: DatabaseManager;
  resolver: DownloadMediaResolver;
  storageDirectory: string;
  fetch?: DownloadFetcher;
};

export type DownloadFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type DownloadMetadata = {
  targetType: DownloadTargetType;
  targetRatingKey: string;
  artist: string;
  album: string;
  artistRatingKey?: string | null;
  albumRatingKey?: string | null;
  duration?: number | null;
  thumb?: string | null;
  targetTitle?: string;
  url: string;
  headers?: Record<string, string>;
  candidates?: Array<{ url: string; headers?: Record<string, string> }>;
  completedAt?: number;
  activityClearedAt?: number;
};

export class DownloadManager {
  private readonly database: DatabaseManager;
  private readonly resolver: DownloadMediaResolver;
  private storageDirectory: string;
  private readonly fetcher: DownloadFetcher;
  private readonly active = new Map<string, AbortController>();
  private readonly pending = new Set<string>();
  private readonly maxConcurrent = 3;

  constructor(options: DownloadManagerOptions) {
    this.database = options.database;
    this.resolver = options.resolver;
    this.storageDirectory = resolve(
      (this.database.get("downloads.storageDirectory") as string | null) ??
        options.storageDirectory,
    );
    this.fetcher = options.fetch ?? globalThis.fetch;
    mkdirSync(this.storageDirectory, { recursive: true });
    // Network work cannot survive a process restart. Keep partial files and
    // expose every interrupted item as explicitly resumable.
    for (const record of this.database.listDownloadsAll()) {
      if (record.status === "queued" || record.status === "downloading")
        this.database.upsertDownload({
          ...record,
          status: "paused",
          error: null,
        });
    }
  }

  async enqueue(
    serverId: string,
    targetType: DownloadTargetType,
    ratingKey: string,
    targetTitle?: string,
  ): Promise<DownloadItem[]> {
    const existing = this.database.listDownloads(serverId).filter((record) => {
      const metadata = record.metadata as DownloadMetadata;
      return (
        metadata.targetType === targetType &&
        metadata.targetRatingKey === ratingKey
      );
    });
    if (existing.length > 0)
      return existing.map((record) => this.toItem(record));
    const tracks = await this.resolver.resolveTracks({
      serverId,
      targetType,
      ratingKey,
    });
    const records = tracks.map((track) => {
      const id = crypto.randomUUID();
      const extension = safeExtension(
        track.fileName ?? new URL(track.url).pathname,
      );
      const name = `${safeSegment(track.title)}-${safeSegment(track.ratingKey)}${extension}`;
      const directory = join(this.storageDirectory, safeSegment(serverId));
      mkdirSync(directory, { recursive: true });
      const filePath = join(directory, name);
      const record = this.database.upsertDownload({
        id,
        serverId,
        ratingKey: track.ratingKey,
        mediaType: targetType,
        title: track.title,
        filePath,
        partialPath: `${filePath}.partial`,
        status: "queued",
        bytesDownloaded: 0,
        totalBytes: null,
        error: null,
        metadata: {
          targetType,
          targetRatingKey: ratingKey,
          artist: track.artist,
          album: track.album,
          artistRatingKey: track.artistRatingKey,
          albumRatingKey: track.albumRatingKey,
          duration: track.duration,
          thumb: track.thumb,
          targetTitle: targetTitle?.trim() || undefined,
          url: track.url,
          headers: track.headers,
          candidates: track.candidates,
        } satisfies DownloadMetadata,
      });
      return record;
    });
    for (const record of records) {
      this.start(record.id);
    }
    return records.map((record) => this.toItem(record));
  }

  async retry(id: string): Promise<DownloadItem> {
    let record = this.requireRecord(id);
    if (record.status === "completed") return this.toItem(record);
    record = await this.refreshCandidates(record);
    const queued = this.database.upsertDownload({
      ...record,
      status: "queued",
      error: null,
    });
    this.start(id);
    return this.toItem(queued);
  }

  pause(id: string): DownloadItem {
    const record = this.requireRecord(id);
    if (record.status === "completed" || record.status === "paused")
      return this.toItem(record);
    this.pending.delete(id);
    this.active.get(id)?.abort();
    return this.toItem(
      this.database.upsertDownload({
        ...record,
        status: "paused",
        error: null,
      }),
    );
  }

  async resume(id: string): Promise<DownloadItem> {
    let record = this.requireRecord(id);
    if (record.status !== "paused" && record.status !== "failed")
      return this.toItem(record);
    record = await this.refreshCandidates(record);
    const queued = this.database.upsertDownload({
      ...record,
      status: "queued",
      error: null,
    });
    this.start(id);
    return this.toItem(queued);
  }

  cancel(id: string): DownloadItem {
    return this.pause(id);
  }

  remove(id: string): void {
    const record = this.requireRecord(id);
    this.active.get(id)?.abort();
    this.pending.delete(id);
    for (const path of [record.filePath, record.partialPath]) {
      if (path && this.isManagedPath(path)) rmSync(path, { force: true });
    }
    this.active.delete(id);
    this.database.deleteDownload(id);
  }

  list(serverId: string): DownloadItem[] {
    return this.database
      .listDownloads(serverId)
      .map((record) => this.toItem(record));
  }

  activity(serverId: string): DownloadActivity {
    const items = this.database
      .listDownloads(serverId)
      .filter((record) => {
        const metadata = record.metadata as DownloadMetadata;
        return (
          record.status === "queued" ||
          record.status === "downloading" ||
          record.status === "paused" ||
          !metadata.activityClearedAt
        );
      })
      .map((record) => this.toItem(record));
    return {
      items,
      activeCount: items.filter((item) =>
        ["queued", "downloading", "paused"].includes(item.state),
      ).length,
      failedCount: items.filter((item) => item.state === "failed").length,
    };
  }

  clearActivity(serverId: string, ids?: string[]): void {
    for (const record of this.database.listDownloads(serverId)) {
      if (ids && !ids.includes(record.id)) continue;
      if (record.status !== "completed" && record.status !== "failed") continue;
      this.database.upsertDownload({
        ...record,
        metadata: {
          ...(record.metadata as DownloadMetadata),
          activityClearedAt: Date.now(),
        },
      });
    }
  }

  statuses(
    serverId: string,
    targets: Array<{ targetType: DownloadTargetType; ratingKey: string }>,
  ): DownloadedStatus[] {
    const records = this.database.listDownloads(serverId);
    return targets.map((target) => {
      const matching = records.filter((record) => {
        const metadata = record.metadata as DownloadMetadata;
        if (target.targetType === "track") {
          return record.ratingKey === target.ratingKey;
        }
        return (
          metadata.targetType === target.targetType &&
          metadata.targetRatingKey === target.ratingKey
        );
      });
      const completedTracks = matching.filter(
        (record) => record.status === "completed",
      ).length;
      const active = matching.find(
        (record) => record.status !== "completed" && record.status !== "failed",
      );
      return {
        ...target,
        state:
          target.targetType === "track" && completedTracks > 0
            ? "downloaded"
            : matching.length === 0 || (completedTracks === 0 && !active)
              ? "not-downloaded"
              : completedTracks === matching.length
                ? "downloaded"
                : "partial",
        activeState:
          active?.status === "queued" ||
          active?.status === "downloading" ||
          active?.status === "paused"
            ? active.status
            : null,
        completedTracks,
        totalTracks: matching.length,
      };
    });
  }

  async setStorageDirectory(directory: string): Promise<OfflineStorageStatus> {
    const next = resolve(directory.trim());
    if (!directory.trim()) throw new Error("Choose a download directory");
    if (next === this.storageDirectory) return this.storageStatus("");
    const resumableIds: string[] = [];
    for (const record of this.database.listDownloadsAll()) {
      if (record.status === "queued" || record.status === "downloading")
        resumableIds.push(record.id);
      if (record.status === "queued" || record.status === "downloading")
        this.pause(record.id);
    }
    while (this.active.size > 0)
      await new Promise((resolve) => setTimeout(resolve, 10));
    mkdirSync(next, { recursive: true });
    const previous = this.storageDirectory;
    const records = this.database.listDownloadsAll();
    const destinationFor = (record: DownloadRecord, path: string | null) => {
      if (!path || !resolve(path).startsWith(`${previous}${sep}`)) return path;
      return join(next, safeSegment(record.serverId), basename(path));
    };
    const relocations = records.map((record) => ({
      id: record.id,
      filePath: destinationFor(record, record.filePath),
      partialPath: destinationFor(record, record.partialPath),
    }));
    const copiedPaths = new Set<string>();
    try {
      for (let index = 0; index < records.length; index += 1) {
        const record = records[index];
        const relocation = relocations[index];
        mkdirSync(join(next, safeSegment(record.serverId)), {
          recursive: true,
        });
        for (const [source, destination] of [
          [record.filePath, relocation.filePath],
          [record.partialPath, relocation.partialPath],
        ] as const) {
          if (
            source &&
            destination &&
            source !== destination &&
            existsSync(source)
          ) {
            copyFileSync(source, destination, constants.COPYFILE_EXCL);
            copiedPaths.add(destination);
          }
        }
      }
      this.database.relocateDownloads(relocations, next);
    } catch (error) {
      for (const path of copiedPaths) rmSync(path, { force: true });
      for (const id of resumableIds) void this.resume(id);
      throw error;
    }
    for (const record of records) {
      for (const path of [record.filePath, record.partialPath]) {
        if (path && resolve(path).startsWith(`${previous}${sep}`))
          rmSync(path, { force: true });
      }
    }
    this.storageDirectory = next;
    for (const id of resumableIds) void this.resume(id);
    return this.storageStatus("");
  }

  storageStatus(serverId: string): OfflineStorageStatus {
    const records = serverId
      ? this.database.listDownloads(serverId)
      : this.database.listDownloadsAll();
    let completedBytes = 0;
    let partialBytes = 0;
    for (const record of records) {
      completedBytes += fileSize(record.filePath);
      partialBytes += fileSize(record.partialPath);
    }
    return {
      storageDirectory: this.storageDirectory,
      usedBytes: completedBytes + partialBytes,
      completedBytes,
      partialBytes,
      downloadCount: records.length,
      completedCount: records.filter((item) => item.status === "completed")
        .length,
      failedCount: records.filter(
        (item) => item.status === "failed" && item.error !== "Download paused",
      ).length,
    };
  }

  private async run(id: string): Promise<void> {
    if (this.active.has(id)) return;
    let record = this.requireRecord(id);
    const metadata = record.metadata as DownloadMetadata;
    if (
      !record.partialPath ||
      !record.filePath ||
      !this.isManagedPath(record.partialPath) ||
      !this.isManagedPath(record.filePath)
    )
      throw new Error("Download record has an invalid managed path");
    const partialPath = record.partialPath;
    const filePath = record.filePath;
    const offset = fileSize(partialPath);
    const controller = new AbortController();
    this.active.set(id, controller);
    record = this.database.upsertDownload({
      ...record,
      status: "downloading",
      bytesDownloaded: offset,
      error: null,
    });
    try {
      const candidates = normalizeCandidates(metadata);
      let lastError: unknown = null;
      let downloaded = offset;
      let totalBytes: number | null = record.totalBytes;
      let completed = false;
      // A second pass recovers from a short-lived failure even when Plex only
      // advertises one connection. Each attempt resumes from the bytes that
      // were durably written by the previous attempt.
      for (let pass = 0; pass < 2 && !completed; pass += 1) {
        for (const candidate of candidates) {
          if (controller.signal.aborted) throw abortError();
          const attemptOffset = fileSize(partialPath);
          const attemptController = new AbortController();
          const abortAttempt = () => attemptController.abort();
          controller.signal.addEventListener("abort", abortAttempt, {
            once: true,
          });
          try {
            const headers = new Headers(candidate.headers);
            if (attemptOffset > 0)
              headers.set("Range", `bytes=${attemptOffset}-`);
            const response = await fetchWithTimeout(
              this.fetcher,
              candidate.url,
              { headers, signal: attemptController.signal },
              attemptController,
            );
            if (!response.ok) {
              const error = new Error(
                `Download failed with HTTP ${response.status}`,
              );
              if (!isRetryableStatus(response.status)) throw error;
              lastError = error;
              continue;
            }
            const resumed = attemptOffset > 0 && response.status === 206;
            const writeOffset = resumed ? attemptOffset : 0;
            if (!response.body)
              throw new Error("Download response had no body");
            const responseBytes = numberHeader(
              response.headers.get("content-length"),
            );
            const contentRangeTotal = parseContentRangeTotal(
              response.headers.get("content-range"),
            );
            totalBytes =
              contentRangeTotal ??
              (responseBytes === null ? null : writeOffset + responseBytes);
            const stream = createWriteStream(partialPath, {
              flags: writeOffset ? "a" : "w",
            });
            const reader = response.body.getReader();
            downloaded = writeOffset;
            try {
              while (true) {
                const { done, value } = await readWithTimeout(
                  reader,
                  attemptController,
                );
                if (done) break;
                // Wait for the chunk to reach the file descriptor before
                // requesting more network data. If the socket dies, the next
                // candidate can therefore resume at the exact durable offset.
                await writeChunk(stream, value);
                downloaded += value.byteLength;
                record = this.database.upsertDownload({
                  ...record,
                  bytesDownloaded: downloaded,
                  totalBytes,
                });
              }
              stream.end();
              await once(stream, "finish");
              completed = true;
              break;
            } catch (error) {
              stream.destroy();
              throw error;
            }
          } catch (error) {
            if (controller.signal.aborted) throw error;
            lastError = error;
          } finally {
            controller.signal.removeEventListener("abort", abortAttempt);
          }
        }
      }
      if (!completed) throw lastError ?? new Error("Download failed");
      renameSync(partialPath, filePath);
      this.database.upsertDownload({
        ...record,
        partialPath: record.partialPath,
        status: "completed",
        bytesDownloaded: downloaded,
        totalBytes: totalBytes ?? downloaded,
        error: null,
        metadata: { ...metadata, completedAt: Date.now() },
      });
    } catch (error) {
      const current = this.requireRecord(id);
      this.database.upsertDownload({
        ...current,
        status: controller.signal.aborted ? "paused" : "failed",
        bytesDownloaded: fileSize(current.partialPath),
        error: controller.signal.aborted ? null : errorMessage(error),
      });
    } finally {
      this.active.delete(id);
      this.pump();
    }
  }

  private requireRecord(id: string): DownloadRecord {
    const record = this.database.getDownload(id);
    if (!record) throw new Error(`Unknown download: ${id}`);
    return record;
  }

  private async refreshCandidates(
    record: DownloadRecord,
  ): Promise<DownloadRecord> {
    const metadata = record.metadata as DownloadMetadata;
    try {
      const tracks = await this.resolver.resolveTracks({
        serverId: record.serverId,
        targetType: metadata.targetType,
        ratingKey: metadata.targetRatingKey,
      });
      const resolved = tracks.find(
        (track) => track.ratingKey === record.ratingKey,
      );
      if (!resolved) return record;
      return this.database.upsertDownload({
        ...record,
        metadata: {
          ...metadata,
          url: resolved.url,
          headers: resolved.headers,
          candidates: resolved.candidates,
          artist: resolved.artist,
          album: resolved.album,
          artistRatingKey: resolved.artistRatingKey,
          albumRatingKey: resolved.albumRatingKey,
          duration: resolved.duration,
          thumb: resolved.thumb,
        },
      });
    } catch {
      // A retry can still succeed through the persisted URL while Plex's
      // metadata endpoint is temporarily unavailable.
      return record;
    }
  }

  private isManagedPath(path: string): boolean {
    const resolved = resolve(path);
    return resolved.startsWith(`${this.storageDirectory}${sep}`);
  }

  private start(id: string): void {
    this.pending.add(id);
    this.pump();
  }

  private pump(): void {
    while (this.active.size < this.maxConcurrent && this.pending.size > 0) {
      const id = this.pending.values().next().value as string;
      this.pending.delete(id);
      const record = this.database.getDownload(id);
      if (!record || record.status !== "queued") continue;
      void this.run(id).catch((error) => {
        const current = this.database.getDownload(id);
        if (current)
          this.database.upsertDownload({
            ...current,
            status: "failed",
            error: errorMessage(error),
          });
        this.pump();
      });
    }
  }

  private toItem(record: DownloadRecord): DownloadItem {
    const metadata = record.metadata as DownloadMetadata;
    return {
      id: record.id,
      serverId: record.serverId,
      targetType: metadata.targetType ?? record.mediaType,
      targetRatingKey: metadata.targetRatingKey ?? record.ratingKey,
      trackRatingKey: record.ratingKey,
      title: record.title,
      artist: metadata.artist ?? "",
      album: metadata.album ?? "",
      targetTitle:
        metadata.targetTitle ??
        (metadata.targetType === "track"
          ? record.title
          : (metadata.album ?? record.title)),
      state: record.status,
      bytesDownloaded: record.bytesDownloaded,
      bytesTotal: record.totalBytes,
      error: record.error,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
      completedAt: metadata.completedAt
        ? new Date(metadata.completedAt).toISOString()
        : null,
    };
  }
}

const DOWNLOAD_STALL_TIMEOUT_MS = 30_000;

function normalizeCandidates(metadata: DownloadMetadata) {
  const values = metadata.candidates?.length
    ? metadata.candidates
    : [{ url: metadata.url, headers: metadata.headers }];
  return values.filter(
    (candidate, index) =>
      candidate.url &&
      values.findIndex((value) => value.url === candidate.url) === index,
  );
}

async function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  controller: AbortController,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Download stalled while waiting for data"));
        }, DOWNLOAD_STALL_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchWithTimeout(
  fetcher: DownloadFetcher,
  url: string,
  init: RequestInit,
  controller: AbortController,
): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetcher(url, init),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Download connection timed out"));
        }, DOWNLOAD_STALL_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 425 || status === 429;
}

function abortError(): Error {
  const error = new Error("Download aborted");
  error.name = "AbortError";
  return error;
}

function writeChunk(
  stream: ReturnType<typeof createWriteStream>,
  value: Uint8Array,
): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(value, (error) => (error ? reject(error) : resolve()));
  });
}

function safeSegment(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "media"
  );
}

function safeExtension(path: string): string {
  const extension = extname(basename(path)).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : ".audio";
}

function fileSize(path: string | null): number {
  if (!path || !existsSync(path)) return 0;
  return statSync(path).size;
}

function numberHeader(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseContentRangeTotal(value: string | null): number | null {
  const match = value?.match(/^bytes \d+-\d+\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
