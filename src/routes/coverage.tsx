import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/coverage")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
