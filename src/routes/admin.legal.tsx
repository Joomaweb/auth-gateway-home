import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { signalAppDataChanged } from "@/lib/realtime-sync";

export const Route = createFileRoute("/admin/legal")({
  component: AdminLegal,
});

type Legal = { terms_en: string; terms_he: string; policy_en: string; policy_he: string };
const DEFAULT_LEGAL: Legal = { terms_en: "", terms_he: "", policy_en: "", policy_he: "" };

function AdminLegal() {
  const [legal, setLegal] = useState<Legal>(DEFAULT_LEGAL);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("store_settings").select("legal").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data?.legal) setLegal({ ...DEFAULT_LEGAL, ...(data.legal as Legal) });
    });
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("store_settings").upsert({ id: 1, legal });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      signalAppDataChanged("store_settings");
      toast.success("נשמר");
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="font-display text-3xl font-semibold">עמודים משפטיים</h1>
      <p className="text-sm text-muted-foreground">
        ערוך את עמודי "תנאי שימוש" ו"מדיניות רכישה" באנגלית ובעברית. השינויים מתעדכנים באתר בזמן אמת.
      </p>
      <form onSubmit={save} className="space-y-6">
        <section className="border rounded-lg p-6 bg-card space-y-4">
          <h3 className="font-semibold">תנאי שימוש / Terms of Use</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>עברית</Label>
              <Textarea rows={14} dir="rtl" value={legal.terms_he} onChange={(e) => setLegal({ ...legal, terms_he: e.target.value })} placeholder="תנאי השימוש באתר..." />
            </div>
            <div className="space-y-2">
              <Label>English</Label>
              <Textarea rows={14} dir="ltr" value={legal.terms_en} onChange={(e) => setLegal({ ...legal, terms_en: e.target.value })} placeholder="Terms of use..." />
            </div>
          </div>
        </section>

        <section className="border rounded-lg p-6 bg-card space-y-4">
          <h3 className="font-semibold">מדיניות רכישה / Purchase Policy</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>עברית</Label>
              <Textarea rows={14} dir="rtl" value={legal.policy_he} onChange={(e) => setLegal({ ...legal, policy_he: e.target.value })} placeholder="מדיניות הרכישה..." />
            </div>
            <div className="space-y-2">
              <Label>English</Label>
              <Textarea rows={14} dir="ltr" value={legal.policy_en} onChange={(e) => setLegal({ ...legal, policy_en: e.target.value })} placeholder="Purchase policy..." />
            </div>
          </div>
        </section>

        <Button type="submit" disabled={busy} className="w-full">{busy ? "שומר..." : "שמור"}</Button>
      </form>
    </div>
  );
}
