import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Copy, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/coupons")({
  component: AdminCoupons,
});

type Coupon = {
  id: string;
  code: string;
  discount_percent: number;
  active: boolean;
  max_uses: number | null;
  uses: number;
  created_at: string;
};

function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState<number>(10);
  const [maxUses, setMaxUses] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return;
    setCoupons((data ?? []) as Coupon[]);
  };

  useEffect(() => {
    load();
  }, []);
  useRealtime("coupons", load);

  const create = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return toast.error("יש להזין קוד קופון");
    if (percent <= 0 || percent > 100) return toast.error("אחוז חייב להיות 1-100");
    setBusy(true);
    const { error } = await supabase.from("coupons").insert({
      code: c,
      discount_percent: percent,
      active: true,
      max_uses: maxUses ? Number(maxUses) : null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setCode("");
    setPercent(10);
    setMaxUses("");
    toast.success("קופון נוצר");
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("coupons").update({ active }).eq("id", id);
  };

  const remove = async (id: string) => {
    if (!confirm("למחוק את הקופון?")) return;
    await supabase.from("coupons").delete().eq("id", id);
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("הקוד הועתק");
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="font-display text-3xl font-semibold">קופונים</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">יצירת קופון חדש</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label>קוד הקופון</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SUMMER20"
            />
          </div>
          <div className="space-y-2">
            <Label>אחוז הנחה (%)</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>מקסימום שימושים (אופציונלי)</Label>
            <Input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="ללא הגבלה"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={create} disabled={busy} className="w-full gap-2">
              <Plus className="h-4 w-4" /> צור קופון
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">רשימת קופונים ({coupons.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {coupons.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין קופונים עדיין.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="text-right py-2">קוד</th>
                    <th className="text-right py-2">הנחה</th>
                    <th className="text-right py-2">שימושים</th>
                    <th className="text-right py-2">פעיל</th>
                    <th className="text-right py-2">נוצר</th>
                    <th className="text-right py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id} className="border-b last:border-b-0">
                      <td className="py-3 font-mono font-semibold">
                        <button
                          onClick={() => copy(c.code)}
                          className="inline-flex items-center gap-1 hover:text-primary"
                        >
                          {c.code} <Copy className="h-3 w-3" />
                        </button>
                      </td>
                      <td className="py-3">{c.discount_percent}%</td>
                      <td className="py-3">
                        {c.uses}
                        {c.max_uses ? ` / ${c.max_uses}` : ""}
                      </td>
                      <td className="py-3">
                        <Switch
                          checked={c.active}
                          onCheckedChange={(v) => toggle(c.id, v)}
                        />
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-left">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(c.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
