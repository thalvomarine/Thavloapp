import { createFileRoute, redirect } from "@tanstack/react-router";
import { getValidUser } from "@/lib/auth-guard";
import { ChartDeck, type ChartPanel } from "@/components/public/ChartDeck";

const TITLE = "THALVO — Marine parts, service and the coast chart";
const DESCRIPTION =
  "Open the Aegean and Mediterranean chart, then browse spare parts and service packages. Sign in only to order, call a technician, or open the live cockpit.";

export const Route = createFileRoute("/")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { panel?: ChartPanel } => {
    if (search.panel === "parts" || search.panel === "services") return { panel: search.panel };
    return {};
  },
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
  component: PublicChartHome,
});

function PublicChartHome() {
  const { panel } = Route.useSearch();
  return <ChartDeck panel={panel} />;
}
