import { createRootRoute, Outlet } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect } from "react";

// eslint-disable-next-line react-refresh/only-export-components
export const queryClient = new QueryClient();

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    const handleReconnect = () => {
      queryClient.invalidateQueries();
    };

    window.addEventListener("rayna:plex-reconnected", handleReconnect);

    return () => {
      window.removeEventListener("rayna:plex-reconnected", handleReconnect);
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-hidden h-full">
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </div>
  );
}
