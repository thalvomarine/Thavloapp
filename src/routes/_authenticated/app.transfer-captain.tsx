import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { TransferCaptainPanel } from "@/components/transfer-captain/TransferCaptainPanel";
import { useProfile, useSessionUser } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/app/transfer-captain")({
  ssr: false,
  component: TransferCaptainPage,
});

function TransferCaptainPage() {
  const routeUser = Route.useRouteContext().user;
  const { user: sessionUser } = useSessionUser();
  const user = sessionUser ?? routeUser;
  if (!user) return null;
  return <TransferCaptainGate userId={user.id} />;
}

function TransferCaptainGate({ userId }: { userId: string }) {
  const { profile, loading } = useProfile(userId);
  if (loading && !profile) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-white/50">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }
  if (profile?.role === "Supplier") return <Navigate to="/app/dealer" replace />;
  return <TransferCaptainPanel />;
}
