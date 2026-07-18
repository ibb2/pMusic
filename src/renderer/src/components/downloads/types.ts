export type DownloadTargetType = "track" | "album" | "playlist";

export interface DownloadTarget {
  ratingKey: string;
  type: DownloadTargetType;
  title: string;
}

export type DownloadStatus =
  | "queued"
  | "downloading"
  | "completed"
  | "failed"
  | "paused";

export interface DownloadItem {
  id: string;
  title: string;
  subtitle?: string;
  targetType: DownloadTargetType;
  status: DownloadStatus;
  bytesDownloaded: number;
  bytesTotal?: number;
  error?: string;
}

export interface DownloadStorage {
  bytesUsed: number;
  bytesAvailable?: number;
}

export interface DownloadsSnapshot {
  items: DownloadItem[];
  storage: DownloadStorage;
}

/** Adapter implemented by the renderer's window.api integration. */
export interface DownloadsApi {
  start(target: DownloadTarget): Promise<void>;
  list(): Promise<DownloadsSnapshot>;
  retry(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}
