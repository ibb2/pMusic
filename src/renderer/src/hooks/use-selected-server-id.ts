import { useQuery } from "@tanstack/react-query";

/**
 * Exposes only the stable Plex server identifier to renderer queries. The
 * selected server object (and any credentials it may contain) is not retained
 * in React Query's cache.
 */
export function useSelectedServerId() {
  return useQuery({
    queryKey: ["selected-server-id"],
    queryFn: async () => {
      const server = await window.api.auth.getUserSelectedServer();
      return server?.clientIdentifier ?? null;
    },
    staleTime: Infinity,
  });
}
