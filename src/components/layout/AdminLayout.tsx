import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, ShoppingCart, Users, MessageSquare, Settings, ArrowLeft, Menu, Webhook } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  const items = [
    { to: "/admin", label: t("admin.dashboard"), icon: LayoutDashboard, exact: true },
    { to: "/admin/products", label: t("admin.products"), icon: Package },
    { to: "/admin/orders", label: t("admin.orders"), icon: ShoppingCart },
    { to: "/admin/customers", label: t("admin.customers"), icon: Users },
    { to: "/admin/messages", label: t("admin.messages"), icon: MessageSquare },
    { to: "/admin/api", label: "API", icon: Webhook },
    { to: "/admin/settings", label: t("admin.settings"), icon: Settings },
  ];

  const isActive = (to: string, exact?: boolean) =>
    exact ? path === to : path === to || path.startsWith(to + "/");

  const Nav = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex flex-col gap-1 p-3">
      <Link
        to="/"
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("common.back")}
      </Link>
      <div className="h-px bg-border my-2" />
      {items.map((it) => (
        <Link
          key={it.to}
          to={it.to}
          onClick={onClick}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
            isActive(it.to, it.exact)
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <it.icon className="h-4 w-4" />
          {it.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-60 border-e flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-5 py-4 border-b">
          <Link to="/admin" className="font-display text-lg font-semibold">
            ATELIER · {t("nav.admin")}
          </Link>
        </div>
        <Nav />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 border-b flex items-center px-3 gap-3 bg-card">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <Nav onClick={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="font-display text-base font-semibold">ATELIER · {t("nav.admin")}</span>
        </header>
        <div className="flex-1 p-4 md:p-8 overflow-x-hidden">{children}</div>
      </div>
    </div>
  );
}
