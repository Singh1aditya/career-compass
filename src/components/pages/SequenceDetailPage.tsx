import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { Plus, Trash2, Mail, Users, ArrowRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddRecipientsDialog } from "@/components/AddRecipientsDialog";
import { TemplatePreview } from "@/components/TemplatePreview";
import { processPendingSends } from "@/lib/sequence-utils";

interface Sequence {
  id: string;
  name: string;
  application_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface SequenceStep {
  id: string;
  sequence_id: string;
  step_number: number;
  delay_days: number;
  template_subject: string;
  template_body: string;
  step_type: string;
}

interface Recipient {
  id: string;
  sequence_id: string;
  contact_id: string;
  state: string;
  next_send_at: string | null;
  enrolled_at: string;
  contact?: {
    name: string;
    email: string;
  };
}

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

export function SequenceDetailPage({ sequenceId }: { sequenceId: string }) {
  const navigate = useNavigate();
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [stepForm, setStepForm] = useState({
    step_type: "initial",
    delay_days: 0,
    template_subject: "",
    template_body: "",
  });

  useEffect(() => {
    loadSequence();
  }, [sequenceId]);

  const loadSequence = async () => {
    const { data: seqData } = await supabase
      .from("sequences")
      .select("*")
      .eq("id", sequenceId)
      .single();

    if (seqData) {
      setSequence(seqData);

      const { data: stepsData } = await supabase
        .from("sequence_steps")
        .select("*")
        .eq("sequence_id", sequenceId)
        .order("step_number", { ascending: true });

      setSteps((stepsData as SequenceStep[]) ?? []);

      const { data: recipientsData } = await supabase
        .from("sequence_recipients")
        .select("*")
        .eq("sequence_id", sequenceId)
        .order("enrolled_at", { ascending: false });

      setRecipients((recipientsData as Recipient[]) ?? []);
    }

    setLoading(false);
  };

  const handleAddStep = async () => {
    if (!stepForm.template_subject.trim() || !stepForm.template_body.trim()) {
      toast.error("Please fill all fields");
      return;
    }

    const nextStepNumber = Math.max(0, ...steps.map((s) => s.step_number)) + 1;

    const { error } = await supabase.from("sequence_steps").insert({
      sequence_id: sequenceId,
      step_number: nextStepNumber,
      delay_days: stepForm.delay_days,
      template_subject: stepForm.template_subject,
      template_body: stepForm.template_body,
      step_type: stepForm.step_type,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Step added");
    setDialogOpen(false);
    setStepForm({
      step_type: "initial",
      delay_days: 0,
      template_subject: "",
      template_body: "",
    });
    loadSequence();
  };

  const deleteStep = async (stepId: string) => {
    const { error } = await supabase
      .from("sequence_steps")
      .delete()
      .eq("id", stepId);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Step deleted");
    loadSequence();
  };

  const handleSendNow = async () => {
    if (steps.length === 0) {
      toast.error("Add email steps before sending");
      return;
    }

    if (recipients.length === 0) {
      toast.error("Add recipients before sending");
      return;
    }

    setSendingEmails(true);
    try {
      const result = await processPendingSends();
      toast.success(`Processed ${result.sent} email(s)`);
      loadSequence();
    } catch (error: any) {
      toast.error(error.message || "Failed to send emails");
    } finally {
      setSendingEmails(false);
    }
  };

  const stepLabels: Record<string, string> = {
    initial: "Initial Email",
    followup_1: "Follow-up 1",
    followup_2: "Follow-up 2",
    followup_3: "Follow-up 3",
  };

  if (loading) return <div>Loading...</div>;
  if (!sequence) return <div>Sequence not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{sequence.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {recipients.length} recipient{recipients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSendNow}
            disabled={sendingEmails || steps.length === 0 || recipients.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {sendingEmails ? "Sending..." : "Send Now"}
          </Button>
          <Button variant="outline" onClick={() => navigate({ to: "/sequences" })}>
            Back
          </Button>
        </div>
      </div>

      <Tabs defaultValue="steps" className="w-full">
        <TabsList>
          <TabsTrigger value="steps">Email Steps</TabsTrigger>
          <TabsTrigger value="recipients">Recipients ({recipients.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="steps" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Email Sequence</h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add Step
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Sequence Step</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Step Type</Label>
                      <Select
                        value={stepForm.step_type}
                        onValueChange={(v) =>
                          setStepForm({ ...stepForm, step_type: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="initial">Initial Email</SelectItem>
                          <SelectItem value="followup_1">Follow-up 1</SelectItem>
                          <SelectItem value="followup_2">Follow-up 2</SelectItem>
                          <SelectItem value="followup_3">Follow-up 3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Days to wait</Label>
                      <Input
                        type="number"
                        min="0"
                        value={stepForm.delay_days}
                        onChange={(e) =>
                          setStepForm({
                            ...stepForm,
                            delay_days: parseInt(e.target.value) || 0,
                          })
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Email Subject</Label>
                    <Input
                      value={stepForm.template_subject}
                      onChange={(e) =>
                        setStepForm({
                          ...stepForm,
                          template_subject: e.target.value,
                        })
                      }
                      placeholder="e.g., Checking in on {{role}} role at {{company}}"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Variables: {{'{{'}}first_name{{'}}'}}
                      , {{{'{' }}}company{{'}}'}}
                      , {{{'{' }}}role{{'}}'}}
                      , {{{'{' }}}my_name{{'}}'}}
                    </p>
                  </div>
                  <div>
                    <Label>Email Body</Label>
                    <Textarea
                      value={stepForm.template_body}
                      onChange={(e) =>
                        setStepForm({
                          ...stepForm,
                          template_body: e.target.value,
                        })
                      }
                      placeholder="Dear {{first_name}},..."
                      rows={6}
                    />
                  </div>
                  <div className="flex gap-2">
                    <TemplatePreview
                      subject={stepForm.template_subject}
                      body={stepForm.template_body}
                    />
                    <Button onClick={handleAddStep} className="flex-1">
                      Add Step
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {steps.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Mail className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No steps yet. Add the first email step to get started!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {steps.map((step, idx) => (
                <div key={step.id}>
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge>{stepLabels[step.step_type]}</Badge>
                          {step.delay_days > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Wait {step.delay_days} days
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => deleteStep(step.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <p className="text-sm font-medium">Subject:</p>
                        <p className="text-sm text-muted-foreground">
                          {step.template_subject}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Body:</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                          {step.template_body}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  {idx < steps.length - 1 && (
                    <div className="flex justify-center py-2">
                      <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recipients" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Recipients</h2>
            <AddRecipientsDialog
              sequenceId={sequenceId}
              onRecipientsAdded={loadSequence}
            />
          </div>

          {recipients.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No recipients yet. Add contacts to this sequence!</p>
                {steps.length === 0 && (
                  <p className="text-xs mt-2">
                    Add email steps first, then add recipients.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">
                        Contact
                      </th>
                      <th className="px-4 py-2 text-left font-medium">State</th>
                      <th className="px-4 py-2 text-left font-medium">
                        Enrolled
                      </th>
                      <th className="px-4 py-2 text-left font-medium">
                        Next Send
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((r) => (
                      <tr key={r.id} className="border-t hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{r.contact?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.contact?.email}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{r.state}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {new Date(r.enrolled_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {r.next_send_at
                            ? new Date(r.next_send_at).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
