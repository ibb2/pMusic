/* eslint-disable @typescript-eslint/explicit-function-return-type */
import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";
import { NavMain } from "./nav-main";
import { Home } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AudioWave01FreeIcons,
  Home02Icon,
  Vynil03Icon,
} from "@hugeicons/core-free-icons";
import { NavLibrary } from "./nav-library";

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Home",
      url: "/app",
      icon: Home02Icon,
    },
    // {
    //   title: "Artists",
    //   url: "/app/library/artists",
    //   icon: ContactRound,
    // },
  ],
  // navClouds: [
  //   {
  //     title: 'Capture',
  //     icon: IconCamera,
  //     isActive: true,
  //     url: '#',
  //     items: [
  //       {
  //         title: 'Active Proposals',
  //         url: '#'
  //       },
  //       {
  //         title: 'Archived',
  //         url: '#'
  //       }
  //     ]
  //   },
  //   {
  //     title: 'Proposal',
  //     icon: IconFileDescription,
  //     url: '#',
  //     items: [
  //       {
  //         title: 'Active Proposals',
  //         url: '#'
  //       },
  //       {
  //         title: 'Archived',
  //         url: '#'
  //       }
  //     ]
  //   },
  //   {
  //     title: 'Prompts',
  //     icon: IconFileAi,
  //     url: '#',
  //     items: [
  //       {
  //         title: 'Active Proposals',
  //         url: '#'
  //       },
  //       {
  //         title: 'Archived',
  //         url: '#'
  //       }
  //     ]
  //   }
  // ],
  // navSecondary: [
  //   {
  //     title: 'Settings',
  //     url: '#',
  //     icon: IconSettings
  //   },
  //   {
  //     title: 'Get Help',
  //     url: '#',
  //     icon: IconHelp
  //   },
  //   {
  //     title: 'Search',
  //     url: '#',
  //     icon: IconSearch
  //   }
  // ],
  library: [
    // {
    //   name: "Liked Songs",
    //   url: "#",
    //   icon: Heart,
    // },
    { name: "Albums", url: "/app/library/albums", icon: Vynil03Icon },
    // { name: "Artits", url: "/app/library/artists", icon: DiscAlbum },
    // { name: "Playlists", url: "/app/library/playlists", icon: DiscAlbum },
    // {
    //   name: "All Music",
    //   url: "#",
    //   icon: Music,
    // },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // Check if running on macOS
  // const isMacOS = navigator.platform.toUpperCase().indexOf('MAC') >= 0

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="flex items-center data-[slot=sidebar-menu-button]:p-2 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0!"
            >
              <a
                href="#"
                className="flex w-full flex-row items-center justify-start gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
              >
                <HugeiconsIcon
                  icon={AudioWave01FreeIcons}
                  className="size-6! shrink-0"
                />
                <span className="truncate text-xl font-normal group-data-[collapsible=icon]:hidden">
                  Rayna
                </span>
              </a>
            </SidebarMenuButton>
            {/*<SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <div className="flex flex-row">
                <div className="bg-[#ffb150] dark:bg-[#ffb050e1] dark:text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <AudioLines className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Rayna</span>
                </div>
              </div>
            </SidebarMenuButton>*/}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavLibrary items={data.library} />
        {/*<NavDocuments items={data.documents} />*/}
        {/*<NavSecondary items={data.navSecondary} className="mt-auto" /> */}
      </SidebarContent>
    </Sidebar>
  );
}
