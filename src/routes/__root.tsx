import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { I18nProvider } from "@/lib/i18n";
import { SiteBrandingProvider } from "@/hooks/use-site-branding";
import { ActiveThemeProvider } from "@/hooks/use-active-theme";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/lib/supabase";
import { clearAppDataCaches, subscribeAppDataChanges } from "@/lib/realtime-sync";

function getBackendOrigin() {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_PROJECT_URL;
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

const backendOrigin = getBackendOrigin();

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Page not found.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex gap-2 justify-center">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Retry
          </button>
          <a href="/" className="rounded-md border px-4 py-2 text-sm">
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      ...(backendOrigin
        ? [
            { rel: "preconnect", href: backendOrigin },
            { rel: "dns-prefetch", href: `//${new URL(backendOrigin).host}` },
          ]
        : []),
      { rel: "preconnect", href: "https://www.youtube.com" },
      { rel: "preconnect", href: "https://www.youtube-nocookie.com" },
      { rel: "preconnect", href: "https://player.vimeo.com" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <SiteBrandingProvider>
          <ActiveThemeProvider>
            <AuthProvider>
              <RealtimeCacheBridge />
              <Outlet />
              <PromoBanner />
              <Toaster richColors position="top-center" />
            </AuthProvider>
          </ActiveThemeProvider>
        </SiteBrandingProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

function RealtimeCacheBridge() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearAppDataCaches();
      queryClient.invalidateQueries({ refetchType: "active" });
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 200);
    };

    const unsubscribeSignals = subscribeAppDataChanges(refresh);
    const channel = supabase
      .channel("global-store-data-sync")
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "products" } as never,
        schedule,
      )
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "categories" } as never,
        schedule,
      )
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "product_variants" } as never,
        schedule,
      )
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "store_settings" } as never,
        schedule,
      )
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "orders" } as never,
        schedule,
      )
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "order_items" } as never,
        schedule,
      )
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "profiles" } as never,
        schedule,
      )
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "conversations" } as never,
        schedule,
      )
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "messages" } as never,
        schedule,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribeSignals();
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}
