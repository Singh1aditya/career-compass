import { useState, useEffect } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Clock,
  Search,
  Menu,
  Building2,
  CalendarDays,
  Send,
  Zap,
  Upload,
  Settings,
  BarChart2,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { searchAll, emptyResults, totalResultCount, type SearchResults } from "@/lib/search";

const primaryTabs = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Applications", url: "/applications", icon: Briefcase },
  { title: "Follow-ups", url: "/follow-ups", icon: Clock },
];

const moreItems = [
  { title: "Insights", url: "/insights", icon: BarChart2 },
  { title: "Companies", url: "/companies", icon: Building2 },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Sequences", url: "/sequences", icon: Send },
  { title: "Quick Add", url: "/quick-add", icon: Zap },
  { title: "Import", url: "/import", icon: Upload },
  { title: "Settings", url: "/settings", icon: Settings },
];

function MobileSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults(emptyResults);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      setResults(await searchAll(query, 5));
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const go = (path: string) => {
    setOpen(false);
    setQuery("");
    navigate({ to: path });
  };

  const total = totalResultCount(results);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground"
          aria-label="Search"
        >
          <Search className="h-5 w-5 stroke-[1.5]" />
          Search
        </button>
      </SheetTrigger>
      <SheetContent side="top" className="h-[80vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>Search</SheetTitle>
        </SheetHeader>
        <Input
          autoFocus
          placeholder="Search contacts, applications, companies..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-2"
        />
        <div className="flex-1 overflow-y-auto mt-3 -mx-2">
          {query.length < 2 ? (
            <p className="text-xs text-muted-foreground px-3 py-4">
              Type at least 2 characters to search.
            </p>
          ) : loading ? (
            <p className="text-xs text-muted-foreground px-3 py-4">Searching…</p>
          ) : total === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-4">No results</p>
          ) : (
            <div className="text-sm">
              {results.contacts.length > 0 && (
                <div className="border-b">
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/50">
                    Contacts
                  </div>
                  {results.contacts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => go(`/contacts/${c.id}`)}
                      className="w-full text-left px-3 py-2 hover:bg-accent"
                    >
                      <div className="font-medium text-sm">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[c.company_name, c.email].filter(Boolean).join(" • ")}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {results.applications.length > 0 && (
                <div className="border-b">
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/50">
                    Applications
                  </div>
                  {results.applications.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => go(`/applications/${a.id}`)}
                      className="w-full text-left px-3 py-2 hover:bg-accent"
                    >
                      <div className="font-medium text-sm">{a.role_title}</div>
                      {a.company_name && (
                        <div className="text-xs text-muted-foreground">{a.company_name}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {results.companies.length > 0 && (
                <div className="border-b">
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/50">
                    Companies
                  </div>
                  {results.companies.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => go(`/companies/${c.id}`)}
                      className="w-full text-left px-3 py-2 hover:bg-accent"
                    >
                      <div className="font-medium text-sm">{c.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MoreMenu({ currentPath }: { currentPath: string }) {
  const [open, setOpen] = useState(false);
  const active = moreItems.some((i) => currentPath.startsWith(i.url));
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            active ? "text-primary" : "text-muted-foreground"
          }`}
          aria-label="More"
        >
          <Menu className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-[1.5]"}`} />
          More
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader>
          <SheetTitle>More</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-3 gap-3 mt-4 pb-4">
          {moreItems.map((item) => {
            const isActive = currentPath.startsWith(item.url);
            return (
              <Link
                key={item.url}
                to={item.url}
                onClick={() => setOpen(false)}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-xs ${
                  isActive ? "border-primary text-primary" : "text-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-center">{item.title}</span>
              </Link>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function MobileNav() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t flex h-16">
      {primaryTabs.map((tab) => {
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
      <MobileSearch />
      <MoreMenu currentPath={currentPath} />
    </nav>
  );
}
