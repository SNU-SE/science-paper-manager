import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Database configuration
export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

// Singleton instances to prevent multiple client creation
let supabaseInstance: SupabaseClient | null = null
let supabaseAdminInstance: SupabaseClient | null = null

// Create Supabase client for client-side operations with auth (Singleton)
export function getSupabaseClient() {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    throw new Error('Supabase configuration is missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.')
  }
  
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined
      }
    })
  }
  
  return supabaseInstance
}

// Create Supabase client with service role for admin operations (Singleton)
export function getSupabaseAdminClient() {
  if (!supabaseConfig.url || !supabaseConfig.serviceRoleKey) {
    throw new Error('Supabase admin configuration is missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.')
  }
  
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }
  
  return supabaseAdminInstance
}

// Legacy exports using singleton instances
export const supabase = (() => {
  try {
    return getSupabaseClient()
  } catch {
    return null as any
  }
})()

export const supabaseAdmin = (() => {
  try {
    return getSupabaseAdminClient()
  } catch {
    return null as any
  }
})()

// Database table names
export const TABLES = {
  PAPERS: 'papers',
  USER_EVALUATIONS: 'user_evaluations',
  AI_ANALYSES: 'ai_analyses',
  DOCUMENTS: 'documents'
} as const

// Database types
export interface Database {
  public: {
    Tables: {
      papers: {
        Row: {
          id: string
          title: string
          authors: string[] | null
          journal: string | null
          publication_year: number | null
          doi: string | null
          abstract: string | null
          zotero_key: string | null
          google_drive_id: string | null
          google_drive_url: string | null
          pdf_path: string | null
          reading_status: 'unread' | 'reading' | 'completed'
          date_added: string
          date_read: string | null
          last_modified: string
        }
        Insert: {
          id?: string
          title: string
          authors?: string[] | null
          journal?: string | null
          publication_year?: number | null
          doi?: string | null
          abstract?: string | null
          zotero_key?: string | null
          google_drive_id?: string | null
          google_drive_url?: string | null
          pdf_path?: string | null
          reading_status?: 'unread' | 'reading' | 'completed'
          date_added?: string
          date_read?: string | null
          last_modified?: string
        }
        Update: {
          id?: string
          title?: string
          authors?: string[] | null
          journal?: string | null
          publication_year?: number | null
          doi?: string | null
          abstract?: string | null
          zotero_key?: string | null
          google_drive_id?: string | null
          google_drive_url?: string | null
          pdf_path?: string | null
          reading_status?: 'unread' | 'reading' | 'completed'
          date_added?: string
          date_read?: string | null
          last_modified?: string
        }
      }
      user_evaluations: {
        Row: {
          id: string
          paper_id: string
          rating: number | null
          notes: string | null
          tags: string[]
          highlights: any | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          paper_id: string
          rating?: number | null
          notes?: string | null
          tags?: string[]
          highlights?: any | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          paper_id?: string
          rating?: number | null
          notes?: string | null
          tags?: string[]
          highlights?: any | null
          created_at?: string
          updated_at?: string
        }
      }
      ai_analyses: {
        Row: {
          id: string
          paper_id: string
          model_provider: 'openai' | 'anthropic' | 'xai' | 'gemini'
          model_name: string
          summary: string | null
          keywords: string[]
          scientific_relevance: any | null
          confidence_score: number | null
          tokens_used: number | null
          processing_time_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          paper_id: string
          model_provider: 'openai' | 'anthropic' | 'xai' | 'gemini'
          model_name: string
          summary?: string | null
          keywords?: string[]
          scientific_relevance?: any | null
          confidence_score?: number | null
          tokens_used?: number | null
          processing_time_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          paper_id?: string
          model_provider?: 'openai' | 'anthropic' | 'xai' | 'gemini'
          model_name?: string
          summary?: string | null
          keywords?: string[]
          scientific_relevance?: any | null
          confidence_score?: number | null
          tokens_used?: number | null
          processing_time_ms?: number | null
          created_at?: string
        }
      }
      documents: {
        Row: {
          id: number
          content: string
          metadata: any
          embedding: number[] | null
        }
        Insert: {
          id?: number
          content: string
          metadata?: any
          embedding?: number[] | null
        }
        Update: {
          id?: number
          content?: string
          metadata?: any
          embedding?: number[] | null
        }
      }
      user_google_drive_settings: {
        Row: {
          id: string
          user_id: string
          client_id: string
          client_secret: string
          redirect_uri: string
          refresh_token: string | null
          access_token: string | null
          token_expiry: string | null
          root_folder_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
      }
      user_api_keys: {
        Row: {
          id: string
          user_id: string
          provider: string
          api_key_encrypted: string
          api_key_hash: string
          is_valid: boolean
          last_validated_at: string | null
          usage_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider: string
          api_key_encrypted: string
          api_key_hash: string
          is_valid?: boolean
          last_validated_at?: string | null
          usage_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: string
          api_key_encrypted?: string
          api_key_hash?: string
          is_valid?: boolean
          last_validated_at?: string | null
          usage_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      user_ai_model_preferences: {
        Row: {
          id: string
          user_id: string
          provider: string
          model_name: string
          is_default: boolean
          parameters: any
          is_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider: string
          model_name: string
          is_default?: boolean
          parameters?: any
          is_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: string
          model_name?: string
          is_default?: boolean
          parameters?: any
          is_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_zotero_settings: {
        Row: {
          id: string
          user_id: string
          api_key_encrypted: string
          user_id_zotero: string
          library_type: string
          library_id: string | null
          auto_sync: boolean
          sync_interval: number
          last_sync_at: string | null
          sync_status: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          api_key_encrypted: string
          user_id_zotero: string
          library_type?: string
          library_id?: string | null
          auto_sync?: boolean
          sync_interval?: number
          last_sync_at?: string | null
          sync_status?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          api_key_encrypted?: string
          user_id_zotero?: string
          library_type?: string
          library_id?: string | null
          auto_sync?: boolean
          sync_interval?: number
          last_sync_at?: string | null
          sync_status?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          user_id: string
          client_id: string
          client_secret: string
          redirect_uri: string
          refresh_token?: string | null
          access_token?: string | null
          token_expiry?: string | null
          root_folder_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          client_id?: string
          client_secret?: string
          redirect_uri?: string
          refresh_token?: string | null
          access_token?: string | null
          token_expiry?: string | null
          root_folder_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Functions: {
      match_documents: {
        Args: {
          query_embedding: number[]
          match_count?: number
          filter?: any
        }
        Returns: {
          id: number
          content: string
          metadata: any
          similarity: number
        }[]
      }
    }
  }
}

// Type helpers
export type Paper = Database['public']['Tables']['papers']['Row']
export type PaperInsert = Database['public']['Tables']['papers']['Insert']
export type PaperUpdate = Database['public']['Tables']['papers']['Update']

export type UserEvaluation = Database['public']['Tables']['user_evaluations']['Row']
export type UserEvaluationInsert = Database['public']['Tables']['user_evaluations']['Insert']
export type UserEvaluationUpdate = Database['public']['Tables']['user_evaluations']['Update']

export type AIAnalysis = Database['public']['Tables']['ai_analyses']['Row']
export type AIAnalysisInsert = Database['public']['Tables']['ai_analyses']['Insert']
export type AIAnalysisUpdate = Database['public']['Tables']['ai_analyses']['Update']

export type Document = Database['public']['Tables']['documents']['Row']
export type DocumentInsert = Database['public']['Tables']['documents']['Insert']
export type DocumentUpdate = Database['public']['Tables']['documents']['Update']

export type UserGoogleDriveSettings = Database['public']['Tables']['user_google_drive_settings']['Row']
export type UserGoogleDriveSettingsInsert = Database['public']['Tables']['user_google_drive_settings']['Insert']
export type UserGoogleDriveSettingsUpdate = Database['public']['Tables']['user_google_drive_settings']['Update']

export type UserApiKey = Database['public']['Tables']['user_api_keys']['Row']
export type UserApiKeyInsert = Database['public']['Tables']['user_api_keys']['Insert']
export type UserApiKeyUpdate = Database['public']['Tables']['user_api_keys']['Update']

export type UserAiModelPreference = Database['public']['Tables']['user_ai_model_preferences']['Row']
export type UserAiModelPreferenceInsert = Database['public']['Tables']['user_ai_model_preferences']['Insert']
export type UserAiModelPreferenceUpdate = Database['public']['Tables']['user_ai_model_preferences']['Update']

export type UserZoteroSettings = Database['public']['Tables']['user_zotero_settings']['Row']
export type UserZoteroSettingsInsert = Database['public']['Tables']['user_zotero_settings']['Insert']
export type UserZoteroSettingsUpdate = Database['public']['Tables']['user_zotero_settings']['Update']

export type MatchDocumentsResult = Database['public']['Functions']['match_documents']['Returns'][0]