import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Zap, FileText, Link2, ClipboardPaste, CheckCircle } from "lucide-react";
import { toast } from "sonner";

type Mode = "url" | "paste";

interface ParsedJob {
  role_title: string;
  company_name: string;
  location: string;
  source: string;
  application_id?: string;
}

export function QuickAddPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("paste");
  const [url, setUrl] = useState("");
  const [jdText, setJdText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParsedJob | null>(null);

  const handleCapture = async () => {
    if (mode === "url" && !url.trim()) {
      toast.error("Enter a job posting URL");
      return;
    }
    if (mode === "paste" && !jdText.trim()) {
      toast.error("Paste a job description first");
      return;
    }

    setLoading(true);
    setResult(null);

    const payload =
      mode === "url"
        ? { url: url.trim() }
        : { jd_text: jdText.trim() };

    const { data, error } = await supabase.functions.invoke("quick-capture", {
      body: payload,
    });

    setLoading(false);

    if (error || data?.error) {
      toast.error(error?.message ?? data?.error ?? "Capture failed");
      return;
    }

    setResult({
      role_title: data.role_title,
      company_name: data.company_name ?? "",
      location: "",
      source: "",
      application_id: data.application_id,
    });
    toast.success("Added to Wishlist!");
  };

  const bookmarkletCode = `javascript:(function(){
  var url=location.href;
  var title=document.title;
  var sel=window.getSelection&&window.getSelection().toString().slice(0,3000);
  fetch('${window.location.origin}/functions/v1/quick-capture',{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':'${import.meta.env.VITE_SUPABASE_ANON_KEY ?? "YOUR_ANON_KEY"}'},
    body:JSON.stringify({url:url,title:title,jd_text:sel||''})
  })
  .then(r=>r.json())
  .then(d=>{if(d.ok){alert('Added: '+d.role_title+(d.company_name?' @ '+d.company_name:''))}else{alert('Error: '+d.error)}})
  .catch(()=>alert('CRM capture failed'));
})();`.replace(/\s+/g, " ").trim();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" /> Quick Add
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Capture a job posting from a URL or paste the description — added to Wishlist in one click.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === "paste" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("paste")}
        >
          <ClipboardPaste className="h-3.5 w-3.5 mr-1.5" /> Paste JD
        </Button>
        <Button
          variant={mode === "url" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("url")}
        >
          <Link2 className="h-3.5 w-3.5 mr-1.5" /> From URL
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          {mode === "paste" ? (
            <div className="space-y-1.5">
              <Label>Job Description</Label>
              <Textarea
                placeholder="Paste the full job description here — role, company, location, and requirements will be extracted automatically…"
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                rows={10}
                className="font-mono text-xs resize-y"
              />
              <p className="text-xs text-muted-foreground">
                Works best with full text including title, company, and location.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Job Posting URL</Label>
              <Input
                type="url"
                placeholder="https://www.linkedin.com/jobs/view/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                LinkedIn, Indeed, Greenhouse, Lever, Ashby, Workday all work.
              </p>
            </div>
          )}

          <Button onClick={handleCapture} disabled={loading} className="w-full">
            {loading ? "Capturing…" : "Add to Wishlist"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="font-semibold text-sm text-green-900 dark:text-green-200">
                  {result.role_title}
                  {result.company_name && (
                    <span className="font-normal text-green-700 dark:text-green-400">
                      {" "}@ {result.company_name}
                    </span>
                  )}
                </p>
                <p className="text-xs text-green-700 dark:text-green-400">Added to Wishlist</p>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() =>
                      result.application_id &&
                      navigate({ to: `/applications/${result.application_id}` })
                    }
                  >
                    Open application
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7"
                    onClick={() => {
                      setResult(null);
                      setJdText("");
                      setUrl("");
                    }}
                  >
                    Add another
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bookmarklet section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" /> Browser Bookmarklet
          </CardTitle>
          <CardDescription className="text-xs">
            Drag this to your bookmarks bar. Click it on any job page to instantly capture it.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <a
            href={bookmarkletCode}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10 cursor-grab active:cursor-grabbing select-none"
            onClick={(e) => e.preventDefault()}
            draggable
          >
            <Zap className="h-4 w-4" /> Add to CRM
          </a>
          <p className="text-xs text-muted-foreground">
            Drag the button above to your bookmarks bar. When on a job posting, click it to
            capture the current page. If you've selected text on the page, it'll use that as
            the job description for better parsing.
          </p>
          <details>
            <summary className="text-xs text-muted-foreground cursor-pointer">
              View bookmarklet code
            </summary>
            <pre className="mt-2 text-[10px] bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
              {bookmarkletCode}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
