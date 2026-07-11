import type { SyncStatus, SyncTrigger } from "../shared/types";
import type { DatabaseManager, DownloadRecord, SyncRecord } from "./database";

const AGGREGATE_LIBRARY_KEY = "__all__";

export type LibraryRefreshResult = {
  cursor?: string | null;
  refreshedItems?: number;
};

/** Plex-specific fetching stays behind this narrow boundary. */
export interface SyncResolver {
  refreshLibrary(input: {
    serverId: string;
    libraryKey: string;
    cursor: string | null;
  }): Promise<LibraryRefreshResult>;
  trackExists(input: { serverId: string; ratingKey: string }): Promise<boolean>;
}

export type SyncServiceOptions = {
  database: DatabaseManager;
  resolver: SyncResolver;
  selectedLibraries: (serverId: string) => Promise<string[]> | string[];
  now?: () => number;
};

type SyncDetails = {
  trigger: SyncTrigger;
  refreshedLibraries: number;
  failedLibraries: number;
  reconciledDownloads: number;
  errors: string[];
};

type DownloadSyncMetadata = Record<string, unknown> & {
  orphaned?: boolean;
  orphanedAt?: number;
  lastReconciledAt?: number;
};

export class SyncService {
  private readonly database: DatabaseManager;
  private readonly resolver: SyncResolver;
  private readonly selectedLibraries: SyncServiceOptions["selectedLibraries"];
  private readonly now: () => number;
  private readonly active = new Map<string, Promise<SyncStatus>>();

  constructor(options: SyncServiceOptions) {
    this.database = options.database;
    this.resolver = options.resolver;
    this.selectedLibraries = options.selectedLibraries;
    this.now = options.now ?? Date.now;
  }

  startup(serverId: string): Promise<SyncStatus> {
    return this.run(serverId, "startup");
  }

  networkRestored(serverId: string): Promise<SyncStatus> {
    return this.run(serverId, "network-restored");
  }

  manual(serverId: string): Promise<SyncStatus> {
    return this.run(serverId, "manual");
  }

  run(serverId: string, trigger: SyncTrigger): Promise<SyncStatus> {
    const existing = this.active.get(serverId);
    if (existing) return existing;
    const operation = this.execute(serverId, trigger).finally(() => {
      if (this.active.get(serverId) === operation) this.active.delete(serverId);
    });
    this.active.set(serverId, operation);
    return operation;
  }

  getStatus(serverId: string): SyncStatus {
    const record = this.database.getSync(serverId, AGGREGATE_LIBRARY_KEY);
    return record ? statusFromRecord(record) : emptyStatus(serverId);
  }

  private async execute(
    serverId: string,
    trigger: SyncTrigger,
  ): Promise<SyncStatus> {
    const startedAt = this.now();
    const previous = this.database.getSync(serverId, AGGREGATE_LIBRARY_KEY);
    const details: SyncDetails = {
      trigger,
      refreshedLibraries: 0,
      failedLibraries: 0,
      reconciledDownloads: 0,
      errors: [],
    };
    this.persistAggregate(
      serverId,
      "running",
      startedAt,
      previous?.lastCompletedAt ?? null,
      null,
      details,
    );

    try {
      const libraryKeys = [
        ...new Set((await this.selectedLibraries(serverId)).filter(Boolean)),
      ];
      for (const libraryKey of libraryKeys) {
        await this.refreshLibrary(serverId, libraryKey, startedAt, details);
      }
      await this.reconcileDownloads(serverId, details);
    } catch (error) {
      details.errors.push(errorMessage(error));
    }

    const completedAt = this.now();
    const failed = details.errors.length > 0;
    const successfulWork =
      details.refreshedLibraries > 0 || details.reconciledDownloads > 0;
    const status = failed
      ? successfulWork
        ? "completed"
        : "failed"
      : "completed";
    this.persistAggregate(
      serverId,
      status,
      startedAt,
      completedAt,
      failed ? details.errors.join("; ") : null,
      details,
    );
    return this.getStatus(serverId);
  }

