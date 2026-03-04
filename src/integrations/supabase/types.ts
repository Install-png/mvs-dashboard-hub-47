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
      calendar_events: {
        Row: {
          created_at: string
          description: string | null
          event_date: string
          event_time: string | null
          id: string
          location: string | null
          ng_equipment_units: number | null
          ng_operations_conducted: number | null
          ng_personnel_deployed: number | null
          police_arrests: number | null
          police_calls: number | null
          police_patrols_deployed: number | null
          police_reports_filed: number | null
          service_national_guard: boolean
          service_other: string | null
          service_police: boolean
          service_ses: boolean
          ses_equipment_used: string | null
          ses_fires_extinguished: number | null
          ses_people_rescued: number | null
          ses_personnel_involved: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_date?: string
          event_time?: string | null
          id?: string
          location?: string | null
          ng_equipment_units?: number | null
          ng_operations_conducted?: number | null
          ng_personnel_deployed?: number | null
          police_arrests?: number | null
          police_calls?: number | null
          police_patrols_deployed?: number | null
          police_reports_filed?: number | null
          service_national_guard?: boolean
          service_other?: string | null
          service_police?: boolean
          service_ses?: boolean
          ses_equipment_used?: string | null
          ses_fires_extinguished?: number | null
          ses_people_rescued?: number | null
          ses_personnel_involved?: number | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_date?: string
          event_time?: string | null
          id?: string
          location?: string | null
          ng_equipment_units?: number | null
          ng_operations_conducted?: number | null
          ng_personnel_deployed?: number | null
          police_arrests?: number | null
          police_calls?: number | null
          police_patrols_deployed?: number | null
          police_reports_filed?: number | null
          service_national_guard?: boolean
          service_other?: string | null
          service_police?: boolean
          service_ses?: boolean
          ses_equipment_used?: string | null
          ses_fires_extinguished?: number | null
          ses_people_rescued?: number | null
          ses_personnel_involved?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      incident_audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          id: string
          incident_id: string
          user_id: string
        }
        Insert: {
          action?: string
          changes?: Json | null
          created_at?: string
          id?: string
          incident_id: string
          user_id: string
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          id?: string
          incident_id?: string
          user_id?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          address: string | null
          category: string | null
          coordinates_lat: number | null
          coordinates_lng: number | null
          created_at: string
          damage_est: string | null
          damage_uah: number | null
          description: string | null
          estimated_resolution_time: string | null
          fatalities: number | null
          id: string
          injured: number | null
          lead_agency: string | null
          location: string
          medical_units: number | null
          personnel_total: number | null
          police_units: number | null
          region_id: string | null
          region_name: string | null
          rescued: number | null
          risk_level: number | null
          service: string | null
          ses_units: number | null
          severity: string | null
          specialized_equipment: string[] | null
          status: string
          time: string
          title: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          coordinates_lat?: number | null
          coordinates_lng?: number | null
          created_at?: string
          damage_est?: string | null
          damage_uah?: number | null
          description?: string | null
          estimated_resolution_time?: string | null
          fatalities?: number | null
          id?: string
          injured?: number | null
          lead_agency?: string | null
          location?: string
          medical_units?: number | null
          personnel_total?: number | null
          police_units?: number | null
          region_id?: string | null
          region_name?: string | null
          rescued?: number | null
          risk_level?: number | null
          service?: string | null
          ses_units?: number | null
          severity?: string | null
          specialized_equipment?: string[] | null
          status?: string
          time?: string
          title?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          category?: string | null
          coordinates_lat?: number | null
          coordinates_lng?: number | null
          created_at?: string
          damage_est?: string | null
          damage_uah?: number | null
          description?: string | null
          estimated_resolution_time?: string | null
          fatalities?: number | null
          id?: string
          injured?: number | null
          lead_agency?: string | null
          location?: string
          medical_units?: number | null
          personnel_total?: number | null
          police_units?: number | null
          region_id?: string | null
          region_name?: string | null
          rescued?: number | null
          risk_level?: number | null
          service?: string | null
          ses_units?: number | null
          severity?: string | null
          specialized_equipment?: string[] | null
          status?: string
          time?: string
          title?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personnel: {
        Row: {
          created_at: string
          department: string
          id: string
          name: string
          rank: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department?: string
          id?: string
          name?: string
          rank?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          name?: string
          rank?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string
          full_name: string
          id: string
          position: string
          rank: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string
          full_name?: string
          id: string
          position?: string
          rank?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string
          full_name?: string
          id?: string
          position?: string
          rank?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          data: Json | null
          generated_at: string
          id: string
          period_end: string
          period_start: string
          report_type: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          generated_at?: string
          id?: string
          period_end: string
          period_start: string
          report_type?: string
          title?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          generated_at?: string
          id?: string
          period_end?: string
          period_start?: string
          report_type?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
