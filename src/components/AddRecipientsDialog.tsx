import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  email: string;
}

interface AddRecipientsDialogProps {
  sequenceId: string;
  onRecipientsAdded: () => void;
}

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

export function AddRecipientsDialog({
  sequenceId,
  onRecipientsAdded,
}: AddRecipientsDialogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dialogOpen) {
      loadContacts();
    }
  }, [dialogOpen]);

  const loadContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, name, email")
      .eq("status", "active")
      .order("name", { ascending: true });

    setContacts((data as Contact[]) ?? []);
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const toggleContact = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
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

      const { error } = await supabase
        .from("sequence_recipients")
        .insert(recipients);

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
          <DialogTitle>Add Recipients to Sequence</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="border rounded-lg max-h-80 overflow-y-auto">
            {filteredContacts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>No contacts found</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-3 hover:bg-muted/50 transition-colors flex items-center gap-3 cursor-pointer"
                    onClick={() => toggleContact(contact.id)}
                  >
                    <Checkbox
                      checked={selectedContacts.has(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {contact.name}
                      </p>
                      {contact.email && (
                        <p className="text-xs text-muted-foreground truncate">
                          {contact.email}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedContacts.size} selected
            </p>
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
                {loading ? "Adding..." : "Add Recipients"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
