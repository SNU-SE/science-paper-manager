'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { verifySession, refreshSession, logSecurityEvent } from '@/lib/auth-helpers'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Shield, User } from 'lucide-react'

interface AuthenticationVerifierProps {
  children: React.ReactNode
  requireAuth?: boolean
  redirectTo?: string
}

/**
 * Enhanced authentication verifier that provides additional security checks
 * beyond the basic ProtectedRoute component
 */
export function AuthenticationVerifier({ 
  children, 
  requireAuth = true, 
  redirectTo = '/login' 
}: AuthenticationVerifierProps) {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [sessionValid, setSessionValid] = useState<boolean | null>(null)
  const [verifying, setVerifying] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading) {
      verifyUserSession()
    }
  }, [user, loading])

  const verifyUserSession = async () => {
    try {
      setVerifying(true)
      setError(null)

      if (!requireAuth) {
        setSessionValid(true)
        setVerifying(false)
        return
      }

      if (!user) {
        setSessionValid(false)
        setVerifying(false)
        logSecurityEvent('auth_failure', { 
          reason: 'No user found',
          path: window.location.pathname 
        })
        return
      }

      // Verify session is still valid
      const isValid = await verifySession()
      
      if (!isValid) {
        // Try to refresh the session
        const refreshed = await refreshSession()
        
        if (!refreshed) {
          setSessionValid(false)
          setError('Your session has expired. Please sign in again.')
          logSecurityEvent('invalid_session', { 
            userId: user.id,
            path: window.location.pathname 
          })
          
          // Sign out and redirect
          await signOut()
          router.push(redirectTo)
          return
        }
      }

      setSessionValid(true)
    } catch (error) {
      console.error('Session verification failed:', error)
      setSessionValid(false)
      setError('Session verification failed. Please try signing in again.')
      logSecurityEvent('auth_failure', { 
        reason: 'Session verification error',
        error: error instanceof Error ? error.message : 'Unknown error',
        path: window.location.pathname 
      })
    } finally {
      setVerifying(false)
    }
  }

  const handleRetry = () => {
    verifyUserSession()
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push(redirectTo)
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  // Show loading state
  if (loading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <h2 className="text-lg font-semibold mb-2">Verifying Authentication</h2>
          <p className="text-gray-600">Please wait while we verify your session...</p>
        </div>
      </div>
    )
  }

  // Show authentication required message
  if (requireAuth && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-red-100 rounded-full w-fit">
              <Shield className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              You need to be signed in to access this page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => router.push(redirectTo)} 
              className="w-full"
            >
              <User className="mr-2 h-4 w-4" />
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show session error
  if (requireAuth && sessionValid === false && error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-yellow-100 rounded-full w-fit">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle>Session Error</CardTitle>
            <CardDescription>
              There was a problem with your authentication session
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleRetry} 
                variant="outline" 
                className="flex-1"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
              <Button 
                onClick={handleSignOut} 
                className="flex-1"
              >
                <User className="mr-2 h-4 w-4" />
                Sign In Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render children if authentication is valid or not required
  if (!requireAuth || (sessionValid && user)) {
    return <>{children}</>
  }

  // Fallback loading state
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}