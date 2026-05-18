import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_USER_ID } from "@/lib/constants";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Props {
  contactId: string;
}

const PRESET_COLORS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280"];

export function TagEditor({ contactId }: Props) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [contactTagIds, setContactTagIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);

  useEffect(() => {
    load();
  }, [contactId]);

  const load = async () => {
    const [tagsRes, joinRes] = await Promise.all([
      supabase.from("tags").select("*").order("name"),
      supabase.from("contact_tags").select("tag_id").eq("contact_id", contactId),
    ]);
    setAllTags((tagsRes.data as Tag[]) ?? []);
    setContactTagIds(new Set((joinRes.data ?? []).map((r: any) => r.tag_id)));
    setLoading(false);
  };

  const toggle = async (tagId: string) => {
    if (contactTagIds.has(tagId)) {
      const { error } = await supabase
        .from("contact_tags")
        .delete()
        .eq("contact_id", contactId)
        .eq("tag_id", tagId);
      if (error) {
        toast.error(error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from("contact_tags")
        .insert({ contact_id: contactId, tag_id: tagId });
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    load();
  };

  const createTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("tags")
      .insert({ user_id: DEFAULT_USER_ID, name, color: newTagColor })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      await supabase.from("contact_tags").insert({
        contact_id: contactId,
        tag_id: data.id,
      });
      setNewTagName("");
      load();
    }
  };

  const applied = allTags.filter((t) => contactTagIds.has(t.id));

  if (loading) return <div className="text-xs text-muted-foreground">Loading tags…</div>;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {applied.map((t) => (
        <Badge
          key={t.id}
          variant="secondary"
          className="gap-1 cursor-pointer"
          style={{ backgroundColor: `${t.color}22`, color: t.color, borderColor: `${t.color}44` }}
          onClick={() => toggle(t.id)}
        >
          {t.name}
          <X className="h-3 w-3" />
        </Badge>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
            <Plus className="h-3 w-3 mr-1" /> Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium mb-2 text-muted-foreground">Apply tag</p>
              <div className="flex flex-wrap gap-1">
                {allTags.length === 0 && (
                  <p className="text-xs text-muted-foreground">No tags yet</p>
                )}
                {allTags.map((t) => {
                  const active = contactTagIds.has(t.id);
                  return (
                    <Badge
                      key={t.id}
                      variant={active ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      style={
                        active
                          ? { backgroundColor: t.color, borderColor: t.color }
                          : { borderColor: `${t.color}66`, color: t.color }
                      }
                      onClick={() => toggle(t.id)}
                    >
                      {t.name}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div className="border-t pt-2">
              <p className="text-xs font-medium mb-2 text-muted-foreground">Create new tag</p>
              <div className="flex gap-1.5 mb-2">
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name"
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createTag();
                  }}
                />
                <Button size="sm" className="h-7" onClick={createTag} disabled={!newTagName.trim()}>
                  Add
                </Button>
              </div>
              <div className="flex gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    onClick={() => setNewTagColor(c)}
                    className={`h-5 w-5 rounded-full border-2 transition ${newTagColor === c ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
