import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/hooks/use-realtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Globe, Eye, Clock, Fingerprint } from "lucide-react";

export const Route = createFileRoute("/admin/visits")({
  component: AdminVisits,
});

type Visit = {
  id: string;
  user_id: string | null;
  visitor_id: string | null;
  ip: string | null;
  path: string | null;
  user_agent: string | null;
  created_at: string;
};

function AdminVisits() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error: err } = await supabase
      .from("site_visits")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    setError(err ? err.message : null);
    setVisits((data ?? []) as Visit[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);
  useRealtime("site_visits", load);

  const now = Date.now();
  const last24h = visits.filter((v) => now - new Date(v.created_at).getTime() < 24 * 3600 * 1000);
  const uniqueDevices = new Set(visits.map((v) => v.visitor_id).filter(Boolean)).size;
  const uniqueIps = new Set(visits.map((v) => v.ip).filter(Boolean)).size;
  // "פר אייפי + קוקי ביחד": ספירה של צירופים ייחודיים
  const uniqueCombined = new Set(
    visits.map((v) => `${v.ip ?? "?"}|${v.visitor_id ?? v.user_id ?? "?"}`),
  ).size;

  const perDevice = aggregate(visits, (v) => v.visitor_id ?? v.user_id ?? "לא ידוע");
  const perIp = aggregate(visits, (v) => v.ip ?? "לא ידוע");
  const perCombined = aggregate(
    visits,
    (v) => `${v.ip ?? "?"} · ${(v.visitor_id ?? v.user_id ?? "?").slice(0, 8)}`,
  );

  const cards = [
    { label: "סה״כ כניסות (30 יום)", value: visits.length, icon: Eye },
    { label: "כניסות (24 שעות)", value: last24h.length, icon: Clock },
    { label: "מכשירים ייחודיים (קוקי)", value: uniqueDevices, icon: Fingerprint },
    { label: "IP ייחודיים", value: uniqueIps, icon: Globe },
    { label: "משתמשים ייחודיים (IP + קוקי)", value: uniqueCombined, icon: Users },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="font-display text-3xl font-semibold">קאונטר כניסות</h1>
      <p className="text-sm text-muted-foreground">
        {loading ? "טוען…" : "מתעדכן בזמן אמת · נספר לפי IP ולפי קוקי מכשיר"}
      </p>
      {error && <p className="text-sm text-destructive">שגיאה בטעינה: {error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs uppercase text-muted-foreground tracking-wider">
                {c.label}
              </CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <AggregateCard title="לפי מכשיר (קוקי)" rows={perDevice} />
        <AggregateCard title="לפי IP" rows={perIp} />
        <AggregateCard title="לפי IP + קוקי" rows={perCombined} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">כניסות אחרונות</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="text-right py-2">זמן</th>
                  <th className="text-right py-2">משתמש</th>
                  <th className="text-right py-2">קוקי</th>
                  <th className="text-right py-2">IP</th>
                  <th className="text-right py-2">נתיב</th>
                </tr>
              </thead>
              <tbody>
                {visits.slice(0, 100).map((v) => (
                  <tr key={v.id} className="border-b last:border-b-0">
                    <td className="py-2 text-muted-foreground whitespace-nowrap">
                      {new Date(v.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 font-mono text-xs">
                      {v.user_id ? v.user_id.slice(0, 8) : "אורח"}
                    </td>
                    <td className="py-2 font-mono text-xs">
                      {v.visitor_id ? v.visitor_id.slice(0, 8) : "—"}
                    </td>
                    <td className="py-2 font-mono text-xs">{v.ip ?? "—"}</td>
                    <td className="py-2 text-xs">{v.path ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function aggregate(visits: Visit[], key: (v: Visit) => string) {
  const map = new Map<string, number>();
  for (const v of visits) {
    const k = key(v);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
}

function AggregateCard({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין נתונים.</p>
        ) : (
          <div className="space-y-1">
            {rows.map(([k, n]) => (
              <div key={k} className="flex justify-between text-sm border-b py-1.5 last:border-b-0">
                <span className="font-mono text-xs truncate max-w-[70%]">{k}</span>
                <span className="font-semibold">{n}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
