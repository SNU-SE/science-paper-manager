/**
 * Tests for authentication security and RLS policies
 */

import { 
  requireAuthentication, 
  requireUserMatch, 
  validateUserId, 
  sanitizeUserInput,
  handleAuthError,
  AuthenticationError,
  AuthorizationError
} from '../auth-helpers'

// Mock user object
const mockUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  aud: 'authenticated',
  role: 'authenticated'
}

describe('Authentication Security', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('requireAuthentication', () => {
    it('should return user ID when user is authenticated', () => {
      const userId = requireAuthentication(mockUser as any)
      expect(userId).toBe(mockUser.id)
    })

    it('should throw AuthenticationError when user is null', () => {
      expect(() => requireAuthentication(null)).toThrow(AuthenticationError)
    })

    it('should throw AuthenticationError when user has no ID', () => {
      const userWithoutId = { ...mockUser, id: undefined }
      expect(() => requireAuthentication(userWithoutId as any)).toThrow(AuthenticationError)
    })
  })

  describe('requireUserMatch', () => {
    it('should pass when current user matches required user ID', () => {
      expect(() => requireUserMatch(mockUser as any, mockUser.id)).not.toThrow()
    })

    it('should throw AuthorizationError when user IDs do not match', () => {
      const differentUserId = '987fcdeb-51a2-43d1-b123-456789abcdef'
      expect(() => requireUserMatch(mockUser as any, differentUserId)).toThrow(AuthorizationError)
    })

    it('should throw AuthenticationError when user is null', () => {
      expect(() => requireUserMatch(null, mockUser.id)).toThrow(AuthenticationError)
    })
  })

  describe('validateUserId', () => {
    it('should return true for valid UUID', () => {
      expect(validateUserId('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
    })

    it('should return false for invalid UUID format', () => {
      expect(validateUserId('invalid-uuid')).toBe(false)
      expect(validateUserId('123')).toBe(false)
      expect(validateUserId('')).toBe(false)
    })

    it('should return false for non-string input', () => {
      expect(validateUserId(null as any)).toBe(false)
      expect(validateUserId(undefined as any)).toBe(false)
      expect(validateUserId(123 as any)).toBe(false)
    })
  })

  describe('sanitizeUserInput', () => {
    it('should remove dangerous characters', () => {
      const input = '<script>alert("xss")</script>'
      const sanitized = sanitizeUserInput(input)
      expect(sanitized).not.toContain('<')
      expect(sanitized).not.toContain('>')
      expect(sanitized).not.toContain('"')
    })

    it('should trim whitespace', () => {
      const input = '  test input  '
      const sanitized = sanitizeUserInput(input)
      expect(sanitized).toBe('test input')
    })

    it('should limit length', () => {
      const longInput = 'a'.repeat(2000)
      const sanitized = sanitizeUserInput(longInput)
      expect(sanitized.length).toBeLessThanOrEqual(1000)
    })

    it('should handle non-string input', () => {
      expect(sanitizeUserInput(null as any)).toBe('')
      expect(sanitizeUserInput(undefined as any)).toBe('')
      expect(sanitizeUserInput(123 as any)).toBe('')
    })
  })

  describe('handleAuthError', () => {
    it('should handle AuthenticationError correctly', () => {
      const error = new AuthenticationError('Test auth error')
      const result = handleAuthError(error)
      
      expect(result.statusCode).toBe(401)
      expect(result.shouldRedirect).toBe(true)
      expect(result.message).toContain('sign in')
    })

    it('should handle AuthorizationError correctly', () => {
      const error = new AuthorizationError('Test auth error')
      const result = handleAuthError(error)
      
      expect(result.statusCode).toBe(403)
      expect(result.shouldRedirect).toBe(false)
      expect(result.message).toContain('permission')
    })

    it('should handle RLS violation errors', () => {
      const error = { code: '42501', message: 'RLS policy violation' }
      const result = handleAuthError(error)
      
      expect(result.statusCode).toBe(403)
      expect(result.message).toContain('security policy')
    })

    it('should handle session expiration errors', () => {
      const error = { code: 'PGRST301', message: 'Session expired' }
      const result = handleAuthError(error)
      
      expect(result.statusCode).toBe(401)
      expect(result.shouldRedirect).toBe(true)
      expect(result.message).toContain('expired')
    })

    it('should handle generic errors', () => {
      const error = new Error('Generic error')
      const result = handleAuthError(error)
      
      expect(result.statusCode).toBe(500)
      expect(result.shouldRedirect).toBe(false)
    })
  })
})

describe('RLS Policy Simulation', () => {
  // These tests simulate RLS policy behavior
  // In a real environment, these would test against the actual database

  it('should simulate user can only access own API keys', () => {
    const userId1 = '123e4567-e89b-12d3-a456-426614174000'
    const userId2 = '987fcdeb-51a2-43d1-b123-456789abcdef'
    
    // Simulate RLS check
    const canAccess = (requestingUserId: string, resourceUserId: string) => {
      return requestingUserId === resourceUserId
    }
    
    expect(canAccess(userId1, userId1)).toBe(true)
    expect(canAccess(userId1, userId2)).toBe(false)
  })

  it('should simulate user can only modify own settings', () => {
    const userId1 = '123e4567-e89b-12d3-a456-426614174000'
    const userId2 = '987fcdeb-51a2-43d1-b123-456789abcdef'
    
    // Simulate RLS policy for updates
    const canUpdate = (requestingUserId: string, resourceUserId: string) => {
      return requestingUserId === resourceUserId
    }
    
    expect(canUpdate(userId1, userId1)).toBe(true)
    expect(canUpdate(userId1, userId2)).toBe(false)
  })

  it('should simulate anonymous users cannot access any settings', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000'
    
    // Simulate RLS check for anonymous user
    const canAccessAsAnonymous = (requestingUserId: string | null, resourceUserId: string) => {
      return requestingUserId !== null && requestingUserId === resourceUserId
    }
    
    expect(canAccessAsAnonymous(null, userId)).toBe(false)
    expect(canAccessAsAnonymous(userId, userId)).toBe(true)
  })
})

describe('Security Event Logging', () => {
  it('should log security events with proper structure', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    
    // Import and test logSecurityEvent
    const { logSecurityEvent } = require('../auth-helpers')
    
    logSecurityEvent('auth_failure', { userId: 'test-user', reason: 'invalid credentials' })
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Security Event: auth_failure',
      expect.objectContaining({
        timestamp: expect.any(String),
        userId: 'test-user',
        reason: 'invalid credentials'
      })
    )
    
    consoleSpy.mockRestore()
  })
})