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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      crm_companies: {
        Row: {
          address: string | null
          assigned_to: string | null
          cnpj: string | null
          company_type: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          notes: string | null
          parent_company_id: string | null
          segment: string | null
          updated_at: string
          url: string | null
          workspace_id: string
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          cnpj?: string | null
          company_type?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          notes?: string | null
          parent_company_id?: string | null
          segment?: string | null
          updated_at?: string
          url?: string | null
          workspace_id: string
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          cnpj?: string | null
          company_type?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          parent_company_id?: string | null
          segment?: string | null
          updated_at?: string
          url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_companies_parent_company_id_fkey"
            columns: ["parent_company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contact_companies: {
        Row: {
          company_id: string
          contact_id: string
          created_at: string
          workspace_id: string
        }
        Insert: {
          company_id: string
          contact_id: string
          created_at?: string
          workspace_id: string
        }
        Update: {
          company_id?: string
          contact_id?: string
          created_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contact_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_companies_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          assigned_to: string | null
          company_id: string | null
          cpf: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          linked_in: string | null
          name: string
          notes: string | null
          person_type: string | null
          phone: string | null
          qualification_bant: Json
          qualification_classification: string | null
          qualification_completed_at: string | null
          qualification_responsible: string | null
          qualification_score: number | null
          role: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          linked_in?: string | null
          name: string
          notes?: string | null
          person_type?: string | null
          phone?: string | null
          qualification_bant?: Json
          qualification_classification?: string | null
          qualification_completed_at?: string | null
          qualification_responsible?: string | null
          qualification_score?: number | null
          role?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          linked_in?: string | null
          name?: string
          notes?: string | null
          person_type?: string | null
          phone?: string | null
          qualification_bant?: Json
          qualification_classification?: string | null
          qualification_completed_at?: string | null
          qualification_responsible?: string | null
          qualification_score?: number | null
          role?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_comments: {
        Row: {
          author_name: string
          author_user_id: string | null
          created_at: string
          deal_id: string
          id: string
          mentions: Json
          message: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          author_name: string
          author_user_id?: string | null
          created_at?: string
          deal_id: string
          id?: string
          mentions?: Json
          message: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          author_name?: string
          author_user_id?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          mentions?: Json
          message?: string
          metadata?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_comments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_contacts: {
        Row: {
          contact_id: string
          deal_id: string
        }
        Insert: {
          contact_id: string
          deal_id: string
        }
        Update: {
          contact_id?: string
          deal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_contacts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_history: {
        Row: {
          action: string
          date: string
          deal_id: string | null
          id: string
          user_name: string | null
        }
        Insert: {
          action: string
          date?: string
          deal_id?: string | null
          id?: string
          user_name?: string | null
        }
        Update: {
          action?: string
          date?: string
          deal_id?: string | null
          id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_notes: {
        Row: {
          attachments: Json
          content_html: string
          content_text: string
          created_at: string
          deal_id: string
          id: string
          last_edited_by: string | null
          updated_at: string
        }
        Insert: {
          attachments?: Json
          content_html?: string
          content_text?: string
          created_at?: string
          deal_id: string
          id?: string
          last_edited_by?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: Json
          content_html?: string
          content_text?: string
          created_at?: string
          deal_id?: string
          id?: string
          last_edited_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          assigned_to: string | null
          closing_date: string | null
          company_id: string | null
          contact_id: string | null
          contact_name: string | null
          contact_role: string | null
          created_at: string
          deal_code: string | null
          deal_code_number: number | null
          deal_name: string | null
          deleted_at: string | null
          id: string
          loss_description: string | null
          loss_reason: string | null
          notes: string[] | null
          outcome: string | null
          person_type: string | null
          phone: string | null
          pipeline_id: string
          primary_contact_id: string | null
          qualification: string | null
          qualification_bant: Json
          qualification_classification: string | null
          qualification_completed_at: string | null
          qualification_responsible: string | null
          qualification_score: number | null
          stage: string
          tags: string[] | null
          updated_at: string
          value: number | null
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          closing_date?: string | null
          company_id?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_role?: string | null
          created_at?: string
          deal_code?: string | null
          deal_code_number?: number | null
          deal_name?: string | null
          deleted_at?: string | null
          id?: string
          loss_description?: string | null
          loss_reason?: string | null
          notes?: string[] | null
          outcome?: string | null
          person_type?: string | null
          phone?: string | null
          pipeline_id: string
          primary_contact_id?: string | null
          qualification?: string | null
          qualification_bant?: Json
          qualification_classification?: string | null
          qualification_completed_at?: string | null
          qualification_responsible?: string | null
          qualification_score?: number | null
          stage?: string
          tags?: string[] | null
          updated_at?: string
          value?: number | null
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          closing_date?: string | null
          company_id?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_role?: string | null
          created_at?: string
          deal_code?: string | null
          deal_code_number?: number | null
          deal_name?: string | null
          deleted_at?: string | null
          id?: string
          loss_description?: string | null
          loss_reason?: string | null
          notes?: string[] | null
          outcome?: string | null
          person_type?: string | null
          phone?: string | null
          pipeline_id?: string
          primary_contact_id?: string | null
          qualification?: string | null
          qualification_bant?: Json
          qualification_classification?: string | null
          qualification_completed_at?: string | null
          qualification_responsible?: string | null
          qualification_score?: number | null
          stage?: string
          tags?: string[] | null
          updated_at?: string
          value?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_option_lists: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: string
          label: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          label: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          label?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      crm_pipeline_stages: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          label: string
          pipeline_id: string
          position: number
          probability: number
          stage_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          pipeline_id: string
          position?: number
          probability?: number
          stage_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          pipeline_id?: string
          position?: number
          probability?: number
          stage_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      crm_record_history: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          changes: Json
          id: string
          record_id: string
          table_name: string
          workspace_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          changes: Json
          id?: string
          record_id: string
          table_name: string
          workspace_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          changes?: Json
          id?: string
          record_id?: string
          table_name?: string
          workspace_id?: string
        }
        Relationships: []
      }
      crm_tasks: {
        Row: {
          activity_result: string | null
          assigned_to: string | null
          canceled_at: string | null
          canceled_by: string | null
          company_id: string | null
          completed: boolean | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          due_date: string | null
          due_time: string | null
          id: string
          result_notes: string | null
          status: string
          task_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          activity_result?: string | null
          assigned_to?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          company_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          result_notes?: string | null
          status?: string
          task_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          activity_result?: string | null
          assigned_to?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          company_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          result_notes?: string | null
          status?: string
          task_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_user_alerts: {
        Row: {
          active: boolean
          created_at: string
          dedupe_key: string
          description: string
          dismissed_at: string | null
          id: string
          metadata: Json
          read_at: string | null
          target: string
          target_id: string | null
          title: string
          type: string
          updated_at: string
          user_email: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dedupe_key: string
          description: string
          dismissed_at?: string | null
          id?: string
          metadata?: Json
          read_at?: string | null
          target?: string
          target_id?: string | null
          title: string
          type: string
          updated_at?: string
          user_email: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dedupe_key?: string
          description?: string
          dismissed_at?: string | null
          id?: string
          metadata?: Json
          read_at?: string | null
          target?: string
          target_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_email?: string
          workspace_id?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          billing_frequency: string | null
          cnpj: string | null
          contract_end_date: string | null
          created_at: string | null
          due_day: number | null
          email: string | null
          id: string
          is_active: boolean | null
          is_blocked: boolean | null
          legal_name: string | null
          manager_email: string | null
          manager_name: string | null
          max_users: number | null
          max_workspaces: number | null
          name: string
          next_due_date: string | null
          phone: string | null
          status: string | null
          subscription_status: string | null
          trade_name: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          billing_frequency?: string | null
          cnpj?: string | null
          contract_end_date?: string | null
          created_at?: string | null
          due_day?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_blocked?: boolean | null
          legal_name?: string | null
          manager_email?: string | null
          manager_name?: string | null
          max_users?: number | null
          max_workspaces?: number | null
          name: string
          next_due_date?: string | null
          phone?: string | null
          status?: string | null
          subscription_status?: string | null
          trade_name?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          billing_frequency?: string | null
          cnpj?: string | null
          contract_end_date?: string | null
          created_at?: string | null
          due_day?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_blocked?: boolean | null
          legal_name?: string | null
          manager_email?: string | null
          manager_name?: string | null
          max_users?: number | null
          max_workspaces?: number | null
          name?: string
          next_due_date?: string | null
          phone?: string | null
          status?: string | null
          subscription_status?: string | null
          trade_name?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string | null
          cpf: string | null
          created_at: string
          email: string
          id: string
          name: string
          organization_id: string | null
          require_password_change: boolean | null
          role_id: string
          workspaces: string[] | null
        }
        Insert: {
          avatar?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          id: string
          name: string
          organization_id?: string | null
          require_password_change?: boolean | null
          role_id?: string
          workspaces?: string[] | null
        }
        Update: {
          avatar?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          organization_id?: string | null
          require_password_change?: boolean | null
          role_id?: string
          workspaces?: string[] | null
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
      roles: {
        Row: {
          created_at: string | null
          id: string
          is_master: boolean | null
          name: string
          permissions: Json
        }
        Insert: {
          created_at?: string | null
          id: string
          is_master?: boolean | null
          name: string
          permissions?: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          is_master?: boolean | null
          name?: string
          permissions?: Json
        }
        Relationships: []
      }
      task_automation_executions: {
        Row: {
          created_at: string
          id: string
          negotiation_id: string
          rule_id: string
          stage_id: string
          task_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          negotiation_id: string
          rule_id: string
          stage_id: string
          task_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          negotiation_id?: string
          rule_id?: string
          stage_id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_automation_executions_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_automation_executions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "task_automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_automation_executions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_automation_rules: {
        Row: {
          active: boolean
          created_at: string
          due_days: number
          id: string
          pipeline_id: string
          stage_id: string
          task_description: string | null
          task_title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          due_days?: number
          id?: string
          pipeline_id: string
          stage_id: string
          task_description?: string | null
          task_title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          due_days?: number
          id?: string
          pipeline_id?: string
          stage_id?: string
          task_description?: string | null
          task_title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_automation_rules_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          color: string | null
          created_at: string | null
          deal_code_next_number: number
          deal_code_prefix: string
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          deal_code_next_number?: number
          deal_code_prefix?: string
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          deal_code_next_number?: number
          deal_code_prefix?: string
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_organization_id_fkey"
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
      current_workspace_id: { Args: never; Returns: string }
      deactivate_comment_mention_alerts: {
        Args: { p_comment_id: string; p_user_emails?: string[] }
        Returns: number
      }
      get_workspace_id: { Args: never; Returns: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
