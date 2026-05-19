import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Search, Users, Briefcase, Building2, FileText, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { searchAll, emptyResults, totalResultCount, type SearchResults } from "@/lib/search";

export function GlobalSearch({ collapsed = false }: { collapsed?: boolean } = {}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K to focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click outside to close
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults(emptyResults);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await searchAll(query, 5);
      setResults(r);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const handleNavigate = (path: string) => {
    setOpen(false);
    setQuery("");
    navigate({ to: path });
  };

  const total = totalResultCount(results);

  // When sidebar is collapsed, show a compact icon button instead of the full input.
  if (collapsed) {
    return (
      <div className="px-2 pt-2 pb-1 flex justify-center">
        <button
          type="button"
          aria-label="Search (⌘K)"
          title="Search (⌘K)"
          onClick={() => navigate({ to: "/search" })}
          className="h-8 w-8 rounded-md hover:bg-accent flex items-center justify-center text-muted-foreground"
        >
          <Search className="h-4 w-4" />
        </button>
        {/* Offscreen input so the Cmd+K shortcut still has a focus target */}
        <input ref={inputRef} className="sr-only" tabIndex={-1} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative px-2 pt-2 pb-1">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Search... (⌘K)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="pl-8 pr-7 h-8 text-xs"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            title="Clear search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && query.length >= 2 && (
        <div className="absolute left-2 right-2 top-full mt-1 z-50 bg-popover border rounded-md shadow-lg max-h-[60vh] overflow-y-auto">
          {loading && <div className="p-3 text-xs text-muted-foreground">Searching...</div>}

          {!loading && total === 0 && (
            <div className="p-3 text-xs text-muted-foreground">No results</div>
          )}

          {results.contacts.length > 0 && (
            <div className="border-b">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/50 flex items-center gap-1">
                <Users className="h-3 w-3" /> Contacts
              </div>
              {results.contacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleNavigate(`/contacts/${c.id}`)}
                  className="w-full text-left px-3 py-1.5 hover:bg-accent text-xs"
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {[c.company_name, c.email, c.contact_type].filter(Boolean).join(" • ")}
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.applications.length > 0 && (
            <div className="border-b">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/50 flex items-center gap-1">
                <Briefcase className="h-3 w-3" /> Applications
              </div>
              {results.applications.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleNavigate(`/applications/${a.id}`)}
                  className="w-full text-left px-3 py-1.5 hover:bg-accent text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate">{a.role_title}</span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1">
                      {a.status}
                    </Badge>
                  </div>
                  {a.company_name && (
                    <div className="text-[11px] text-muted-foreground truncate">
                      {a.company_name}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {results.companies.length > 0 && (
            <div className="border-b">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/50 flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Companies
              </div>
              {results.companies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleNavigate(`/companies/${c.id}`)}
                  className="w-full text-left px-3 py-1.5 hover:bg-accent text-xs"
                >
                  <div className="font-medium">{c.name}</div>
                  {c.industry && (
                    <div className="text-[11px] text-muted-foreground">{c.industry}</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {results.notes.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/50 flex items-center gap-1">
                <FileText className="h-3 w-3" /> Notes
              </div>
              {results.notes.map((n) => {
                const path = n.contact_id
                  ? `/contacts/${n.contact_id}`
                  : n.application_id
                    ? `/applications/${n.application_id}`
                    : "/search";
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleNavigate(path)}
                    className="w-full text-left px-3 py-1.5 hover:bg-accent text-xs"
                  >
                    <div className="line-clamp-2 text-[11px]">{n.content}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
