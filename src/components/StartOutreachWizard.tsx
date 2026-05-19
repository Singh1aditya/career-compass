// 5-step wizard for kicking off an outreach campaign from an application.
// Mirrors the diagram:
//   Step 1  Name + role/company context
//   Step 2  Company sub-list (pre-checked)
//   Step 3  Role/title refinement (best-match badges)
//   Step 4  Email steps composer (initial + 3 followups, variable pills, live preview)
//   Step 5  Confirm + first-email preview
//
// On submit: writes sequence + sequence_steps + sequence_recipients atomically.

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { renderTemplate, loadSender, type TemplateSender } from "@/lib/templates";
import { roleMatches, matchedTokens } from "@/lib/sequence-keywords";
import { useAuth } from "@/hooks/use-auth";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  company_name: string | null;
  role: string | null;
  contact_type: string;
}

const TYPE_GROUPS: Array<{ key: string; label: string }> = [
  { key: "recruiter", label: "Recruiters" },
  { key: "founder", label: "Founders / Hiring Managers" },
  { key: "referral", label: "Referrals" },
  { key: "colleague", label: "Colleagues / Alumni" },
  { key: "other", label: "Other" },
];

interface EmailStepDraft {
  step_type: "initial" | "followup_1" | "followup_2" | "followup_3";
  step_label: string;
  delay_days: number;
  template_subject: string;
  template_body: string;
}

const VARIABLE_PILLS = [
  "{{first_name}}",
  "{{full_name}}",
  "{{role}}",
  "{{company}}",
  "{{contact_email}}",
  "{{my_name}}",
  "{{my_signature}}",
];

function defaultEmailSteps(): EmailStepDraft[] {
  return [
    {
      step_type: "initial",
      step_label: "Initial outreach",
      delay_days: 0,
      template_subject: "Re: {{role}} role at {{company}}",
      template_body:
        "Hi {{first_name}},\n\n" +
        "I came across the {{role}} opportunity at {{company}} and would love to chat about the team and what you're looking for. " +
        "Happy to share my background and a resume if useful.\n\n" +
        "Would 15 minutes this week work?\n\n" +
        "Thanks,\n{{my_name}}\n{{my_signature}}",
    },
    {
      step_type: "followup_1",
      step_label: "Follow-up 1",
      delay_days: 5,
      template_subject: "Following up — {{role}}",
      template_body:
        "Hi {{first_name}},\n\n" +
        "Just bumping this in case it slipped past. Still very interested in the {{role}} role at {{company}}. " +
        "Even a quick async note about the team or hiring timeline would be hugely helpful.\n\n" +
        "Best,\n{{my_name}}",
    },
    {
      step_type: "followup_2",
      step_label: "Follow-up 2",
      delay_days: 7,
      template_subject: "",
      template_body: "",
    },
    {
      step_type: "followup_3",
      step_label: "Follow-up 3",
      delay_days: 10,
      template_subject: "",
      template_body: "",
    },
  ];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  roleTitle: string;
  companyName: string | null;
  onCreated: (sequenceId: string) => void;
}

