import {
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { basename, extname, join, resolve, sep } from "node:path";
import { once } from "node:events";
import type {
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
};

export class DownloadManager {
  private readonly database: DatabaseManager;
  private readonly resolver: DownloadMediaResolver;
  private readonly storageDirectory: string;
  private readonly fetcher: DownloadFetcher;
  private readonly active = new Map<string, AbortController>();

  constructor(options: DownloadManagerOptions) {
    this.database = options.database;
    this.resolver = options.resolver;
    this.storageDirectory = resolve(options.storageDirectory);
    this.fetcher = options.fetch ?? globalThis.fetch;
    mkdirSync(this.storageDirectory, { recursive: true });
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

  cancel(id: string): DownloadItem {
    const record = this.requireRecord(id);
    this.active.get(id)?.abort();
    return this.toItem(
      this.database.upsertDownload({
        ...record,
        status: "failed",
        error: "Download paused",
      }),
    );
  }

  remove(id: string): void {
    const record = this.requireRecord(id);
    this.active.get(id)?.abort();
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

  storageStatus(serverId: string): OfflineStorageStatus {
    const records = this.database.listDownloads(serverId);
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
        status: "failed",
        bytesDownloaded: fileSize(current.partialPath),
        error: controller.signal.aborted
          ? "Download paused"
          : errorMessage(error),
      });
    } finally {
      this.active.delete(id);
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
    void this.run(id).catch((error) => {
      const current = this.database.getDownload(id);
      if (current)
        this.database.upsertDownload({
          ...current,
          status: "failed",
          error: errorMessage(error),
        });
    });
  }

  private toItem(record: DownloadRecord): DownloadItem {
    const metadata = record.metadata as DownloadMetadata;
    const paused =
      record.status === "failed" && record.error === "Download paused";
    return {
      id: record.id,
      serverId: record.serverId,
      targetType: metadata.targetType ?? record.mediaType,
      targetRatingKey: metadata.targetRatingKey ?? record.ratingKey,
      trackRatingKey: record.ratingKey,
      title: record.title,
      artist: metadata.artist ?? "",
      album: metadata.album ?? "",
      state: paused ? "paused" : record.status,
      bytesDownloaded: record.bytesDownloaded,
      bytesTotal: record.totalBytes,
      error: paused ? null : record.error,
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
