import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string;
  company_name?: string;
  role?: string;
}

interface TemplatePreviewProps {
  subject: string;
  body: string;
  recipientId?: string;
}

const DEFAULT_USER_NAME = "You";

export function TemplatePreview({
  subject,
  body,
  recipientId,
}: TemplatePreviewProps) {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contacts")
      .select("id, name, email, company_name, role")
      .eq("status", "active")
      .limit(10)
      .order("name", { ascending: true });

    if (data && data.length > 0) {
      setContacts(data);
      setSelectedContact(data[0]);
    }
    setLoading(false);
  };

  const renderTemplate = (text: string, contact: Contact | null) => {
    if (!contact) return text;

    const firstName = contact.name.split(" ")[0];
    return text
      .replace(/{{first_name}}/g, firstName)
      .replace(/{{company}}/g, contact.company_name || "[Company]")
      .replace(/{{role}}/g, contact.role || "[Role]")
      .replace(/{{my_name}}/g, DEFAULT_USER_NAME);
  };

  const renderedSubject = renderTemplate(subject, selectedContact);
  const renderedBody = renderTemplate(body, selectedContact);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-2" /> Preview
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Template Preview</DialogTitle>
        </DialogHeader>

        {contacts.length > 0 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Preview as:</label>
              <Select
                value={selectedContact?.id || ""}
                onValueChange={(id) => {
                  const contact = contacts.find((c) => c.id === id);
                  if (contact) setSelectedContact(contact);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name} ({contact.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedContact && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="text-sm">
                    <p className="text-muted-foreground">To:</p>
                    <p className="font-medium">{selectedContact.email}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">
                      SUBJECT
                    </p>
                    <p className="bg-muted p-3 rounded text-sm font-medium break-words">
                      {renderedSubject || "[Empty subject]"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">
                      BODY
                    </p>
                    <div className="bg-muted p-4 rounded text-sm whitespace-pre-wrap break-words font-mono text-xs leading-relaxed min-h-[200px] max-h-[400px] overflow-y-auto">
                      {renderedBody || "[Empty body]"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-900 mb-2">
                Available Variables:
              </p>
              <ul className="text-xs text-blue-800 space-y-1 font-mono">
                <li>
                  <code>{"{{"}}first_name{{"}}"}}</code> -{" "}
                  <span className="font-normal">Contact's first name</span>
                </li>
                <li>
                  <code>{"{{"}}company{{"}}"}}</code> -{" "}
                  <span className="font-normal">Contact's company</span>
                </li>
                <li>
                  <code>{"{{"}}role{{"}}"}}</code> -{" "}
                  <span className="font-normal">Contact's role</span>
                </li>
                <li>
                  <code>{"{{"}}my_name{{"}}"}}</code> -{" "}
                  <span className="font-normal">Your name</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {contacts.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No contacts available for preview</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading contacts...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
