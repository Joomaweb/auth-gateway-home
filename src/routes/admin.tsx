import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-role";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  component: AdminGate,
});

function AdminGate() {
  const { user, loading } = useAuth();
  const { isAdmin, checking, error, retry } = useIsAdmin();

  if (loading || checking) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">טוען...</div>;
  }
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full border rounded-lg p-6 space-y-4 text-center bg-card">
          <h1 className="text-xl font-semibold">נדרשת התחברות</h1>
          <p className="text-sm text-muted-foreground">יש להתחבר עם משתמש אדמין כדי לגשת לפאנל הניהול.</p>
          <Button asChild className="w-full"><Link to="/login">התחבר</Link></Button>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full border rounded-lg p-6 space-y-4 text-center bg-card">
          <h1 className="text-xl font-semibold">בעיה זמנית בחיבור</h1>
          <p className="text-sm text-muted-foreground">בדיקת הרשאת האדמין לא חזרה בזמן. נסה שוב בעוד רגע.</p>
          <Button onClick={() => retry()} className="w-full">נסה שוב</Button>
        </div>
      </div>
    );
  }
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
