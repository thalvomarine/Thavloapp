import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ThalvoLoader } from "@/components/ThalvoLoader";
import { TransferCaptainPanel } from "@/components/transfer-captain/TransferCaptainPanel";
import { useProfile, useSessionUser } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/app/transfer-captain")({
  ssr: false,
  component: TransferCaptainPage,
});

function TransferCaptainPage() {
  const { user, loading } = useSessionUser();
  if (loading) return <ThalvoLoader />;
  if (!user) return null;
  return (
    <AppShell userId={user.id}>
      <TransferCaptainGate userId={user.id} />
    </AppShell>
  );
}

function TransferCaptainGate({ userId }: { userId: string }) {
  const { profile, loading } = useProfile(userId);
  if (loading) return <ThalvoLoader />;
  if (profile?.role === "Supplier") return <Navigate to="/app/dealer" replace />;
  return <TransferCaptainPanel />;
}
