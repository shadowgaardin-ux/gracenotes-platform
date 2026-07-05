export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_codes: {
        Row: {
          code: string
          created_at: string
          cycle_started_at: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          cycle_started_at?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          cycle_started_at?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "access_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_inquiries: {
        Row: {
          contact_name: string
          created_at: string
          email: string
          id: string
          message: string | null
          organization_name: string
          size: string | null
          status: string
        }
        Insert: {
          contact_name: string
          created_at?: string
          email: string
          id?: string
          message?: string | null
          organization_name: string
          size?: string | null
          status?: string
        }
        Update: {
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          organization_name?: string
          size?: string | null
          status?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          status: string
          subscription_currency: string
          subscription_expires_at: string | null
          subscription_period_days: number | null
          subscription_price_cents: number | null
          subscription_started_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          status?: string
          subscription_currency?: string
          subscription_expires_at?: string | null
          subscription_period_days?: number | null
          subscription_price_cents?: number | null
          subscription_started_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          status?: string
          subscription_currency?: string
          subscription_expires_at?: string | null
          subscription_period_days?: number | null
          subscription_price_cents?: number | null
          subscription_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_receipts: {
        Row: {
          amount_cents: number | null
          created_at: string
          file_mime: string | null
          file_path: string
          id: string
          note: string | null
          organization_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          file_mime?: string | null
          file_path: string
          id?: string
          note?: string | null
          organization_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          file_mime?: string | null
          file_path?: string
          id?: string
          note?: string | null
          organization_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scripture_refs: {
        Row: {
          book: string | null
          chapter: number | null
          created_at: string
          id: string
          organization_id: string
          reference: string
          sermon_id: string
          verse_end: number | null
          verse_start: number | null
        }
        Insert: {
          book?: string | null
          chapter?: number | null
          created_at?: string
          id?: string
          organization_id: string
          reference: string
          sermon_id: string
          verse_end?: number | null
          verse_start?: number | null
        }
        Update: {
          book?: string | null
          chapter?: number | null
          created_at?: string
          id?: string
          organization_id?: string
          reference?: string
          sermon_id?: string
          verse_end?: number | null
          verse_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scripture_refs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripture_refs_sermon_id_fkey"
            columns: ["sermon_id"]
            isOneToOne: false
            referencedRelation: "sermons"
            referencedColumns: ["id"]
          },
        ]
      }
      sermon_content: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          organization_id: string
          sermon_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind: string
          organization_id: string
          sermon_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          organization_id?: string
          sermon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sermon_content_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sermon_content_sermon_id_fkey"
            columns: ["sermon_id"]
            isOneToOne: false
            referencedRelation: "sermons"
            referencedColumns: ["id"]
          },
        ]
      }
      sermons: {
        Row: {
          audio_url: string | null
          author_id: string
          created_at: string
          delivered_at: string | null
          id: string
          is_favorite: boolean
          organization_id: string
          primary_topic: string | null
          scripture_focus: string | null
          series: string | null
          source_kind: string
          summary: string | null
          tags: string[]
          title: string
          transcript: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          audio_url?: string | null
          author_id: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          is_favorite?: boolean
          organization_id: string
          primary_topic?: string | null
          scripture_focus?: string | null
          series?: string | null
          source_kind?: string
          summary?: string | null
          tags?: string[]
          title: string
          transcript?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          audio_url?: string | null
          author_id?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          is_favorite?: boolean
          organization_id?: string
          primary_topic?: string | null
          scripture_focus?: string | null
          series?: string | null
          source_kind?: string
          summary?: string | null
          tags?: string[]
          title?: string
          transcript?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "sermons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_notes: {
        Row: {
          author_id: string
          body: string | null
          category: string
          created_at: string
          id: string
          organization_id: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          organization_id: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          organization_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_receipt_and_activate: {
        Args: {
          _period_days: number
          _price_cents: number
          _receipt_id: string
        }
        Returns: {
          access_code: string
          expires_at: string
        }[]
      }
      create_church: {
        Args: { _name: string }
        Returns: {
          admin_code: string
          organization_id: string
        }[]
      }
      get_user_org: { Args: { _user_id: string }; Returns: string }
      grant_super_admin_by_email: { Args: { _email: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_pastoral: { Args: { _user_id: string }; Returns: boolean }
      redeem_access_code: {
        Args: { _code: string }
        Returns: {
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      refresh_org_status: {
        Args: { _org_id: string }
        Returns: {
          created_at: string
          id: string
          name: string
          notes: string | null
          status: string
          subscription_currency: string
          subscription_expires_at: string | null
          subscription_period_days: number | null
          subscription_price_cents: number | null
          subscription_started_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_receipt: {
        Args: { _reason: string; _receipt_id: string }
        Returns: undefined
      }
      submit_payment_receipt: {
        Args: {
          _amount_cents: number
          _file_mime: string
          _file_path: string
          _note: string
        }
        Returns: string
      }
      super_create_organization: {
        Args: {
          _admin_email: string
          _name: string
          _period_days: number
          _price_cents: number
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "pastor" | "staff" | "congregation" | "super_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "pastor", "staff", "congregation", "super_admin"],
    },
  },
} as const
