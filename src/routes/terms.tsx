import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useT } from "@/lib/i18n";
import { useSiteBranding } from "@/hooks/use-site-branding";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Use" }] }),
  component: TermsPage,
});

function TermsPage() {
  const { t, lang } = useT();
  const { legal } = useSiteBranding();
  const body = lang === "he" ? legal.terms_he : legal.terms_en;
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-display text-3xl font-semibold mb-6">{t("legal.terms.title")}</h1>
        {body ? (
          <article className="whitespace-pre-wrap text-foreground/90 leading-relaxed">{body}</article>
        ) : (
          <p className="text-muted-foreground">{t("legal.empty")}</p>
        )}
      </div>
    </PublicLayout>
  );
}
