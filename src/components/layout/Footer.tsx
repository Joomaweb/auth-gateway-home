import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";

export function Footer() {
  const { t } = useT();
  return (
    <footer className="border-t mt-20 bg-secondary/30">
      <div className="max-w-7xl mx-auto px-4 py-12 grid gap-8 md:grid-cols-4">
        <div>
          <h3 className="font-display text-xl font-semibold mb-2">ATELIER</h3>
          <p className="text-sm text-muted-foreground">
            {t("about.body")}
          </p>
        </div>
        <div>
          <h4 className="font-medium text-sm mb-3">{t("footer.shop")}</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/shop" className="hover:text-foreground">{t("nav.shop")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium text-sm mb-3">{t("footer.about")}</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/about" className="hover:text-foreground">{t("nav.about")}</Link></li>
            <li><Link to="/contact" className="hover:text-foreground">{t("nav.contact")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium text-sm mb-3">{t("footer.legal")}</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/terms" className="hover:text-foreground">{t("footer.terms")}</Link></li>
            <li><Link to="/policy" className="hover:text-foreground">{t("footer.policy")}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} ATELIER. {t("footer.rights")}
        </div>
      </div>
    </footer>
  );
}
