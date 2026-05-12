import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Archive,
  RotateCcw,
  User,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  role: string | null;
  contact_type: string;
  status: string;
  notes: string | null;
  created_at: string;
}

const contactTypes = ["recruiter", "founder", "referral", "colleague", "other"];

type SortKey = "name" | "company_name" | "role" | "contact_type" | "created_at";
type SortDir = "asc" | "desc";

export function ContactsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company_name: "",
    role: "",
    contact_type: "other",
    notes: "",
  });

  useEffect(() => {
    if (user) loadContacts();
  }, [user, statusFilter]);

  const loadContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .eq("status", statusFilter)
      .order("created_at", { ascending: false });
    setContacts((data as Contact[]) ?? []);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const result = contacts.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.toLowerCase().includes(q) ?? false) ||
        (c.company_name?.toLowerCase().includes(q) ?? false) ||
        (c.role?.toLowerCase().includes(q) ?? false) ||
        (c.notes?.toLowerCase().includes(q) ?? false);
      const matchesType = typeFilter === "all" || c.contact_type === typeFilter;
      return matchesSearch && matchesType;
    });

    const sorted = [...result].sort((a, b) => {
      const av = (a[sortKey] ?? "") as string;
      const bv = (b[sortKey] ?? "") as string;
      const cmp = av.localeCompare(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [contacts, searchQuery, typeFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  };

  const resetForm = () => {
    setForm({ name: "", email: "", phone: "", company_name: "", role: "", contact_type: "other", notes: "" });
    setSelectedContact(null);
  };

  const handleSave = async () => {
    if (!user || !form.name.trim()) return;
    if (selectedContact) {
      const { error } = await supabase
        .from("contacts")
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq("id", selectedContact.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Contact updated");
    } else {
      const { error } = await supabase
        .from("contacts")
        .insert({ ...form, user_id: user.id });
      if (error) { toast.error(error.message); return; }
      toast.success("Contact added");
    }
    setDialogOpen(false);
    resetForm();
    loadContacts();
  };

  const toggleArchive = async (contact: Contact) => {
    const newStatus = contact.status === "active" ? "archived" : "active";
    await supabase.from("contacts").update({ status: newStatus }).eq("id", contact.id);
    toast.success(newStatus === "archived" ? "Contact archived" : "Contact restored");
    loadContacts();
  };

  const typeColors: Record<string, string> = {
    recruiter: "bg-primary/10 text-primary",
    founder: "bg-chart-3/10 text-chart-3",
    referral: "bg-success/10 text-success",
    colleague: "bg-chart-4/10 text-chart-4",
    other: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} {filtered.length === 1 ? "contact" : "contacts"}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Contact</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedContact ? "Edit Contact" : "Add Contact"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Smith" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@co.com" /></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1..." /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Company</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
                <div><Label>Role</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.contact_type} onValueChange={(v) => setForm({ ...form, contact_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {contactTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
              <Button onClick={handleSave} className="w-full">{selectedContact ? "Update" : "Add"} Contact</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search contacts (name, email, phone, company, role, notes)..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {contactTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <User className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No contacts found. Add your first contact to get started!</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-foreground">
                      Name <SortIcon k="name" />
                    </button>
                  </TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("company_name")} className="flex items-center gap-1 hover:text-foreground">
                      Company <SortIcon k="company_name" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("role")} className="flex items-center gap-1 hover:text-foreground">
                      Role <SortIcon k="role" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("contact_type")} className="flex items-center gap-1 hover:text-foreground">
                      Type <SortIcon k="contact_type" />
                    </button>
                  </TableHead>
                  <TableHead className="max-w-[200px]">Notes</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("created_at")} className="flex items-center gap-1 hover:text-foreground">
                      Created <SortIcon k="created_at" />
                    </button>
                  </TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => navigate({ to: `/contacts/${c.id}` })}
                  >
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone || "—"}</TableCell>
                    <TableCell>{c.company_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.role || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${typeColors[c.contact_type]}`}>
                        {c.contact_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
                      {c.notes || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => { e.stopPropagation(); toggleArchive(c); }}
                      >
                        {c.status === "active" ? <Archive className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
