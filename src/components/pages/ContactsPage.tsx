import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
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
import { toast } from "sonner";
import { Plus, Search, Mail, Phone, Archive, RotateCcw, User } from "lucide-react";

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

export function ContactsPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
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
    let query = supabase
      .from("contacts")
      .select("*")
      .eq("status", statusFilter)
      .order("created_at", { ascending: false });
    const { data } = await query;
    setContacts((data as Contact[]) ?? []);
    setLoading(false);
  };

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (c.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesType = typeFilter === "all" || c.contact_type === typeFilter;
    return matchesSearch && matchesType;
  });

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

  const openEdit = (contact: Contact) => {
    setSelectedContact(contact);
    setForm({
      name: contact.name,
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      company_name: contact.company_name ?? "",
      role: contact.role ?? "",
      contact_type: contact.contact_type,
      notes: contact.notes ?? "",
    });
    setDialogOpen(true);
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
        <h1 className="text-2xl font-bold">Contacts</h1>
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
          <Input placeholder="Search contacts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
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
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4"><div className="h-12 bg-muted rounded" /></CardContent></Card>)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <User className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No contacts found. Add your first contact to get started!</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Card key={c.id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => openEdit(c)}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{c.name}</p>
                    <Badge variant="secondary" className={`text-xs ${typeColors[c.contact_type]}`}>{c.contact_type}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    {c.company_name && <span>{c.company_name}</span>}
                    {c.role && <span>• {c.role}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {c.email && <Mail className="h-3.5 w-3.5 text-muted-foreground" />}
                  {c.phone && <Phone className="h-3.5 w-3.5 text-muted-foreground" />}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 ml-1" onClick={(e) => { e.stopPropagation(); toggleArchive(c); }}>
                    {c.status === "active" ? <Archive className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
