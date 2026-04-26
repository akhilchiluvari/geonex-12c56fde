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
      accounts: {
        Row: {
          account_number: string
          account_type: Database["public"]["Enums"]["account_type"]
          balance: number
          created_at: string
          currency: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          account_number: string
          account_type: Database["public"]["Enums"]["account_type"]
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          account_number?: string
          account_type?: Database["public"]["Enums"]["account_type"]
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_audit: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          metadata: Json | null
          target_transaction_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_transaction_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_transaction_id?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      bill_payments: {
        Row: {
          biller_name: string
          biller_type: string
          consumer_number: string
          created_at: string
          id: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          biller_name: string
          biller_type: string
          consumer_number: string
          created_at?: string
          id?: string
          transaction_id: string
          user_id: string
        }
        Update: {
          biller_name?: string
          biller_type?: string
          consumer_number?: string
          created_at?: string
          id?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          account_id: string
          card_holder: string
          card_number_masked: string
          card_type: Database["public"]["Enums"]["card_type"]
          created_at: string
          daily_limit: number
          expiry_month: number
          expiry_year: number
          id: string
          is_frozen: boolean
          network: string
          user_id: string
        }
        Insert: {
          account_id: string
          card_holder: string
          card_number_masked: string
          card_type: Database["public"]["Enums"]["card_type"]
          created_at?: string
          daily_limit?: number
          expiry_month: number
          expiry_year: number
          id?: string
          is_frozen?: boolean
          network?: string
          user_id: string
        }
        Update: {
          account_id?: string
          card_holder?: string
          card_number_masked?: string
          card_type?: Database["public"]["Enums"]["card_type"]
          created_at?: string
          daily_limit?: number
          expiry_month?: number
          expiry_year?: number
          id?: string
          is_frozen?: boolean
          network?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      device_fingerprints: {
        Row: {
          created_at: string
          fingerprint: string
          id: string
          last_seen_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fingerprint: string
          id?: string
          last_seen_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fingerprint?: string
          id?: string
          last_seen_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      otp_challenges: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          max_attempts: number
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          max_attempts?: number
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          max_attempts?: number
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "otp_challenges_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payees: {
        Row: {
          account_number: string
          bank_name: string | null
          created_at: string
          id: string
          name: string
          trust_score: number
          user_id: string
        }
        Insert: {
          account_number: string
          bank_name?: string | null
          created_at?: string
          id?: string
          name: string
          trust_score?: number
          user_id: string
        }
        Update: {
          account_number?: string
          bank_name?: string | null
          created_at?: string
          id?: string
          name?: string
          trust_score?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          confidential_id_hash: string | null
          created_at: string
          full_name: string
          home_city: string | null
          id: string
          phone: string | null
        }
        Insert: {
          confidential_id_hash?: string | null
          created_at?: string
          full_name: string
          home_city?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          confidential_id_hash?: string | null
          created_at?: string
          full_name?: string
          home_city?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      risk_assessments: {
        Row: {
          created_at: string
          features: Json
          id: string
          model_name: string | null
          reasoning: string | null
          risk_score: number
          risk_tier: Database["public"]["Enums"]["risk_tier"]
          top_factors: Json | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          features: Json
          id?: string
          model_name?: string | null
          reasoning?: string | null
          risk_score: number
          risk_tier: Database["public"]["Enums"]["risk_tier"]
          top_factors?: Json | null
          transaction_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          model_name?: string | null
          reasoning?: string | null
          risk_score?: number
          risk_tier?: Database["public"]["Enums"]["risk_tier"]
          top_factors?: Json | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          description: string
          event_type: string
          id: string
          metadata: Json | null
          severity: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          event_type: string
          id?: string
          metadata?: Json | null
          severity?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          severity?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          city: string | null
          completed_at: string | null
          created_at: string
          currency: string
          from_account_id: string | null
          id: string
          note: string | null
          risk_score: number | null
          risk_tier: Database["public"]["Enums"]["risk_tier"] | null
          status: Database["public"]["Enums"]["txn_status"]
          to_account_number: string | null
          to_name: string | null
          txn_type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          city?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          from_account_id?: string | null
          id?: string
          note?: string | null
          risk_score?: number | null
          risk_tier?: Database["public"]["Enums"]["risk_tier"] | null
          status?: Database["public"]["Enums"]["txn_status"]
          to_account_number?: string | null
          to_name?: string | null
          txn_type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          city?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          from_account_id?: string | null
          id?: string
          note?: string | null
          risk_score?: number | null
          risk_tier?: Database["public"]["Enums"]["risk_tier"] | null
          status?: Database["public"]["Enums"]["txn_status"]
          to_account_number?: string | null
          to_name?: string | null
          txn_type?: Database["public"]["Enums"]["txn_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      trusted_locations: {
        Row: {
          city: string
          country: string | null
          created_at: string
          id: string
          last_seen_at: string
          lat: number
          lng: number
          user_id: string
        }
        Insert: {
          city: string
          country?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string
          lat: number
          lng: number
          user_id: string
        }
        Update: {
          city?: string
          country?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string
          lat?: number
          lng?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      account_type: "checking" | "savings"
      app_role: "customer" | "admin"
      card_type: "debit" | "credit"
      risk_tier: "LOW" | "MEDIUM" | "HIGH"
      txn_status:
        | "pending"
        | "otp_required"
        | "high_risk_review"
        | "blocked"
        | "success"
        | "failed"
      txn_type:
        | "transfer"
        | "bill_payment"
        | "deposit"
        | "withdrawal"
        | "card_payment"
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
      account_type: ["checking", "savings"],
      app_role: ["customer", "admin"],
      card_type: ["debit", "credit"],
      risk_tier: ["LOW", "MEDIUM", "HIGH"],
      txn_status: [
        "pending",
        "otp_required",
        "high_risk_review",
        "blocked",
        "success",
        "failed",
      ],
      txn_type: [
        "transfer",
        "bill_payment",
        "deposit",
        "withdrawal",
        "card_payment",
      ],
    },
  },
} as const
