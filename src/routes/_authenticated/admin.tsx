import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getValidUser } from "@/lib/auth-guard";
import { ensureSuperadminRouteAccess } from "@/lib/superadmin";
import { n, useSessionUser } from "@/lib/session";
import { ThalvoLoader } from "@/components/ThalvoLoader";
import { MissionShell } from "@/components/mission/MissionShell";
import { SuperadminDesk } from "@/components/admin/SuperadminDesk";
import { useTranslation } from "react-i18next";

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
  const { user, loading: sessionLoading } = useSessionUser();
  const { profile, loading } = n(user?.id);
  if ((!user && sessionLoading) || loading) return <ThalvoLoader />;
  if (!profile) return null;

  return (
    <MissionShell profile={profile}>
      <div className="mb-4 flex justify-end">
        <Link
          to="/app/admin"
          className="inline-flex h-9 items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-100"
        >
          {t("admin.super.open_tower")}
        </Link>
      </div>
      <SuperadminDesk />
    </MissionShell>
  );
}
