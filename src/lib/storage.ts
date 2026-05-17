import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_USER_ID } from "@/lib/constants";

const BUCKET = "crm-files";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
];

export interface Attachment {
  id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: string | null;
  created_at: string;
  storage_path: string;
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_SIZE) return `File too large (max 10 MB)`;
  if (!ALLOWED_TYPES.includes(file.type)) return `File type not supported`;
  return null;
}

export async function uploadAttachment(
  file: File,
  parent: { application_id?: string; contact_id?: string; company_id?: string },
  kind: string = "other"
): Promise<{ data: Attachment | null; error: string | null }> {
  const validationError = validateFile(file);
  if (validationError) return { data: null, error: validationError };

  const ext = file.name.split(".").pop();
  const path = `${DEFAULT_USER_ID}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type });

  if (uploadError) return { data: null, error: uploadError.message };

  const { data, error: dbError } = await supabase
    .from("attachments")
    .insert({
      user_id: DEFAULT_USER_ID,
      storage_path: path,
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      kind,
      ...parent,
    })
    .select()
    .single();

  if (dbError) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { data: null, error: dbError.message };
  }

  return { data: data as Attachment, error: null };
}

export async function getSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60); // 1 hour
  return data?.signedUrl ?? null;
}

export async function deleteAttachment(id: string, path: string): Promise<string | null> {
  const { error: dbError } = await supabase.from("attachments").delete().eq("id", id);
  if (dbError) return dbError.message;
  await supabase.storage.from(BUCKET).remove([path]);
  return null;
}

export async function fetchAttachments(
  parent: { application_id?: string; contact_id?: string; company_id?: string }
): Promise<Attachment[]> {
  const key = Object.keys(parent)[0] as keyof typeof parent;
  const val = parent[key];
  const { data } = await supabase
    .from("attachments")
    .select("id, filename, mime_type, size_bytes, kind, created_at, storage_path")
    .eq(key, val)
    .order("created_at", { ascending: false });
  return (data ?? []) as Attachment[];
}
