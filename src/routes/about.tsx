import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About — ATELIER" }] }),
  component: AboutPage,
});

function AboutPage() {
  const { t } = useT();
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-20">
        <h1 className="font-display text-5xl font-semibold mb-6">{t("about.title")}</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">{t("about.body")}</p>
        <div className="mt-12 grid gap-8 sm:grid-cols-3 text-sm">
          <div><h3 className="font-semibold mb-2">Quality</h3><p className="text-muted-foreground">Premium fabrics, ethical sourcing, lasting craftsmanship.</p></div>
          <div><h3 className="font-semibold mb-2">Timeless</h3><p className="text-muted-foreground">Classic silhouettes that stay relevant year after year.</p></div>
          <div><h3 className="font-semibold mb-2">Honest</h3><p className="text-muted-foreground">Fair prices, no markups, transparent process.</p></div>
        </div>
      </div>
    </PublicLayout>
  );
}
