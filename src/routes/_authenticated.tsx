import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/insights": "Insights",
  "/calendar": "Calendar",
  "/contacts": "Contacts",
  "/applications": "Applications",
  "/companies": "Companies",
  "/follow-ups": "Follow-ups",
  "/sequences": "Sequences",
  "/quick-add": "Quick Add",
  "/import": "Import",
  "/settings": "Settings",
  "/health": "System Health",
  "/search": "Search",
};

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useAuth();
  const title =
    Object.entries(pageTitles).find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "Career CRM";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b px-4 shrink-0 gap-3">
            <SidebarTrigger className="hidden md:flex" />
            <span className="font-semibold text-sm truncate">{title}</span>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileNav />
    </SidebarProvider>
  );
}
