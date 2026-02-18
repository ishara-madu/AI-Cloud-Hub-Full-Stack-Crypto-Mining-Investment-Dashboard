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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_alerts: {
        Row: {
          alert_type: string
          created_at: string
          description: string | null
          id: string
          is_resolved: boolean
          related_user_ids: string[] | null
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          description?: string | null
          id?: string
          is_resolved?: boolean
          related_user_ids?: string[] | null
          severity?: string
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_resolved?: boolean
          related_user_ids?: string[] | null
          severity?: string
          title?: string
        }
        Relationships: []
      }
      ai_packages: {
        Row: {
          bonus_tag: string | null
          cashback_percent: number | null
          created_at: string
          description: string | null
          duration_days: number | null
          features: Json
          id: string
          is_active: boolean | null
          name: string
          price_monthly: number | null
          price_onetime: number | null
        }
        Insert: {
          bonus_tag?: string | null
          cashback_percent?: number | null
          created_at?: string
          description?: string | null
          duration_days?: number | null
          features?: Json
          id?: string
          is_active?: boolean | null
          name: string
          price_monthly?: number | null
          price_onetime?: number | null
        }
        Update: {
          bonus_tag?: string | null
          cashback_percent?: number | null
          created_at?: string
          description?: string | null
          duration_days?: number | null
          features?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          price_monthly?: number | null
          price_onetime?: number | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string
          bank_name: string
          created_at: string
          iban: string | null
          id: string
          is_default: boolean | null
          user_id: string
        }
        Insert: {
          account_number: string
          bank_name: string
          created_at?: string
          iban?: string | null
          id?: string
          is_default?: boolean | null
          user_id: string
        }
        Update: {
          account_number?: string
          bank_name?: string
          created_at?: string
          iban?: string | null
          id?: string
          is_default?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          amount: number
          created_at: string
          from_user_id: string | null
          id: string
          source_id: string | null
          source_type: string | null
          tier: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          from_user_id?: string | null
          id?: string
          source_id?: string | null
          source_type?: string | null
          tier?: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_user_id?: string | null
          id?: string
          source_id?: string | null
          source_type?: string | null
          tier?: number
          user_id?: string
        }
        Relationships: []
      }
      daily_signins: {
        Row: {
          created_at: string
          id: string
          reward_amount: number
          signed_in_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reward_amount?: number
          signed_in_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reward_amount?: number
          signed_in_date?: string
          user_id?: string
        }
        Relationships: []
      }
      deposit_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          slip_url: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          slip_url?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          slip_url?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_logs: {
        Row: {
          audio_hash: string | null
          canvas_hash: string | null
          created_at: string
          event_type: string
          fingerprint: string | null
          fonts_hash: string | null
          id: string
          ip_address: string | null
          screen_info: string | null
          timezone: string | null
          user_agent: string | null
          user_id: string
          webgl_hash: string | null
        }
        Insert: {
          audio_hash?: string | null
          canvas_hash?: string | null
          created_at?: string
          event_type?: string
          fingerprint?: string | null
          fonts_hash?: string | null
          id?: string
          ip_address?: string | null
          screen_info?: string | null
          timezone?: string | null
          user_agent?: string | null
          user_id: string
          webgl_hash?: string | null
        }
        Update: {
          audio_hash?: string | null
          canvas_hash?: string | null
          created_at?: string
          event_type?: string
          fingerprint?: string | null
          fonts_hash?: string | null
          id?: string
          ip_address?: string | null
          screen_info?: string | null
          timezone?: string | null
          user_agent?: string | null
          user_id?: string
          webgl_hash?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          ban_count: number
          created_at: string
          credit_score: number
          display_name: string | null
          id: string
          is_frozen: boolean
          phone: string | null
          privacy_accepted: boolean
          privacy_accepted_at: string | null
          referral_code: string | null
          referred_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          ban_count?: number
          created_at?: string
          credit_score?: number
          display_name?: string | null
          id?: string
          is_frozen?: boolean
          phone?: string | null
          privacy_accepted?: boolean
          privacy_accepted_at?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          ban_count?: number
          created_at?: string
          credit_score?: number
          display_name?: string | null
          id?: string
          is_frozen?: boolean
          phone?: string | null
          privacy_accepted?: boolean
          privacy_accepted_at?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      redeem_code_uses: {
        Row: {
          code_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          code_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redeem_code_uses_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "redeem_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      redeem_codes: {
        Row: {
          code: string
          created_at: string
          current_uses: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          reward_amount: number
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          reward_amount?: number
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          reward_amount?: number
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          tier: number
        }
        Insert: {
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          tier?: number
        }
        Update: {
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          tier?: number
        }
        Relationships: []
      }
      slider_banners: {
        Row: {
          created_at: string
          gradient: string
          id: string
          image_url: string | null
          is_active: boolean
          sort_order: number
          subtitle: string | null
          title: string
        }
        Insert: {
          created_at?: string
          gradient?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          subtitle?: string | null
          title: string
        }
        Update: {
          created_at?: string
          gradient?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          status: Database["public"]["Enums"]["request_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_packages: {
        Row: {
          expires_at: string | null
          id: string
          is_active: boolean | null
          package_id: string
          price_paid: number
          purchased_at: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          package_id: string
          price_paid: number
          purchased_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          package_id?: string
          price_paid?: number
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "ai_packages"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          total_commission: number
          total_deposited: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          total_commission?: number
          total_deposited?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          total_commission?: number
          total_deposited?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_deposit: { Args: { p_deposit_id: string }; Returns: Json }
      ban_user: { Args: { p_user_id: string }; Returns: Json }
      claim_package_daily_income: { Args: never; Returns: Json }
      daily_checkin: { Args: never; Returns: Json }
      generate_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      purchase_package: { Args: { p_package_id: string }; Returns: Json }
      submit_withdrawal: {
        Args: { p_amount: number; p_bank_account_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
      payment_method: "bank_transfer" | "crypto" | "credit_card"
      request_status: "pending" | "approved" | "rejected"
      transaction_type:
        | "deposit"
        | "withdrawal"
        | "purchase"
        | "commission"
        | "refund"
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
      app_role: ["admin", "user"],
      payment_method: ["bank_transfer", "crypto", "credit_card"],
      request_status: ["pending", "approved", "rejected"],
      transaction_type: [
        "deposit",
        "withdrawal",
        "purchase",
        "commission",
        "refund",
      ],
    },
  },
} as const
