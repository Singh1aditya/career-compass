// Custom Cloudflare Workers entry that wraps TanStack Start and injects
// security headers on every response.
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://sentry.io",
    "font-src 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
};

const fetchHandler = createStartHandler(defaultStreamHandler);

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
    const response = await (fetchHandler as (r: Request, e: unknown, c: ExecutionContext) => Promise<Response>)(
      request,
      env,
      ctx,
    );
    const secure = new Headers(response.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      secure.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: secure,
    });
  },
};
