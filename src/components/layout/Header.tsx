import { Link } from "@tanstack/react-router";
import { ShoppingBag, User, Mail, Globe, LogOut, Shield, Menu } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-role";
import { useUnreadMessages } from "@/hooks/use-unread";
import { useCart } from "@/lib/cart";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function Header() {
  const { t, lang, setLang } = useT();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const cartCount = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  const unread = useUnreadMessages();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {[
        { to: "/", label: t("nav.home") },
        { to: "/shop", label: t("nav.shop") },
        { to: "/about", label: t("nav.about") },
        { to: "/contact", label: t("nav.contact") },
      ].map((l) => (
        <Link
          key={l.to}
          to={l.to}
          onClick={onClick}
          className="relative text-sm tracking-wide text-foreground/80 hover:text-foreground transition-colors after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-1 after:mx-auto after:w-0 after:h-px after:bg-gradient-gold after:transition-all hover:after:w-full"
        >
          {l.label}
        </Link>
      ))}
    </>
  );

  return (
    <header className="sticky top-0 z-40">
      <div className="glass-panel border-b border-gold/10 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 h-16 md:h-[72px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-6">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden -ms-2">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side={lang === "he" ? "right" : "left"} className="w-72 glass-panel">
                <SheetHeader>
                  <SheetTitle className="font-display tracking-[0.3em] text-gradient-gold">ATELIER</SheetTitle>
                </SheetHeader>
                <div className="hairline-gold my-4" />
                <nav className="flex flex-col gap-1 mt-2">
                  <NavLinks onClick={() => setOpen(false)} />
                </nav>
              </SheetContent>
            </Sheet>
            <Link to="/" className="font-display text-lg md:text-xl font-semibold tracking-[0.25em] text-gradient-gold">
              ATELIER
            </Link>
            <nav className="hidden md:flex items-center gap-7">
              <NavLinks />
            </nav>
          </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLang(lang === "en" ? "he" : "en")}
            className="gap-1.5"
          >
            <Globe className="h-4 w-4" />
            <span className="text-xs font-medium">{lang === "en" ? "עב" : "EN"}</span>
          </Button>

          {user && (
            <Button asChild variant="ghost" size="icon" className="relative">
              <Link to="/inbox">
                <Mail className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </Link>
            </Button>
          )}

          <Button asChild variant="ghost" size="icon" className="relative">
            <Link to="/cart">
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/profile">{t("nav.profile")}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/orders">{t("nav.orders")}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/inbox">{t("nav.inbox")}</Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/admin">
                        <Shield className="h-4 w-4 mr-2" />
                        {t("nav.admin")}
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link to="/login">{t("nav.login")}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
