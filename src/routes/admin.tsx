import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-role";
import { AdminLayout } from "@/components/layout/AdminLayout";

export const Route = createFileRoute("/admin")({
  component: AdminGate,
});

function AdminGate() {
  const { user, loading } = useAuth();
  const { isAdmin, checking } = useIsAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || checking) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (!isAdmin) {
      navigate({ to: "/" });
    }
  }, [user, loading, isAdmin, checking, navigate]);

  if (loading || checking) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }
  if (!user || !isAdmin) return null;

  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}
