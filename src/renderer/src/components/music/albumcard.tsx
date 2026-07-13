import { Link } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import BlankImage from "@/assets/512px-Black_colour.jpg";

export function AlbumCard({ album }: { album: any }) {
  return (
    <div className="h-fit" key={album.id}>
      <Card className="flex w-40 shrink-0 justify-center border-0 bg-transparent p-3 shadow-none ring-0 hover:rounded-lg hover:bg-zinc-300/60 dark:hover:bg-zinc-800/60">
        <CardHeader className="p-0 gap-0">
          <Link
            to="/app/album/$ratingKey"
            params={{ ratingKey: String(album.ratingKey) }}
          >
            <img
              src={album.thumb ?? BlankImage}
              alt={album.title}
              className="mb-1.5 aspect-square w-full rounded-lg object-cover"
            />
          </Link>
          <CardTitle className="mb-0.5 overflow-hidden text-ellipsis text-nowrap text-sm leading-tight">
            <Link
              to="/app/album/$ratingKey"
              params={{ ratingKey: String(album.ratingKey) }}
            >
              <p className="truncate hover:underline max-w-sm text-sm">
                {album.title}
              </p>
            </Link>
          </CardTitle>
          <CardDescription className="truncate text-xs leading-tight text-black/80 dark:text-muted-foreground">
            {(album.artistRatingKey ?? album.parentRatingKey) ? (
              <Link
                to="/app/artist/$ratingKey"
                params={{
                  ratingKey: String(
                    album.artistRatingKey ?? album.parentRatingKey,
                  ),
                }}
                className="hover:underline"
              >
                {album.artist}
              </Link>
            ) : (
              album.artist
            )}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
