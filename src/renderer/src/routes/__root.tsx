import { createRootRoute, Outlet } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect } from "react";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Rayna's durable cache lives in the Bun process. Queries must still run
      // while the browser reports offline so the renderer can read that cache.
      networkMode: "always",
    },
  },
});

export const Route = createRootRoute({
  component: () => (
    <div className="flex flex-1 flex-col overflow-hidden h-full">
      <QueryClientProvider client={queryClient}>
        <NetworkStatusBridge />
        <Outlet />
        {/*<ReactQueryDevtools initialIsOpen={false} />*/}
      </QueryClientProvider>
    </div>
  ),
});

function NetworkStatusBridge() {
  useEffect(() => {
    const update = () => {
      void window.api.network.setOffline(!navigator.onLine).then(() => {
        void queryClient.invalidateQueries();
      });
    };

    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return null;
}
