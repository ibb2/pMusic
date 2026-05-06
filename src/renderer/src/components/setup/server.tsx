import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { PlexServer } from "@/types";
import { ServerStack02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export default function SelectServer({ progress, servers, selectServer }) {
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
              selectServer(server);
              await window.api.auth.selectServer(server);
              progress();
            }}
            className="hover:bg-accent"
          >
            <ItemMedia className="self-center!">
              <HugeiconsIcon icon={ServerStack02Icon} className="size-8" />
            </ItemMedia>
            <ItemContent className="flex flex-col items-start">
              <ItemTitle>{server.name}</ItemTitle>
              <ItemDescription>
                {server.presence ? "Online" : "Offline"}
              </ItemDescription>
            </ItemContent>
            <ItemActions />
          </Item>
        ))}
      </div>
    </div>
  );
}
