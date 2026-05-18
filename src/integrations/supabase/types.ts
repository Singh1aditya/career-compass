export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      applications: {
        Row: {
          applied_date: string | null;
          company_id: string | null;
          company_name: string | null;
          created_at: string;
          id: string;
          notes: string | null;
          resume_version: string | null;
          role_title: string;
          source: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          applied_date?: string | null;
          company_id?: string | null;
          company_name?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          resume_version?: string | null;
          role_title: string;
          source?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          applied_date?: string | null;
          company_id?: string | null;
          company_name?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          resume_version?: string | null;
          role_title?: string;
          source?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "applications_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      automation_logs: {
        Row: {
          created_at: string;
          function_name: string;
          id: string;
          level: string;
          message: string;
          payload: Json | null;
        };
        Insert: {
          created_at?: string;
          function_name: string;
          id?: string;
          level?: string;
          message: string;
          payload?: Json | null;
        };
        Update: {
          created_at?: string;
          function_name?: string;
          id?: string;
          level?: string;
          message?: string;
          payload?: Json | null;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          created_at: string;
          hiring_signals: string | null;
          id: string;
          industry: string | null;
          name: string;
          notes: string | null;
          stage: string | null;
          updated_at: string;
          user_id: string;
          watchlist: boolean;
          website: string | null;
        };
        Insert: {
          created_at?: string;
          hiring_signals?: string | null;
          id?: string;
          industry?: string | null;
          name: string;
          notes?: string | null;
          stage?: string | null;
          updated_at?: string;
          user_id?: string;
          watchlist?: boolean;
          website?: string | null;
        };
        Update: {
          created_at?: string;
          hiring_signals?: string | null;
          id?: string;
          industry?: string | null;
          name?: string;
          notes?: string | null;
          stage?: string | null;
          updated_at?: string;
          user_id?: string;
          watchlist?: boolean;
          website?: string | null;
        };
        Relationships: [];
      };
      contact_tags: {
        Row: {
          contact_id: string;
          id: string;
          tag_id: string;
        };
        Insert: {
          contact_id: string;
          id?: string;
          tag_id: string;
        };
        Update: {
          contact_id?: string;
          id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      contacts: {
        Row: {
          company_id: string | null;
          company_name: string | null;
          contact_type: string;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          role: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          company_id?: string | null;
          company_name?: string | null;
          contact_type?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          role?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          company_id?: string | null;
          company_name?: string | null;
          contact_type?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          role?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      follow_ups: {
        Row: {
          application_id: string | null;
          contact_id: string | null;
          created_at: string;
          description: string | null;
          due_date: string;
          id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          application_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          description?: string | null;
          due_date: string;
          id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          application_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          description?: string | null;
          due_date?: string;
          id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "follow_ups_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follow_ups_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      interactions: {
        Row: {
          application_id: string | null;
          contact_id: string | null;
          created_at: string;
          date: string;
          direction: string;
          id: string;
          summary: string | null;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          application_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          date: string;
          direction: string;
          id?: string;
          summary?: string | null;
          type: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          application_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          date?: string;
          direction?: string;
          id?: string;
          summary?: string | null;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interactions_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interactions_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      notes: {
        Row: {
          application_id: string | null;
          contact_id: string | null;
          content: string;
          created_at: string;
          id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          application_id?: string | null;
          contact_id?: string | null;
          content: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          application_id?: string | null;
          contact_id?: string | null;
          content?: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notes_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      oauth_tokens: {
        Row: {
          access_token: string;
          created_at: string;
          email: string | null;
          expires_at: string | null;
          id: string;
          provider: string;
          refresh_token: string | null;
          scope: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          access_token: string;
          created_at?: string;
          email?: string | null;
          expires_at?: string | null;
          id?: string;
          provider: string;
          refresh_token?: string | null;
          scope?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_token?: string;
          created_at?: string;
          email?: string | null;
          expires_at?: string | null;
          id?: string;
          provider?: string;
          refresh_token?: string | null;
          scope?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      processed_emails: {
        Row: {
          action_taken: string;
          application_id: string | null;
          classification: string;
          detected_company: string | null;
          detected_role: string | null;
          email_date: string | null;
          email_from: string | null;
          email_subject: string | null;
          gmail_message_id: string;
          gmail_thread_id: string | null;
          id: string;
          processed_at: string;
          user_id: string;
        };
        Insert: {
          action_taken: string;
          application_id?: string | null;
          classification: string;
          detected_company?: string | null;
          detected_role?: string | null;
          email_date?: string | null;
          email_from?: string | null;
          email_subject?: string | null;
          gmail_message_id: string;
          gmail_thread_id?: string | null;
          id?: string;
          processed_at?: string;
          user_id: string;
        };
        Update: {
          action_taken?: string;
          application_id?: string | null;
          classification?: string;
          detected_company?: string | null;
          detected_role?: string | null;
          email_date?: string | null;
          email_from?: string | null;
          email_subject?: string | null;
          gmail_message_id?: string;
          gmail_thread_id?: string | null;
          id?: string;
          processed_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "processed_emails_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          signature: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          signature?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          signature?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      sequence_recipients: {
        Row: {
          automation_active: boolean;
          contact_id: string;
          created_at: string;
          enrolled_at: string;
          id: string;
          lock_reason: string | null;
          next_send_at: string | null;
          sequence_id: string;
          state: string;
          user_id: string;
        };
        Insert: {
          automation_active?: boolean;
          contact_id: string;
          created_at?: string;
          enrolled_at?: string;
          id?: string;
          lock_reason?: string | null;
          next_send_at?: string | null;
          sequence_id: string;
          state?: string;
          user_id?: string;
        };
        Update: {
          automation_active?: boolean;
          contact_id?: string;
          created_at?: string;
          enrolled_at?: string;
          id?: string;
          lock_reason?: string | null;
          next_send_at?: string | null;
          sequence_id?: string;
          state?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sequence_recipients_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sequence_recipients_sequence_id_fkey";
            columns: ["sequence_id"];
            isOneToOne: false;
            referencedRelation: "sequences";
            referencedColumns: ["id"];
          },
        ];
      };
      sequence_sends: {
        Row: {
          body: string | null;
          created_at: string;
          gmail_message_id: string | null;
          gmail_thread_id: string | null;
          id: string;
          recipient_id: string;
          sent_at: string;
          step_number: number;
          subject: string | null;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          gmail_message_id?: string | null;
          gmail_thread_id?: string | null;
          id?: string;
          recipient_id: string;
          sent_at?: string;
          step_number: number;
          subject?: string | null;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          gmail_message_id?: string | null;
          gmail_thread_id?: string | null;
          id?: string;
          recipient_id?: string;
          sent_at?: string;
          step_number?: number;
          subject?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sequence_sends_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "sequence_recipients";
            referencedColumns: ["id"];
          },
        ];
      };
      sequence_steps: {
        Row: {
          created_at: string;
          delay_days: number;
          id: string;
          sequence_id: string;
          step_number: number;
          step_type: string;
          template_body: string;
          template_subject: string | null;
        };
        Insert: {
          created_at?: string;
          delay_days?: number;
          id?: string;
          sequence_id: string;
          step_number: number;
          step_type: string;
          template_body: string;
          template_subject?: string | null;
        };
        Update: {
          created_at?: string;
          delay_days?: number;
          id?: string;
          sequence_id?: string;
          step_number?: number;
          step_type?: string;
          template_body?: string;
          template_subject?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sequence_steps_sequence_id_fkey";
            columns: ["sequence_id"];
            isOneToOne: false;
            referencedRelation: "sequences";
            referencedColumns: ["id"];
          },
        ];
      };
      sequences: {
        Row: {
          application_id: string | null;
          created_at: string;
          id: string;
          name: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          application_id?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          application_id?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sequences_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          name: string;
          user_id?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          daily_email_cap: number;
          display_name: string | null;
          per_tick_email_cap: number;
          signature: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          daily_email_cap?: number;
          display_name?: string | null;
          per_tick_email_cap?: number;
          signature?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          daily_email_cap?: number;
          display_name?: string | null;
          per_tick_email_cap?: number;
          signature?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
