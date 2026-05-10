import { Header } from "./Header";
import { Footer } from "./Footer";
import { FloatingDock } from "./FloatingDock";
import type { ReactNode } from "react";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pb-24 md:pb-0">{children}</main>
      <Footer />
      <FloatingDock />
    </div>
  );
}
