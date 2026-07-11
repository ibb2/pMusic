import BlankImage from "@/assets/512px-Black_colour.jpg";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { SearchResult, SearchResults } from "../../../../shared/rpc";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/app/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const query = useQuery({
    queryKey: ["search", q],
    queryFn: () => window.api.media.search(q),
    enabled: q.trim().length > 0,
  });

  if (!q.trim()) return <SearchMessage text="Enter a search above to find music." />;
  if (query.isLoading)
    return <div className="flex h-full items-center justify-center"><Spinner className="size-8" /></div>;
  if (query.isError)
    return <SearchMessage text={`Search failed: ${query.error.message}`} />;

  const results = query.data;
  const hasResults = results && Object.values(results).some((items) => items.length > 0);
  if (!hasResults) return <SearchMessage text={`No results for “${q}”`} />;

  return (
    <div className="flex min-h-full flex-col gap-8 p-6 pb-10">
      <h1 className="text-2xl font-bold">Search results for “{q}”</h1>
      {(["artists", "albums", "tracks", "playlists"] as const).map((section) => (
        <ResultSection key={section} title={capitalize(section)} items={results[section]} />
      ))}
    </div>
  );
}

function ResultSection({ title, items }: { title: string; items: SearchResult[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => <ResultItem key={`${item.type}-${item.ratingKey}`} item={item} />)}
      </div>
    </section>
  );
}

function ResultItem({ item }: { item: SearchResult }) {
  const content = (
    <div className="flex min-w-0 items-center gap-3 rounded-lg p-2 text-left hover:bg-muted">
      <img src={item.thumb || BlankImage} alt="" className="size-14 shrink-0 rounded-md object-cover" />
      <div className="min-w-0"><div className="truncate font-medium">{item.title}</div><div className="truncate text-sm text-muted-foreground">{item.subtitle}</div></div>
    </div>
  );
  if (item.type === "track")
    return <Button variant="ghost" className="h-auto justify-start p-0" onClick={() => window.api.player.playTrack(item.ratingKey)}>{content}</Button>;
  const to = item.type === "artist" ? "/app/artist/$ratingKey" : item.type === "album" ? "/app/album/$ratingKey" : "/app/playlist/$ratingKey";
  return <Link to={to} params={{ ratingKey: item.ratingKey }}>{content}</Link>;
}

function SearchMessage({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center p-6 text-muted-foreground">{text}</div>;
}

function capitalize(value: keyof SearchResults): string {
  return value[0].toUpperCase() + value.slice(1);
}
