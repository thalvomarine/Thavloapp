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
    defaultPreloadStaleTime: 0,
    ...(history ? { history } : {}),
  });

  return router;
};
