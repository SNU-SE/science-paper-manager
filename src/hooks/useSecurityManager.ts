import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

export interface SecurityActivity {
  id: string
  action: string
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  metadata: any
  created_at: string
  ip_address?: string
  user_agent?: string
}

export interface SecurityAssessment {
  suspiciousActivity: boolean
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  recommendations: string[]
  detectedPatterns: string[]
}

export interface SecurityStats {
  riskLevelDistribution: Record<string, number>
  topActions: [string, number][]
  recentActivity: SecurityActivity[]
  accountStatus: {
    isLocked: boolean
    lockReason?: string
    lockedAt?: string
    lockExpiresAt?: string
    failedLoginAttempts: number
  }
  summary: {
    totalEvents: number
    highRiskEvents: number
    criticalEvents: number
    recentEvents: number
  }
}

export interface SessionInfo {
  valid: boolean
  userId?: string
  expiresAt?: string
  needsRefresh?: boolean
}

export interface CSRFToken {
  csrfToken: string
  expiresAt: string
}

export function useSecurityManager() {
  const [isLoading, setIsLoading] = useState(false)
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [securityStats, setSecurityStats] = useState<SecurityStats | null>(null)

  /**
   * Validate current session
   */
  const validateSession = useCallback(async (): Promise<SessionInfo | null> => {
    try {
      const response = await fetch('/api/security/session', {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setSessionInfo(data)
        return data
      } else {
        setSessionInfo(null)
        return null
      }
    } catch (error) {
      console.error('Session validation failed:', error)
      setSessionInfo(null)
      return null
    }
  }, [])

  /**
   * Create new session (login)
   */
  const createSession = useCallback(async (userId: string, credentials?: any): Promise<boolean> => {
    try {
      setIsLoading(true)
      
      const response = await fetch('/api/security/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ userId, credentials })
      })

      if (response.ok) {
        const data = await response.json()
        await validateSession() // Refresh session info
        toast.success('Session created successfully')
        return true
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create session')
        return false
      }
    } catch (error) {
      console.error('Session creation failed:', error)
      toast.error('Failed to create session')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [validateSession])

  /**
   * Invalidate session (logout)
   */
  const invalidateSession = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true)
      
      const response = await fetch('/api/security/session', {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        setSessionInfo(null)
        setCsrfToken(null)
        toast.success('Logged out successfully')
        return true
      } else {
        toast.error('Failed to logout')
        return false
      }
    } catch (error) {
      console.error('Session invalidation failed:', error)
      toast.error('Failed to logout')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Generate CSRF token
   */
  const generateCSRFToken = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/security/csrf', {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        const data: CSRFToken = await response.json()
        setCsrfToken(data.csrfToken)
        return data.csrfToken
      } else {
        console.error('Failed to generate CSRF token')
        return null
      }
    } catch (error) {
      console.error('CSRF token generation failed:', error)
      return null
    }
  }, [])

  /**
   * Store encrypted API key
   */
  const storeAPIKey = useCallback(async (provider: string, apiKey: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      
      // Ensure we have a CSRF token
      const token = csrfToken || await generateCSRFToken()
      if (!token) {
        toast.error('Security token required')
        return false
      }

      const response = await fetch('/api/security/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
          'X-Session-ID': sessionInfo?.userId?.substring(0, 16) || ''
        },
        credentials: 'include',
        body: JSON.stringify({ provider, apiKey })
      })

      if (response.ok) {
        toast.success('API key stored securely')
        return true
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to store API key')
        return false
      }
    } catch (error) {
      console.error('API key storage failed:', error)
      toast.error('Failed to store API key')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [csrfToken, sessionInfo, generateCSRFToken])

  /**
   * Get API key (for internal use)
   */
  const getAPIKey = useCallback(async (provider: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/security/api-keys?provider=${provider}`, {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        return data.apiKey
      } else {
        return null
      }
    } catch (error) {
      console.error('API key retrieval failed:', error)
      return null
    }
  }, [])

  /**
   * Delete API key
   */
  const deleteAPIKey = useCallback(async (provider: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      
      // Ensure we have a CSRF token
      const token = csrfToken || await generateCSRFToken()
      if (!token) {
        toast.error('Security token required')
        return false
      }

      const response = await fetch(`/api/security/api-keys?provider=${provider}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': token,
          'X-Session-ID': sessionInfo?.userId?.substring(0, 16) || ''
        },
        credentials: 'include'
      })

      if (response.ok) {
        toast.success('API key deleted successfully')
        return true
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete API key')
        return false
      }
    } catch (error) {
      console.error('API key deletion failed:', error)
      toast.error('Failed to delete API key')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [csrfToken, sessionInfo, generateCSRFToken])

  /**
   * Get security activity
   */
  const getSecurityActivity = useCallback(async (
    limit = 50, 
    offset = 0, 
    filters?: { riskLevel?: string; action?: string }
  ): Promise<{ activities: SecurityActivity[]; pagination: any } | null> => {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      })

      if (filters?.riskLevel) {
        params.append('riskLevel', filters.riskLevel)
      }

      if (filters?.action) {
        params.append('action', filters.action)
      }

      const response = await fetch(`/api/security/activity?${params}`, {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        return await response.json()
      } else {
        return null
      }
    } catch (error) {
      console.error('Security activity retrieval failed:', error)
      return null
    }
  }, [])

  /**
   * Analyze security patterns
   */
  const analyzeSecurityPatterns = useCallback(async (
    action?: string, 
    metadata?: any
  ): Promise<SecurityAssessment | null> => {
    try {
      // Ensure we have a CSRF token
      const token = csrfToken || await generateCSRFToken()
      if (!token) {
        return null
      }

      const response = await fetch('/api/security/activity/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
          'X-Session-ID': sessionInfo?.userId?.substring(0, 16) || ''
        },
        credentials: 'include',
        body: JSON.stringify({ action, metadata })
      })

      if (response.ok) {
        const data = await response.json()
        return data.assessment
      } else {
        return null
      }
    } catch (error) {
      console.error('Security analysis failed:', error)
      return null
    }
  }, [csrfToken, sessionInfo, generateCSRFToken])

  /**
   * Get security statistics
   */
  const getSecurityStats = useCallback(async (): Promise<SecurityStats | null> => {
    try {
      const response = await fetch('/api/security/activity/stats', {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setSecurityStats(data)
        return data
      } else {
        return null
      }
    } catch (error) {
      console.error('Security statistics retrieval failed:', error)
      return null
    }
  }, [])

  /**
   * Make secure API request with CSRF protection
   */
  const secureRequest = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    // Ensure we have a CSRF token for state-changing operations
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || 'GET')) {
      const token = csrfToken || await generateCSRFToken()
      if (token) {
        options.headers = {
          ...options.headers,
          'X-CSRF-Token': token,
          'X-Session-ID': sessionInfo?.userId?.substring(0, 16) || ''
        }
      }
    }

    options.credentials = 'include'
    return fetch(url, options)
  }, [csrfToken, sessionInfo, generateCSRFToken])

  // Initialize session validation on mount
  useEffect(() => {
    validateSession()
  }, [validateSession])

  // Auto-refresh CSRF token
  useEffect(() => {
    if (sessionInfo?.valid && !csrfToken) {
      generateCSRFToken()
    }
  }, [sessionInfo, csrfToken, generateCSRFToken])

  // Auto-refresh session if needed
  useEffect(() => {
    if (sessionInfo?.needsRefresh) {
      // In a real implementation, you might want to refresh the session token
      console.log('Session needs refresh')
    }
  }, [sessionInfo])

  return {
    // State
    isLoading,
    sessionInfo,
    csrfToken,
    securityStats,
    
    // Session management
    validateSession,
    createSession,
    invalidateSession,
    
    // CSRF protection
    generateCSRFToken,
    
    // API key management
    storeAPIKey,
    getAPIKey,
    deleteAPIKey,
    
    // Security monitoring
    getSecurityActivity,
    analyzeSecurityPatterns,
    getSecurityStats,
    
    // Utilities
    secureRequest
  }
}