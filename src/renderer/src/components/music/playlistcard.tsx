import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { Card, CardDescription, CardHeader, CardTitle } from "../ui/card";
import BlankImage from "@/assets/512px-Black_colour.jpg";

export default function PlaylistCard({ playlist }: { playlist: any }) {
  return (
    <Link
      key={playlist.id}
      to={`/app/playlist/$ratingKey`}
      params={{ ratingKey: playlist.ratingKey }}
      className="h-fit"
    >
      <Card className="relative flex w-40 shrink-0 justify-center border-0 p-3 shadow-none ring-0 hover:rounded-lg hover:bg-zinc-300/60 bg-transparent dark:hover:bg-zinc-800/60">
        <CardHeader className="p-0 gap-0">
          <img
            src={
              playlist.composite?.length > 0 ? playlist.composite : BlankImage
            }
            alt={playlist.title}
            className="mb-1.5 aspect-square w-full rounded-lg object-cover"
          />
          <CardTitle className="mb-0.5 overflow-hidden text-ellipsis text-nowrap text-sm leading-tight">
            {playlist.title}
          </CardTitle>
          <CardDescription className="truncate text-xs leading-tight text-black/80 dark:text-muted-foreground">
            {playlist.duration
              ? `${dayjs.duration(playlist.duration).hours()}hr ${dayjs.duration(playlist.duration).minutes()}min`
              : "0hr 0min"}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
