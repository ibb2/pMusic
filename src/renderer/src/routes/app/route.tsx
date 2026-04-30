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
    <StartupLoading>
      <div className="flex flex-col h-screen w-screen">
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <SidebarProvider
            defaultOpen={false}
            className="h-full! min-h-0! [&_div[data-slot='sidebar-container']]:absolute! [&_div[data-slot='sidebar-container']]:h-full! [&_div[data-slot='sidebar-container']]:top-0! [&_div[data-slot='sidebar-container']]:bottom-0!"
          >
            <AppSidebar collapsible="icon" />
            <SidebarInset className="h-full min-h-0 overflow-hidden">
              <SiteHeader />
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                <Outlet />
              </div>
            </SidebarInset>
          </SidebarProvider>
        </div>
        <PlayerFooter />
      </div>
    </StartupLoading>
  );
}
