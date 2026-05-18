import { useState, useEffect, useRef, DragEvent, ChangeEvent } from "react";
import {
  fetchAttachments,
  uploadAttachment,
  deleteAttachment,
  getSignedUrl,
  type Attachment,
} from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Paperclip, Trash2, Download, Upload } from "lucide-react";
import { toast } from "sonner";

type Parent = {
  application_id?: string;
  contact_id?: string;
  company_id?: string;
};

interface Props {
  parent: Parent;
}

const KIND_LABELS: Record<string, string> = {
  resume: "Resume",
  cover_letter: "Cover Letter",
  jd: "Job Description",
  other: "Other",
};

function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsList({ parent }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [kind, setKind] = useState("other");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const data = await fetchAttachments(parent);
    setAttachments(data);
    setLoading(false);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const fileArray = Array.from(files);
    await Promise.all(
      fileArray.map(async (file) => {
        const { data, error } = await uploadAttachment(file, parent, kind);
        if (error) {
          toast.error(`${file.name}: ${error}`);
        } else if (data) {
          toast.success(`${file.name} uploaded`);
        }
      }),
    );
    setUploading(false);
    load();
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset so same file can be re-uploaded if needed
    e.target.value = "";
  };

  const handleDownload = async (attachment: Attachment) => {
    const url = await getSignedUrl(attachment.storage_path);
    if (!url) {
      toast.error("Could not generate download link");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.filename;
    a.target = "_blank";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = async (attachment: Attachment) => {
    const error = await deleteAttachment(attachment.id, attachment.storage_path);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Attachment deleted");
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue placeholder="Kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resume">Resume</SelectItem>
                <SelectItem value="cover_letter">Cover Letter</SelectItem>
                <SelectItem value="jd">Job Description</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            {uploading ? "Uploading..." : "Choose Files"}
          </Button>
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {uploading ? "Uploading..." : "Drag & drop files here, or click to select"}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            PDF, Word, TXT, PNG, JPEG — max 10 MB
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
          onChange={handleInputChange}
        />
      </div>

      {/* Attachment list */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-2">Loading...</p>
      ) : attachments.length === 0 ? (
        <div className="py-8 text-center">
          <Paperclip className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No attachments yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <Card key={att.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{att.filename}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {att.kind && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">
                        {KIND_LABELS[att.kind] ?? att.kind}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatSize(att.size_bytes)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(att.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleDownload(att)}
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(att)}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
