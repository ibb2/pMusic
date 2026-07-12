import { AppSidebar } from "@/components/app-sidebar";
import { PlayerFooter } from "@/components/layout/PlayerFooter";
import { LyricsPanel } from "@/components/layout/LyricsPanel";
import { QueueSidebar } from "@/components/layout/QueueSidebar";
import {
  UltraBlurProvider,
  useUltraBlur,
} from "@/components/layout/UltraBlurProvider";
import { SiteHeader } from "@/components/site-header";
import { StartupLoading } from "@/components/StartupLoading";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    const isUserLoggedIn = await window.api.auth.isUserSignedIn();
    const server = await window.api.auth.getUserSelectedServer();

    if (!isUserLoggedIn) {
      throw redirect({
        to: "/auth",
      });
    }

    if (!server) {
      throw redirect({
        to: "/setup",
      });
    }
  },
  component: AppLayoutComponent,
});

function AppLayoutComponent() {
  const [queueOpen, setQueueOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);

  return (
    // <StartupLoading>
    <UltraBlurProvider>
      <div className="flex h-full min-h-0 w-full min-w-0 bg-(--color-sidebar) flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <SidebarProvider className="h-full! min-h-0!  [&_div[data-slot='sidebar-container']]:absolute!">
            <AppSidebar variant="inset" collapsible="icon" />
            <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
              <UltraBlurBackground />
              <SiteHeader />
              <div
                data-app-scroll-container
                className="relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
              >
                {lyricsOpen ? <LyricsPanel /> : <Outlet />}
              </div>
            </SidebarInset>
            <QueueSidebar open={queueOpen} />
          </SidebarProvider>
        </div>
        <PlayerFooter
          queueOpen={queueOpen}
          onToggleQueue={() => setQueueOpen((open) => !open)}
          lyricsOpen={lyricsOpen}
          onToggleLyrics={() => setLyricsOpen((open) => !open)}
        />
      </div>
    </UltraBlurProvider>
    // </StartupLoading>
  );
}

function UltraBlurBackground() {
  const { ultraBlur, enabled } = useUltraBlur();
  if (!ultraBlur || !enabled) return null;

  const lightUrl = typeof ultraBlur === "string" ? ultraBlur : ultraBlur.light;
  const darkUrl = typeof ultraBlur === "string" ? ultraBlur : ultraBlur.dark;

  return (
    <>
      <div
        key={`light-${lightUrl}`}
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-100 transition-opacity duration-700 dark:opacity-0"
        style={{ backgroundImage: `url(${lightUrl})` }}
      />
      <div
        key={`dark-${darkUrl}`}
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-0 transition-opacity duration-700 dark:opacity-100"
        style={{ backgroundImage: `url(${darkUrl})` }}
      />
      <div
        className={cn(
          "absolute inset-0 z-[1] pointer-events-none transition-opacity duration-700",
          "bg-white/5 dark:bg-black/10",
        )}
      />
    </>
  );
}
