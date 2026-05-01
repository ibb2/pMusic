import { AppSidebar } from "@/components/app-sidebar";
import { PlayerFooter } from "@/components/layout/PlayerFooter";
import { SiteHeader } from "@/components/site-header";
import { StartupLoading } from "@/components/StartupLoading";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
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
    <div className="flex h-full min-h-0 w-full min-w-0 bg-(--color-sidebar) flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <SidebarProvider className="h-full! min-h-0!  [&_div[data-slot='sidebar-container']]:absolute!">
          <AppSidebar variant="inset" collapsible="icon" />
          <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
            <SiteHeader />
            <div
              data-app-scroll-container
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
            >
              <Outlet />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
      <PlayerFooter />
    </div>
    // </StartupLoading>
  );
}
