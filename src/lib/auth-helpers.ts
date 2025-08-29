/**
 * Authentication helper functions for user settings and security
 */

import { User } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { getSupabaseClient } from './database'

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthorizationError'
  }
}

/**
 * Verify that a user is authenticated and return their ID
 * Throws AuthenticationError if not authenticated
 */
export function requireAuthentication(user: User | null): string {
  if (!user || !user.id) {
    throw new AuthenticationError('User must be authenticated to access this resource')
  }
  return user.id
}

/**
 * Verify that the current user matches the required user ID
 * Throws AuthorizationError if user IDs don't match
 */
export function requireUserMatch(currentUser: User | null, requiredUserId: string): void {
  const currentUserId = requireAuthentication(currentUser)
  
  if (currentUserId !== requiredUserId) {
    throw new AuthorizationError('User can only access their own resources')
  }
}

/**
 * Get the current authenticated user from Supabase
 * Returns null if not authenticated
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = getSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error('Error getting current user:', error)
      return null
    }
    
    return user
  } catch (error) {
    console.error('Error in getCurrentUser:', error)
    return null
  }
}

/**
 * Get authenticated user from request (for API routes)
 * Returns null if not authenticated
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<User | null> {
  try {
    const supabase = getSupabaseClient()
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }
    
    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    
    // Verify the token
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error) {
      console.error('Error getting authenticated user:', error)
      return null
    }
    
    return user
  } catch (error) {
    console.error('Error in getAuthenticatedUser:', error)
    return null
  }
}

/**
 * Verify that the current session is valid
 * Returns true if session is valid, false otherwise
 */
export async function verifySession(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient()
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Error verifying session:', error)
      return false
    }
    
    return !!session && !!session.user
  } catch (error) {
    console.error('Error in verifySession:', error)
    return false
  }
}

/**
 * Refresh the current session if it's expired
 * Returns true if refresh was successful, false otherwise
 */
export async function refreshSession(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.refreshSession()
    
    if (error) {
      console.error('Error refreshing session:', error)
      return false
    }
    
    return !!data.session
  } catch (error) {
    console.error('Error in refreshSession:', error)
    return false
  }
}

/**
 * Check if a user has access to a specific resource
 * This is a placeholder for future role-based access control
 */
export function checkResourceAccess(
  user: User | null, 
  resourceType: string, 
  resourceId?: string
): boolean {
  if (!user) {
    return false
  }
  
  // For now, all authenticated users have access to their own resources
  // This can be extended for role-based access control in the future
  return true
}

/**
 * Validate that a user ID is in the correct format
 */
export function validateUserId(userId: string): boolean {
  if (!userId || typeof userId !== 'string') {
    return false
  }
  
  // Supabase user IDs are UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(userId)
}

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }
  
  // Remove potentially dangerous characters
  return input
    .trim()
    .replace(/[<>'"&]/g, '') // Remove HTML/script injection characters
    .substring(0, 1000) // Limit length
}

/**
 * Log security events for monitoring
 */
export function logSecurityEvent(
  event: 'auth_failure' | 'unauthorized_access' | 'invalid_session' | 'rls_violation',
  details: Record<string, any> = {}
): void {
  // In production, this would send to a security monitoring service
  console.warn(`Security Event: ${event}`, {
    timestamp: new Date().toISOString(),
    ...details
  })
}

/**
 * Enhanced error handler for authentication/authorization errors
 */
export function handleAuthError(error: unknown): {
  message: string
  shouldRedirect: boolean
  statusCode: number
} {
  if (error instanceof AuthenticationError) {
    logSecurityEvent('auth_failure', { error: error.message })
    return {
      message: 'Please sign in to access this resource',
      shouldRedirect: true,
      statusCode: 401
    }
  }
  
  if (error instanceof AuthorizationError) {
    logSecurityEvent('unauthorized_access', { error: error.message })
    return {
      message: 'You do not have permission to access this resource',
      shouldRedirect: false,
      statusCode: 403
    }
  }
  
  // Handle Supabase RLS violations
  if (error && typeof error === 'object' && 'code' in error) {
    const supabaseError = error as { code: string; message: string }
    
    if (supabaseError.code === '42501' || supabaseError.message?.includes('RLS')) {
      logSecurityEvent('rls_violation', { error: supabaseError.message })
      return {
        message: 'Access denied by security policy',
        shouldRedirect: false,
        statusCode: 403
      }
    }
    
    if (supabaseError.code === 'PGRST301') {
      logSecurityEvent('invalid_session', { error: supabaseError.message })
      return {
        message: 'Your session has expired. Please sign in again.',
        shouldRedirect: true,
        statusCode: 401
      }
    }
  }
  
  // Generic error
  return {
    message: 'An unexpected error occurred',
    shouldRedirect: false,
    statusCode: 500
  }
}