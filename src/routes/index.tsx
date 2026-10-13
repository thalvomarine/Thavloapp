import { createFileRoute, redirect } from "@tanstack/react-router";
import { getValidUser } from "@/lib/auth-guard";
import { BrandLanding } from "@/components/public/BrandLanding";

const TITLE = "THALVO | Marine Operating System";
const DESCRIPTION =
  "THALVO MarineOS — Aegean and Mediterranean. SOS, technicians, spare parts and the coast chart. Partner leads welcome.";

export const Route = createFileRoute("/")({
  ssr: false,
  staleTime: 60_000,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    const user = await getValidUser();
    if (user) throw redirect({ to: "/app" });
  },
  component: BrandLanding,
});
