import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Briefcase, BarChart2, Clock } from "lucide-react";

const tabs = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Applications", url: "/applications", icon: Briefcase },
  { title: "Insights", url: "/insights", icon: BarChart2 },
  { title: "Follow-ups", url: "/follow-ups", icon: Clock },
];

export function MobileNav() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t flex h-16">
      {tabs.map((tab) => {
        const active = currentPath.startsWith(tab.url);
        return (
          <Link
            key={tab.url}
            to={tab.url}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <tab.icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-[1.5]"}`} />
            {tab.title}
          </Link>
        );
      })}
    </nav>
  );
}
