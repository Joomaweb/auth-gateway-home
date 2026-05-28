import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About — ATELIER" }] }),
  component: AboutPage,
});

type Feature = { title: string; body: string };
type About = { title: string; body: string; features: Feature[] };

const DEFAULT_ABOUT: About = {
  title: "About ATELIER",
  body: "A boutique for classic, refined fashion — premium fabrics, timeless cuts, responsible craftsmanship.",
  features: [
    { title: "Quality", body: "Premium fabrics and meticulous craftsmanship." },
    { title: "Classic", body: "Cuts that never go out of style." },
    { title: "Transparency", body: "Fair pricing, no hidden fees." },
  ],
};

function AboutPage() {
  const [a, setA] = useState<About>(DEFAULT_ABOUT);

  const load = () => {
    supabase
      .from("store_settings")
      .select("about")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.about) setA({ ...DEFAULT_ABOUT, ...(data.about as About) });
      });
  };
  useEffect(load, []);
  useRealtime("store_settings", load);

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-20">
        <h1 className="font-display text-5xl font-semibold mb-6">{a.title}</h1>
        <p className="text-lg text-muted-foreground leading-relaxed whitespace-pre-line">
          {a.body}
        </p>
        {a.features.length > 0 && (
          <div className="mt-12 grid gap-8 sm:grid-cols-3 text-sm">
            {a.features.map((f, i) => (
              <div key={i}>
                <h3 className="font-semibold mb-2 text-gold">{f.title}</h3>
                <p className="text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
