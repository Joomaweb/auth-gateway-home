import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — ATELIER" }] }),
  component: ContactPage,
});

function ContactPage() {
  const { t } = useT();
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error(t("contact.loginRequired"));
      return;
    }
    setBusy(true);
    const { data: conv, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, subject, last_message_at: new Date().toISOString() })
      .select()
      .single();
    if (error || !conv) {
      setBusy(false);
      toast.error(error?.message ?? "Error");
      return;
    }
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      sender_id: user.id,
      is_admin: false,
      body,
      read_by_user: true,
    });
    setBusy(false);
    setSubject("");
    setBody("");
    toast.success(t("contact.sent"));
  };

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="font-display text-5xl font-semibold mb-3">{t("contact.title")}</h1>
        <p className="text-muted-foreground mb-8">{t("contact.subtitle")}</p>

        {!user ? (
          <div className="border rounded-lg p-8 bg-card text-center">
            <p className="text-muted-foreground mb-4">{t("contact.loginRequired")}</p>
            <Button asChild><Link to="/login">{t("nav.login")}</Link></Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 border rounded-lg p-6 bg-card">
            <div className="space-y-2">
              <Label>{t("contact.subject")}</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>{t("contact.message")}</Label>
              <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} required />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? t("common.loading") : t("contact.send")}
            </Button>
          </form>
        )}
      </div>
    </PublicLayout>
  );
}
