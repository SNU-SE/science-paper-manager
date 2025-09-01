import * as crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export interface EncryptedData {
  encryptedValue: string
  iv: string
  salt: string
  hash: string
  authTag: string
}

export interface SessionValidation {
  isValid: boolean
  userId?: string
  expiresAt?: Date
  needsRefresh?: boolean
  fingerprint?: string
}

export interface SecurityAssessment {
  suspiciousActivity: boolean
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  recommendations: string[]
  detectedPatterns: string[]
}

export interface CSRFTokenData {
  token: string
  sessionId: string
  expiresAt: Date
}

export class SecurityService {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly KEY_LENGTH = 32
  private static readonly IV_LENGTH = 16
  private static readonly SALT_LENGTH = 16
  private static readonly SESSION_TIMEOUT = 60 * 60 * 1000 // 1 hour
  private static readonly CSRF_TOKEN_EXPIRY = 30 * 60 * 1000 // 30 minutes

  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  /**
   * Encrypt API key using AES-256-CBC with user-specific salt
   * Requirement 4.1: AES-256 encryption for API keys
   */
  async encryptAPIKey(key: string, userId: string): Promise<EncryptedData> {
    try {
      const salt = crypto.randomBytes(SecurityService.SALT_LENGTH)
      const derivedKey = crypto.pbkdf2Sync(
        process.env.ENCRYPTION_MASTER_KEY!,
        salt,
        100000,
        SecurityService.KEY_LENGTH,
        'sha256'
      )
      
      const iv = crypto.randomBytes(SecurityService.IV_LENGTH)
      const cipher = crypto.createCipher('aes-256-cbc', derivedKey)
      
      let encrypted = cipher.update(key, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      
      const hash = crypto.createHash('sha256').update(key).digest('hex')
      
      // Create HMAC for authentication
      const hmac = crypto.createHmac('sha256', derivedKey)
      hmac.update(encrypted + userId)
      const authTag = hmac.digest('hex')
      
      return {
        encryptedValue: encrypted,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        hash,
        authTag
      }
    } catch (error) {
      console.error('API key encryption failed:', error)
      throw new Error('Failed to encrypt API key')
    }
  }

  /**
   * Decrypt API key using stored encryption data
   * Requirement 4.1: Secure API key decryption
   */
  async decryptAPIKey(encryptedData: EncryptedData, userId: string): Promise<string> {
    try {
      const salt = Buffer.from(encryptedData.salt, 'hex')
      const derivedKey = crypto.pbkdf2Sync(
        process.env.ENCRYPTION_MASTER_KEY!,
        salt,
        100000,
        SecurityService.KEY_LENGTH,
        'sha256'
      )
      
      // Verify HMAC authentication
      const hmac = crypto.createHmac('sha256', derivedKey)
      hmac.update(encryptedData.encryptedValue + userId)
      const expectedAuthTag = hmac.digest('hex')
      
      if (expectedAuthTag !== encryptedData.authTag) {
        throw new Error('Authentication failed')
      }
      
      const decipher = crypto.createDecipher('aes-256-cbc', derivedKey)
      
      let decrypted = decipher.update(encryptedData.encryptedValue, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      // Verify integrity
      const hash = crypto.createHash('sha256').update(decrypted).digest('hex')
      if (hash !== encryptedData.hash) {
        throw new Error('Data integrity check failed')
      }
      
      return decrypted
    } catch (error) {
      console.error('API key decryption failed:', error)
      throw new Error('Failed to decrypt API key')
    }
  }

  /**
   * Generate session fingerprint for session hijacking detection
   * Requirement 4.2: Session management and security
   */
  generateSessionFingerprint(req: any): string {
    const components = [
      req.headers['user-agent'] || '',
      req.headers['accept-language'] || '',
      req.headers['accept-encoding'] || '',
      req.ip || req.connection?.remoteAddress || ''
    ]
    
    return crypto.createHash('sha256')
      .update(components.join('|'))
      .digest('hex')
  }

  /**
   * Validate session token and detect potential hijacking
   * Requirement 4.2: Secure session management
   */
  async validateSession(token: string, currentFingerprint: string): Promise<SessionValidation> {
    try {
      const { data: session, error } = await this.supabase
        .from('user_sessions')
        .select('*')
        .eq('token_hash', crypto.createHash('sha256').update(token).digest('hex'))
        .single()

      if (error || !session) {
        return { isValid: false }
      }

      const now = new Date()
      const expiresAt = new Date(session.expires_at)

      // Check if session is expired
      if (now > expiresAt) {
        await this.invalidateSession(token)
        return { isValid: false }
      }

      // Check for session hijacking
      if (session.fingerprint !== currentFingerprint) {
        await this.handleSuspiciousActivity(session.user_id, 'session_hijacking_detected', {
          originalFingerprint: session.fingerprint,
          currentFingerprint,
          sessionId: session.id
        })
        await this.invalidateSession(token)
        return { isValid: false }
      }

      // Check if session needs refresh (within 15 minutes of expiry)
      const needsRefresh = (expiresAt.getTime() - now.getTime()) < (15 * 60 * 1000)

      return {
        isValid: true,
        userId: session.user_id,
        expiresAt,
        needsRefresh,
        fingerprint: session.fingerprint
      }
    } catch (error) {
      console.error('Session validation failed:', error)
      return { isValid: false }
    }
  }

  /**
   * Create new secure session
   * Requirement 4.2: Session token management with expiry
   */
  async createSession(userId: string, fingerprint: string): Promise<string> {
    try {
      const token = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      const expiresAt = new Date(Date.now() + SecurityService.SESSION_TIMEOUT)

      const { error } = await this.supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          token_hash: tokenHash,
          fingerprint,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString()
        })

      if (error) {
        throw error
      }

      return token
    } catch (error) {
      console.error('Session creation failed:', error)
      throw new Error('Failed to create session')
    }
  }

