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
      commission_records: {
        Row: {
          created_at: string
          currency: string
          fee_cents: number
          gross_cents: number
          id: string
          job_id: string
          metadata: Json
          net_cents: number
          payment_intent_id: string | null
          rate: number
        }
        Insert: {
          created_at?: string
          currency?: string
          fee_cents: number
          gross_cents: number
          id?: string
          job_id: string
          metadata?: Json
          net_cents: number
          payment_intent_id?: string | null
          rate?: number
        }
        Update: {
          created_at?: string
          currency?: string
          fee_cents?: number
          gross_cents?: number
          id?: string
          job_id?: string
          metadata?: Json
          net_cents?: number
          payment_intent_id?: string | null
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_records_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_records_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reports: {
        Row: {
          category: string
          created_at: string
          depth_m: number | null
          id: string
          lat: number
          lng: number
          note: string
          reporter_id: string | null
          reviewed_by: string | null
          seabed: string | null
          status: string
          submitted_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          depth_m?: number | null
          id?: string
          lat: number
          lng: number
          note: string
          reporter_id?: string | null
          reviewed_by?: string | null
          seabed?: string | null
          status?: string
          submitted_by?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          depth_m?: number | null
          id?: string
          lat?: number
          lng?: number
          note?: string
          reporter_id?: string | null
          reviewed_by?: string | null
          seabed?: string | null
          status?: string
          submitted_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      emergency_service_requests: {
        Row: {
          assigned_provider_id: string | null
          bay_name: string | null
          category: string
          created_at: string
          description: string
          id: string
          lat: number
          lng: number
          status: string
          urgency_level: string
          user_id: string
          vessel_name: string
        }
        Insert: {
          assigned_provider_id?: string | null
          bay_name?: string | null
          category: string
          created_at?: string
          description?: string
          id?: string
          lat: number
          lng: number
          status?: string
          urgency_level?: string
          user_id: string
          vessel_name?: string
        }
        Update: {
          assigned_provider_id?: string | null
          bay_name?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          lat?: number
          lng?: number
          status?: string
          urgency_level?: string
          user_id?: string
          vessel_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_service_requests_assigned_provider_id_fkey"
            columns: ["assigned_provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_service_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_transactions: {
        Row: {
          actor_id: string | null
          amount_cents: number
          created_at: string
          currency: string
          id: string
          job_id: string
          kind: string
          metadata: Json
          notes: string | null
          payment_intent_id: string | null
        }
        Insert: {
          actor_id?: string | null
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          job_id: string
          kind: string
          metadata?: Json
          notes?: string | null
          payment_intent_id?: string | null
        }
        Update: {
          actor_id?: string | null
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          job_id?: string
          kind?: string
          metadata?: Json
          notes?: string | null
          payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escrow_transactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_transactions_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      job_messages: {
        Row: {
          blocked_terms: string[]
          created_at: string
          id: string
          job_id: string
          masked: boolean
          sender_id: string
          text: string
        }
        Insert: {
          blocked_terms?: string[]
          created_at?: string
          id?: string
          job_id: string
          masked?: boolean
          sender_id: string
          text: string
        }
        Update: {
          blocked_terms?: string[]
          created_at?: string
          id?: string
          job_id?: string
          masked?: boolean
          sender_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_offers: {
        Row: {
          created_at: string
          eta_minutes: number
          id: string
          job_id: string
          note: string | null
          price: number
          provider_id: string
        }
        Insert: {
          created_at?: string
          eta_minutes: number
          id?: string
          job_id: string
          note?: string | null
          price: number
          provider_id: string
        }
        Update: {
          created_at?: string
          eta_minutes?: number
          id?: string
          job_id?: string
          note?: string | null
          price?: number
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_offers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_offers_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_parts: {
        Row: {
          created_at: string
          id: string
          job_id: string
          part_image_url: string | null
          part_name: string
          part_price: number
          payment_status: Database["public"]["Enums"]["part_status"]
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          part_image_url?: string | null
          part_name: string
          part_price: number
          payment_status?: Database["public"]["Enums"]["part_status"]
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          part_image_url?: string | null
          part_name?: string
          part_price?: number
          payment_status?: Database["public"]["Enums"]["part_status"]
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_parts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          client_id: string
          created_at: string
          description: string
          dispatched_at: string | null
          eta_minutes: number | null
          extra_parts_cost: number
          id: string
          initial_labor_cost: number
          lat: number
          lng: number
          location_accuracy_m: number | null
          location_captured_at: string | null
          marina: string
          photo_url: string | null
          problem_category: string
          provider_id: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["job_status"]
          total_escrow_pool: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string
          dispatched_at?: string | null
          eta_minutes?: number | null
          extra_parts_cost?: number
          id?: string
          initial_labor_cost?: number
          lat?: number
          lng?: number
          location_accuracy_m?: number | null
          location_captured_at?: string | null
          marina?: string
          photo_url?: string | null
          problem_category: string
          provider_id?: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["job_status"]
          total_escrow_pool?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string
          dispatched_at?: string | null
          eta_minutes?: number | null
          extra_parts_cost?: number
          id?: string
          initial_labor_cost?: number
          lat?: number
          lng?: number
          location_accuracy_m?: number | null
          location_captured_at?: string | null
          marina?: string
          photo_url?: string | null
          problem_category?: string
          provider_id?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["job_status"]
          total_escrow_pool?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marine_zones: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          depth_m: number | null
          description: string | null
          id: string
          kind: string
          lat: number
          lng: number
          metadata: Json
          name: string
          updated_at: string
          vhf_channel: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          depth_m?: number | null
          description?: string | null
          id?: string
          kind: string
          lat: number
          lng: number
          metadata?: Json
          name: string
          updated_at?: string
          vhf_channel?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          depth_m?: number | null
          description?: string | null
          id?: string
          kind?: string
          lat?: number
          lng?: number
          metadata?: Json
          name?: string
          updated_at?: string
          vhf_channel?: string | null
        }
        Relationships: []
      }
      part_order_items: {
        Row: {
          id: string
          name_snapshot: string
          order_id: string
          part_id: string
          qty: number
          unit_price: number
        }
        Insert: {
          id?: string
          name_snapshot: string
          order_id: string
          part_id: string
          qty?: number
          unit_price: number
        }
        Update: {
          id?: string
          name_snapshot?: string
          order_id?: string
          part_id?: string
          qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "part_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "part_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_order_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_order_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "public_parts_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      part_orders: {
        Row: {
          buyer_id: string
          commission: number
          created_at: string
          dealer_id: string | null
          dealer_note: string | null
          delivery_eta_minutes: number | null
          delivery_location_label: string | null
          delivery_marina: string | null
          delivery_method: string
          id: string
          notes: string | null
          status: string
          subtotal: number | null
          total: number
          updated_at: string
          vessel_id: string | null
        }
        Insert: {
          buyer_id: string
          commission: number
          created_at?: string
          dealer_id?: string | null
          dealer_note?: string | null
          delivery_eta_minutes?: number | null
          delivery_location_label?: string | null
          delivery_marina?: string | null
          delivery_method?: string
          id?: string
          notes?: string | null
          status?: string
          subtotal?: number | null
          total: number
          updated_at?: string
          vessel_id?: string | null
        }
        Update: {
          buyer_id?: string
          commission?: number
          created_at?: string
          dealer_id?: string | null
          dealer_note?: string | null
          delivery_eta_minutes?: number | null
          delivery_location_label?: string | null
          delivery_marina?: string | null
          delivery_method?: string
          id?: string
          notes?: string | null
          status?: string
          subtotal?: number | null
          total?: number
          updated_at?: string
          vessel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "part_orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_orders_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_orders_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_catalog: {
        Row: {
          active: boolean
          brand: string
          category: string
          compatibility: string[] | null
          created_at: string
          id: string
          image_url: string | null
          marina: string | null
          marina_lat: number | null
          marina_lng: number | null
          name: string
          price: number
          sku: string | null
          stock: number
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand: string
          category: string
          compatibility?: string[] | null
          created_at?: string
          id?: string
          image_url?: string | null
          marina?: string | null
          marina_lat?: number | null
          marina_lng?: number | null
          name: string
          price: number
          sku?: string | null
          stock?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string
          category?: string
          compatibility?: string[] | null
          created_at?: string
          id?: string
          image_url?: string | null
          marina?: string | null
          marina_lat?: number | null
          marina_lng?: number | null
          name?: string
          price?: number
          sku?: string | null
          stock?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_catalog_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount_cents: number
          captain_id: string
          created_at: string
          currency: string
          external_ref: string | null
          id: string
          job_id: string
          metadata: Json
          offer_id: string | null
          provider: string
          provider_id: string | null
          released_at: string | null
          secured_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          captain_id: string
          created_at?: string
          currency?: string
          external_ref?: string | null
          id?: string
          job_id: string
          metadata?: Json
          offer_id?: string | null
          provider?: string
          provider_id?: string | null
          released_at?: string | null
          secured_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          captain_id?: string
          created_at?: string
          currency?: string
          external_ref?: string | null
          id?: string
          job_id?: string
          metadata?: Json
          offer_id?: string | null
          provider?: string
          provider_id?: string | null
          released_at?: string | null
          secured_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "job_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          severity: string
          subject_id: string | null
          subject_type: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          severity?: string
          subject_id?: string | null
          subject_type: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          severity?: string
          subject_id?: string | null
          subject_type?: string
        }
        Relationships: []
      }
      platform_ledger: {
        Row: {
          commission_amount: number
          created_at: string
          id: string
          job_id: string | null
          provider_payout: number
        }
        Insert: {
          commission_amount: number
          created_at?: string
          id?: string
          job_id?: string | null
          provider_payout: number
        }
        Update: {
          commission_amount?: number
          created_at?: string
          id?: string
          job_id?: string | null
          provider_payout?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_ledger_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string | null
          base_location: string | null
          boat_name: string | null
          business_name: string | null
          company_name: string | null
          created_at: string
          emergency_health_note: string | null
          equipment: Json
          full_name: string
          home_lat: number | null
          home_lng: number | null
          home_marina: string | null
          id: string
          is_available: boolean
          phone: string | null
          preferred_language: Database["public"]["Enums"]["language_code"]
          profile_picture_url: string | null
          requested_role: Database["public"]["Enums"]["user_role"] | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          wallet_balance: number
        }
        Insert: {
          account_type?: string | null
          base_location?: string | null
          boat_name?: string | null
          business_name?: string | null
          company_name?: string | null
          created_at?: string
          emergency_health_note?: string | null
          equipment?: Json
          full_name?: string
          home_lat?: number | null
          home_lng?: number | null
          home_marina?: string | null
          id: string
          is_available?: boolean
          phone?: string | null
          preferred_language?: Database["public"]["Enums"]["language_code"]
          profile_picture_url?: string | null
          requested_role?: Database["public"]["Enums"]["user_role"] | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          wallet_balance?: number
        }
        Update: {
          account_type?: string | null
          base_location?: string | null
          boat_name?: string | null
          business_name?: string | null
          company_name?: string | null
          created_at?: string
          emergency_health_note?: string | null
          equipment?: Json
          full_name?: string
          home_lat?: number | null
          home_lng?: number | null
          home_marina?: string | null
          id?: string
          is_available?: boolean
          phone?: string | null
          preferred_language?: Database["public"]["Enums"]["language_code"]
          profile_picture_url?: string | null
          requested_role?: Database["public"]["Enums"]["user_role"] | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          wallet_balance?: number
        }
        Relationships: []
      }
      provider_details: {
        Row: {
          certification_url: string | null
          created_at: string
          id: string
          jobs_completed: number
          lat: number | null
          live_status: Database["public"]["Enums"]["provider_status"]
          lng: number | null
          marina: string
          rating: number
          service_type: Database["public"]["Enums"]["service_type"]
          specialized_brands: string[]
          updated_at: string
        }
        Insert: {
          certification_url?: string | null
          created_at?: string
          id: string
          jobs_completed?: number
          lat?: number | null
          live_status?: Database["public"]["Enums"]["provider_status"]
          lng?: number | null
          marina?: string
          rating?: number
          service_type: Database["public"]["Enums"]["service_type"]
          specialized_brands?: string[]
          updated_at?: string
        }
        Update: {
          certification_url?: string | null
          created_at?: string
          id?: string
          jobs_completed?: number
          lat?: number | null
          live_status?: Database["public"]["Enums"]["provider_status"]
          lng?: number | null
          marina?: string
          rating?: number
          service_type?: Database["public"]["Enums"]["service_type"]
          specialized_brands?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_details_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_payouts: {
        Row: {
          amount_cents: number
          completed_at: string | null
          created_at: string
          currency: string
          external_ref: string | null
          id: string
          job_id: string
          metadata: Json
          payment_intent_id: string | null
          provider_id: string
          requested_at: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          external_ref?: string | null
          id?: string
          job_id: string
          metadata?: Json
          payment_intent_id?: string | null
          provider_id: string
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          external_ref?: string | null
          id?: string
          job_id?: string
          metadata?: Json
          payment_intent_id?: string | null
          provider_id?: string
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_payouts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_payouts_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_service_packages: {
        Row: {
          created_at: string
          eta_minutes: number | null
          id: string
          note: string | null
          package_id: string
          price: number
          provider_id: string
        }
        Insert: {
          created_at?: string
          eta_minutes?: number | null
          id?: string
          note?: string | null
          package_id: string
          price: number
          provider_id: string
        }
        Update: {
          created_at?: string
          eta_minutes?: number | null
          id?: string
          note?: string | null
          package_id?: string
          price?: number
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_service_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_service_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_packages: {
        Row: {
          base_duration_min: number | null
          category: string
          created_at: string
          id: string
          key: string
          title_en: string
          title_tr: string
        }
        Insert: {
          base_duration_min?: number | null
          category: string
          created_at?: string
          id?: string
          key: string
          title_en: string
          title_tr: string
        }
        Update: {
          base_duration_min?: number | null
          category?: string
          created_at?: string
          id?: string
          key?: string
          title_en?: string
          title_tr?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verified_dealers: {
        Row: {
          created_at: string
          note: string | null
          updated_at: string
          user_id: string
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          note?: string | null
          updated_at?: string
          user_id: string
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          note?: string | null
          updated_at?: string
          user_id?: string
          verified_by?: string | null
        }
        Relationships: []
      }
      verified_providers: {
        Row: {
          notes: string | null
          user_id: string
          verified_at: string
          verified_by: string | null
        }
        Insert: {
          notes?: string | null
          user_id: string
          verified_at?: string
          verified_by?: string | null
        }
        Update: {
          notes?: string | null
          user_id?: string
          verified_at?: string
          verified_by?: string | null
        }
        Relationships: []
      }
      vessels: {
        Row: {
          category: string
          created_at: string
          engine_model: string | null
          fuel_type: string | null
          id: string
          length_m: number | null
          name: string
          owner_id: string
          updated_at: string
          vessel_type: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          engine_model?: string | null
          fuel_type?: string | null
          id?: string
          length_m?: number | null
          name: string
          owner_id: string
          updated_at?: string
          vessel_type?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          engine_model?: string | null
          fuel_type?: string | null
          id?: string
          length_m?: number | null
          name?: string
          owner_id?: string
          updated_at?: string
          vessel_type?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      public_parts_catalog: {
        Row: {
          brand: string | null
          category: string | null
          compatibility: string[] | null
          created_at: string | null
          id: string | null
          image_url: string | null
          marina: string | null
          name: string | null
          price: number | null
          sku: string | null
          stock: number | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          compatibility?: string[] | null
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          marina?: string | null
          name?: string | null
          price?: number | null
          sku?: string | null
          stock?: number | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          compatibility?: string[] | null
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          marina?: string | null
          name?: string | null
          price?: number | null
          sku?: string | null
          stock?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_emergency_request: { Args: { _id: string }; Returns: undefined }
      accept_offer: {
        Args: { _job_id: string; _offer_id: string }
        Returns: undefined
      }
      add_extra_part: {
        Args: {
          _job_id: string
          _name: string
          _photo: string
          _price: number
          _source: string
        }
        Returns: string
      }
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      approve_part: { Args: { _part_id: string }; Returns: undefined }
      book_service_package: {
        Args: {
          _psp_id: string
          _lat: number
          _lng: number
          _marina: string
          _description: string
          _location_accuracy_m?: number
          _location_captured_at?: string
        }
        Returns: string
      }
      approve_role_request: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: undefined
      }
      checkout_parts_cart:
        | { Args: { _delivery_marina: string; _items: Json }; Returns: string }
        | {
            Args: {
              _delivery_eta_minutes?: number
              _delivery_location_label?: string
              _delivery_marina: string
              _delivery_method?: string
              _items: Json
              _notes?: string
              _vessel_id?: string
            }
            Returns: string
          }
      complete_job: { Args: { _job_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_provider: { Args: { _user_id: string }; Returns: boolean }
      is_verified_dealer: { Args: { _user_id: string }; Returns: boolean }
      is_verified_provider: { Args: { _user_id: string }; Returns: boolean }
      mark_arrived: { Args: { _job_id: string }; Returns: undefined }
      provider_is_available: { Args: { _provider: string }; Returns: boolean }
      provider_offers_service: {
        Args: {
          _provider: string
          _service: Database["public"]["Enums"]["service_type"]
        }
        Returns: boolean
      }
      record_payment_intent: {
        Args: { _job_id: string; _offer_id: string }
        Returns: string
      }
      reject_part: { Args: { _part_id: string }; Returns: undefined }
      set_sail: { Args: { _job_id: string }; Returns: undefined }
      user_is_job_participant_with: {
        Args: { _other: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      job_status:
        | "Pending"
        | "Offered"
        | "Accepted"
        | "EnRoute"
        | "OnSite"
        | "PartsPending"
        | "InProgress"
        | "Completed"
        | "Cancelled"
      language_code: "tr" | "en"
      part_status: "Pending" | "Paid" | "Rejected"
      provider_status: "Available" | "Busy" | "Offline"
      service_type: "Marine Mechanic" | "Underwater Diver"
      user_role: "Client" | "Provider" | "Supplier"
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
    Enums: {
      app_role: ["admin", "user"],
      job_status: [
        "Pending",
        "Offered",
        "Accepted",
        "EnRoute",
        "OnSite",
        "PartsPending",
        "InProgress",
        "Completed",
        "Cancelled",
      ],
      language_code: ["tr", "en"],
      part_status: ["Pending", "Paid", "Rejected"],
      provider_status: ["Available", "Busy", "Offline"],
      service_type: ["Marine Mechanic", "Underwater Diver"],
      user_role: ["Client", "Provider", "Supplier"],
    },
  },
} as const
