import {
  createWriteStream,
  copyFileSync,
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
  /** An authenticated URL for the original Plex media part (not a transcode). */
  url: string;
  headers?: Record<string, string>;
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
  url: string;
  headers?: Record<string, string>;
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
  ): Promise<DownloadItem[]> {
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
          url: track.url,
          headers: track.headers,
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
    const record = this.requireRecord(id);
    if (record.status === "completed") return this.toItem(record);
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

  resume(id: string): DownloadItem {
    const record = this.requireRecord(id);
    if (record.status !== "paused" && record.status !== "failed")
      return this.toItem(record);
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
      if (record.status === "downloading" || record.status === "queued")
        continue;
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
        return (
          metadata.targetType === target.targetType &&
          metadata.targetRatingKey === target.ratingKey
        );
      });
      const completedTracks = matching.filter(
        (record) => record.status === "completed",
      ).length;
      return {
        ...target,
        state:
          completedTracks === 0
            ? "not-downloaded"
            : completedTracks === matching.length
              ? "downloaded"
              : "partial",
        completedTracks,
        totalTracks: matching.length,
      };
    });
  }

  async setStorageDirectory(directory: string): Promise<OfflineStorageStatus> {
    const next = resolve(directory.trim());
    if (!directory.trim()) throw new Error("Choose a download directory");
    if (next === this.storageDirectory) return this.storageStatus("");
    for (const record of this.database.listDownloadsAll()) {
      if (record.status === "queued" || record.status === "downloading")
        this.pause(record.id);
    }
    while (this.active.size > 0)
      await new Promise((resolve) => setTimeout(resolve, 10));
    mkdirSync(next, { recursive: true });
    const previous = this.storageDirectory;
    for (const record of this.database.listDownloadsAll()) {
      const directoryForServer = join(next, safeSegment(record.serverId));
      mkdirSync(directoryForServer, { recursive: true });
      const move = (path: string | null) => {
        if (!path || !resolve(path).startsWith(`${previous}${sep}`))
          return path;
        const destination = join(directoryForServer, basename(path));
        if (existsSync(path)) copyFileSync(path, destination);
        return destination;
      };
      const filePath = move(record.filePath);
      const partialPath = move(record.partialPath);
      this.database.upsertDownload({ ...record, filePath, partialPath });
      for (const path of [record.filePath, record.partialPath]) {
        if (path && resolve(path).startsWith(`${previous}${sep}`))
          rmSync(path, { force: true });
      }
    }
    this.storageDirectory = next;
    this.database.set("downloads.storageDirectory", next);
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
      const headers = new Headers(metadata.headers);
      if (offset > 0) headers.set("Range", `bytes=${offset}-`);
      const response = await this.fetcher(metadata.url, {
        headers,
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(`Download failed with HTTP ${response.status}`);
      if (offset > 0 && response.status !== 206)
        throw new Error("Server did not honor the resume range");
      if (!response.body) throw new Error("Download response had no body");
      const responseBytes = numberHeader(
        response.headers.get("content-length"),
      );
      const contentRangeTotal = parseContentRangeTotal(
        response.headers.get("content-range"),
      );
      const totalBytes =
        contentRangeTotal ??
        (responseBytes === null ? null : offset + responseBytes);
      const stream = createWriteStream(partialPath, {
        flags: offset ? "a" : "w",
      });
      const reader = response.body.getReader();
      let downloaded = offset;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!stream.write(value)) await once(stream, "drain");
          downloaded += value.byteLength;
          record = this.database.upsertDownload({
            ...record,
            bytesDownloaded: downloaded,
            totalBytes,
          });
        }
        stream.end();
        await once(stream, "finish");
      } catch (error) {
        stream.destroy();
        throw error;
      }
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
