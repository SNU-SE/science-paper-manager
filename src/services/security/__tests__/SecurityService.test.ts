import { SecurityService } from '../SecurityService'
import crypto from 'crypto'

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis()
    }))
  }))
}))

// Mock environment variables
process.env.ENCRYPTION_MASTER_KEY = 'test-master-key-32-characters-long'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

describe('SecurityService', () => {
  let securityService: SecurityService

  beforeEach(() => {
    securityService = new SecurityService()
    jest.clearAllMocks()
  })

  describe('API Key Encryption/Decryption', () => {
    test('should encrypt and decrypt API key successfully', async () => {
      const originalKey = 'sk-test-api-key-12345'
      const userId = 'user-123'

      // Encrypt the key
      const encryptedData = await securityService.encryptAPIKey(originalKey, userId)

      expect(encryptedData).toHaveProperty('encryptedValue')
      expect(encryptedData).toHaveProperty('iv')
      expect(encryptedData).toHaveProperty('salt')
      expect(encryptedData).toHaveProperty('hash')
      expect(encryptedData).toHaveProperty('authTag')

      // Decrypt the key
      const decryptedKey = await securityService.decryptAPIKey(encryptedData, userId)

      expect(decryptedKey).toBe(originalKey)
    })

    test('should fail decryption with wrong user ID', async () => {
      const originalKey = 'sk-test-api-key-12345'
      const userId = 'user-123'
      const wrongUserId = 'user-456'

      const encryptedData = await securityService.encryptAPIKey(originalKey, userId)

      await expect(
        securityService.decryptAPIKey(encryptedData, wrongUserId)
      ).rejects.toThrow('Failed to decrypt API key')
    })

    test('should fail decryption with tampered data', async () => {
      const originalKey = 'sk-test-api-key-12345'
      const userId = 'user-123'

      const encryptedData = await securityService.encryptAPIKey(originalKey, userId)
      
      // Tamper with the encrypted data
      encryptedData.encryptedValue = 'tampered-data'

      await expect(
        securityService.decryptAPIKey(encryptedData, userId)
      ).rejects.toThrow('Failed to decrypt API key')
    })
  })

  describe('Session Management', () => {
    test('should generate consistent session fingerprint', () => {
      const mockRequest = {
        headers: {
          'user-agent': 'Mozilla/5.0 Test Browser',
          'accept-language': 'en-US,en;q=0.9',
          'accept-encoding': 'gzip, deflate, br',
        },
        ip: '192.168.1.1'
      }

      const fingerprint1 = securityService.generateSessionFingerprint(mockRequest)
      const fingerprint2 = securityService.generateSessionFingerprint(mockRequest)

      expect(fingerprint1).toBe(fingerprint2)
      expect(fingerprint1).toHaveLength(64) // SHA-256 hex string
    })

    test('should generate different fingerprints for different requests', () => {
      const mockRequest1 = {
        headers: {
          'user-agent': 'Mozilla/5.0 Test Browser',
          'accept-language': 'en-US,en;q=0.9',
          'accept-encoding': 'gzip, deflate, br',
        },
        ip: '192.168.1.1'
      }

      const mockRequest2 = {
        headers: {
          'user-agent': 'Chrome/91.0 Test Browser',
          'accept-language': 'en-US,en;q=0.9',
          'accept-encoding': 'gzip, deflate, br',
        },
        ip: '192.168.1.1'
      }

      const fingerprint1 = securityService.generateSessionFingerprint(mockRequest1)
      const fingerprint2 = securityService.generateSessionFingerprint(mockRequest2)

      expect(fingerprint1).not.toBe(fingerprint2)
    })

    test('should create session token', async () => {
      const userId = 'user-123'
      const fingerprint = 'test-fingerprint'

      const token = await securityService.createSession(userId, fingerprint)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.length).toBe(64) // 32 bytes as hex
    })
  })

  describe('CSRF Token Management', () => {
    test('should generate CSRF token', () => {
      const sessionId = 'session-123'

      const tokenData = securityService.generateCSRFToken(sessionId)

      expect(tokenData).toHaveProperty('token')
      expect(tokenData).toHaveProperty('sessionId', sessionId)
      expect(tokenData).toHaveProperty('expiresAt')
      expect(tokenData.token).toHaveLength(64) // 32 bytes as hex
      expect(tokenData.expiresAt).toBeInstanceOf(Date)
    })

    test('should generate different CSRF tokens', () => {
      const sessionId = 'session-123'

      const token1 = securityService.generateCSRFToken(sessionId)
      const token2 = securityService.generateCSRFToken(sessionId)

      expect(token1.token).not.toBe(token2.token)
    })
  })

  describe('Suspicious Activity Detection', () => {
    test('should analyze activity patterns', () => {
      // Create 6 failed login attempts within 15 minutes to trigger the pattern
      const activities = []
      for (let i = 0; i < 6; i++) {
        activities.push({
          action: 'login_failed',
          created_at: new Date(Date.now() - i * 2 * 60 * 1000).toISOString(), // Every 2 minutes
          metadata: { ip_address: '192.168.1.1' }
        })
      }

      // Use reflection to access private method for testing
      const analyzeMethod = (securityService as any).analyzeActivityPatterns
      const patterns = analyzeMethod.call(securityService, activities, 'login_attempt', {})

      expect(patterns).toContain('multiple_failed_logins')
    })

    test('should calculate risk levels correctly', () => {
      // Use reflection to access private method for testing
      const calculateMethod = (securityService as any).calculateRiskLevel

      expect(calculateMethod.call(securityService, ['multiple_failed_logins'])).toBe('critical')
      expect(calculateMethod.call(securityService, ['rapid_requests'])).toBe('high')
      expect(calculateMethod.call(securityService, ['multiple_user_agents'])).toBe('medium')
      expect(calculateMethod.call(securityService, [])).toBe('low')
    })

    test('should generate appropriate security recommendations', () => {
      // Use reflection to access private method for testing
      const recommendMethod = (securityService as any).generateSecurityRecommendations

      const recommendations = recommendMethod.call(
        securityService, 
        ['multiple_failed_logins', 'rapid_requests'], 
        'high'
      )

      expect(recommendations).toContain('Enable two-factor authentication')
      expect(recommendations).toContain('Change password immediately')
      expect(recommendations).toContain('Review API usage patterns')
      expect(recommendations).toContain('Temporarily lock account')
    })
  })

  describe('Security Event Logging', () => {
    test('should log security events', async () => {
      const userId = 'user-123'
      const action = 'login_success'
      const riskLevel = 'low'
      const metadata = { ip: '192.168.1.1' }

      // Mock the supabase insert to verify it's called
      const mockInsert = jest.fn().mockResolvedValue({ error: null })
      ;(securityService as any).supabase.from = jest.fn(() => ({
        insert: mockInsert
      }))

      await securityService.logSecurityEvent(userId, action, riskLevel, metadata)

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: userId,
        action,
        risk_level: riskLevel,
        metadata,
        created_at: expect.any(String)
      })
    })
  })

  describe('Account Locking', () => {
    test('should check if account is locked', async () => {
      const userId = 'user-123'

      // Mock unlocked account
      ;(securityService as any).supabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { is_locked: false },
          error: null
        })
      }))

      const isLocked = await securityService.isAccountLocked(userId)
      expect(isLocked).toBe(false)
    })

    test('should detect expired lock and unlock account', async () => {
      const userId = 'user-123'
      const expiredLockTime = new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1 hour ago

      const mockUpdate = jest.fn().mockResolvedValue({ error: null })
      ;(securityService as any).supabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            is_locked: true,
            lock_expires_at: expiredLockTime
          },
          error: null
        }),
        update: mockUpdate
      }))

      const isLocked = await securityService.isAccountLocked(userId)

      expect(isLocked).toBe(false)
      expect(mockUpdate).toHaveBeenCalledWith({
        is_locked: false,
        lock_reason: null,
        locked_at: null,
        lock_expires_at: null
      })
    })
  })

  describe('Data Cleanup', () => {
    test('should clean up expired data', async () => {
      const mockDelete = jest.fn().mockResolvedValue({ error: null })
      const mockLt = jest.fn().mockReturnThis()
      
      ;(securityService as any).supabase.from = jest.fn(() => ({
        delete: jest.fn(() => ({
          lt: mockLt
        }))
      }))

      await securityService.cleanupExpiredData()

      // Should be called 3 times: sessions, csrf_tokens, security_logs
      expect(mockLt).toHaveBeenCalledTimes(3)
    })
  })
})

