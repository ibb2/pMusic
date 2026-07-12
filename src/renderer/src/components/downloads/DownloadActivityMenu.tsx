import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconActivity,
  IconPlayerPause,
  IconPlayerPlay,
  IconX,
} from "@tabler/icons-react";
import { useSelectedServerId } from "@/hooks/use-selected-server-id";

const percent = (value: number, total: number | null) =>
  total ? Math.min(100, (value / total) * 100) : null;

export function DownloadActivityMenu() {
  const client = useQueryClient();
  const selectedServer = useSelectedServerId();
  const activity = useQuery({
    queryKey: [selectedServer.data, "download-activity"],
    queryFn: () => window.api.downloads.getActivity(),
    enabled: Boolean(selectedServer.data),
    refetchInterval: 1_000,
  });
  const refresh = () =>
    client.invalidateQueries({
      queryKey: [selectedServer.data, "download-activity"],
    });
  const act = async (action: () => Promise<unknown>) => {
    await action();
    await refresh();
  };
  const count =
    (activity.data?.activeCount ?? 0) + (activity.data?.failedCount ?? 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-full"
            aria-label="Open activity"
          />
        }
      >
        <IconActivity className="size-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
            {count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Activity</span>
          {!!activity.data?.items.some(
            (item) => item.state === "completed" || item.state === "failed",
          ) && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() =>
                void act(() => window.api.downloads.clearActivity())
              }
            >
              Clear
            </Button>
          )}
        </div>
        <ScrollArea className="h-72">
          <div className="space-y-1 p-2">
            {activity.isLoading && (
              <p className="p-3 text-sm text-muted-foreground">
                Loading activity…
              </p>
            )}
            {activity.data?.items.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">
                No recent activity.
              </p>
            )}
            {activity.data?.items.map((item) => (
              <div key={item.id} className="rounded-lg p-2 hover:bg-muted/60">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-xs capitalize text-muted-foreground">
                      {item.state}
                      {item.error ? ` · ${item.error}` : ""}
                    </p>
                  </div>
                  {item.state === "downloading" || item.state === "queued" ? (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Pause ${item.title}`}
                      onClick={() =>
                        void act(() => window.api.downloads.pause(item.id))
                      }
                    >
                      <IconPlayerPause />
                    </Button>
                  ) : item.state === "paused" || item.state === "failed" ? (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Resume ${item.title}`}
                      onClick={() =>
                        void act(() => window.api.downloads.resume(item.id))
                      }
                    >
                      <IconPlayerPlay />
                    </Button>
                  ) : null}
                  {(item.state === "completed" || item.state === "failed") && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Clear ${item.title} from activity`}
                      onClick={() =>
                        void act(() =>
                          window.api.downloads.clearActivity([item.id]),
                        )
                      }
                    >
                      <IconX />
                    </Button>
                  )}
                </div>
                {(item.state === "downloading" || item.state === "queued") && (
                  <Progress
                    className="mt-2 h-1"
                    value={percent(item.bytesDownloaded, item.bytesTotal)}
                  />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
