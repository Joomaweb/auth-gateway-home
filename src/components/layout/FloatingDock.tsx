import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Store, ShoppingBag, User, Info } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function FloatingDock() {
  const { t } = useT();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const cartCount = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));

  const items = [
    { to: "/", icon: Home, label: t("nav.home"), exact: true },
    { to: "/shop", icon: Store, label: t("nav.shop") },
    { to: "/cart", icon: ShoppingBag, label: t("nav.cart") ?? "Cart", badge: cartCount },
    { to: "/about", icon: Info, label: t("nav.about") },
    { to: "/profile", icon: User, label: t("nav.profile") },
  ];

  const isActive = (to: string, exact?: boolean) =>
    exact ? path === to : path === to || path.startsWith(to + "/");

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none"
      aria-label="Bottom navigation"
    >
      <nav className="pointer-events-auto mx-auto max-w-md glass-panel rounded-2xl shadow-elegant border border-gold/20 px-2 py-2">
        <ul className="grid grid-cols-5">
          {items.map((it) => {
            const active = isActive(it.to, it.exact);
            return (
              <li key={it.to} className="flex">
                <Link
                  to={it.to}
                  className={cn(
                    "relative flex-1 flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-xl transition-all duration-300",
                    active
                      ? "bg-gradient-gold text-gold-foreground shadow-soft scale-[1.03]"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  <div className="relative">
                    <it.icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 1.8} />
                    {it.badge && it.badge > 0 ? (
                      <span className="absolute -top-1.5 -right-2 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                        {it.badge}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[10px] tracking-wide font-medium leading-none">
                    {it.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
