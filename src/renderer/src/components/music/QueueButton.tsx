import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ListStartIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useOnlineStatus } from "@/hooks/use-online-status";

type QueueTarget = {
  type: "track";
  ratingKey: string;
  title: string;
};

export function QueueButton({
  target,
  disabled = false,
  className,
  showLabel = false,
  allowOffline = false,
}: {
  target: QueueTarget;
  disabled?: boolean;
  className?: string;
  showLabel?: boolean;
  allowOffline?: boolean;
}) {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const [queueing, setQueueing] = useState(false);

  const queue = async () => {
    setQueueing(true);
    try {
      await window.api.player.queueTrack(target.ratingKey);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["playerStatus"] }),
        queryClient.invalidateQueries({ queryKey: ["playerQueue"] }),
      ]);
    } catch (error) {
      console.error(
        `Unable to queue ${target.type} ${target.ratingKey}`,
        error,
      );
    } finally {
      setQueueing(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size={showLabel ? "sm" : "icon-sm"}
      className={cn(className)}
      disabled={disabled || queueing || (!online && !allowOffline)}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void queue();
      }}
      aria-label={`Queue ${target.title}`}
      title={`Add ${target.title} to queue`}
    >
      <HugeiconsIcon icon={ListStartIcon} />
      {showLabel ? (queueing ? "Queueing…" : "Queue") : null}
    </Button>
  );
}