export function StartOutreachWizard({
  open,
  onOpenChange,
  applicationId,
  roleTitle,
  companyName,
  onCreated,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [name, setName] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [emailSteps, setEmailSteps] = useState<EmailStepDraft[]>(defaultEmailSteps());
  const [previewContactId, setPreviewContactId] = useState<string | null>(null);
  const [sender, setSender] = useState<TemplateSender>({});
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();

  // Reset and seed when opened
  useEffect(() => {
    if (!open || !user) return;
    setStep(1);
    setName(`Outreach for ${roleTitle}${companyName ? ` at ${companyName}` : ""}`);
    setShowAll(false);
    setEmailSteps(defaultEmailSteps());
    setPreviewContactId(null);
    loadContacts();
    loadSender(user.id, true).then((s) => setSender(s));
  }, [open, roleTitle, companyName, user]);

  const loadContacts = async () => {
    setLoadingContacts(true);
    const { data } = await supabase
      .from("contacts")
      .select("id, name, email, company_name, role, contact_type")
      .eq("status", "active")
      .order("name", { ascending: true });
    const all = (data as Contact[]) ?? [];
    setContacts(all);

    if (companyName) {
      const target = companyName.toLowerCase();
      const preSelected = new Set(
        all.filter((c) => (c.company_name ?? "").toLowerCase().includes(target)).map((c) => c.id),
      );
      setSelectedIds(preSelected);
    } else {
      setSelectedIds(new Set());
    }
    setLoadingContacts(false);
  };

  // Step 2 — visible contacts respect company filter / "show all" toggle
  const companyMatched = useMemo(() => {
    if (!companyName) return contacts;
    const target = companyName.toLowerCase();
    return contacts.filter((c) => (c.company_name ?? "").toLowerCase().includes(target));
  }, [contacts, companyName]);

  const visibleContacts = useMemo(() => {
    if (showAll || !companyName) return contacts;
    return companyMatched;
  }, [contacts, companyMatched, companyName, showAll]);

  const grouped = useMemo(() => {
    const map: Record<string, Contact[]> = {};
    for (const c of visibleContacts) {
      const key = TYPE_GROUPS.some((g) => g.key === c.contact_type) ? c.contact_type : "other";
      (map[key] ??= []).push(c);
    }
    return map;
  }, [visibleContacts]);

  // Step 3 — best-match by role keyword overlap (over the company sub-list)
  const refinedList = useMemo(() => {
    return companyMatched
      .map((c) => ({
        contact: c,
        match: roleMatches(roleTitle, c.role),
        tokens: matchedTokens(roleTitle, c.role),
      }))
      .sort((a, b) => Number(b.match) - Number(a.match));
  }, [companyMatched, roleTitle]);

  const matchCount = companyMatched.length;
  const bestMatchCount = refinedList.filter((r) => r.match).length;

  const toggleContact = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleGroup = (key: string) => {
    const ids = (grouped[key] ?? []).map((c) => c.id);
    const next = new Set(selectedIds);
    const allOn = ids.every((id) => next.has(id));
    if (allOn) ids.forEach((id) => next.delete(id));
    else ids.forEach((id) => next.add(id));
    setSelectedIds(next);
  };

  const selectOnlyBestMatches = () => {
    const next = new Set<string>();
    for (const r of refinedList) {
      if (r.match) next.add(r.contact.id);
    }
    setSelectedIds(next);
  };

  const selectedContacts = useMemo(
    () => contacts.filter((c) => selectedIds.has(c.id)),
    [contacts, selectedIds],
  );

  // Pre-select the first eligible recipient as preview target whenever selection changes
  useEffect(() => {
    if (previewContactId && selectedContacts.some((c) => c.id === previewContactId)) return;
    const firstWithEmail = selectedContacts.find((c) => c.email);
    setPreviewContactId(firstWithEmail?.id ?? selectedContacts[0]?.id ?? null);
  }, [selectedContacts, previewContactId]);

  const previewContact = useMemo(
    () => contacts.find((c) => c.id === previewContactId) ?? null,
    [contacts, previewContactId],
  );

  const updateStep = (idx: number, patch: Partial<EmailStepDraft>) => {
    setEmailSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Give the campaign a name");
      setStep(1);
      return;
    }
    const filledSteps = emailSteps.filter((s) => s.template_body.trim().length > 0);
    if (filledSteps.length === 0) {
      toast.error("Add at least one email step");
      setStep(4);
      return;
    }

    setSubmitting(true);

    // 1. sequence
    const { data: seq, error: seqErr } = await supabase
      .from("sequences")
      .insert({
        user_id: user!.id,
        name: name.trim(),
        application_id: applicationId,
        status: "draft",
      })
      .select()
      .single();

    if (seqErr || !seq) {
      toast.error(seqErr?.message ?? "Failed to create sequence");
      setSubmitting(false);
      return;
    }

    // 2. sequence_steps
    const stepRows = filledSteps.map((s, idx) => ({
      sequence_id: seq.id,
      step_number: idx + 1,
      delay_days: s.delay_days,
      template_subject: s.template_subject,
      template_body: s.template_body,
      step_type: s.step_type,
    }));
    const { error: stepsErr } = await supabase.from("sequence_steps").insert(stepRows);
    if (stepsErr) {
      toast.error(`Sequence created but steps failed: ${stepsErr.message}`);
      setSubmitting(false);
      onCreated(seq.id);
      return;
    }

    // 3. sequence_recipients (only with email)
    const eligible = selectedContacts.filter((c) => c.email);
    const skipped = selectedContacts.length - eligible.length;

    if (eligible.length > 0) {
      const { error: recErr } = await supabase.from("sequence_recipients").insert(
        eligible.map((c) => ({
          sequence_id: seq.id,
          contact_id: c.id,
          user_id: user!.id,
          state: "waiting",
        })),
      );
      if (recErr) {
        toast.error(`Sequence + steps created but recipients failed: ${recErr.message}`);
        setSubmitting(false);
        onCreated(seq.id);
        return;
      }
    }

    setSubmitting(false);
    toast.success(
      `Campaign created with ${filledSteps.length} email step${filledSteps.length === 1 ? "" : "s"}` +
        (eligible.length > 0
          ? ` and ${eligible.length} recipient${eligible.length === 1 ? "" : "s"}`
          : "") +
        (skipped > 0 ? ` (${skipped} skipped — no email)` : ""),
    );
    onCreated(seq.id);
  };

  const goNext = () => {
    if (step === 1) {
      if (!name.trim()) {
        toast.error("Name your campaign");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      const anyFilled = emailSteps.some((s) => s.template_body.trim().length > 0);
      if (!anyFilled) {
        toast.error("Add at least one email step (the initial outreach)");
        return;
      }
      setStep(5);
    }
  };

  const goBack = () => {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start Outreach Campaign</DialogTitle>
        </DialogHeader>

        <Stepper step={step} />

        {/* Context banner — visible on every step */}
        <div className="rounded-md border bg-muted/30 p-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="flex items-center gap-1">
            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Applying to</span>
            <span className="font-medium">{roleTitle}</span>
          </span>
          {companyName && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{companyName}</span>
            </span>
          )}
        </div>

        {step === 1 && (
          <Step1Name
            name={name}
            setName={setName}
            matchCount={matchCount}
            bestMatchCount={bestMatchCount}
            companyName={companyName}
          />
        )}

        {step === 2 && (
          <Step2Recipients
            grouped={grouped}
            selectedIds={selectedIds}
            toggleContact={toggleContact}
            toggleGroup={toggleGroup}
            loading={loadingContacts}
            companyName={companyName}
            showAll={showAll}
            setShowAll={setShowAll}
          />
        )}

        {step === 3 && (
          <Step3Refine
            refinedList={refinedList}
            selectedIds={selectedIds}
            toggleContact={toggleContact}
            selectOnlyBestMatches={selectOnlyBestMatches}
            roleTitle={roleTitle}
            bestMatchCount={bestMatchCount}
          />
        )}

        {step === 4 && (
          <Step4Compose
            emailSteps={emailSteps}
            updateStep={updateStep}
            selectedContacts={selectedContacts}
            previewContactId={previewContactId}
            setPreviewContactId={setPreviewContactId}
            previewContact={previewContact}
            sender={sender}
          />
        )}

        {step === 5 && (
          <Step5Confirm
            name={name}
            selectedContacts={selectedContacts}
            emailSteps={emailSteps}
            previewContact={previewContact}
            sender={sender}
          />
        )}

        <DialogFooter className="gap-2">
          <div className="text-xs text-muted-foreground mr-auto self-center">
            {step === 2 && <span>{selectedIds.size} selected (company match)</span>}
            {step === 3 && (
              <span>
                {bestMatchCount} best match{bestMatchCount === 1 ? "" : "es"} · {selectedIds.size}{" "}
                selected
              </span>
            )}
            {step === 4 && (
              <span>
                {emailSteps.filter((s) => s.template_body.trim()).length} of 4 steps configured
              </span>
            )}
          </div>
          {step > 1 && (
            <Button variant="ghost" onClick={goBack} disabled={submitting}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          {step < 5 ? (
            <Button onClick={goNext}>
              Next <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              <Send className="h-3.5 w-3.5 mr-1" />
              {submitting
                ? "Creating..."
                : `Create${selectedIds.size > 0 ? ` with ${selectedIds.size}` : ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Steps ----------

function Stepper({ step }: { step: 1 | 2 | 3 | 4 | 5 }) {
  const items = [
    { n: 1, label: "Name" },
    { n: 2, label: "Company" },
    { n: 3, label: "Refine" },
    { n: 4, label: "Emails" },
    { n: 5, label: "Confirm" },
  ];
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
      {items.map((it, i) => (
        <div key={it.n} className="flex items-center gap-2">
          <div
            className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
              step > it.n
                ? "bg-primary text-primary-foreground"
                : step === it.n
                  ? "bg-primary/15 text-primary border border-primary"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {step > it.n ? <Check className="h-3 w-3" /> : it.n}
          </div>
          <span className={step === it.n ? "text-foreground font-medium" : ""}>{it.label}</span>
          {i < items.length - 1 && <span className="opacity-40">/</span>}
        </div>
      ))}
    </div>
  );
}

function Step1Name({
  name,
  setName,
  matchCount,
  bestMatchCount,
  companyName,
}: {
  name: string;
  setName: (v: string) => void;
  matchCount: number;
  bestMatchCount: number;
  companyName: string | null;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Campaign name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Outreach for ..."
          autoFocus
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {companyName
          ? matchCount > 0
            ? `Found ${matchCount} contact${matchCount === 1 ? "" : "s"} at ${companyName}` +
              (bestMatchCount > 0
                ? ` (${bestMatchCount} role match${bestMatchCount === 1 ? "" : "es"} based on the title above).`
                : ".")
            : `No contacts at ${companyName} yet. You can still create the campaign.`
          : "No company set on this application — you'll see all your contacts on the next step."}
      </p>
    </div>
  );
}

function Step2Recipients({
  grouped,
  selectedIds,
  toggleContact,
  toggleGroup,
  loading,
  companyName,
  showAll,
  setShowAll,
}: {
  grouped: Record<string, Contact[]>;
  selectedIds: Set<string>;
  toggleContact: (id: string) => void;
  toggleGroup: (key: string) => void;
  loading: boolean;
  companyName: string | null;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
}) {
  const totalShown = Object.values(grouped).reduce((acc, arr) => acc + arr.length, 0);
  return (
    <div className="space-y-2">
      {companyName && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {showAll ? "Showing all contacts" : `Showing contacts at ${companyName}`}
          </span>
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="underline text-primary"
          >
            {showAll ? `Only ${companyName}` : "Show all companies"}
          </button>
        </div>
      )}

      <div className="border rounded-md max-h-80 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading contacts…</div>
        ) : totalShown === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No contacts in this view.</p>
            {!showAll && companyName && (
              <button
                type="button"
                className="text-xs underline mt-2"
                onClick={() => setShowAll(true)}
              >
                Show contacts from all companies
              </button>
            )}
          </div>
        ) : (
          TYPE_GROUPS.map((g) => {
            const items = grouped[g.key] ?? [];
            if (items.length === 0) return null;
            const allOn = items.every((c) => selectedIds.has(c.id));
            return (
              <div key={g.key} className="border-b last:border-b-0">
                <div className="px-3 py-1.5 bg-muted/50 flex items-center gap-2 sticky top-0">
                  <Checkbox checked={allOn} onCheckedChange={() => toggleGroup(g.key)} />
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
                      checked={selectedIds.has(c.id)}
                      onCheckedChange={() => toggleContact(c.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[c.role, c.company_name, c.email].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {!c.email && (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1 text-muted-foreground"
                      >
                        no email
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Recipients without an email will be skipped automatically when emails go out.
      </p>
    </div>
  );
}

function Step3Refine({
  refinedList,
  selectedIds,
  toggleContact,
  selectOnlyBestMatches,
  roleTitle,
  bestMatchCount,
}: {
  refinedList: Array<{ contact: Contact; match: boolean; tokens: string[] }>;
  selectedIds: Set<string>;
  toggleContact: (id: string) => void;
  selectOnlyBestMatches: () => void;
  roleTitle: string;
  bestMatchCount: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-muted-foreground">
          Matching contact roles against{" "}
          <span className="font-medium text-foreground">{roleTitle}</span>.
          <span className="ml-1">
            {bestMatchCount > 0
              ? `${bestMatchCount} contact${bestMatchCount === 1 ? "" : "s"} look${bestMatchCount === 1 ? "s" : ""} like a strong match.`
              : "No role-keyword matches in this sub-list — refine manually."}
          </span>
        </div>
        {bestMatchCount > 0 && (
          <Button type="button" size="sm" variant="outline" onClick={selectOnlyBestMatches}>
            <Sparkles className="h-3 w-3 mr-1" /> Pick only best matches
          </Button>
        )}
      </div>

      <div className="border rounded-md max-h-80 overflow-y-auto">
        {refinedList.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No contacts at this company. Go back to step 2 and toggle "Show all companies" to
            expand.
          </div>
        ) : (
          refinedList.map(({ contact, match, tokens }) => (
            <div
              key={contact.id}
              className={`px-3 py-2 flex items-center gap-3 cursor-pointer border-b last:border-b-0 hover:bg-muted/30 ${
                match ? "bg-primary/5" : ""
              }`}
              onClick={() => toggleContact(contact.id)}
            >
              <Checkbox
                checked={selectedIds.has(contact.id)}
                onCheckedChange={() => toggleContact(contact.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{contact.name}</p>
                  {match && (
                    <Badge className="text-[10px] h-4 px-1 bg-primary/15 text-primary border-primary/40">
                      <Sparkles className="h-2.5 w-2.5 mr-0.5" /> best match
                    </Badge>
                  )}
                  {tokens.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      on: {tokens.slice(0, 3).join(", ")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {[contact.role, contact.company_name, contact.email].filter(Boolean).join(" · ")}
                </p>
              </div>
              {!contact.email && (
                <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground">
                  no email
                </Badge>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Step4Compose({
  emailSteps,
  updateStep,
  selectedContacts,
  previewContactId,
  setPreviewContactId,
  previewContact,
  sender,
}: {
  emailSteps: EmailStepDraft[];
  updateStep: (idx: number, patch: Partial<EmailStepDraft>) => void;
  selectedContacts: Contact[];
  previewContactId: string | null;
  setPreviewContactId: (v: string) => void;
  previewContact: Contact | null;
  sender: TemplateSender;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Compose initial outreach + up to 3 follow-ups. Empty steps are skipped. Variables
          substitute per-recipient at send time.
        </p>
        {selectedContacts.length > 0 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Preview as</Label>
            <Select value={previewContactId ?? ""} onValueChange={(v) => setPreviewContactId(v)}>
              <SelectTrigger className="h-7 text-xs w-48">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {selectedContacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.company_name ? ` · ${c.company_name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {emailSteps.map((s, idx) => (
          <StepEditor
            key={s.step_type}
            index={idx}
            step={s}
            updateStep={updateStep}
            previewContact={previewContact}
            sender={sender}
          />
        ))}
      </div>
    </div>
  );
}

function StepEditor({
  index,
  step,
  updateStep,
  previewContact,
  sender,
}: {
  index: number;
  step: EmailStepDraft;
  updateStep: (idx: number, patch: Partial<EmailStepDraft>) => void;
  previewContact: Contact | null;
  sender: TemplateSender;
}) {
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [activeField, setActiveField] = useState<"subject" | "body">("body");

  const insertVar = (token: string) => {
    if (activeField === "subject") {
      const el = subjectRef.current;
      if (!el) return;
      const start = el.selectionStart ?? step.template_subject.length;
      const end = el.selectionEnd ?? step.template_subject.length;
      const next = step.template_subject.slice(0, start) + token + step.template_subject.slice(end);
      updateStep(index, { template_subject: next });
      setTimeout(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      }, 0);
    } else {
      const el = bodyRef.current;
      if (!el) return;
      const start = el.selectionStart ?? step.template_body.length;
      const end = el.selectionEnd ?? step.template_body.length;
      const next = step.template_body.slice(0, start) + token + step.template_body.slice(end);
      updateStep(index, { template_body: next });
      setTimeout(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      }, 0);
    }
  };

  const filled = step.template_body.trim().length > 0;

  return (
    <div className={`border rounded-md p-3 space-y-2 ${filled ? "" : "bg-muted/20"}`}>
      <div className="flex items-center gap-2">
        <Badge variant={filled ? "default" : "outline"} className="text-[10px] h-5 px-1.5">
          {step.step_label}
        </Badge>
        <div className="flex items-center gap-1 ml-auto text-xs">
          <Label className="text-[11px] text-muted-foreground">Send after</Label>
          <Input
            type="number"
            min={0}
            max={60}
            className="h-6 w-14 text-xs"
            value={step.delay_days}
            onChange={(e) => updateStep(index, { delay_days: Math.max(0, Number(e.target.value)) })}
          />
          <span className="text-[11px] text-muted-foreground">
            day{step.delay_days === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div>
        <Label className="text-[11px]">Subject</Label>
        <Input
          ref={subjectRef}
          value={step.template_subject}
          onChange={(e) => updateStep(index, { template_subject: e.target.value })}
          onFocus={() => setActiveField("subject")}
          placeholder={index === 0 ? "Re: {{role}} role at {{company}}" : "(optional)"}
          className="text-sm"
        />
      </div>

      <div>
        <Label className="text-[11px]">Body</Label>
        <Textarea
          ref={bodyRef}
          rows={6}
          value={step.template_body}
          onChange={(e) => updateStep(index, { template_body: e.target.value })}
          onFocus={() => setActiveField("body")}
          placeholder={
            index === 0 ? "Hi {{first_name}}, …" : "(leave empty to skip this follow-up)"
          }
          className="text-sm font-mono"
        />
      </div>

      <div className="flex flex-wrap gap-1">
        <span className="text-[11px] text-muted-foreground self-center mr-1">Variables:</span>
        {VARIABLE_PILLS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => insertVar(v)}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-background hover:bg-accent"
          >
            {v}
          </button>
        ))}
      </div>

      {filled && previewContact && (
        <div className="rounded-md bg-blue-50 border border-blue-200 p-2 text-xs space-y-1">
          <p className="font-semibold text-blue-900">Preview · {previewContact.name}</p>
          {step.template_subject && (
            <p>
              <span className="text-muted-foreground">Subject: </span>
              <span className="font-medium">
                {renderTemplate(step.template_subject, previewContact, sender)}
              </span>
            </p>
          )}
          <p className="whitespace-pre-wrap">
            {renderTemplate(step.template_body, previewContact, sender)}
          </p>
        </div>
      )}
    </div>
  );
}

function Step5Confirm({
  name,
  selectedContacts,
  emailSteps,
  previewContact,
  sender,
}: {
  name: string;
  selectedContacts: Contact[];
  emailSteps: EmailStepDraft[];
  previewContact: Contact | null;
  sender: TemplateSender;
}) {
  const eligible = selectedContacts.filter((c) => c.email);
  const skipped = selectedContacts.length - eligible.length;
  const filledSteps = emailSteps.filter((s) => s.template_body.trim());
  const initial = filledSteps[0];

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">Campaign</Label>
        <p className="text-sm font-medium">{name}</p>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <Stat n={eligible.length} label="Will be enrolled" tone="green" />
        <Stat n={skipped} label="Skipped (no email)" tone="muted" />
        <Stat n={filledSteps.length} label="Email steps" tone="primary" />
        <Stat
          n={Math.max(...filledSteps.map((s) => s.delay_days), 0)}
          label="Days max delay"
          tone="muted"
        />
      </div>

      {initial && previewContact && (
        <div className="rounded-md border p-3 space-y-1.5">
          <p className="text-xs font-semibold">First email · sample for {previewContact.name}</p>
          {initial.template_subject && (
            <p className="text-sm">
              <span className="text-muted-foreground">Subject: </span>
              <span className="font-medium">
                {renderTemplate(initial.template_subject, previewContact, sender)}
              </span>
            </p>
          )}
          <p className="text-sm whitespace-pre-wrap font-mono">
            {renderTemplate(initial.template_body, previewContact, sender)}
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Sequence will be created in <span className="font-medium">draft</span>. Toggle to{" "}
        <span className="font-medium">active</span> on the sequence page to start sending.
      </p>
    </div>
  );
}

function Stat({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone: "green" | "muted" | "primary";
}) {
  const color =
    tone === "green"
      ? "text-green-600"
      : tone === "primary"
        ? "text-primary"
        : "text-muted-foreground";
  return (
    <div className="border rounded-md p-2">
      <p className={`text-2xl font-bold ${color}`}>{n}</p>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}
