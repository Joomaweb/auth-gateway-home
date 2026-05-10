import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase, type Profile } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LogOut, User, Mail, Calendar, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "לוח הבקרה" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, session, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login" });
    }
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as Profile | null));
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("התנתקת בהצלחה");
    navigate({ to: "/login" });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">טוען...</p>
      </div>
    );
  }

  const fullName = profile?.full_name || (user.user_metadata?.full_name as string) || "משתמש";
  const lastSignIn = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString("he-IL")
    : "—";
  const createdAt = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("he-IL")
    : user.created_at
      ? new Date(user.created_at).toLocaleDateString("he-IL")
      : "—";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-primary-foreground">
                <path d="M12 2L2 12l10 10 10-10L12 2z" fill="currentColor" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold">לוח הבקרה</h1>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            התנתק
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        <div>
          <h2 className="text-3xl font-bold">שלום, {fullName} 👋</h2>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span dir="ltr">{user.email}</span>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">סטטוס חשבון</CardTitle>
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">פעיל</div>
              <CardDescription>החשבון שלך מאומת ופעיל</CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">התחברות אחרונה</CardTitle>
              <Calendar className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{lastSignIn}</div>
              <CardDescription>זמן ההתחברות האחרון</CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">פרטי משתמש</CardTitle>
              <User className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-sm"><span className="text-muted-foreground">שם:</span> {fullName}</div>
              <div className="text-sm"><span className="text-muted-foreground">חבר מאז:</span> {createdAt}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>פרטי פרופיל</CardTitle>
            <CardDescription>המידע השמור על החשבון שלך</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <InfoRow label="שם מלא" value={fullName} />
            <InfoRow label="אימייל" value={user.email ?? "—"} ltr />
            <InfoRow label="מזהה משתמש" value={user.id} ltr />
            <InfoRow label="נוצר בתאריך" value={createdAt} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function InfoRow({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-sm font-medium truncate ${ltr ? "text-left" : ""}`} dir={ltr ? "ltr" : undefined}>
        {value}
      </div>
    </div>
  );
}
