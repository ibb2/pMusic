import { AppSidebar } from "@/components/app-sidebar";
import { PlayerFooter } from "@/components/layout/PlayerFooter";
import {
  UltraBlurProvider,
  useUltraBlur,
} from "@/components/layout/UltraBlurProvider";
import { SiteHeader } from "@/components/site-header";
import { StartupLoading } from "@/components/StartupLoading";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

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
                <Outlet />
              </div>
            </SidebarInset>
          </SidebarProvider>
        </div>
        <PlayerFooter />
      </div>
    </UltraBlurProvider>
    // </StartupLoading>
  );
}

function UltraBlurBackground() {
  const { ultraBlurUrl, enabled } = useUltraBlur();
  if (!ultraBlurUrl || !enabled) return null;

  return (
    <>
      <div
        key={ultraBlurUrl}
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700"
        style={{ backgroundImage: `url(${ultraBlurUrl})` }}
      />
      <div
        className={cn(
          "absolute inset-0 z-[1] pointer-events-none transition-opacity duration-700",
          "bg-white/50 dark:bg-black/20"
        )}
      />
    </>
  );
}
