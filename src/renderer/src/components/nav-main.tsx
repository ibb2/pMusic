import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { HugeiconsIcon, IconSvgElement } from "@hugeicons/react";
import { useNavigate } from "@tanstack/react-router";
import { LucideIcon } from "lucide-react";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: IconSvgElement;
  }[];
}) {
  const navigate = useNavigate();

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem
              key={item.title}
              onClick={() => navigate({ to: item.url })}
            >
              <SidebarMenuButton className="flex-row">
                {item.icon && (
                  <HugeiconsIcon
                    icon={item.icon}
                    className="size-4.5! shrink-0"
                  />
                )}
                <span className="min-w-0 translate-y-px truncate text-center leading-none text-base font-light">
                  {item.title}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
