import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getValidUser } from "@/lib/auth-guard";
import { ensureSuperadminRouteAccess } from "@/lib/superadmin";
import { n, useSessionUser } from "@/lib/session";
import { SuperadminDesk } from "@/components/admin/SuperadminDesk";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getValidUser();
    if (!user) {
      throw redirect({ to: "/auth", search: { next: "/admin" } });
    }
    const ok = await ensureSuperadminRouteAccess(user);
    if (!ok) {
      throw redirect({ to: "/" });
    }
    return { user };
  },
  component: SuperadminPage,
});

function SuperadminPage() {
  const { t } = useTranslation();
  const routeUser = Route.useRouteContext().user;
  const { user: sessionUser } = useSessionUser();
  const user = sessionUser ?? routeUser;
  const { profile, loading } = n(user?.id);
  if (!user) return null;
  if (loading && !profile) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-white/50" />
      </div>
    );
  }
  if (!profile) return null;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Link
          to="/app/admin"
          className="inline-flex h-9 items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-100"
        >
          {t("admin.super.open_tower")}
        </Link>
      </div>
      <SuperadminDesk />
    </>
  );
}
