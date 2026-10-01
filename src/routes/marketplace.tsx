import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/marketplace")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/", search: { panel: "parts" } });
  },
});
