import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  company_name: string | null;
  role: string | null;
  contact_type: string;
}

interface AddRecipientsDialogProps {
  sequenceId: string;
  onRecipientsAdded: () => void;
  /** When provided, the dialog defaults to filtering contacts at this company. */
  targetCompany?: string | null;
}

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

const TYPE_GROUPS: Array<{ key: string; label: string }> = [
  { key: "recruiter", label: "Recruiters" },
  { key: "founder", label: "Founders / Hiring Managers" },
  { key: "referral", label: "Referrals" },
  { key: "colleague", label: "Colleagues / Alumni" },
  { key: "other", label: "Other" },
];

export function AddRecipientsDialog({
  sequenceId,
  onRecipientsAdded,
  targetCompany,
}: AddRecipientsDialogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAllCompanies, setShowAllCompanies] = useState(!targetCompany);

  useEffect(() => {
    if (dialogOpen) loadContacts();
  }, [dialogOpen]);

  // Reset show-all toggle when target company changes
  useEffect(() => {
    setShowAllCompanies(!targetCompany);
  }, [targetCompany]);

  const loadContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, name, email, company_name, role, contact_type")
      .eq("status", "active")
      .order("name", { ascending: true });
    setContacts((data as Contact[]) ?? []);
  };

  const visibleContacts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return contacts.filter((c) => {
      // Company filter
      if (!showAllCompanies && targetCompany) {
        const target = targetCompany.toLowerCase();
        const cc = (c.company_name ?? "").toLowerCase();
        if (!cc.includes(target)) return false;
      }
      // Search filter
      if (q) {
        const hay = [c.name, c.email, c.company_name, c.role].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [contacts, searchQuery, showAllCompanies, targetCompany]);

  // Group by contact_type with stable order
  const grouped = useMemo(() => {
    const map: Record<string, Contact[]> = {};
    for (const c of visibleContacts) {
      const key = TYPE_GROUPS.some((g) => g.key === c.contact_type) ? c.contact_type : "other";
      if (!map[key]) map[key] = [];
      map[key].push(c);
    }
    return map;
  }, [visibleContacts]);

  const toggleContact = (contactId: string) => {
    const next = new Set(selectedContacts);
    if (next.has(contactId)) next.delete(contactId);
    else next.add(contactId);
    setSelectedContacts(next);
  };

  const toggleGroup = (groupKey: string) => {
    const ids = (grouped[groupKey] ?? []).map((c) => c.id);
    const next = new Set(selectedContacts);
    const allSelected = ids.every((id) => next.has(id));
    if (allSelected) {
      ids.forEach((id) => next.delete(id));
    } else {
      ids.forEach((id) => next.add(id));
    }
    setSelectedContacts(next);
  };

  const handleAddRecipients = async () => {
    if (selectedContacts.size === 0) {
      toast.error("Please select at least one contact");
      return;
    }

    setLoading(true);
    try {
      const recipients = Array.from(selectedContacts).map((contactId) => ({
        sequence_id: sequenceId,
        contact_id: contactId,
        user_id: DEFAULT_USER_ID,
        state: "waiting",
      }));

      const { error } = await supabase.from("sequence_recipients").insert(recipients);
      if (error) throw error;

      toast.success(`Added ${selectedContacts.size} recipient(s)`);
      setDialogOpen(false);
      setSelectedContacts(new Set());
      setSearchQuery("");
      onRecipientsAdded();
    } catch (error: any) {
      toast.error(error.message || "Failed to add recipients");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Recipients
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Add Recipients to Sequence
            {targetCompany && !showAllCompanies && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                — at {targetCompany}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {targetCompany && (
              <Button
                type="button"
                variant={showAllCompanies ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowAllCompanies((v) => !v)}
                className="whitespace-nowrap"
              >
                {showAllCompanies ? "Showing all" : `Only ${targetCompany}`}
              </Button>
            )}
          </div>

          <div className="border rounded-lg max-h-96 overflow-y-auto">
            {visibleContacts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>No contacts match.</p>
                {targetCompany && !showAllCompanies && (
                  <button
                    type="button"
                    className="text-sm underline mt-2"
                    onClick={() => setShowAllCompanies(true)}
                  >
                    Show contacts from all companies
                  </button>
                )}
              </div>
            ) : (
              TYPE_GROUPS.map((g) => {
                const items = grouped[g.key] ?? [];
                if (items.length === 0) return null;
                const allSelected = items.every((c) => selectedContacts.has(c.id));
                return (
                  <div key={g.key} className="border-b last:border-b-0">
                    <div className="px-3 py-1.5 bg-muted/50 flex items-center gap-2 sticky top-0">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={() => toggleGroup(g.key)}
                      />
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.label}
                      </span>
                      <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1">
                        {items.length}
                      </Badge>
                    </div>
                    {items.map((c) => (
                      <div
                        key={c.id}
                        className="px-3 py-2 flex items-center gap-3 hover:bg-muted/30 cursor-pointer"
                        onClick={() => toggleContact(c.id)}
                      >
                        <Checkbox
                          checked={selectedContacts.has(c.id)}
                          onCheckedChange={() => toggleContact(c.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[c.role, c.company_name, c.email].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{selectedContacts.size} selected</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setSelectedContacts(new Set());
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddRecipients}
                disabled={selectedContacts.size === 0 || loading}
              >
                {loading ? "Adding..." : `Add ${selectedContacts.size || ""}`.trim()}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
