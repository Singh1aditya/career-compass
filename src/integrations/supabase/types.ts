// NOTE: This file used to be auto-generated from the old project schema and
// drifted significantly (missing tables, wrong column names like
// `interaction_type`/`occurred_at` for what are actually `type`/`date`).
//
// Until we run `supabase gen types typescript --project-id cpbntgdqtvqrensrqjmy`
// against the live DB, we use a permissive `Database` shape so the TS compiler
// doesn't fight runtime queries. Strict typing should be restored as soon as
// the CLI auth is set up.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type AnyTable = {
  Row: Record<string, any>;
  Insert: Record<string, any>;
  Update: Record<string, any>;
  Relationships: any[];
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: Record<string, AnyTable>;
    Views: Record<string, AnyTable>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// Helper kept for compatibility with any consumer that imports them.
export type Tables<T extends string = string> = Record<string, any>;
export type TablesInsert<T extends string = string> = Record<string, any>;
export type TablesUpdate<T extends string = string> = Record<string, any>;
export type Enums<T extends string = string> = string;
