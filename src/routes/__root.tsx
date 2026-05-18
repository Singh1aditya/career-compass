import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";
// Side-effect import: initialises Sentry when VITE_SENTRY_DSN is set.
import "@/lib/sentry";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Career CRM — Track Your Professional Network" },
      {
        name: "description",
        content:
          "A personal CRM for managing professional contacts, job applications, and career networking.",
      },
      { property: "og:title", content: "Career CRM" },
      {
        property: "og:description",
        content: "Track your professional network and job search in one place.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
  return (
    <>
      <Outlet />
      <Toaster position="top-right" />
    </>
  );
}
