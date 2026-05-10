import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { GENERIC_AUTH_ERROR, isValidEmail } from "@/lib/security";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "התחברות" },
      { name: "description", content: "התחבר לחשבון שלך" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValidEmail(email) || password.length < 1 || password.length > 128) {
      setError(GENERIC_AUTH_ERROR);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (error) {
      // Generic message — never reveal whether email exists.
      setError(GENERIC_AUTH_ERROR);
      toast.error(GENERIC_AUTH_ERROR);
      return;
    }
    toast.success("Signed in");
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
          <CardTitle className="text-2xl">ברוך הבא</CardTitle>
          <CardDescription>התחבר לחשבון שלך כדי להמשיך</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
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
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {loading ? "מתחבר..." : "התחבר"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            אין לך חשבון?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">
              הרשמה
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
