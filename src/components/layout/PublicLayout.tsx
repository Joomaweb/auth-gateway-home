import { Header } from "./Header";
import { Footer } from "./Footer";
import { FloatingDock } from "./FloatingDock";
import { useActiveTheme } from "@/hooks/use-active-theme";
import type { ReactNode } from "react";

export function PublicLayout({ children }: { children: ReactNode }) {
  const { theme } = useActiveTheme();
  const layout = theme.layout;

  // Side-left: vertical sidebar nav, no top header
  if (layout === "side-left") {
    return (
      <div className="min-h-screen flex">
        <Header variant="side-left" />
        <div className="flex-1 flex flex-col min-w-0 md:ms-64">
          <main className="flex-1 pb-24 md:pb-0">{children}</main>
          <Footer />
        </div>
        <FloatingDock />
      </div>
    );
  }

  // Floating-dock: header detached/floating
  if (layout === "floating-dock") {
    return (
      <div className="min-h-screen flex flex-col">
        <Header variant="floating" />
        <main className="flex-1 pb-28 pt-24">{children}</main>
        <Footer />
        <FloatingDock />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header variant={layout} />
      <main className="flex-1 pb-24 md:pb-0">{children}</main>
      <Footer />
      <FloatingDock />
    </div>
  );
}
