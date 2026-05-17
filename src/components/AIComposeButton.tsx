// Drop-in AI compose button. Renders a "Draft with AI" button that opens a dialog.
// Supports: draft_email, draft_reply, summarize, gap_analysis, auto_tag.
//
// Usage:
//   <AIComposeButton
//     kind="draft_email"
//     context={{ contact_name, company, role, my_name, tone }}
//     onResult={(text) => setBody(text)}
//   />

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Sparkles, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type AIKind = "draft_email" | "draft_reply" | "summarize" | "gap_analysis" | "auto_tag";

interface AIComposeButtonProps {
  kind: AIKind;
  context: Record<string, string>;
  onResult?: (text: string) => void;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

const KIND_LABELS: Record<AIKind, string> = {
  draft_email: "Draft outreach email",
  draft_reply: "Draft reply",
  summarize: "Summarise thread",
  gap_analysis: "JD vs resume gap analysis",
  auto_tag: "Suggest tags",
};

const TONE_OPTIONS = ["professional", "warm", "concise", "enthusiastic", "casual"];

export function AIComposeButton({
  kind,
  context,
  onResult,
  label,
  variant = "outline",
  size = "sm",
}: AIComposeButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [tone, setTone] = useState("professional");
  const [copied, setCopied] = useState(false);
  const [extraContext, setExtraContext] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setOutput(null);
    try {
      const ctx: Record<string, string> = {
        ...context,
        tone,
        ...(extraContext ? { my_background: extraContext } : {}),
      };

      const { data, error } = await supabase.functions.invoke("ai-assist", {
        body: { kind, context: ctx },
      });

      if (error) throw new Error(error.message);

      const result = (data as any)?.output ?? "";
      setOutput(result);
    } catch (e: any) {
      toast.error(e?.message ?? "AI generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUse = () => {
    if (output && onResult) {
      onResult(output);
      setOpen(false);
      toast.success("Draft applied");
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => { setOpen(true); setOutput(null); }}
      >
        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
        {label ?? KIND_LABELS[kind]}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {KIND_LABELS[kind]}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Tone selector for email kinds */}
            {(kind === "draft_email" || kind === "draft_reply") && (
              <div className="flex items-center gap-3">
                <Label className="text-sm shrink-0">Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Extra context for draft_email */}
            {kind === "draft_email" && (
              <div>
                <Label className="text-sm">Your background (optional)</Label>
                <Textarea
                  className="mt-1 text-sm"
                  rows={2}
                  placeholder="e.g. 5 years as a senior frontend engineer, built several React apps..."
                  value={extraContext}
                  onChange={(e) => setExtraContext(e.target.value)}
                />
              </div>
            )}

            {/* Generate button */}
            {!output && (
              <Button onClick={handleGenerate} disabled={loading} className="w-full">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 animate-spin" /> Generating…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Generate
                  </span>
                )}
              </Button>
            )}

            {/* Output */}
            {output && (
              <div className="space-y-3">
                <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap font-mono">
                  {output}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopy}>
                    {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleGenerate} disabled={loading}>
                    <Sparkles className="h-3.5 w-3.5 mr-1" /> Regenerate
                  </Button>
                  {onResult && (
                    <Button size="sm" onClick={handleUse}>
                      Use this draft
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <p className="text-xs text-muted-foreground">
              Powered by Claude. Results may need editing — always review before sending.
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
