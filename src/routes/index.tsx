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
    // Cap wait so a hung Supabase session check cannot blank the landing on
    // mobile networks — public home must paint even if auth is slow.
    const user = await Promise.race([
      getValidUser(),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 1800);
      }),
    ]);
    if (user) throw redirect({ to: "/app" });
  },
  component: BrandLanding,
});
