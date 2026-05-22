import { Link } from "@tanstack/react-router";
import { ShoppingBag, User, Mail, LogOut, Shield, Menu } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-role";
import { useUnreadMessages } from "@/hooks/use-unread";
import { useCart } from "@/lib/cart";
import { useT } from "@/lib/i18n";
import { useSiteBranding } from "@/hooks/use-site-branding";
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

export type HeaderVariant = "top-classic" | "top-split" | "top-stacked" | "side-left" | "floating";

export function Header({ variant = "top-classic" }: { variant?: HeaderVariant }) {
  const { t, lang } = useT();
  const { branding } = useSiteBranding();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const cartCount = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  const unread = useUnreadMessages();
  const [open, setOpen] = useState(false);
  const siteName = branding.site_name || "";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const links = [
    { to: "/", label: t("nav.home") },
    { to: "/shop", label: t("nav.shop") },
    { to: "/about", label: t("nav.about") },
    { to: "/contact", label: t("nav.contact") },
  ];

  const NavLinks = ({ onClick, vertical }: { onClick?: () => void; vertical?: boolean }) => (
    <>
      {links.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          onClick={onClick}
          className={
            vertical
              ? "block px-3 py-2.5 rounded-md text-sm tracking-wide text-foreground/80 hover:text-foreground hover:bg-muted transition-colors"
              : "relative text-sm tracking-wide text-foreground/80 hover:text-foreground transition-colors after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-1 after:mx-auto after:w-0 after:h-px after:bg-gradient-gold after:transition-all hover:after:w-full"
          }
        >
          {l.label}
        </Link>
      ))}
    </>
  );

  const Logo = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => (
    <Link to="/" className="flex items-center gap-2">
      {branding.logo_url ? (
        <img
          src={branding.logo_url}
          alt={siteName}
          style={branding.logo_height ? { height: `${branding.logo_height}px`, width: "auto" } : undefined}
          className={
            branding.logo_height
              ? "object-contain"
              : size === "lg"
              ? "h-12 md:h-14 w-auto object-contain"
              : size === "sm"
              ? "h-7 w-auto object-contain"
              : "h-8 md:h-10 w-auto object-contain"
          }
        />
      ) : (
        <span
          className={`font-display font-semibold tracking-[0.25em] text-gradient-gold ${
            size === "lg" ? "text-2xl md:text-3xl" : size === "sm" ? "text-base" : "text-lg md:text-xl"
          }`}
        >
          {siteName}
        </span>
      )}
    </Link>
  );

  const Actions = () => (
    <div className="flex items-center gap-0.5 md:gap-1">
      {user && (
        <Button asChild variant="ghost" size="icon" className="relative hidden sm:inline-flex">
          <Link to="/inbox">
            <Mail className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
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
            <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-gradient-gold text-gold-foreground text-[10px] font-bold flex items-center justify-center shadow-soft">
              {cartCount}
            </span>
          )}
        </Link>
      </Button>
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><User className="h-5 w-5" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 glass-panel">
            <DropdownMenuItem asChild><Link to="/profile">{t("nav.profile")}</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/orders">{t("nav.orders")}</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/inbox">{t("nav.inbox")}</Link></DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/admin"><Shield className="h-4 w-4 mr-2" />{t("nav.admin")}</Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" />{t("nav.logout")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button asChild size="sm" className="bg-gradient-gold text-gold-foreground hover:opacity-90 shadow-soft">
          <Link to="/login">{t("nav.login")}</Link>
        </Button>
      )}
    </div>
  );

  const MobileMenu = () => (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden -ms-2"><Menu className="h-5 w-5" /></Button>
      </SheetTrigger>
      <SheetContent side={lang === "he" ? "right" : "left"} className="w-72 glass-panel">
        <SheetHeader>
          <SheetTitle className="font-display tracking-[0.3em] text-gradient-gold">{siteName}</SheetTitle>
        </SheetHeader>
        <div className="hairline-gold my-4" />
        <nav className="flex flex-col gap-1 mt-2"><NavLinks onClick={() => setOpen(false)} vertical /></nav>
      </SheetContent>
    </Sheet>
  );

  // ===== SIDE-LEFT: vertical sidebar =====
  if (variant === "side-left") {
    return (
      <>
        <aside className="hidden md:flex fixed inset-y-0 start-0 w-64 z-40 flex-col border-e border-border bg-sidebar text-sidebar-foreground">
          <div className="p-6 border-b border-border"><Logo size="md" /></div>
          <nav className="flex-1 p-4 flex flex-col gap-1"><NavLinks vertical /></nav>
          <div className="p-4 border-t border-border flex flex-col gap-2"><Actions /></div>
        </aside>
        <header className="md:hidden sticky top-0 z-40 glass-panel border-b border-border">
          <div className="px-4 h-16 flex items-center justify-between">
            <MobileMenu />
            <Logo size="sm" />
            <Actions />
          </div>
        </header>
      </>
    );
  }

  // ===== TOP-SPLIT: logo center, nav split =====
  if (variant === "top-split") {
    return (
      <header className="sticky top-0 z-40 glass-panel border-b border-border shadow-soft">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between gap-3">
          <nav className="hidden md:flex items-center gap-6 flex-1 justify-start">
            <Link to="/" className="text-sm tracking-wide hover:text-primary">{t("nav.home")}</Link>
            <Link to="/shop" className="text-sm tracking-wide hover:text-primary">{t("nav.shop")}</Link>
          </nav>
          <div className="flex items-center gap-3 md:hidden"><MobileMenu /></div>
          <div className="flex-1 flex justify-center"><Logo size="lg" /></div>
          <nav className="hidden md:flex items-center gap-6 flex-1 justify-end">
            <Link to="/about" className="text-sm tracking-wide hover:text-primary">{t("nav.about")}</Link>
            <Link to="/contact" className="text-sm tracking-wide hover:text-primary">{t("nav.contact")}</Link>
          </nav>
          <div className="flex items-center"><Actions /></div>
        </div>
      </header>
    );
  }

  // ===== TOP-STACKED: logo top, nav row below =====
  if (variant === "top-stacked") {
    return (
      <header className="sticky top-0 z-40 glass-panel border-b border-border">
        <div className="max-w-7xl mx-auto px-4 pt-4 pb-2 flex flex-col items-center gap-2">
          <div className="w-full flex items-center justify-between">
            <div className="flex-1 flex md:hidden"><MobileMenu /></div>
            <div className="flex-1 flex justify-center md:justify-start"><Logo size="lg" /></div>
            <div className="flex-1 flex justify-end"><Actions /></div>
          </div>
          <nav className="hidden md:flex items-center gap-8 pt-1 pb-2"><NavLinks /></nav>
        </div>
      </header>
    );
  }

  // ===== FLOATING: detached pill on top =====
  if (variant === "floating") {
    return (
      <header className="fixed top-4 inset-x-4 z-40">
        <div className="max-w-6xl mx-auto rounded-2xl glass-panel border border-border shadow-elegant px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MobileMenu />
            <Logo size="sm" />
          </div>
          <nav className="hidden md:flex items-center gap-6"><NavLinks /></nav>
          <Actions />
        </div>
      </header>
    );
  }

  // ===== TOP-CLASSIC (default) =====
  return (
    <header className="sticky top-0 z-40">
      <div className="glass-panel border-b border-gold/10 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 h-16 md:h-[72px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-6">
            <MobileMenu />
            <Logo />
            <nav className="hidden md:flex items-center gap-7"><NavLinks /></nav>
          </div>
          <Actions />
        </div>
      </div>
    </header>
  );
}
