import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import type { PlexServer } from "@/types";
import { ServerStack02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

type SelectServerProps = {
  progress: () => void;
  servers: PlexServer[];
  selectServer: (server: PlexServer) => void;
};

export default function SelectServer({
  progress,
  servers,
  selectServer,
}: SelectServerProps) {
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectingServer, setConnectingServer] = useState<string | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-12 overflow-y-auto p-4 h-full">
      <h1 className="scroll-m-20 text-center text-4xl font-bold tracking-tight text-balance">
        Servers
      </h1>
      <div>
        {servers.map((server: PlexServer) => (
          <Item
            key={server.name + server.createdAt}
            size="sm"
            variant={"outline"}
            onClick={async () => {
              if (connectingServer) return;
              setConnectionError(null);
              setConnectingServer(server.clientIdentifier);
              try {
                await window.api.auth.selectServer(server);
                await window.api.auth.resolveServerConnection("auto");
                selectServer(server);
                progress();
              } catch (error) {
                setConnectionError(
                  error instanceof Error
                    ? error.message
                    : "Rayna could not reach this Plex server.",
                );
              } finally {
                setConnectingServer(null);
              }
            }}
            aria-disabled={connectingServer !== null}
            className="hover:bg-accent"
          >
            <ItemMedia className="self-center!">
              <HugeiconsIcon icon={ServerStack02Icon} className="size-8" />
            </ItemMedia>
            <ItemContent className="flex flex-col items-start">
              <ItemTitle>{server.name}</ItemTitle>
              <ItemDescription>
                {connectingServer === server.clientIdentifier
                  ? "Checking connections…"
                  : server.presence
                    ? "Online"
                    : "Offline"}
              </ItemDescription>
            </ItemContent>
            <ItemActions />
          </Item>
        ))}
      </div>
      {connectionError && (
        <p role="alert" className="text-sm text-destructive">
          {connectionError}
        </p>
      )}
    </div>
  );
}
