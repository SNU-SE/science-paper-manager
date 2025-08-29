/**
 * Environment variable validation and fallback utilities
 */

export interface EnvConfig {
  supabaseUrl: string | null
  supabaseAnonKey: string | null
  googleClientId: string | null
  googleClientSecret: string | null
}

export function getEnvConfig(): EnvConfig {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null,
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
  }
}

export function isSupabaseConfigured(): boolean {
  const config = getEnvConfig()
  return !!(config.supabaseUrl && config.supabaseAnonKey)
}

export function isGoogleDriveConfigured(): boolean {
  const config = getEnvConfig()
  return !!(config.googleClientId && config.googleClientSecret)
}

export function getClientSafeEnvConfig() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null,
    hasGoogleDrive: isGoogleDriveConfigured(),
  }
}

export function validateRequiredEnv() {
  const issues: string[] = []
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    issues.push('NEXT_PUBLIC_SUPABASE_URL is not set')
  }
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    issues.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')
  }
  
  return {
    isValid: issues.length === 0,
    issues,
  }
}