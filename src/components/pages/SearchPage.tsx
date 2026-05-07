import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search as SearchIcon, Users, Briefcase, Building2, FileText } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { searchAll, emptyResults, totalResultCount, type SearchResults } from "@/lib/search";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setResults(emptyResults); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    const r = await searchAll(q, 10);
    setResults(r);
    setLoading(false);
  };

  const totalResults = totalResultCount(results);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Search</h1>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search contacts, applications, companies, notes..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-11 h-11 text-base"
          autoFocus
        />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Searching...</p>}

      {searched && !loading && totalResults === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <SearchIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No results found for "{query}"</p>
        </CardContent></Card>
      )}

      {results.contacts.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Contacts ({results.contacts.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {results.contacts.map((c) => (
              <Link key={c.id} to="/contacts/$contactId" params={{ contactId: c.id }} className="block p-2 rounded hover:bg-accent">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{[c.company_name, c.email, c.contact_type].filter(Boolean).join(" • ")}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {results.applications.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Briefcase className="h-4 w-4" /> Applications ({results.applications.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {results.applications.map((a) => (
              <Link key={a.id} to="/applications/$applicationId" params={{ applicationId: a.id }} className="block p-2 rounded hover:bg-accent">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{a.role_title}</p>
                  <Badge variant="secondary" className="text-xs">{a.status}</Badge>
                </div>
                {a.company_name && <p className="text-xs text-muted-foreground">{a.company_name}</p>}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {results.companies.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> Companies ({results.companies.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {results.companies.map((c) => (
              <Link key={c.id} to="/companies/$companyId" params={{ companyId: c.id }} className="block p-2 rounded hover:bg-accent">
                <p className="text-sm font-medium">{c.name}</p>
                {c.industry && <p className="text-xs text-muted-foreground">{c.industry}</p>}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {results.notes.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Notes ({results.notes.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {results.notes.map((n) => (
              <div key={n.id} className="p-2 rounded hover:bg-accent">
                <p className="text-sm line-clamp-2">{n.content}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
