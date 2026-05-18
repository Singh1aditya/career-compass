// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import type { Plugin } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    // unsafe-inline / unsafe-eval are required by Vite HMR and React dev tools in dev mode.
    // In production these are tightened via src/worker.ts which omits unsafe-eval.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://sentry.io",
    "font-src 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
};

// Vite plugin that adds security headers via configureServer (dev) and
// configurePreviewServer (vite preview). Using a plugin instead of
// server.headers because the lovable wrapper strips server.headers.
const securityHeadersPlugin: Plugin = {
  name: "security-headers",
  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        res.setHeader(key, value);
      }
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((_req, res, next) => {
      for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        res.setHeader(key, value);
      }
      next();
    });
  },
};

export default defineConfig({
  vite: {
    plugins: [securityHeadersPlugin],
  },
});
