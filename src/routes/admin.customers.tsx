import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/admin/customers")({
  component: AdminCustomers,
});

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: { city?: string; country?: string } | null;
  created_at: string;
};

function AdminCustomers() {
  const { t } = useT();
  const [rows, setRows] = useState<Profile[]>([]);
  const [orderCounts, setOrderCounts] = useState<Record<string, { count: number; total: number }>>({});

  const load = () => {
    supabase.from("profiles").select("*").order("created_at", { ascending: false }).then(async ({ data }) => {
      const list = (data ?? []) as Profile[];
      setRows(list);
      const { data: orders } = await supabase.from("orders").select("user_id,total");
      const map: Record<string, { count: number; total: number }> = {};
      (orders ?? []).forEach((o) => {
        const k = o.user_id as string;
        if (!map[k]) map[k] = { count: 0, total: 0 };
        map[k].count++;
        map[k].total += Number(o.total);
      });
      setOrderCounts(map);
    });
  };
  useEffect(load, []);
  useRealtime("profiles", load);
  useRealtime("orders", load);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">{t("admin.customers")}</h1>
      <div className="border rounded-lg bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="p-3 text-start">Name</th>
              <th className="p-3 text-start">Email</th>
              <th className="p-3 text-start">Phone</th>
              <th className="p-3 text-start">Location</th>
              <th className="p-3 text-start">Orders</th>
              <th className="p-3 text-start">Spent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-3 font-medium">{r.full_name ?? "—"}</td>
                <td className="p-3">{r.email}</td>
                <td className="p-3">{r.phone ?? "—"}</td>
                <td className="p-3 text-xs">{r.address?.city ? `${r.address.city}, ${r.address.country}` : "—"}</td>
                <td className="p-3">{orderCounts[r.id]?.count ?? 0}</td>
                <td className="p-3 font-semibold">${(orderCounts[r.id]?.total ?? 0).toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No customers.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