  private async refreshLibrary(
    serverId: string,
    libraryKey: string,
    startedAt: number,
    details: SyncDetails,
  ): Promise<void> {
    const previous = this.database.getSync(serverId, libraryKey);
    this.database.upsertSync({
      serverId,
      libraryKey,
      status: "running",
      cursor: previous?.cursor ?? null,
      lastStartedAt: startedAt,
      lastCompletedAt: previous?.lastCompletedAt ?? null,
      error: null,
      details: previous?.details ?? null,
    });
    try {
      const result = await this.resolver.refreshLibrary({
        serverId,
        libraryKey,
        cursor: previous?.cursor ?? null,
      });
      const completedAt = this.now();
      this.database.upsertSync({
        serverId,
        libraryKey,
        status: "completed",
        cursor: result.cursor ?? previous?.cursor ?? null,
        lastStartedAt: startedAt,
        lastCompletedAt: completedAt,
        error: null,
        details: { refreshedItems: result.refreshedItems ?? 0 },
      });
      details.refreshedLibraries += 1;
    } catch (error) {
      const message = `Library ${libraryKey}: ${errorMessage(error)}`;
      this.database.upsertSync({
        serverId,
        libraryKey,
        status: "failed",
        cursor: previous?.cursor ?? null,
        lastStartedAt: startedAt,
        lastCompletedAt: previous?.lastCompletedAt ?? null,
        error: errorMessage(error),
        details: previous?.details ?? null,
      });
      details.failedLibraries += 1;
      details.errors.push(message);
    }
  }

  private async reconcileDownloads(
    serverId: string,
    details: SyncDetails,
  ): Promise<void> {
    for (const download of this.database.listDownloads(serverId)) {
      try {
        const exists = await this.resolver.trackExists({
          serverId,
          ratingKey: download.ratingKey,
        });
        const metadata = objectMetadata(download);
        const reconciledAt = this.now();
        this.database.upsertDownload({
          ...download,
          metadata: exists
            ? {
                ...metadata,
                orphaned: false,
                orphanedAt: undefined,
                lastReconciledAt: reconciledAt,
              }
            : {
                ...metadata,
                orphaned: true,
                orphanedAt: metadata.orphanedAt ?? reconciledAt,
                lastReconciledAt: reconciledAt,
              },
        });
        details.reconciledDownloads += 1;
      } catch (error) {
        details.errors.push(
          `Download ${download.ratingKey}: ${errorMessage(error)}`,
        );
      }
    }
  }

  private persistAggregate(
    serverId: string,
    status: SyncRecord["status"],
    lastStartedAt: number,
    lastCompletedAt: number | null,
    error: string | null,
    details: SyncDetails,
  ): void {
    this.database.upsertSync({
      serverId,
      libraryKey: AGGREGATE_LIBRARY_KEY,
      status,
      cursor: null,
      lastStartedAt,
      lastCompletedAt,
      error,
      details,
    });
  }
}

function statusFromRecord(record: SyncRecord): SyncStatus {
  const details = (record.details ?? {}) as Partial<SyncDetails>;
  const hasPartialFailure =
    record.status === "completed" && (details.errors?.length ?? 0) > 0;
  return {
    serverId: record.serverId,
    state:
      record.status === "running"
        ? "running"
        : record.status === "failed"
          ? "failed"
          : hasPartialFailure
            ? "partial"
            : "succeeded",
    trigger: details.trigger ?? null,
    startedAt: toIso(record.lastStartedAt),
    completedAt: toIso(record.lastCompletedAt),
    refreshedLibraries: details.refreshedLibraries ?? 0,
    failedLibraries: details.failedLibraries ?? 0,
    reconciledDownloads: details.reconciledDownloads ?? 0,
    error: record.error,
  };
}

function emptyStatus(serverId: string): SyncStatus {
  return {
    serverId,
    state: "idle",
    trigger: null,
    startedAt: null,
    completedAt: null,
    refreshedLibraries: 0,
    failedLibraries: 0,
    reconciledDownloads: 0,
    error: null,
  };
}

function objectMetadata(download: DownloadRecord): DownloadSyncMetadata {
  return download.metadata && typeof download.metadata === "object"
    ? (download.metadata as DownloadSyncMetadata)
    : {};
}

function toIso(value: number | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
