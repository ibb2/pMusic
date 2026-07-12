import { Link } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import BlankImage from "@/assets/512px-Black_colour.jpg";
import { DownloadStatusIndicator } from "@/components/downloads";

export function AlbumCard({ album }: { album: any }) {
  return (
    <Link
      key={album.id}
      to={`/app/album/$ratingKey`}
      params={{ ratingKey: album.ratingKey }}
      className="h-fit"
    >
      <Card className="relative flex w-40 shrink-0 justify-center border-0 p-3 shadow-none ring-0 hover:rounded-lg hover:bg-zinc-300/60 bg-transparent dark:hover:bg-zinc-800/60">
        <DownloadStatusIndicator
          targetType="album"
          ratingKey={String(album.ratingKey)}
          className="absolute right-4 top-4 z-10"
        />
        <CardHeader className="p-0 gap-0">
          <img
            src={album.thumb ?? BlankImage}
            alt={album.title}
            className="mb-1.5 aspect-square w-full rounded-lg object-cover"
          />
          <CardTitle className="mb-0.5 overflow-hidden text-ellipsis text-nowrap text-sm leading-tight">
            <Link
              to={`/app/album/$ratingKey`}
              params={{ ratingKey: album.ratingKey }}
            >
              <p className="truncate hover:underline max-w-sm text-sm">
                {album.title}
              </p>
            </Link>
          </CardTitle>
          <CardDescription className="truncate text-xs leading-tight text-black/80 dark:text-muted-foreground">
            <Link
              to={`/app/artist/$ratingKey`}
              params={{
                ratingKey: album.artistRatingKey ?? album.parentRatingKey,
              }}
            >
              <p className="hover:underline text-xs">{album.artist}</p>
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
