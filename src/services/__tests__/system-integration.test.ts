/**
 * System Integration Tests
 * 
 * Comprehensive integration tests for the entire system enhancement features
 * including background processing, monitoring, security, notifications, and backup systems.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'
import { JobQueueManager } from '../background/JobQueueManager'
import { AIAnalysisWorker } from '../background/AIAnalysisWorker'
import { NotificationService } from '../notifications/NotificationService'
import { PerformanceMonitor } from '../monitoring/PerformanceMonitor'
import { SecurityService } from '../security/SecurityService'
import { BackupService } from '../backup/BackupService'
import { HealthCheckService } from '../health/HealthCheckService'
import { APIUsageService } from '../usage/APIUsageService'
import { CacheService } from '../cache/CacheService'

// Test configuration
const TEST_CONFIG = {
  supabase: {
    url: process.env.TEST_SUPABASE_URL || 'http://localhost:54321',
    key: process.env.TEST_SUPABASE_ANON_KEY || 'test-key'
  },
  redis: {
    url: process.env.TEST_REDIS_URL || 'redis://localhost:6379/1'
  }
}

describe('System Integration Tests', () => {
  let supabase: any
  let redis: Redis
  let jobQueue: JobQueueManager
  let worker: AIAnalysisWorker
  let notificationService: NotificationService
  let performanceMonitor: PerformanceMonitor
  let securityService: SecurityService
  let backupService: BackupService
  let healthService: HealthCheckService
  let usageService: APIUsageService
  let cacheService: CacheService
  let testUserId: string

  beforeAll(async () => {
    // Initialize test services
    supabase = createClient(TEST_CONFIG.supabase.url, TEST_CONFIG.supabase.key)
    redis = new Redis(TEST_CONFIG.redis.url)
    
    jobQueue = new JobQueueManager(redis)
    worker = new AIAnalysisWorker(supabase, redis)
    notificationService = new NotificationService(supabase, redis)
    performanceMonitor = new PerformanceMonitor(supabase, redis)
    securityService = new SecurityService(supabase, redis)
    backupService = new BackupService(supabase)
    healthService = new HealthCheckService(supabase, redis)
    usageService = new APIUsageService(supabase, redis)
    cacheService = new CacheService(redis)

    // Create test user
    const { data: user } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: 'testpassword123'
    })
    testUserId = user?.user?.id || 'test-user-id'
  })

  afterAll(async () => {
    // Cleanup
    await redis.flushdb()
    await redis.quit()
    
    // Clean up test user and data
    if (testUserId) {
      await supabase.from('papers').delete().eq('user_id', testUserId)
      await supabase.from('background_jobs').delete().eq('user_id', testUserId)
      await supabase.from('notifications').delete().eq('user_id', testUserId)
    }
  })

  beforeEach(async () => {
    // Clear Redis cache before each test
    await redis.flushdb()
  })

  describe('Complete AI Analysis Workflow', () => {
    test('should process complete AI analysis workflow end-to-end', async () => {
      // 1. Create a test paper
      const { data: paper } = await supabase
        .from('papers')
        .insert({
          title: 'Test Paper for Integration',
          abstract: 'This is a test paper for integration testing',
          content: 'Full content of the test paper...',
          user_id: testUserId,
          file_path: '/test/paper.pdf'
        })
        .select()
        .single()

      expect(paper).toBeDefined()
      expect(paper.id).toBeDefined()

      // 2. Submit AI analysis job
      const jobId = await jobQueue.addAnalysisJob(paper.id, ['openai', 'anthropic'], {
        userId: testUserId,
        priority: 1
      })

      expect(jobId).toBeDefined()

      // 3. Verify job is queued
      const initialStatus = await jobQueue.getJobStatus(jobId)
      expect(initialStatus.status).toBe('pending')

      // 4. Process the job (simulate worker processing)
      const job = await jobQueue.getJob(jobId)
      expect(job).toBeDefined()

      // Mock AI analysis results
      const mockAnalysisResults = {
        openai: {
          summary: 'AI-generated summary from OpenAI',
          keyPoints: ['Point 1', 'Point 2', 'Point 3'],
          rating: 4.2,
          tags: ['machine-learning', 'ai']
        },
        anthropic: {
          summary: 'AI-generated summary from Anthropic',
          keyPoints: ['Point A', 'Point B', 'Point C'],
          rating: 4.5,
          tags: ['artificial-intelligence', 'research']
        }
      }

      // Simulate job processing
      await worker.processAnalysisJob({
        id: jobId,
        paperId: paper.id,
        providers: ['openai', 'anthropic'],
        userId: testUserId,
        mockResults: mockAnalysisResults // For testing
      })

      // 5. Verify job completion
      const completedStatus = await jobQueue.getJobStatus(jobId)
      expect(completedStatus.status).toBe('completed')
      expect(completedStatus.result).toBeDefined()

      // 6. Verify analysis results are stored
      const { data: analysisResults } = await supabase
        .from('ai_analysis_results')
        .select('*')
        .eq('paper_id', paper.id)

      expect(analysisResults).toHaveLength(2)
      expect(analysisResults.some(r => r.provider === 'openai')).toBe(true)
      expect(analysisResults.some(r => r.provider === 'anthropic')).toBe(true)

      // 7. Verify notification was sent
      const { data: notifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', testUserId)
        .eq('type', 'ai_analysis_complete')

      expect(notifications).toHaveLength(1)
      expect(notifications[0].title).toContain('AI Analysis Complete')

      // 8. Verify performance metrics were recorded
      const metrics = await performanceMonitor.getJobMetrics(jobId)
      expect(metrics).toBeDefined()
      expect(metrics.duration).toBeGreaterThan(0)

      // 9. Verify API usage was tracked
      const usage = await usageService.getUserUsage(testUserId, new Date())
      expect(usage.aiAnalysisCount).toBeGreaterThan(0)
    }, 30000) // 30 second timeout for integration test

    test('should handle job failures with proper retry logic', async () => {
      // Create a job that will fail
      const jobId = await jobQueue.addAnalysisJob('non-existent-paper', ['openai'], {
        userId: testUserId,
        priority: 1
      })

      // Process the job (should fail)
      const job = await jobQueue.getJob(jobId)
      
      try {
        await worker.processAnalysisJob({
          id: jobId,
          paperId: 'non-existent-paper',
          providers: ['openai'],
          userId: testUserId,
          shouldFail: true // Test flag
        })
      } catch (error) {
        // Expected to fail
      }

      // Verify retry logic
      const status = await jobQueue.getJobStatus(jobId)
      expect(status.attempts).toBeGreaterThan(0)
      expect(status.status).toBe('failed')

      // Verify error notification was sent
      const { data: notifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', testUserId)
        .eq('type', 'ai_analysis_failed')

      expect(notifications.length).toBeGreaterThan(0)
    })
  })

  describe('Performance Monitoring Integration', () => {
    test('should track and aggregate performance metrics', async () => {
      // Simulate API requests
      const requests = [
        { endpoint: '/api/papers', method: 'GET', responseTime: 150, statusCode: 200 },
        { endpoint: '/api/papers', method: 'POST', responseTime: 300, statusCode: 201 },
        { endpoint: '/api/ai-analysis', method: 'POST', responseTime: 2000, statusCode: 200 },
        { endpoint: '/api/search', method: 'GET', responseTime: 100, statusCode: 200 }
      ]

      for (const req of requests) {
        await performanceMonitor.trackAPIRequest({
          endpoint: req.endpoint,
          method: req.method,
          responseTime: req.responseTime,
          statusCode: req.statusCode,
          userId: testUserId,
          timestamp: new Date()
        })
      }

      // Get aggregated metrics
      const metrics = await performanceMonitor.getMetrics({
        start: new Date(Date.now() - 60000), // Last minute
        end: new Date()
      })

      expect(metrics.apiMetrics.totalRequests).toBe(4)
      expect(metrics.apiMetrics.averageResponseTime).toBeGreaterThan(0)
      expect(metrics.apiMetrics.slowestEndpoints).toBeDefined()
      expect(metrics.apiMetrics.slowestEndpoints[0].endpoint).toBe('/api/ai-analysis')
    })

    test('should detect performance anomalies and send alerts', async () => {
      // Simulate slow requests that should trigger alerts
      for (let i = 0; i < 10; i++) {
        await performanceMonitor.trackAPIRequest({
          endpoint: '/api/papers',
          method: 'GET',
          responseTime: 5000, // Very slow
          statusCode: 200,
          userId: testUserId,
          timestamp: new Date()
        })
      }

      // Check if alert was generated
      const alerts = await performanceMonitor.getActiveAlerts()
      expect(alerts.some(alert => alert.type === 'slow_response_time')).toBe(true)
    })
  })

  describe('Security System Integration', () => {
    test('should encrypt and decrypt API keys securely', async () => {
      const originalKey = 'sk-test-api-key-12345'
      
      // Encrypt API key
      const encrypted = await securityService.encryptAPIKey(originalKey, testUserId)
      expect(encrypted.encryptedValue).toBeDefined()
      expect(encrypted.iv).toBeDefined()
      expect(encrypted.salt).toBeDefined()

      // Decrypt API key
      const decrypted = await securityService.decryptAPIKey(encrypted, testUserId)
      expect(decrypted).toBe(originalKey)
    })

    test('should detect suspicious activity patterns', async () => {
      // Simulate suspicious activity (many rapid requests)
      const suspiciousActions = Array(20).fill(null).map((_, i) => ({
        userId: testUserId,
        action: 'api_request',
        endpoint: '/api/papers',
        timestamp: new Date(Date.now() - i * 1000), // 1 second apart
        ipAddress: '192.168.1.100'
      }))

      for (const action of suspiciousActions) {
        await securityService.logSecurityEvent(action)
      }

      // Check if suspicious activity was detected
      const threatLevel = await securityService.detectSuspiciousActivity(testUserId, 'api_request')
      expect(threatLevel.level).toBeGreaterThan(0)
      expect(threatLevel.reasons).toContain('high_frequency_requests')
    })
  })

  describe('Notification System Integration', () => {
    test('should send and track notifications across different channels', async () => {
      const notification = {
        userId: testUserId,
        type: 'system_update',
        title: 'System Maintenance Scheduled',
        message: 'System will be down for maintenance at 2 AM UTC',
        priority: 'high' as const,
        data: { maintenanceTime: '2024-01-01T02:00:00Z' }
      }

      // Send notification
      const notificationId = await notificationService.sendNotification(notification)
      expect(notificationId).toBeDefined()

      // Verify notification was stored
      const { data: storedNotification } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .single()

      expect(storedNotification).toBeDefined()
      expect(storedNotification.title).toBe(notification.title)
      expect(storedNotification.read_at).toBeNull()

      // Mark as read
      await notificationService.markAsRead(notificationId)

      // Verify read status
      const { data: readNotification } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .single()

      expect(readNotification.read_at).not.toBeNull()
    })
  })

  describe('Backup System Integration', () => {
    test('should create and validate backup', async () => {
      // Create test data
      await supabase.from('papers').insert({
        title: 'Backup Test Paper',
        abstract: 'Test paper for backup validation',
        user_id: testUserId
      })

      // Create backup
      const backupResult = await backupService.createBackup('incremental')
      expect(backupResult.status).toBe('success')
      expect(backupResult.id).toBeDefined()
      expect(backupResult.checksum).toBeDefined()

      // Validate backup
      const validation = await backupService.validateBackup(backupResult.id)
      expect(validation.isValid).toBe(true)
      expect(validation.checksumMatch).toBe(true)
    })
  })

  describe('Health Monitoring Integration', () => {
    test('should monitor system health and detect issues', async () => {
      // Get initial system status
      const initialStatus = await healthService.getSystemStatus()
      expect(initialStatus.overall).toBe('healthy')
      expect(initialStatus.services.database.status).toBe('healthy')
      expect(initialStatus.services.redis.status).toBe('healthy')

      // Simulate a service issue (disconnect Redis temporarily)
      await redis.disconnect()

      // Check health status
      const degradedStatus = await healthService.getSystemStatus()
      expect(degradedStatus.services.redis.status).toBe('unhealthy')
      expect(degradedStatus.overall).toBe('degraded')

      // Reconnect Redis
      redis.connect()

      // Wait for health to recover
      await new Promise(resolve => setTimeout(resolve, 2000))

      const recoveredStatus = await healthService.getSystemStatus()
      expect(recoveredStatus.services.redis.status).toBe('healthy')
    })
  })

  describe('Cache System Integration', () => {
    test('should cache and invalidate data correctly', async () => {
      const cacheKey = 'test:user:papers'
      const testData = { papers: ['paper1', 'paper2', 'paper3'] }

      // Set cache
      await cacheService.set(cacheKey, testData, 300) // 5 minutes TTL

      // Get from cache
      const cachedData = await cacheService.get(cacheKey)
      expect(cachedData).toEqual(testData)

      // Invalidate cache pattern
      await cacheService.invalidatePattern('test:user:*')

      // Verify cache was invalidated
      const invalidatedData = await cacheService.get(cacheKey)
      expect(invalidatedData).toBeNull()
    })
  })

  describe('API Usage Tracking Integration', () => {
    test('should track usage and enforce limits', async () => {
      // Set usage limit
      await usageService.setUserLimit(testUserId, 'ai_analysis', 5)

      // Track usage up to limit
      for (let i = 0; i < 5; i++) {
        await usageService.trackUsage(testUserId, 'ai_analysis', {
          endpoint: '/api/ai-analysis',
          cost: 1
        })
      }

      // Check if limit is reached
      const canUse = await usageService.canUserPerformAction(testUserId, 'ai_analysis')
      expect(canUse).toBe(false)

      // Verify usage statistics
      const usage = await usageService.getUserUsage(testUserId, new Date())
      expect(usage.aiAnalysisCount).toBe(5)
      expect(usage.limitReached).toBe(true)
    })
  })
})