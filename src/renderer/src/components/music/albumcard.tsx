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
    <Link
      key={album.id}
      to={`/app/album/$ratingKey`}
      params={{ ratingKey: album.ratingKey }}
      className="h-fit"
    >
      <Card className="flex w-40 shrink-0 justify-center border-0 p-3 shadow-none ring-0 hover:rounded-lg hover:bg-zinc-300/60 bg-transparent dark:hover:bg-zinc-800/60">
        <CardHeader className="p-0 gap-0">
          <img
            src={album.thumb ?? BlankImage}
            alt={album.title}
            className="mb-1.5 aspect-square w-full rounded-lg object-cover"
          />
          <CardTitle className="mb-0.5 overflow-hidden text-ellipsis text-nowrap text-sm leading-tight">
            {album.title}
          </CardTitle>
          <CardDescription className="truncate text-xs leading-tight text-black/80 dark:text-muted-foreground">
            {album.artist}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
