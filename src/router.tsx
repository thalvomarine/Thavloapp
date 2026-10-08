import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createNativeRouterHistory } from "@/lib/native-history";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();
  const history = createNativeRouterHistory();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    trailingSlash: "never",
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    defaultPendingMs: 800,
    defaultPendingMinMs: 0,
    ...(history ? { history } : {}),
  });

  return router;
};
