import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Cache aggressively across navigations so repeat visits feel instant.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,        // 1 min: don't refetch on remount
        gcTime: 10 * 60_000,      // keep in memory 10 min
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 2,
        // Exponential backoff with jitter, capped at 4s.
        retryDelay: (i) => Math.min(4000, 300 * Math.pow(2, i)) + Math.random() * 150,
        networkMode: "offlineFirst",
      },
      mutations: { retry: 1, networkMode: "offlineFirst" },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: typeof window === "undefined" ? createMemoryHistory() : undefined,
    scrollRestoration: true,
    defaultPreload: "intent",         // prefetch on hover/focus
    defaultPreloadStaleTime: 0,       // let Query own freshness
    defaultPreloadDelay: 50,
  });

  return router;
};
