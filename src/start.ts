import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

// Security headers applied to every server response (SSR + server routes/fns).
// Defense-in-depth on top of Supabase JWT auth + React's auto-escaping.
const SECURITY_HEADERS: Record<string, string> = {
  // Prevents the site being embedded in iframes (clickjacking).
  "X-Frame-Options": "DENY",
  // Browsers must not sniff MIME types — blocks some XSS via uploaded files.
  "X-Content-Type-Options": "nosniff",
  // Don't leak full URL to cross-origin sites.
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Disable powerful browser features by default.
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(self)",
  // Force HTTPS for 2 years incl. subdomains.
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  // XSS protection legacy header (still respected by some browsers).
  "X-XSS-Protection": "1; mode=block",
};

const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  const response = result as unknown as Response;
  if (response && response.headers && typeof response.headers.set === "function") {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      if (!response.headers.has(k)) response.headers.set(k, v);
    }
  }
  return result;
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: {
        "content-type": "text/html; charset=utf-8",
        ...SECURITY_HEADERS,
      },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, securityHeadersMiddleware],
}));
