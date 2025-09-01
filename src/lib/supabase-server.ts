import { createClient } from '@supabase/supabase-js'

/**
 * Create a Supabase client for server-side operations
 * Returns null if credentials are not available (e.g., during build)
 */
export function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('supabaseKey is required in production')
    }
    console.warn('Supabase credentials not available - using development mode')
    return null
  }
  
  try {
    return createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  } catch (error) {
    console.error('Failed to create Supabase client:', error)
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Failed to initialize Supabase client in production')
    }
    return null
  }
}

/**
 * Execute a Supabase operation with fallback to mock data
 */
export async function withSupabase<T>(
  operation: (supabase: any) => Promise<T>,
  fallbackData: T
): Promise<T> {
  const supabase = createServerSupabaseClient()
  
  if (!supabase) {
    console.warn('Supabase not available, returning fallback data')
    return fallbackData
  }
  
  try {
    return await operation(supabase)
  } catch (error) {
    console.error('Supabase operation failed:', error)
    return fallbackData
  }
}