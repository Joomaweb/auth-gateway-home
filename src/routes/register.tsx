import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "הרשמה" },
      { name: "description", content: "צור חשבון חדש" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    if (password.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      toast.error(signUpError.message);
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        full_name: fullName,
        email,
      });
      if (profileError && !profileError.message.includes("duplicate")) {
        console.error("profile insert error:", profileError);
      }
    }

    setLoading(false);

    if (!data.session) {
      toast.success("נרשמת בהצלחה! אנא בדוק את האימייל שלך לאישור.");
      navigate({ to: "/login" });
      return;
    }

    toast.success("Account created");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-primary-foreground">
              <path d="M12 2L2 12l10 10 10-10L12 2z" fill="currentColor" />
            </svg>
          </div>
          <CardTitle className="text-2xl">יצירת חשבון</CardTitle>
          <CardDescription>הצטרף אלינו עוד היום</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">שם מלא</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="ltr"
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">אימות סיסמה</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                dir="ltr"
                className="text-right"
              />
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm p-3">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "נרשם..." : "הירשם"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            כבר יש לך חשבון?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              התחברות
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
