import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

type AddressForm = { address?: string; city?: string; zip?: string; country?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function addressFrom(value: unknown): AddressForm {
  if (!isRecord(value)) return {};
  return {
    address: typeof value.address === "string" ? value.address : "",
    city: typeof value.city === "string" ? value.city : "",
    zip: typeof value.zip === "string" ? value.zip : "",
    country: typeof value.country === "string" ? value.country : "",
  };
}

function ProfilePage() {
  const { user, loading } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    address: "",
    city: "",
    zip: "",
    country: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        const address = addressFrom(data.address);
        setForm({
          full_name: data.full_name ?? "",
          phone: data.phone ?? "",
          address: address.address ?? "",
          city: address.city ?? "",
          zip: address.zip ?? "",
          country: address.country ?? "",
        });
      }
    });
  }, [user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { sanitizeText } = await import("@/lib/security");
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email,
      full_name: sanitizeText(form.full_name, 80),
      phone: sanitizeText(form.phone, 30),
      address: {
        address: sanitizeText(form.address, 200),
        city: sanitizeText(form.city, 80),
        zip: sanitizeText(form.zip, 20),
        country: sanitizeText(form.country, 80),
      },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success(t("profile.saved"));
  };

  if (!user) return null;

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="font-display text-4xl font-semibold mb-8">{t("profile.title")}</h1>
        <form onSubmit={submit} className="space-y-4 border rounded-lg p-6 bg-card">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user.email ?? ""} disabled dir="ltr" />
          </div>
          <Field label={t("checkout.fullName")} value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
          <Field label={t("checkout.phone")} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label={t("checkout.address")} value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("checkout.city")} value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <Field label={t("checkout.zip")} value={form.zip} onChange={(v) => setForm({ ...form, zip: v })} />
          </div>
          <Field label={t("checkout.country")} value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? t("common.loading") : t("profile.save")}
          </Button>
        </form>
      </div>
    </PublicLayout>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
