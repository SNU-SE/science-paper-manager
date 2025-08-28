import { createClient } from '@supabase/supabase-js'

// Database configuration
export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

// Create Supabase client for client-side operations with auth
export function getSupabaseClient() {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    throw new Error('Supabase configuration is missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.')
  }
  return createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  })
}

// Create Supabase client with service role for admin operations
export function getSupabaseAdminClient() {
  if (!supabaseConfig.url || !supabaseConfig.serviceRoleKey) {
    throw new Error('Supabase admin configuration is missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.')
  }
  return createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey)
}

// Legacy exports for backward compatibility - these will throw errors during build if env vars are missing
export const supabase = (() => {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    // Return a mock client during build time
    return null as any
  }
  return createClient(supabaseConfig.url, supabaseConfig.anonKey)
})()

export const supabaseAdmin = (() => {
  if (!supabaseConfig.url || !supabaseConfig.serviceRoleKey) {
    // Return a mock client during build time
    return null as any
  }
  return createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey)
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

export type MatchDocumentsResult = Database['public']['Functions']['match_documents']['Returns'][0]