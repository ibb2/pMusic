import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { IconCheck, IconCloudDownload, IconLoader2 } from "@tabler/icons-react";
import type { DownloadTargetType } from "../../../../shared/types";
import { useSelectedServerId } from "@/hooks/use-selected-server-id";

export function DownloadStatusIndicator({
  targetType,
  ratingKey,
  className,
}: {
  targetType: DownloadTargetType;
  ratingKey: string;
  className?: string;
}) {
  const selectedServer = useSelectedServerId();
  const status = useQuery({
    queryKey: [selectedServer.data, "download-status", targetType, ratingKey],
    queryFn: async () =>
      (await window.api.downloads.getStatus([{ targetType, ratingKey }]))[0],
    staleTime: 2_000,
    enabled: Boolean(selectedServer.data),
    refetchInterval: 1_000,
  });
  const state = status.data?.state ?? "not-downloaded";
  const activeState = status.data?.activeState;
  const Icon =
    state === "downloaded"
      ? IconCheck
      : activeState === "downloading" || activeState === "queued"
        ? IconLoader2
        : IconCloudDownload;

  return (
    <span
      title={
        state === "downloaded"
          ? "Downloaded"
          : state === "partial"
            ? activeState === "paused"
              ? "Download paused"
              : "Partially downloaded"
            : "Not downloaded"
      }
      aria-label={
        state === "downloaded"
          ? "Downloaded"
          : state === "partial"
            ? activeState === "paused"
              ? "Download paused"
              : "Partially downloaded"
            : "Not downloaded"
      }
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full border bg-background/90 shadow-sm backdrop-blur",
        state === "downloaded" && "border-emerald-500 text-emerald-600",
        state === "partial" && "border-amber-500 text-amber-600",
        state === "not-downloaded" && "text-muted-foreground",
        className,
      )}
    >
      <Icon
        className={cn(
          "size-3.5",
          activeState === "downloading" && "animate-spin",
        )}
      />
    </span>
  );
}
