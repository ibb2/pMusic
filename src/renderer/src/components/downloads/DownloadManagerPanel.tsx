import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { IconDownload, IconRefresh, IconTrash } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import type { DownloadItem, DownloadsApi, DownloadsSnapshot } from "./types";

const formatBytes = (bytes?: number) => {
  if (bytes == null) return "Unknown";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unit = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};

const progressFor = (item: DownloadItem) =>
  item.bytesTotal
    ? Math.min(100, (item.bytesDownloaded / item.bytesTotal) * 100)
    : null;

export interface DownloadManagerPanelProps {
  api: Pick<DownloadsApi, "list" | "retry" | "remove">;
  pollIntervalMs?: number;
}

export function DownloadManagerPanel({
  api,
  pollIntervalMs = 1500,
}: DownloadManagerPanelProps) {
  const [snapshot, setSnapshot] = useState<DownloadsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await api.list());
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Downloads could not be loaded.",
      );
    }
  }, [api]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [pollIntervalMs, refresh]);

  const act = async (id: string, action: (id: string) => Promise<void>) => {
    setBusyId(id);
    try {
      await action(id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Offline downloads</CardTitle>
        <CardDescription>Manage music saved on this device.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {snapshot && (
          <div className="rounded-xl bg-muted/50 p-4">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium">Storage used</span>
              <span className="tabular-nums text-muted-foreground">
                {formatBytes(snapshot.storage.bytesUsed)}
                {snapshot.storage.bytesAvailable != null &&
                  ` · ${formatBytes(snapshot.storage.bytesAvailable)} available`}
              </span>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!snapshot && !error && (
          <p className="text-sm text-muted-foreground">Loading downloads…</p>
        )}
        {snapshot?.items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <IconDownload className="size-8" />
            <p className="text-sm">No offline downloads yet.</p>
          </div>
        )}

        <div className="divide-y divide-border">
          {snapshot?.items.map((item) => {
            const progress = progressFor(item);
            return (
              <div
                key={item.id}
                className="space-y-3 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.subtitle ?? item.targetType} ·{" "}
                      {formatBytes(item.bytesDownloaded)}
                      {item.bytesTotal != null &&
                        ` of ${formatBytes(item.bytesTotal)}`}
                    </p>
                  </div>
                  <Badge
                    variant={
                      item.status === "failed" ? "destructive" : "outline"
                    }
                  >
                    {item.status}
                  </Badge>
                </div>
                {(item.status === "downloading" ||
                  item.status === "queued") && (
                  <Progress
                    value={progress}
                    aria-label={`Download progress for ${item.title}`}
                  />
                )}
                {item.error && (
                  <p className="text-xs text-destructive">{item.error}</p>
                )}
                <div className="flex justify-end gap-2">
                  {item.status === "failed" && (
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={busyId === item.id}
                      onClick={() => void act(item.id, api.retry)}
                    >
                      <IconRefresh /> Retry
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={busyId === item.id}
                    onClick={() => void act(item.id, api.remove)}
                  >
                    <IconTrash /> Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
