import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ברוכים הבאים" },
      { name: "description", content: "מערכת אימות מאובטחת" },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary px-4">
      <div className="max-w-2xl text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-primary flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-9 w-9 text-primary-foreground">
            <path d="M12 2L2 12l10 10 10-10L12 2z" fill="currentColor" />
          </svg>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          מערכת אימות מאובטחת
        </h1>
        <p className="text-lg text-muted-foreground">
          התחבר או הירשם כדי להתחיל. מערכת מהירה, מאובטחת ומודרנית.
        </p>
        <div className="flex gap-3 justify-center">
          <Button asChild size="lg">
            <Link to="/login">התחברות</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/register">הרשמה</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
