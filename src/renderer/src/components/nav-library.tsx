"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import { useNavigate } from "@tanstack/react-router";

export function NavLibrary({
  items,
}: {
  items: {
    name: string;
    url: string;
    icon: IconSvgElement;
  }[];
}) {
  // const { isMobile } = useSidebar()
  const navigate = useNavigate();

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="uppercase">Your Library</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem
            key={item.name}
            onClick={() => navigate({ to: item.url })}
          >
            <SidebarMenuButton className="flex h-9 items-center text-center">
              <HugeiconsIcon icon={item.icon} className="size-4.5! shrink-0" />
              <span className="min-w-0 translate-y-px truncate text-center leading-none text-base font-light">
                {item.name}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
