import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { IconDownload, IconTrash } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import type { DownloadGroup, DownloadItem, DownloadTargetType } from "../../../../shared/types";

export const Route = createFileRoute("/app/downloads")({ component: DownloadsPage });

function DownloadsPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | DownloadTargetType>("all");
  const client = useQueryClient();
  const downloads = useQuery({ queryKey: ["downloads", "completed"], queryFn: () => window.api.downloads.list(["completed"]) });
  const groups = useMemo(() => groupDownloads(downloads.data ?? []).filter((group) => {
    const text = `${group.title} ${group.artist}`.toLowerCase();
    return (type === "all" || group.targetType === type) && text.includes(query.toLowerCase().trim());
  }), [downloads.data, query, type]);
  const remove = async (group: DownloadGroup) => {
    await Promise.all(group.items.map((item) => window.api.downloads.remove(item.id)));
    await client.invalidateQueries({ queryKey: ["downloads"] });
  };

  return <main className="mx-auto w-full max-w-6xl space-y-6 p-6 lg:p-8">
    <div><h1 className="text-3xl font-semibold tracking-tight">Downloads</h1><p className="text-muted-foreground">Music saved on this device, grouped by album or playlist.</p></div>
    <div className="flex flex-wrap gap-3">
      <Input className="max-w-sm" placeholder="Filter downloads" value={query} onChange={(event) => setQuery(event.target.value)} />
      <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="album">Albums</SelectItem><SelectItem value="playlist">Playlists</SelectItem><SelectItem value="track">Tracks</SelectItem></SelectContent>
      </Select>
    </div>
    {groups.length === 0 ? <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-muted-foreground"><IconDownload className="size-8"/><p>No matching downloads.</p></div> :
      <div className="grid gap-3">{groups.map((group) => <section key={`${group.targetType}-${group.targetRatingKey}`} className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate font-semibold">{group.title}</h2><Badge variant="outline" className="capitalize">{group.targetType}</Badge></div><p className="text-sm text-muted-foreground">{group.artist} · {group.items.length} {group.items.length === 1 ? "track" : "tracks"}</p></div>
        <Button size="sm" variant="outline" onClick={() => void remove(group)}><IconTrash/> Remove</Button></div>
        <div className="mt-3 divide-y">{group.items.map((item) => <div key={item.id} className="flex justify-between gap-4 py-2 text-sm"><span className="truncate">{item.title}</span><span className="shrink-0 text-muted-foreground">{formatBytes(item.bytesDownloaded)}</span></div>)}</div>
      </section>)}</div>}
  </main>;
}

function groupDownloads(items: DownloadItem[]): DownloadGroup[] {
  const groups = new Map<string, DownloadGroup>();
  for (const item of items) {
    const key = `${item.targetType}:${item.targetRatingKey}`;
    const current = groups.get(key) ?? { targetType: item.targetType, targetRatingKey: item.targetRatingKey, title: item.targetType === "track" ? item.title : item.album || item.title, artist: item.artist, items: [], bytesTotal: 0 };
    current.items.push(item); current.bytesTotal += item.bytesDownloaded; groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
}
function formatBytes(bytes: number) { return bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`; }
