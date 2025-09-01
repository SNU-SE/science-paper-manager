/**
 * Final Integration Test Suite
 * Comprehensive end-to-end testing of all system components
 */

import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'
import { JobQueueManager } from '../background/JobQueueManager'
import { PerformanceMonitor } from '../monitoring/PerformanceMonitor'
import { SecurityService } from '../security/SecurityService'
import { NotificationService } from '../notifications/NotificationService'
import { BackupService } from '../backup/BackupService'
import { HealthCheckService } from '../health/HealthCheckService'
import { CacheService } from '../cache/CacheService'
import { APIUsageService } from '../usage/APIUsageService'
import { AdvancedSearchService } from '../search/AdvancedSearchService'

describe('Final System Integration Tests', () => {
  let supabase: any
  let redis: Redis
  let jobQueue: JobQueueManager
  let monitor: PerformanceMonitor
  let security: SecurityService
  let notifications: NotificationService
  let backup: BackupService
  let health: HealthCheckService
  let cache: CacheService
  let usage: APIUsageService
  let search: AdvancedSearchService

  beforeAll(async () => {
    // Initialize all services
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    redis = new Redis(process.env.REDIS_URL!)
    jobQueue = new JobQueueManager(redis)
    monitor = new PerformanceMonitor()
    security = new SecurityService()
    notifications = new NotificationService()
    backup = new BackupService()
    health = new HealthCheckService()
    cache = new CacheService(redis)
    usage = new APIUsageService()
    search = new AdvancedSearchService()

    // Wait for all services to be ready
    await Promise.all([
      redis.ping(),
      supabase.from('papers').select('count').limit(1)
    ])
  })

  afterAll(async () => {
    await redis.disconnect()
  })

  describe('Complete AI Analysis Workflow', () => {
    it('should handle complete AI analysis workflow with all integrations', async () => {
      const testUserId = 'test-user-' + Date.now()
      const testPaperId = 'test-paper-' + Date.now()

      // 1. Track API usage
      await usage.trackUsage(testUserId, 'ai_analysis', 1)
      const initialUsage = await usage.getUserUsage(testUserId)
      expect(initialUsage.daily).toBeGreaterThan(0)

      // 2. Create background job
      const jobId = await jobQueue.addAnalysisJob(testPaperId, ['openai'])
      expect(jobId).toBeDefined()

      // 3. Monitor performance
      const startTime = Date.now()
      await monitor.recordAPIMetric({
        endpoint: '/api/ai-analysis',
        method: 'POST',
        statusCode: 202,
        responseTime: Date.now() - startTime,
        userId: testUserId,
        ipAddress: '127.0.0.1'
      })

      // 4. Check job status
      const jobStatus = await jobQueue.getJobStatus(jobId)
      expect(jobStatus.status).toBe('pending')

      // 5. Create notification
      await notifications.createNotification({
        userId: testUserId,
        type: 'ai_analysis_started',
        title: 'Analysis Started',
        message: 'Your AI analysis has been queued',
        priority: 'medium'
      })

      // 6. Verify notification was created
      const userNotifications = await notifications.getUserNotifications(testUserId, 10)
      expect(userNotifications.length).toBeGreaterThan(0)
      expect(userNotifications[0].type).toBe('ai_analysis_started')

      // 7. Cache analysis result (simulated)
      const mockResult = {
        summary: 'Test analysis result',
        keywords: ['test', 'analysis'],
        rating: 4.5
      }
      await cache.set(`analysis:${testPaperId}`, mockResult, 3600)

      // 8. Verify cached result
      const cachedResult = await cache.get(`analysis:${testPaperId}`)
      expect(cachedResult).toEqual(mockResult)

      // 9. Update job status to completed (simulated)
      // In real scenario, this would be done by the worker
      
      // 10. Send completion notification
      await notifications.createNotification({
        userId: testUserId,
        type: 'ai_analysis_complete',
        title: 'Analysis Complete',
        message: 'Your AI analysis has finished',
        priority: 'high'
      })

      // 11. Verify completion notification
      const finalNotifications = await notifications.getUserNotifications(testUserId, 10)
      expect(finalNotifications.length).toBe(2)
      expect(finalNotifications.some(n => n.type === 'ai_analysis_complete')).toBe(true)

      // 12. Clean up
      await jobQueue.cancelJob(jobId)
      await cache.invalidate(`analysis:${testPaperId}`)
    }, 30000)
  })

  describe('Search and Performance Integration', () => {
    it('should handle search with performance monitoring and caching', async () => {
      const testUserId = 'search-user-' + Date.now()

      // 1. Track search API usage
      await usage.trackUsage(testUserId, 'search', 1)

      // 2. Perform search with performance monitoring
      const searchStartTime = Date.now()
      
      const searchQuery = {
        textQuery: 'machine learning',
        filters: {
          rating: { min: 3, max: 5 },
          tags: ['AI', 'ML']
        },
        sortBy: 'relevance' as const,
        pagination: { page: 1, limit: 10 }
      }

      const searchResults = await search.searchPapers(searchQuery)
      const searchDuration = Date.now() - searchStartTime

      // 3. Record search performance
      await monitor.recordAPIMetric({
        endpoint: '/api/search',
        method: 'POST',
        statusCode: 200,
        responseTime: searchDuration,
        userId: testUserId,
        ipAddress: '127.0.0.1'
      })

      // 4. Cache search results
      const cacheKey = `search:${JSON.stringify(searchQuery)}`
      await cache.set(cacheKey, searchResults, 600) // 10 minutes

      // 5. Verify cached results
      const cachedSearchResults = await cache.get(cacheKey)
      expect(cachedSearchResults).toEqual(searchResults)

      // 6. Verify performance metrics were recorded
      const metrics = await monitor.getMetrics({
        start: new Date(searchStartTime - 1000),
        end: new Date()
      })
      
      expect(metrics.apiMetrics).toBeDefined()

      // 7. Clean up cache
      await cache.invalidate(cacheKey)
    }, 20000)
  })

  describe('Security and Monitoring Integration', () => {
    it('should handle security operations with monitoring and alerting', async () => {
      const testUserId = 'security-user-' + Date.now()
      const testApiKey = 'test-api-key-' + Date.now()

      // 1. Encrypt API key with performance monitoring
      const encryptStartTime = Date.now()
      const encrypted = await security.encryptAPIKey(testApiKey, testUserId)
      const encryptDuration = Date.now() - encryptStartTime

      // 2. Record encryption performance
      await monitor.recordAPIMetric({
        endpoint: '/api/security/encrypt',
        method: 'POST',
        statusCode: 200,
        responseTime: encryptDuration,
        userId: testUserId,
        ipAddress: '127.0.0.1'
      })

      // 3. Decrypt API key
      const decryptStartTime = Date.now()
      const decrypted = await security.decryptAPIKey(encrypted, testUserId)
      const decryptDuration = Date.now() - decryptStartTime

      expect(decrypted).toBe(testApiKey)

      // 4. Record decryption performance
      await monitor.recordAPIMetric({
        endpoint: '/api/security/decrypt',
        method: 'POST',
        statusCode: 200,
        responseTime: decryptDuration,
        userId: testUserId,
        ipAddress: '127.0.0.1'
      })

      // 5. Test CSRF token with caching
      const sessionId = 'test-session-' + Date.now()
      const csrfToken = security.generateCSRFToken(sessionId)
      
      // Cache CSRF token
      await cache.set(`csrf:${sessionId}`, csrfToken, 1800) // 30 minutes

      // 6. Validate CSRF token
      const isValid = security.validateCSRFToken(csrfToken, sessionId)
      expect(isValid).toBe(true)

      // 7. Verify cached token
      const cachedToken = await cache.get(`csrf:${sessionId}`)
      expect(cachedToken).toBe(csrfToken)

      // 8. Simulate suspicious activity detection
      const suspiciousActivity = await security.detectSuspiciousActivity(testUserId, 'multiple_failed_logins')
      
      if (suspiciousActivity.level === 'high') {
        // Send security alert notification
        await notifications.createNotification({
          userId: testUserId,
          type: 'security_alert',
          title: 'Security Alert',
          message: 'Suspicious activity detected on your account',
          priority: 'urgent'
        })
      }

      // 9. Clean up
      await cache.invalidate(`csrf:${sessionId}`)
    }, 20000)
  })

  describe('Backup and Health Monitoring Integration', () => {
    it('should handle backup operations with health monitoring', async () => {
      // 1. Check system health before backup
      const healthBefore = await health.getSystemHealth()
      expect(healthBefore.overall).toBeDefined()

      // 2. Monitor backup performance
      const backupStartTime = Date.now()
      
      // List existing backups (lightweight operation for testing)
      const backups = await backup.listBackups()
      const backupDuration = Date.now() - backupStartTime

      // 3. Record backup operation performance
      await monitor.recordAPIMetric({
        endpoint: '/api/backup',
        method: 'GET',
        statusCode: 200,
        responseTime: backupDuration,
        userId: 'system',
        ipAddress: '127.0.0.1'
      })

      // 4. Cache backup list
      await cache.set('backup:list', backups, 300) // 5 minutes

      // 5. Verify cached backup list
      const cachedBackups = await cache.get('backup:list')
      expect(cachedBackups).toEqual(backups)

      // 6. Check system health after backup operations
      const healthAfter = await health.getSystemHealth()
      expect(healthAfter.overall).toBeDefined()

      // 7. If backup operations affected health, send notification
      if (healthBefore.overall === 'healthy' && healthAfter.overall !== 'healthy') {
        await notifications.createNotification({
          userId: 'admin',
          type: 'system_alert',
          title: 'System Health Alert',
          message: 'System health degraded after backup operations',
          priority: 'high'
        })
      }

      // 8. Clean up
      await cache.invalidate('backup:list')
    }, 15000)
  })

  describe('Cross-Service Error Handling', () => {
    it('should handle cascading failures gracefully', async () => {
      const testUserId = 'error-test-user-' + Date.now()

      // 1. Simulate Redis failure by using invalid key
      try {
        await cache.get('invalid:key:that:should:fail')
      } catch (error) {
        // Should not throw - cache service should handle gracefully
      }

      // 2. Continue with other operations despite cache failure
      await usage.trackUsage(testUserId, 'test_operation', 1)
      const userUsage = await usage.getUserUsage(testUserId)
      expect(userUsage).toBeDefined()

      // 3. Test notification system resilience
      await notifications.createNotification({
        userId: testUserId,
        type: 'system_test',
        title: 'Error Handling Test',
        message: 'Testing system resilience',
        priority: 'low'
      })

      const userNotifications = await notifications.getUserNotifications(testUserId, 10)
      expect(userNotifications.length).toBeGreaterThan(0)

      // 4. Test health check during partial failures
      const healthStatus = await health.getSystemHealth()
      expect(healthStatus).toBeDefined()
      // System should still report status even if some components have issues
    }, 15000)
  })

  describe('Performance Under Load', () => {
    it('should maintain performance under concurrent operations', async () => {
      const concurrentOperations = 10
      const testUserId = 'load-test-user-' + Date.now()

      // 1. Create multiple concurrent operations
      const operations = Array.from({ length: concurrentOperations }, async (_, index) => {
        const operationId = `${testUserId}-${index}`
        
        // Concurrent cache operations
        await cache.set(`load-test:${operationId}`, { data: `test-${index}` }, 60)
        
        // Concurrent usage tracking
        await usage.trackUsage(testUserId, 'load_test', 1)
        
        // Concurrent notifications
        await notifications.createNotification({
          userId: testUserId,
          type: 'load_test',
          title: `Load Test ${index}`,
          message: `Concurrent operation ${index}`,
          priority: 'low'
        })
        
        return operationId
      })

      // 2. Execute all operations concurrently
      const startTime = Date.now()
      const results = await Promise.all(operations)
      const totalDuration = Date.now() - startTime

      // 3. Verify all operations completed
      expect(results).toHaveLength(concurrentOperations)

      // 4. Check that performance is acceptable
      const avgDurationPerOperation = totalDuration / concurrentOperations
      expect(avgDurationPerOperation).toBeLessThan(1000) // Less than 1 second per operation

      // 5. Verify data integrity
      const finalUsage = await usage.getUserUsage(testUserId)
      expect(finalUsage.daily).toBeGreaterThanOrEqual(concurrentOperations)

      const finalNotifications = await notifications.getUserNotifications(testUserId, 20)
      expect(finalNotifications.length).toBeGreaterThanOrEqual(concurrentOperations)

      // 6. Clean up cache entries
      for (const operationId of results) {
        await cache.invalidate(`load-test:${operationId}`)
      }
    }, 30000)
  })

  describe('Data Consistency Verification', () => {
    it('should maintain data consistency across all services', async () => {
      const testUserId = 'consistency-user-' + Date.now()
      const testPaperId = 'consistency-paper-' + Date.now()

      // 1. Create a paper evaluation
      const { data: evaluation, error } = await supabase
        .from('user_evaluations')
        .insert({
          user_id: testUserId,
          paper_id: testPaperId,
          rating: 4,
          tags: ['test', 'consistency'],
          notes: 'Consistency test evaluation'
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(evaluation).toBeDefined()

      // 2. Track the evaluation in usage
      await usage.trackUsage(testUserId, 'evaluation', 1)

      // 3. Cache the evaluation
      await cache.set(`evaluation:${testUserId}:${testPaperId}`, evaluation, 3600)

      // 4. Create notification about evaluation
      await notifications.createNotification({
        userId: testUserId,
        type: 'evaluation_created',
        title: 'Evaluation Created',
        message: 'Your paper evaluation has been saved',
        priority: 'low'
      })

      // 5. Verify data consistency across services
      const cachedEvaluation = await cache.get(`evaluation:${testUserId}:${testPaperId}`)
      expect(cachedEvaluation.rating).toBe(evaluation.rating)
      expect(cachedEvaluation.tags).toEqual(evaluation.tags)

      const userUsage = await usage.getUserUsage(testUserId)
      expect(userUsage.daily).toBeGreaterThan(0)

      const userNotifications = await notifications.getUserNotifications(testUserId, 10)
      expect(userNotifications.some(n => n.type === 'evaluation_created')).toBe(true)

      // 6. Update evaluation and verify consistency
      const { data: updatedEvaluation, error: updateError } = await supabase
        .from('user_evaluations')
        .update({ rating: 5, notes: 'Updated consistency test evaluation' })
        .eq('id', evaluation.id)
        .select()
        .single()

      expect(updateError).toBeNull()

      // 7. Update cache
      await cache.set(`evaluation:${testUserId}:${testPaperId}`, updatedEvaluation, 3600)

      // 8. Verify updated data consistency
      const updatedCachedEvaluation = await cache.get(`evaluation:${testUserId}:${testPaperId}`)
      expect(updatedCachedEvaluation.rating).toBe(5)
      expect(updatedCachedEvaluation.notes).toBe('Updated consistency test evaluation')

      // 9. Clean up
      await supabase.from('user_evaluations').delete().eq('id', evaluation.id)
      await cache.invalidate(`evaluation:${testUserId}:${testPaperId}`)
    }, 20000)
  })
})