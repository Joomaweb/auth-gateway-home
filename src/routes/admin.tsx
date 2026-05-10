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
    }
  }, [user, loading, checking, navigate]);

  if (loading || checking) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">טוען...</div>;
  }
  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-lg w-full border border-destructive/40 bg-destructive/10 text-destructive rounded-lg p-6 space-y-3">
          <h1 className="text-xl font-semibold">אין לך הרשאות אדמין</h1>
          <p className="text-sm text-foreground/80">
            המשתמש שלך ({user.email}) לא רשום כאדמין בטבלת <code>user_roles</code> ב-Supabase.
            הרץ את הפקודה הבאה ב-SQL Editor של Supabase ואז התנתק והתחבר מחדש:
          </p>
          <pre className="text-xs bg-background border rounded p-3 overflow-auto text-start" dir="ltr">
{`INSERT INTO public.user_roles (user_id, role)
VALUES ('${user.id}', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;`}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}
