import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconCheck, IconDownload, IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DownloadTarget, DownloadsApi } from "./types";

interface DownloadButtonProps {
  api: Pick<DownloadsApi, "start">;
  target: DownloadTarget;
  className?: string;
  compact?: boolean;
  onQueued?: () => void;
  onError?: (error: unknown) => void;
}

export function DownloadButton({
  api,
  target,
  className,
  compact = false,
  onQueued,
  onError,
}: DownloadButtonProps) {
  const [state, setState] = useState<"idle" | "pending" | "queued">("idle");
  const queryClient = useQueryClient();
  const downloaded = useQuery({
    queryKey: ["download-status", target.type, target.ratingKey],
    queryFn: async () =>
      (
        await window.api.downloads.getStatus([
          { targetType: target.type, ratingKey: target.ratingKey },
        ])
      )[0],
    staleTime: 2_000,
  });

  const startDownload = async () => {
    if (state !== "idle") return;
    setState("pending");
    try {
      await api.start(target);
      setState("queued");
      await queryClient.invalidateQueries({
        queryKey: ["download-status", target.type, target.ratingKey],
      });
      onQueued?.();
    } catch (error) {
      setState("idle");
      onError?.(error);
    }
  };

  const persistedState = downloaded.data?.state;
  const label =
    persistedState === "downloaded"
      ? "Downloaded"
      : persistedState === "partial"
        ? "Downloading"
        : state === "queued"
          ? "Queued"
          : state === "pending"
            ? "Queuing"
            : "Download";
  const Icon =
    persistedState === "downloaded"
      ? IconCheck
      : persistedState === "partial"
        ? IconLoader2
        : state === "queued"
          ? IconCheck
          : state === "pending"
            ? IconLoader2
            : IconDownload;

  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "icon-sm" : "sm"}
      className={cn(className)}
      disabled={
        state !== "idle" ||
        persistedState === "downloaded" ||
        persistedState === "partial"
      }
      aria-label={`${label} ${target.title}`}
      onClick={startDownload}
    >
      <Icon
        className={cn(
          (state === "pending" || persistedState === "partial") &&
            "animate-spin",
        )}
      />
      {!compact && label}
    </Button>
  );
}
