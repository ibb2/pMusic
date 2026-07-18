import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { IconDownload, IconTrash } from "@tabler/icons-react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState } from "react";
import type {
  DownloadGroup,
  DownloadItem,
  DownloadState,
  DownloadTargetType,
} from "../../../../shared/types";
import { useSelectedServerId } from "@/hooks/use-selected-server-id";

export const Route = createFileRoute("/app/downloads")({
  component: DownloadsPage,
});

function DownloadsPage() {
  const selectedServer = useSelectedServerId();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | DownloadTargetType>("all");
  const [status, setStatus] = useState<"all" | DownloadState>("completed");
  const [sort, setSort] = useState<"title" | "date" | "size">("title");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const client = useQueryClient();
  const downloads = useQuery({
    queryKey: [selectedServer.data, "downloads"],
    queryFn: () => window.api.downloads.list(),
    enabled: Boolean(selectedServer.data),
    refetchInterval: 1_000,
  });
  const groups = useMemo(
    () =>
      groupDownloads(
        (downloads.data ?? []).filter(
          (item) => status === "all" || item.state === status,
        ),
      )
        .filter((group) => {
          const text = `${group.title} ${group.artist}`.toLowerCase();
          return (
            (type === "all" || group.targetType === type) &&
            text.includes(query.toLowerCase().trim())
          );
        })
        .sort((a, b) => {
          const comparison =
            sort === "title"
              ? a.title.localeCompare(b.title)
              : sort === "size"
                ? a.bytesTotal - b.bytesTotal
                : latestUpdate(a) - latestUpdate(b);
          return direction === "asc" ? comparison : -comparison;
        }),
    [downloads.data, query, type, status, sort, direction],
  );
  const remove = async (group: DownloadGroup) => {
    await Promise.all(
      group.items.map((item) => window.api.downloads.remove(item.id)),
    );
    await client.invalidateQueries({
      queryKey: [selectedServer.data, "downloads"],
    });
  };

  return (
    <main className="mx-auto w-full space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Downloads</h1>
        <p className="text-muted-foreground">
          Music saved on this device, grouped by album or playlist.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-sm"
          placeholder="Filter downloads"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          value={type}
          onValueChange={(value) => setType(value as typeof type)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="album">Albums</SelectItem>
            <SelectItem value="playlist">Playlists</SelectItem>
            <SelectItem value="track">Tracks</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as typeof status)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Downloaded</SelectItem>
            <SelectItem value="downloading">Downloading</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sort}
          onValueChange={(value) => setSort(value as typeof sort)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="title">Title</SelectItem>
            <SelectItem value="date">Last updated</SelectItem>
            <SelectItem value="size">File size</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() =>
            setDirection((value) => (value === "asc" ? "desc" : "asc"))
          }
          aria-label={`Sort ${direction === "asc" ? "descending" : "ascending"}`}
        >
          {direction === "asc" ? "Ascending" : "Descending"}
        </Button>
      </div>
      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-muted-foreground">
          <IconDownload className="size-8" />
          <p>No matching downloads.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {groups.map((group) => (
            <Collapsible
              key={`${group.targetType}-${group.targetRatingKey}`}
              defaultOpen={false}
            >
              <Card size="sm" className="gap-0">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <CollapsibleTrigger
                    className="group flex min-w-0 flex-1 items-start gap-3 text-left"
                    aria-label={`Toggle ${group.title} downloads`}
                  >
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      className="mt-0.5 shrink-0 transition-transform group-data-[open]:rotate-180"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="truncate">
                          {group.title}
                        </CardTitle>
                        <Badge variant="outline" className="capitalize">
                          {group.targetType}
                        </Badge>
                      </div>
                      <CardDescription>
                        {group.artist} · {group.items.length}{" "}
                        {group.items.length === 1 ? "track" : "tracks"}
                      </CardDescription>
                    </div>
                  </CollapsibleTrigger>
                  <CardAction>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void remove(group)}
                    >
                      <IconTrash data-icon="inline-start" /> Remove
                    </Button>
                  </CardAction>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-3">
                    <div className="divide-y">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between gap-4 py-2 text-sm"
                        >
                          <span className="truncate">{item.title}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {formatBytes(item.bytesDownloaded)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}
    </main>
  );
}

function groupDownloads(items: DownloadItem[]): DownloadGroup[] {
  const groups = new Map<string, DownloadGroup>();
  for (const item of items) {
    const key = `${item.targetType}:${item.targetRatingKey}`;
    const current = groups.get(key) ?? {
      targetType: item.targetType,
      targetRatingKey: item.targetRatingKey,
      title: item.targetTitle,
      artist: item.artist,
      items: [],
      bytesTotal: 0,
    };
    current.items.push(item);
    current.bytesTotal += item.bytesDownloaded;
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
}
function latestUpdate(group: DownloadGroup) {
  return Math.max(...group.items.map((item) => Date.parse(item.updatedAt)));
}
function formatBytes(bytes: number) {
  return bytes < 1024 ** 2
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