describe('SecurityService Integration', () => {
  test('should handle complete encryption/decryption workflow', async () => {
    const securityService = new SecurityService()
    const apiKey = 'sk-test-very-long-api-key-with-special-chars-123!@#'
    const userId = 'user-integration-test'

    // Encrypt
    const encrypted = await securityService.encryptAPIKey(apiKey, userId)
    
    // Verify encrypted data structure
    expect(encrypted.encryptedValue).not.toBe(apiKey)
    expect(encrypted.iv).toHaveLength(32) // 16 bytes as hex
    expect(encrypted.salt).toHaveLength(32) // 16 bytes as hex
    expect(encrypted.hash).toHaveLength(64) // SHA-256 as hex
    expect(encrypted.authTag).toHaveLength(32) // 16 bytes as hex

    // Decrypt
    const decrypted = await securityService.decryptAPIKey(encrypted, userId)
    expect(decrypted).toBe(apiKey)
  })

  test('should handle session workflow', async () => {
    const securityService = new SecurityService()
    const userId = 'user-session-test'
    const mockRequest = {
      headers: {
        'user-agent': 'Test Browser',
        'accept-language': 'en-US',
        'accept-encoding': 'gzip',
      },
      ip: '127.0.0.1'
    }

    // Generate fingerprint
    const fingerprint = securityService.generateSessionFingerprint(mockRequest)
    expect(fingerprint).toHaveLength(64)

    // Create session
    const sessionToken = await securityService.createSession(userId, fingerprint)
    expect(sessionToken).toHaveLength(64)

    // Generate CSRF token
    const csrfData = securityService.generateCSRFToken(sessionToken.substring(0, 16))
    expect(csrfData.token).toHaveLength(64)
    expect(csrfData.sessionId).toBe(sessionToken.substring(0, 16))
  })
})