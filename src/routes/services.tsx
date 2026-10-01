import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/services")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/", search: { panel: "services" } });
  },
});
