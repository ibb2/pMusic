import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconCheck, IconDownload, IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
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

  const startDownload = async () => {
    if (state !== "idle") return;
    setState("pending");
    try {
      await api.start(target);
      setState("queued");
      onQueued?.();
    } catch (error) {
      setState("idle");
      onError?.(error);
    }
  };

  const label =
    state === "queued"
      ? "Queued"
      : state === "pending"
        ? "Queuing"
        : "Download";
  const Icon =
    state === "queued"
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
      disabled={state !== "idle"}
      aria-label={`${label} ${target.title}`}
      onClick={startDownload}
    >
      <Icon className={cn(state === "pending" && "animate-spin")} />
      {!compact && label}
    </Button>
  );
}
