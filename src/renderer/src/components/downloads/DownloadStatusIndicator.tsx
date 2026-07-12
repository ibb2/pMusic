import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { IconCheck, IconCloudDownload, IconLoader2 } from "@tabler/icons-react";
import type { DownloadTargetType } from "../../../../shared/types";

export function DownloadStatusIndicator({
  targetType,
  ratingKey,
  className,
}: {
  targetType: DownloadTargetType;
  ratingKey: string;
  className?: string;
}) {
  const status = useQuery({
    queryKey: ["download-status", targetType, ratingKey],
    queryFn: async () =>
      (await window.api.downloads.getStatus([{ targetType, ratingKey }]))[0],
    staleTime: 2_000,
  });
  const state = status.data?.state ?? "not-downloaded";
  const Icon =
    state === "downloaded"
      ? IconCheck
      : state === "partial"
        ? IconLoader2
        : IconCloudDownload;

  return (
    <span
      title={
        state === "downloaded"
          ? "Downloaded"
          : state === "partial"
            ? "Partially downloaded"
            : "Not downloaded"
      }
      aria-label={
        state === "downloaded"
          ? "Downloaded"
          : state === "partial"
            ? "Partially downloaded"
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
      <Icon className={cn("size-3.5", state === "partial" && "animate-spin")} />
    </span>
  );
}
