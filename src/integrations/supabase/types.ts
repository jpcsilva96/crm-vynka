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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      contact_tags: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          area: string
          created_at: string
          created_by_email: string
          ddd: string
          full_name: string
          id: string
          mobile: string
          phone: string
          updated_at: string
        }
        Insert: {
          area?: string
          created_at?: string
          created_by_email?: string
          ddd?: string
          full_name?: string
          id?: string
          mobile?: string
          phone: string
          updated_at?: string
        }
        Update: {
          area?: string
          created_at?: string
          created_by_email?: string
          ddd?: string
          full_name?: string
          id?: string
          mobile?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_cadence_steps: {
        Row: {
          cadence_id: string
          created_at: string | null
          due_days_offset: number
          id: string
          position: number
          task_description: string | null
          task_title: string
          task_type: string
        }
        Insert: {
          cadence_id: string
          created_at?: string | null
          due_days_offset?: number
          id?: string
          position?: number
          task_description?: string | null
          task_title: string
          task_type?: string
        }
        Update: {
          cadence_id?: string
          created_at?: string | null
          due_days_offset?: number
          id?: string
          position?: number
          task_description?: string | null
          task_title?: string
          task_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_cadence_steps_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "crm_cadences"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_cadences: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
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
      crm_deal_order_items: {
        Row: {
          created_at: string
          id: string
          item_notes: string | null
          metadata: Json
          order_id: string
          product_name: string
          quantity: number
          quote_product_id: string | null
          sku: string | null
          total_price: number
          unit_price: number
          updated_at: string
          workspace_product_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_notes?: string | null
          metadata?: Json
          order_id: string
          product_name: string
          quantity?: number
          quote_product_id?: string | null
          sku?: string | null
          total_price?: number
          unit_price?: number
          updated_at?: string
          workspace_product_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_notes?: string | null
          metadata?: Json
          order_id?: string
          product_name?: string
          quantity?: number
          quote_product_id?: string | null
          sku?: string | null
          total_price?: number
          unit_price?: number
          updated_at?: string
          workspace_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "crm_deal_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_order_items_quote_product_id_fkey"
            columns: ["quote_product_id"]
            isOneToOne: false
            referencedRelation: "crm_deal_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_order_items_workspace_product_id_fkey"
            columns: ["workspace_product_id"]
            isOneToOne: false
            referencedRelation: "crm_workspace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_orders: {
        Row: {
          canceled_at: string | null
          canceled_by: string | null
          created_at: string
          deal_id: string
          id: string
          notes: string | null
          order_number: string | null
          source_quote_id: string
          status: string
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          deal_id: string
          id?: string
          notes?: string | null
          order_number?: string | null
          source_quote_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          notes?: string | null
          order_number?: string | null
          source_quote_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_orders_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_orders_source_quote_id_fkey"
            columns: ["source_quote_id"]
            isOneToOne: false
            referencedRelation: "crm_deal_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_products: {
        Row: {
          created_at: string
          deal_id: string
          discount: number
          event_date: string | null
          external_reference: string | null
          id: string
          item_notes: string | null
          item_status: string
          metadata: Json
          product_name: string
          quantity: number
          quote_id: string | null
          sku: string | null
          source_label: string | null
          source_type: string
          total_price: number
          unit_price: number
          updated_at: string
          workspace_product_id: string | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          discount?: number
          event_date?: string | null
          external_reference?: string | null
          id?: string
          item_notes?: string | null
          item_status?: string
          metadata?: Json
          product_name: string
          quantity?: number
          quote_id?: string | null
          sku?: string | null
          source_label?: string | null
          source_type?: string
          total_price?: number
          unit_price?: number
          updated_at?: string
          workspace_product_id?: string | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          discount?: number
          event_date?: string | null
          external_reference?: string | null
          id?: string
          item_notes?: string | null
          item_status?: string
          metadata?: Json
          product_name?: string
          quantity?: number
          quote_id?: string | null
          sku?: string | null
          source_label?: string | null
          source_type?: string
          total_price?: number
          unit_price?: number
          updated_at?: string
          workspace_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_products_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_products_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "crm_deal_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_products_workspace_product_id_fkey"
            columns: ["workspace_product_id"]
            isOneToOne: false
            referencedRelation: "crm_workspace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_quotes: {
        Row: {
          canceled_at: string | null
          canceled_by: string | null
          created_at: string
          crm_proposal_number: string
          deal_id: string
          erp_generated_at: string | null
          erp_generated_by: string | null
          erp_proposal_number: string | null
          generated_at: string | null
          generated_by: string | null
          generated_deal_code: string | null
          generated_deal_id: string | null
          generated_quote_code: string | null
          generated_quote_id: string | null
          id: string
          notes: string | null
          quote_number: number
          status: string
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          crm_proposal_number?: string
          deal_id: string
          erp_generated_at?: string | null
          erp_generated_by?: string | null
          erp_proposal_number?: string | null
          generated_at?: string | null
          generated_by?: string | null
          generated_deal_code?: string | null
          generated_deal_id?: string | null
          generated_quote_code?: string | null
          generated_quote_id?: string | null
          id?: string
          notes?: string | null
          quote_number: number
          status?: string
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          crm_proposal_number?: string
          deal_id?: string
          erp_generated_at?: string | null
          erp_generated_by?: string | null
          erp_proposal_number?: string | null
          generated_at?: string | null
          generated_by?: string | null
          generated_deal_code?: string | null
          generated_deal_id?: string | null
          generated_quote_code?: string | null
          generated_quote_id?: string | null
          id?: string
          notes?: string | null
          quote_number?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_quotes_generated_deal_id_fkey"
            columns: ["generated_deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_quotes_generated_quote_id_fkey"
            columns: ["generated_quote_id"]
            isOneToOne: false
            referencedRelation: "crm_deal_quotes"
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
          has_active_order: boolean
          id: string
          last_message: string | null
          last_message_time: string | null
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
          unread_count: number | null
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
          has_active_order?: boolean
          id?: string
          last_message?: string | null
          last_message_time?: string | null
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
          unread_count?: number | null
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
          has_active_order?: boolean
          id?: string
          last_message?: string | null
          last_message_time?: string | null
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
          unread_count?: number | null
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
      crm_pipeline_rules: {
        Row: {
          active: boolean
          config: Json
          created_at: string
          id: string
          pipeline_id: string
          rule_key: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          config?: Json
          created_at?: string
          id?: string
          pipeline_id: string
          rule_key: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          config?: Json
          created_at?: string
          id?: string
          pipeline_id?: string
          rule_key?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipeline_rules_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
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
      crm_sales_goals: {
        Row: {
          created_at: string | null
          id: string
          period_month: number
          period_year: number
          pipeline_id: string | null
          target_count: number | null
          target_value: number | null
          updated_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          period_month: number
          period_year: number
          pipeline_id?: string | null
          target_count?: number | null
          target_value?: number | null
          updated_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          period_month?: number
          period_year?: number
          pipeline_id?: string | null
          target_count?: number | null
          target_value?: number | null
          updated_at?: string | null
          user_id?: string
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
      crm_workspace_product_integrations: {
        Row: {
          authorization_token: string | null
          base_url: string
          business_unit_header: string
          business_unit_id: string
          company_header: string
          company_id: string
          created_at: string
          id: string
          initial_queue_date: string
          is_enabled: boolean
          last_products_count: number
          last_queue_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          last_synced_at: string | null
          load_queue_path: string
          products_path: string
          provider: string
          secret_key: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          authorization_token?: string | null
          base_url?: string
          business_unit_header?: string
          business_unit_id?: string
          company_header?: string
          company_id?: string
          created_at?: string
          id?: string
          initial_queue_date?: string
          is_enabled?: boolean
          last_products_count?: number
          last_queue_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          load_queue_path?: string
          products_path?: string
          provider: string
          secret_key?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          authorization_token?: string | null
          base_url?: string
          business_unit_header?: string
          business_unit_id?: string
          company_header?: string
          company_id?: string
          created_at?: string
          id?: string
          initial_queue_date?: string
          is_enabled?: boolean
          last_products_count?: number
          last_queue_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          load_queue_path?: string
          products_path?: string
          provider?: string
          secret_key?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_workspace_product_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_workspace_products: {
        Row: {
          category: string | null
          created_at: string
          external_reference: string | null
          id: string
          integration_metadata: Json
          is_active: boolean
          name: string
          sku: string | null
          source_label: string | null
          source_type: string
          unit_price: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          external_reference?: string | null
          id?: string
          integration_metadata?: Json
          is_active?: boolean
          name: string
          sku?: string | null
          source_label?: string | null
          source_type?: string
          unit_price?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          external_reference?: string | null
          id?: string
          integration_metadata?: Json
          is_active?: boolean
          name?: string
          sku?: string | null
          source_label?: string | null
          source_type?: string
          unit_price?: number
          updated_at?: string
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
          max_channels: number | null
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
          max_channels?: number | null
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
          max_channels?: number | null
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
          permissions: Json
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
      session_tags: {
        Row: {
          created_at: string
          id: string
          session_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tabulations: {
        Row: {
          channel_id: string
          created_at: string
          created_by_email: string
          id: string
          name: string
          workspace_id: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string
          created_by_email?: string
          id?: string
          name: string
          workspace_id?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string
          created_by_email?: string
          id?: string
          name?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tabulations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabulations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          created_by_email: string
          id: string
          name: string
          workspace_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          created_by_email?: string
          id?: string
          name: string
          workspace_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          created_by_email?: string
          id?: string
          name?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      whatsapp_channels: {
        Row: {
          created_at: string
          id: string
          instance: string
          is_default: boolean
          name: string
          robot_id: string
          token: string
          updated_at: string
          user_email: string
          waba_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instance: string
          is_default?: boolean
          name: string
          robot_id: string
          token: string
          updated_at?: string
          user_email: string
          waba_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instance?: string
          is_default?: boolean
          name?: string
          robot_id?: string
          token?: string
          updated_at?: string
          user_email?: string
          waba_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          id: string
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
      api_internal_keys: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_by_email: string | null
          id: string | null
          is_active: boolean | null
          is_revoked: boolean | null
          key_hash: string | null
          key_prefix: string | null
          last_used_at: string | null
          last_used_ip: string | null
          last_used_user_agent: string | null
          name: string | null
          organization_id: string | null
          permissions: Json | null
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_by_email?: string | null
          id?: string | null
          is_active?: boolean | null
          is_revoked?: boolean | null
          key_hash?: string | null
          key_prefix?: string | null
          last_used_at?: string | null
          last_used_ip?: string | null
          last_used_user_agent?: string | null
          name?: string | null
          organization_id?: string | null
          permissions?: Json | null
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_by_email?: string | null
          id?: string | null
          is_active?: boolean | null
          is_revoked?: boolean | null
          key_hash?: string | null
          key_prefix?: string | null
          last_used_at?: string | null
          last_used_ip?: string | null
          last_used_user_agent?: string | null
          name?: string | null
          organization_id?: string | null
          permissions?: Json | null
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      api_internal_pipelines: {
        Row: {
          created_at: string | null
          id: string | null
          name: string | null
          organization_id: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          organization_id?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          organization_id?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      api_internal_create_key: {
        Args: {
          p_created_by: string
          p_created_by_email: string
          p_key_hash: string
          p_key_prefix: string
          p_name: string
          p_organization_id: string
          p_permissions: Json
        }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "api_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      api_internal_touch_key_usage: {
        Args: {
          p_id: string
          p_last_used_at: string
          p_last_used_ip: string
          p_last_used_user_agent: string
        }
        Returns: undefined
      }
      api_internal_update_key: {
        Args: {
          p_id: string
          p_is_active?: boolean
          p_is_revoked?: boolean
          p_name?: string
          p_organization_id: string
          p_permissions?: Json
          p_revoked_at?: string
          p_revoked_by?: string
          p_revoked_reason?: string
        }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "api_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_deal_order: {
        Args: { p_canceled_by?: string; p_order_id: string }
        Returns: Json
      }
      create_deal_order_from_quote: {
        Args: {
          p_deal_id: string
          p_notes?: string
          p_order_number?: string
          p_quote_id: string
        }
        Returns: Json
      }
      current_workspace_id: { Args: never; Returns: string }
      generate_crm_proposal_number: { Args: never; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
