import BlankImage from "@/assets/512px-Black_colour.jpg";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useRef } from "react";

export const Route = createFileRoute("/app/library/artists")({
  component: RouteComponent,
});

function RouteComponent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<HTMLDivElement>(null);

  const fetchArtists = async ({ pageParam }: { pageParam: string }) => {
    return window.api.media.getArtistsPage(pageParam || "", 30);
  };

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["allArtists"],
    queryFn: fetchArtists,
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  useEffect(() => {
    if (!containerRef.current || !hasNextPage || isFetching) return;

    const container = containerRef.current;
    const hasScroll = container.scrollHeight > container.clientHeight;

    if (!hasScroll) {
      fetchNextPage();
    }
  }, [data, hasNextPage, isFetching, fetchNextPage]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetching) {
        fetchNextPage();
      }
    });

    const target = observerRef.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) observer.unobserve(target);
    };
  }, [hasNextPage, isFetching, fetchNextPage]);

  if (status === "pending") {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-full items-center justify-center px-6 text-sm text-muted-foreground">
        Error loading artists: {error.message}
      </div>
    );
  }

  const artists = data.pages.flatMap((group) => group.items);

  return (
    <div ref={containerRef} className="flex min-h-full flex-col px-6">
      <div className="sticky top-0 z-10 w-full bg-background py-2">
        <p className="text-2xl font-bold">Artists</p>
      </div>

      {artists.length > 0 ? (
        <div className="flex w-full flex-wrap">
          {data.pages.map((group, i) => (
            <React.Fragment key={i}>
              {group.items.map((artist: any) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          No artists found
        </div>
      )}

      <div ref={observerRef} className="flex h-12 items-center justify-center">
        {isFetching && !isFetchingNextPage ? (
          <Spinner className="size-4" />
        ) : null}
      </div>
    </div>
  );
}

function ArtistCard({ artist }: { artist: any }) {
  return (
    <Link
      to={`/app/artist/$ratingKey`}
      params={{ ratingKey: String(artist.ratingKey) }}
      className="h-fit"
    >
      <Card className="flex w-40 shrink-0 justify-center border-0 bg-transparent p-3 shadow-none ring-0 hover:rounded-lg hover:bg-zinc-300/60 dark:hover:bg-zinc-800/60">
        <CardHeader className="gap-0 p-0">
          <img
            src={artist.thumb ?? BlankImage}
            alt={artist.title}
            className="mb-2 aspect-square w-full rounded-full object-cover"
          />
          <CardTitle className="mb-0.5 overflow-hidden text-ellipsis text-nowrap text-sm leading-tight">
            <p className="truncate hover:underline">{artist.title}</p>
          </CardTitle>
          <p className="truncate text-xs leading-tight text-black/80 dark:text-muted-foreground">
            Artist
          </p>
        </CardHeader>
      </Card>
    </Link>
  );
}
