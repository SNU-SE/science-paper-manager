'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { 
  verifySession, 
  refreshSession, 
  validateUserId, 
  logSecurityEvent,
  requireAuthentication,
  AuthenticationError,
  AuthorizationError
} from '@/lib/auth-helpers'
import { useToast } from './use-toast'

interface AuthSecurityState {
  isAuthenticated: boolean
  isSessionValid: boolean
  isVerifying: boolean
  error: string | null
}

interface AuthSecurityActions {
  verifyUserSession: () => Promise<boolean>
  requireAuth: () => string
  handleAuthError: (error: unknown) => void
  refreshUserSession: () => Promise<boolean>
}

/**
 * Enhanced authentication security hook that provides comprehensive
 * authentication and authorization checks for user settings
 */
export function useAuthenticationSecurity(): AuthSecurityState & AuthSecurityActions {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  
  const [state, setState] = useState<AuthSecurityState>({
    isAuthenticated: false,
    isSessionValid: false,
    isVerifying: true,
    error: null
  })

  // Verify user session
  const verifyUserSession = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isVerifying: true, error: null }))

      if (!user) {
        setState(prev => ({ 
          ...prev, 
          isAuthenticated: false, 
          isSessionValid: false,
          isVerifying: false,
          error: 'No user found'
        }))
        return false
      }

      // Validate user ID format
      if (!validateUserId(user.id)) {
        logSecurityEvent('invalid_session', { 
          userId: user.id, 
          reason: 'Invalid user ID format' 
        })
        setState(prev => ({ 
          ...prev, 
          isAuthenticated: false, 
          isSessionValid: false,
          isVerifying: false,
          error: 'Invalid user session'
        }))
        return false
      }

      // Verify session is still valid
      const isValid = await verifySession()
      
      setState(prev => ({ 
        ...prev, 
        isAuthenticated: !!user, 
        isSessionValid: isValid,
        isVerifying: false,
        error: isValid ? null : 'Session expired'
      }))

      if (!isValid) {
        logSecurityEvent('invalid_session', { 
          userId: user.id, 
          reason: 'Session verification failed' 
        })
      }

      return isValid
    } catch (error) {
      console.error('Session verification failed:', error)
      setState(prev => ({ 
        ...prev, 
        isAuthenticated: false, 
        isSessionValid: false,
        isVerifying: false,
        error: 'Session verification failed'
      }))
      
      logSecurityEvent('auth_failure', { 
        userId: user?.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'verifyUserSession'
      })
      
      return false
    }
  }, [user])

  // Refresh user session
  const refreshUserSession = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isVerifying: true }))
      
      const refreshed = await refreshSession()
      
      if (refreshed) {
        // Re-verify after refresh
        return await verifyUserSession()
      } else {
        setState(prev => ({ 
          ...prev, 
          isAuthenticated: false, 
          isSessionValid: false,
          isVerifying: false,
          error: 'Failed to refresh session'
        }))
        
        logSecurityEvent('auth_failure', { 
          userId: user?.id,
          reason: 'Session refresh failed'
        })
        
        return false
      }
    } catch (error) {
      console.error('Session refresh failed:', error)
      setState(prev => ({ 
        ...prev, 
        isAuthenticated: false, 
        isSessionValid: false,
        isVerifying: false,
        error: 'Session refresh failed'
      }))
      return false
    }
  }, [user, verifyUserSession])

  // Require authentication and return user ID
  const requireAuth = useCallback((): string => {
    try {
      return requireAuthentication(user)
    } catch (error) {
      handleAuthError(error)
      throw error
    }
  }, [user])

  // Handle authentication/authorization errors
  const handleAuthError = useCallback((error: unknown) => {
    if (error instanceof AuthenticationError) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to access this feature',
        variant: 'destructive'
      })
      
      // Redirect to login
      router.push('/login')
      return
    }
    
    if (error instanceof AuthorizationError) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to access this resource',
        variant: 'destructive'
      })
      return
    }
    
    // Handle Supabase RLS violations
    if (error && typeof error === 'object' && 'code' in error) {
      const supabaseError = error as { code: string; message: string }
      
      if (supabaseError.code === '42501' || supabaseError.message?.includes('RLS')) {
        logSecurityEvent('rls_violation', { 
          userId: user?.id,
          error: supabaseError.message 
        })
        
        toast({
          title: 'Access Denied',
          description: 'Security policy prevents access to this resource',
          variant: 'destructive'
        })
        return
      }
      
      if (supabaseError.code === 'PGRST301') {
        logSecurityEvent('invalid_session', { 
          userId: user?.id,
          error: supabaseError.message 
        })
        
        toast({
          title: 'Session Expired',
          description: 'Your session has expired. Please sign in again.',
          variant: 'destructive'
        })
        
        // Sign out and redirect
        signOut().then(() => {
          router.push('/login')
        })
        return
      }
    }
    
    // Generic error
    console.error('Unhandled auth error:', error)
    toast({
      title: 'Error',
      description: 'An unexpected error occurred',
      variant: 'destructive'
    })
  }, [user, toast, router, signOut])

  // Initial verification when user changes
  useEffect(() => {
    if (!loading) {
      verifyUserSession()
    }
  }, [user, loading, verifyUserSession])

  // Periodic session verification (every 5 minutes)
  useEffect(() => {
    if (!user || loading) return

    const interval = setInterval(() => {
      verifyUserSession()
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [user, loading, verifyUserSession])

  return {
    ...state,
    verifyUserSession,
    requireAuth,
    handleAuthError,
    refreshUserSession
  }
}