  /**
   * Invalidate session
   */
  async invalidateSession(token: string): Promise<void> {
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      
      await this.supabase
        .from('user_sessions')
        .delete()
        .eq('token_hash', tokenHash)
    } catch (error) {
      console.error('Session invalidation failed:', error)
    }
  }

  /**
   * Generate CSRF token
   * Requirement 4.4: CSRF token verification
   */
  generateCSRFToken(sessionId: string): CSRFTokenData {
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + SecurityService.CSRF_TOKEN_EXPIRY)
    
    return {
      token,
      sessionId,
      expiresAt
    }
  }

  /**
   * Validate CSRF token
   * Requirement 4.4: CSRF protection
   */
  async validateCSRFToken(token: string, sessionId: string): Promise<boolean> {
    try {
      const { data: csrfToken, error } = await this.supabase
        .from('csrf_tokens')
        .select('*')
        .eq('token', token)
        .eq('session_id', sessionId)
        .single()

      if (error || !csrfToken) {
        return false
      }

      const now = new Date()
      const expiresAt = new Date(csrfToken.expires_at)

      if (now > expiresAt) {
        // Clean up expired token
        await this.supabase
          .from('csrf_tokens')
          .delete()
          .eq('token', token)
        return false
      }

      return true
    } catch (error) {
      console.error('CSRF token validation failed:', error)
      return false
    }
  }

  /**
   * Store CSRF token
   */
  async storeCSRFToken(tokenData: CSRFTokenData): Promise<void> {
    try {
      await this.supabase
        .from('csrf_tokens')
        .insert({
          token: tokenData.token,
          session_id: tokenData.sessionId,
          expires_at: tokenData.expiresAt.toISOString(),
          created_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('CSRF token storage failed:', error)
      throw new Error('Failed to store CSRF token')
    }
  }

  /**
   * Detect suspicious activity patterns
   * Requirement 4.3: Suspicious activity detection
   */
  async detectSuspiciousActivity(userId: string, action: string, metadata?: any): Promise<SecurityAssessment> {
    try {
      // Get recent activity for this user
      const { data: recentActivity, error } = await this.supabase
        .from('security_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      const patterns = this.analyzeActivityPatterns(recentActivity || [], action, metadata)
      const riskLevel = this.calculateRiskLevel(patterns)
      
      // Log this activity
      await this.logSecurityEvent(userId, action, riskLevel, metadata)

      // If high risk, trigger automatic protection
      if (riskLevel === 'high' || riskLevel === 'critical') {
        await this.triggerAutomaticProtection(userId, riskLevel, patterns)
      }

      return {
        suspiciousActivity: riskLevel !== 'low',
        riskLevel,
        recommendations: this.generateSecurityRecommendations(patterns, riskLevel),
        detectedPatterns: patterns
      }
    } catch (error) {
      console.error('Suspicious activity detection failed:', error)
      return {
        suspiciousActivity: false,
        riskLevel: 'low',
        recommendations: [],
        detectedPatterns: []
      }
    }
  }

  /**
   * Handle suspicious activity
   * Requirement 4.3: Automatic account protection
   */
  private async handleSuspiciousActivity(userId: string, activityType: string, metadata: any): Promise<void> {
    try {
      await this.logSecurityEvent(userId, activityType, 'high', metadata)
      
      // Lock account temporarily
      await this.supabase
        .from('user_security_status')
        .upsert({
          user_id: userId,
          is_locked: true,
          lock_reason: activityType,
          locked_at: new Date().toISOString(),
          lock_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
        })

      // Invalidate all sessions for this user
      await this.supabase
        .from('user_sessions')
        .delete()
        .eq('user_id', userId)

      // Notify administrators
      await this.notifyAdministrators(userId, activityType, metadata)
    } catch (error) {
      console.error('Failed to handle suspicious activity:', error)
    }
  }

  /**
   * Analyze activity patterns for suspicious behavior
   */
  private analyzeActivityPatterns(activities: any[], currentAction: string, metadata?: any): string[] {
    const patterns: string[] = []
    
    // Check for rapid successive requests
    const recentRequests = activities.filter(a => 
      new Date(a.created_at).getTime() > Date.now() - 5 * 60 * 1000 // Last 5 minutes
    )
    
    if (recentRequests.length > 50) {
      patterns.push('rapid_requests')
    }

    // Check for multiple failed login attempts
    const failedLogins = activities.filter(a => 
      a.action === 'login_failed' && 
      new Date(a.created_at).getTime() > Date.now() - 15 * 60 * 1000 // Last 15 minutes
    )
    
    if (failedLogins.length > 5) {
      patterns.push('multiple_failed_logins')
    }

    // Check for unusual IP addresses
    const uniqueIPs = new Set(activities.map(a => a.metadata?.ip_address).filter(Boolean))
    if (uniqueIPs.size > 5) {
      patterns.push('multiple_ip_addresses')
    }

    // Check for unusual user agents
    const uniqueUserAgents = new Set(activities.map(a => a.metadata?.user_agent).filter(Boolean))
    if (uniqueUserAgents.size > 3) {
      patterns.push('multiple_user_agents')
    }

    // Check for API key access patterns
    const apiKeyAccess = activities.filter(a => a.action.includes('api_key'))
    if (apiKeyAccess.length > 10) {
      patterns.push('excessive_api_key_access')
    }

    return patterns
  }

  /**
   * Calculate risk level based on detected patterns
   */
  private calculateRiskLevel(patterns: string[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalPatterns = ['multiple_failed_logins', 'session_hijacking_detected']
    const highPatterns = ['rapid_requests', 'multiple_ip_addresses', 'excessive_api_key_access']
    const mediumPatterns = ['multiple_user_agents']

    if (patterns.some(p => criticalPatterns.includes(p))) {
      return 'critical'
    }
    
    if (patterns.some(p => highPatterns.includes(p))) {
      return 'high'
    }
    
    if (patterns.some(p => mediumPatterns.includes(p))) {
      return 'medium'
    }
    
    return 'low'
  }

  /**
   * Generate security recommendations
   */
  private generateSecurityRecommendations(patterns: string[], riskLevel: string): string[] {
    const recommendations: string[] = []

    if (patterns.includes('multiple_failed_logins')) {
      recommendations.push('Enable two-factor authentication')
      recommendations.push('Change password immediately')
    }

    if (patterns.includes('rapid_requests')) {
      recommendations.push('Review API usage patterns')
      recommendations.push('Consider implementing rate limiting')
    }

    if (patterns.includes('multiple_ip_addresses')) {
      recommendations.push('Review login locations')
      recommendations.push('Enable login notifications')
    }

    if (riskLevel === 'high' || riskLevel === 'critical') {
      recommendations.push('Temporarily lock account')
      recommendations.push('Notify security team')
      recommendations.push('Review all recent activities')
    }

    return recommendations
  }

  /**
   * Trigger automatic protection measures
   * Requirement 4.3: Automatic account protection
   */
  private async triggerAutomaticProtection(userId: string, riskLevel: string, patterns: string[]): Promise<void> {
    try {
      // Lock account
      await this.supabase
        .from('user_security_status')
        .upsert({
          user_id: userId,
          is_locked: true,
          lock_reason: `Automatic protection: ${patterns.join(', ')}`,
          locked_at: new Date().toISOString(),
          lock_expires_at: new Date(Date.now() + (riskLevel === 'critical' ? 60 : 30) * 60 * 1000).toISOString()
        })

      // Invalidate all sessions
      await this.supabase
        .from('user_sessions')
        .delete()
        .eq('user_id', userId)

      // Log the protection action
      await this.logSecurityEvent(userId, 'automatic_protection_triggered', riskLevel, {
        patterns,
        lockDuration: riskLevel === 'critical' ? 60 : 30
      })
    } catch (error) {
      console.error('Failed to trigger automatic protection:', error)
    }
  }

  /**
   * Log security events
   * Requirement 4.5: Access logging and audit trail
   */
  async logSecurityEvent(userId: string, action: string, riskLevel: string, metadata?: any): Promise<void> {
    try {
      await this.supabase
        .from('security_logs')
        .insert({
          user_id: userId,
          action,
          risk_level: riskLevel,
          metadata: metadata || {},
          created_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Failed to log security event:', error)
    }
  }

  /**
   * Notify administrators of security events
   */
  private async notifyAdministrators(userId: string, activityType: string, metadata: any): Promise<void> {
    try {
      // Get admin users
      const { data: admins } = await this.supabase
        .from('users')
        .select('id')
        .eq('role', 'admin')

      // Send notifications to all admins
      for (const admin of admins || []) {
        await this.supabase
          .from('notifications')
          .insert({
            user_id: admin.id,
            type: 'security_alert',
            title: 'Security Alert',
            message: `Suspicious activity detected for user ${userId}: ${activityType}`,
            data: { userId, activityType, metadata },
            priority: 'urgent',
            created_at: new Date().toISOString()
          })
      }
    } catch (error) {
      console.error('Failed to notify administrators:', error)
    }
  }

  /**
   * Check if user account is locked
   */
  async isAccountLocked(userId: string): Promise<boolean> {
    try {
      const { data: status } = await this.supabase
        .from('user_security_status')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (!status || !status.is_locked) {
        return false
      }

      // Check if lock has expired
      if (status.lock_expires_at && new Date() > new Date(status.lock_expires_at)) {
        // Unlock the account
        await this.supabase
          .from('user_security_status')
          .update({
            is_locked: false,
            lock_reason: null,
            locked_at: null,
            lock_expires_at: null
          })
          .eq('user_id', userId)
        
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to check account lock status:', error)
      return false
    }
  }

  /**
   * Clean up expired sessions and tokens
   */
  async cleanupExpiredData(): Promise<void> {
    try {
      const now = new Date().toISOString()

      // Clean up expired sessions
      await this.supabase
        .from('user_sessions')
        .delete()
        .lt('expires_at', now)

      // Clean up expired CSRF tokens
      await this.supabase
        .from('csrf_tokens')
        .delete()
        .lt('expires_at', now)

      // Clean up old security logs (keep for 90 days)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      await this.supabase
        .from('security_logs')
        .delete()
        .lt('created_at', ninetyDaysAgo)
    } catch (error) {
      console.error('Failed to cleanup expired data:', error)
    }
  }
}

let securityServiceInstance: SecurityService | null = null

export function getSecurityService(): SecurityService {
  if (!securityServiceInstance) {
    securityServiceInstance = new SecurityService()
  }
  return securityServiceInstance
}

// For backward compatibility, but this will be lazy-loaded
export const securityService = {
  get instance() {
    return getSecurityService()
  },
  encryptAPIKey: (...args: Parameters<SecurityService['encryptAPIKey']>) => getSecurityService().encryptAPIKey(...args),
  decryptAPIKey: (...args: Parameters<SecurityService['decryptAPIKey']>) => getSecurityService().decryptAPIKey(...args),
  validateSession: (...args: Parameters<SecurityService['validateSession']>) => getSecurityService().validateSession(...args),
  generateSessionFingerprint: (...args: Parameters<SecurityService['generateSessionFingerprint']>) => getSecurityService().generateSessionFingerprint(...args),
  detectSuspiciousActivity: (...args: Parameters<SecurityService['detectSuspiciousActivity']>) => getSecurityService().detectSuspiciousActivity(...args),
  generateCSRFToken: (...args: Parameters<SecurityService['generateCSRFToken']>) => getSecurityService().generateCSRFToken(...args),
  validateCSRFToken: (...args: Parameters<SecurityService['validateCSRFToken']>) => getSecurityService().validateCSRFToken(...args),
  storeCSRFToken: (...args: Parameters<SecurityService['storeCSRFToken']>) => getSecurityService().storeCSRFToken(...args),
  isAccountLocked: (...args: Parameters<SecurityService['isAccountLocked']>) => getSecurityService().isAccountLocked(...args),
  logSecurityEvent: (...args: Parameters<SecurityService['logSecurityEvent']>) => getSecurityService().logSecurityEvent(...args)
}