#!/usr/bin/env tsx

/**
 * System Integration Verification Script
 * Verifies all system components are properly integrated and functioning
 */

import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'
// Import types only to avoid module loading issues
type JobQueueManager = import('../src/services/background/JobQueueManager').JobQueueManager
type PerformanceMonitor = import('../src/services/monitoring/PerformanceMonitor').PerformanceMonitor
type SecurityService = import('../src/services/security/SecurityService').SecurityService
type NotificationService = import('../src/services/notifications/NotificationService').NotificationService
type BackupService = import('../src/services/backup/BackupService').BackupService
type HealthCheckService = import('../src/services/health/HealthCheckService').HealthCheckService
type CacheService = import('../src/services/cache/CacheService').CacheService
type APIUsageService = import('../src/services/usage/APIUsageService').APIUsageService

interface IntegrationTestResult {
  component: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: any
  duration: number
}

class SystemIntegrationVerifier {
  private results: IntegrationTestResult[] = []
  private supabase: any
  private redis: Redis
  
  constructor() {
    // Check for required environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('⚠️ Supabase environment variables not configured - some tests will be skipped')
      this.supabase = null
    } else {
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
    }
    
    if (!process.env.REDIS_URL) {
      console.warn('⚠️ Redis URL not configured - some tests will be skipped')
      this.redis = null as any
    } else {
      this.redis = new Redis(process.env.REDIS_URL!)
    }
  }

  async runAllTests(): Promise<IntegrationTestResult[]> {
    console.log('🔍 Starting System Integration Verification...\n')
    
    // Core Infrastructure Tests
    await this.testDatabaseConnection()
    await this.testRedisConnection()
    
    // Service Integration Tests
    await this.testJobQueueIntegration()
    await this.testPerformanceMonitoringIntegration()
    await this.testSecurityServiceIntegration()
    await this.testNotificationSystemIntegration()
    await this.testBackupSystemIntegration()
    await this.testHealthCheckIntegration()
    await this.testCacheSystemIntegration()
    await this.testAPIUsageIntegration()
    
    // Cross-Service Integration Tests
    await this.testEndToEndWorkflow()
    await this.testServiceInteractions()
    
    return this.results
  }

  private async testDatabaseConnection(): Promise<void> {
    const startTime = Date.now()
    
    if (!this.supabase) {
      this.addResult({
        component: 'Database Connection',
        status: 'warning',
        message: 'Database connection skipped - environment variables not configured',
        duration: Date.now() - startTime
      })
      return
    }
    
    try {
      const { data, error } = await this.supabase
        .from('papers')
        .select('count')
        .limit(1)
      
      if (error) throw error
      
      this.addResult({
        component: 'Database Connection',
        status: 'pass',
        message: 'Database connection successful',
        duration: Date.now() - startTime
      })
    } catch (error) {
      this.addResult({
        component: 'Database Connection',
        status: 'fail',
        message: `Database connection failed: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }

  private async testRedisConnection(): Promise<void> {
    const startTime = Date.now()
    
    if (!this.redis) {
      this.addResult({
        component: 'Redis Connection',
        status: 'warning',
        message: 'Redis connection skipped - environment variables not configured',
        duration: Date.now() - startTime
      })
      return
    }
    
    try {
      await this.redis.ping()
      await this.redis.set('integration-test', 'success', 'EX', 10)
      const result = await this.redis.get('integration-test')
      
      if (result !== 'success') throw new Error('Redis read/write test failed')
      
      this.addResult({
        component: 'Redis Connection',
        status: 'pass',
        message: 'Redis connection and operations successful',
        duration: Date.now() - startTime
      })
    } catch (error) {
      this.addResult({
        component: 'Redis Connection',
        status: 'fail',
        message: `Redis connection failed: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }

  private async testJobQueueIntegration(): Promise<void> {
    const startTime = Date.now()
    
    if (!this.redis) {
      this.addResult({
        component: 'Job Queue System',
        status: 'warning',
        message: 'Job queue test skipped - Redis not configured',
        duration: Date.now() - startTime
      })
      return
    }
    
    try {
      const { JobQueueManager } = await import('../src/services/background/JobQueueManager')
      const jobQueue = new JobQueueManager(this.redis)
      
      // Test job creation
      const jobId = await jobQueue.addAnalysisJob('test-paper-id', ['openai'])
      
      // Test job status retrieval
      const status = await jobQueue.getJobStatus(jobId)
      
      if (!status || !jobId) throw new Error('Job queue operations failed')
      
      // Cleanup test job
      await jobQueue.cancelJob(jobId)
      
      this.addResult({
        component: 'Job Queue System',
        status: 'pass',
        message: 'Job queue operations successful',
        details: { jobId, status: status.status },
        duration: Date.now() - startTime
      })
    } catch (error) {
      this.addResult({
        component: 'Job Queue System',
        status: 'fail',
        message: `Job queue integration failed: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }

  private async testPerformanceMonitoringIntegration(): Promise<void> {
    const startTime = Date.now()
    
    if (!this.supabase) {
      this.addResult({
        component: 'Performance Monitoring',
        status: 'warning',
        message: 'Performance monitoring test skipped - database not configured',
        duration: Date.now() - startTime
      })
      return
    }
    
    try {
      const { PerformanceMonitor } = await import('../src/services/monitoring/PerformanceMonitor')
      const monitor = new PerformanceMonitor()
      
      // Test metric recording
      await monitor.recordAPIMetric({
        endpoint: '/test',
        method: 'GET',
        statusCode: 200,
        responseTime: 100,
        userId: 'test-user',
        ipAddress: '127.0.0.1'
      })
      
      // Test metric retrieval
      const metrics = await monitor.getMetrics({
        start: new Date(Date.now() - 60000),
        end: new Date()
      })
      
      this.addResult({
        component: 'Performance Monitoring',
        status: 'pass',
        message: 'Performance monitoring integration successful',
        details: { metricsCount: metrics.apiMetrics?.length || 0 },
        duration: Date.now() - startTime
      })
    } catch (error) {
      this.addResult({
        component: 'Performance Monitoring',
        status: 'fail',
        message: `Performance monitoring failed: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }

  private async testSecurityServiceIntegration(): Promise<void> {
    const startTime = Date.now()
    try {
      const security = new SecurityService()
      
      // Test encryption/decryption
      const testData = 'test-api-key'
      const encrypted = await security.encryptAPIKey(testData, 'test-user')
      const decrypted = await security.decryptAPIKey(encrypted, 'test-user')
      
      if (decrypted !== testData) throw new Error('Encryption/decryption test failed')
      
      // Test CSRF token generation
      const csrfToken = security.generateCSRFToken('test-session')
      const isValid = security.validateCSRFToken(csrfToken, 'test-session')
      
      if (!isValid) throw new Error('CSRF token validation failed')
      
      this.addResult({
        component: 'Security Service',
        status: 'pass',
        message: 'Security service integration successful',
        duration: Date.now() - startTime
      })
    } catch (error) {
      this.addResult({
        component: 'Security Service',
        status: 'fail',
        message: `Security service failed: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }

  private async testNotificationSystemIntegration(): Promise<void> {
    const startTime = Date.now()
    try {
      const notifications = new NotificationService()
      
      // Test notification creation
      await notifications.createNotification({
        userId: 'test-user',
        type: 'system_test',
        title: 'Integration Test',
        message: 'Testing notification system',
        priority: 'low'
      })
      
      // Test notification retrieval
      const userNotifications = await notifications.getUserNotifications('test-user', 10)
      
      this.addResult({
        component: 'Notification System',
        status: 'pass',
        message: 'Notification system integration successful',
        details: { notificationCount: userNotifications.length },
        duration: Date.now() - startTime
      })
    } catch (error) {
      this.addResult({
        component: 'Notification System',
        status: 'fail',
        message: `Notification system failed: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }

  private async testBackupSystemIntegration(): Promise<void> {
    const startTime = Date.now()
    try {
      const backup = new BackupService()
      
      // Test backup listing (should not fail even if no backups exist)
      const backups = await backup.listBackups()
      
      // Test backup validation (if backups exist)
      if (backups.length > 0) {
        const validation = await backup.validateBackup(backups[0].id)
        if (!validation.isValid && validation.errors.length > 0) {
          throw new Error(`Backup validation failed: ${validation.errors.join(', ')}`)
        }
      }
      
      this.addResult({
        component: 'Backup System',
        status: 'pass',
        message: 'Backup system integration successful',
        details: { backupCount: backups.length },
        duration: Date.now() - startTime
      })
    } catch (error) {
      this.addResult({
        component: 'Backup System',
        status: 'fail',
        message: `Backup system failed: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }

  private async testHealthCheckIntegration(): Promise<void> {
    const startTime = Date.now()
    try {
      const health = new HealthCheckService()
      
      // Test health status
      const status = await health.getSystemHealth()
      
      if (!status.overall || !status.services) {
        throw new Error('Health check returned invalid status')
      }
      
      this.addResult({
        component: 'Health Check System',
        status: status.overall === 'healthy' ? 'pass' : 'warning',
        message: `Health check integration successful - System status: ${status.overall}`,
        details: status,
        duration: Date.now() - startTime
      })
    } catch (error) {
      this.addResult({
        component: 'Health Check System',
        status: 'fail',
        message: `Health check failed: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }

  private async testCacheSystemIntegration(): Promise<void> {
    const startTime = Date.now()
    try {
      const cache = new CacheService(this.redis)
      
      // Test cache operations
      await cache.set('integration-test', { test: 'data' }, 60)
      const cached = await cache.get('integration-test')
      
      if (!cached || cached.test !== 'data') {
        throw new Error('Cache read/write test failed')
      }
      
      // Test cache invalidation
      await cache.invalidate('integration-test')
      const afterInvalidation = await cache.get('integration-test')
      
      if (afterInvalidation !== null) {
        throw new Error('Cache invalidation test failed')
      }
      
      this.addResult({
        component: 'Cache System',
        status: 'pass',
        message: 'Cache system integration successful',
        duration: Date.now() - startTime
      })
    } catch (error) {
      this.addResult({
        component: 'Cache System',
        status: 'fail',
        message: `Cache system failed: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }

  private async testAPIUsageIntegration(): Promise<void> {
    const startTime = Date.now()
    try {
      const usage = new APIUsageService()
      
      // Test usage tracking
      await usage.trackUsage('test-user', 'ai_analysis', 1)
      
      // Test usage retrieval
      const userUsage = await usage.getUserUsage('test-user')
      
      this.addResult({
        component: 'API Usage System',
        status: 'pass',
        message: 'API usage system integration successful',
        details: { dailyUsage: userUsage.daily },
        duration: Date.now() - startTime
      })
    } catch (error) {
      this.addResult({
        component: 'API Usage System',
        status: 'fail',
        message: `API usage system failed: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }

  private async testEndToEndWorkflow(): Promise<void> {
    const startTime = Date.now()
    try {
      // Simulate a complete AI analysis workflow
      const jobQueue = new JobQueueManager(this.redis)
      const notifications = new NotificationService()
      const usage = new APIUsageService()
      
      // 1. Track API usage
      await usage.trackUsage('test-user', 'ai_analysis', 1)
      
      // 2. Create background job
      const jobId = await jobQueue.addAnalysisJob('test-paper-id', ['openai'])
      
      // 3. Create notification
      await notifications.createNotification({
        userId: 'test-user',
        type: 'ai_analysis_started',
        title: 'Analysis Started',
        message: 'AI analysis has been queued',
        priority: 'medium'
      })
      
      // 4. Verify job status
      const status = await jobQueue.getJobStatus(jobId)
      
      // 5. Cleanup
      await jobQueue.cancelJob(jobId)
      
      this.addResult({
        component: 'End-to-End Workflow',
        status: 'pass',
        message: 'Complete workflow integration successful',
        details: { jobId, status: status.status },
        duration: Date.now() - startTime
      })
    } catch (error) {
      this.addResult({
        component: 'End-to-End Workflow',
        status: 'fail',
        message: `End-to-end workflow failed: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }

  private async testServiceInteractions(): Promise<void> {
    const startTime = Date.now()
    try {
      // Test service-to-service communication
      const monitor = new PerformanceMonitor()
      const security = new SecurityService()
      const cache = new CacheService(this.redis)
      
      // Test performance monitoring of security operations
      const securityStartTime = Date.now()
      const encrypted = await security.encryptAPIKey('test-key', 'test-user')
      const securityDuration = Date.now() - securityStartTime
      
      await monitor.recordAPIMetric({
        endpoint: '/security/encrypt',
        method: 'POST',
        statusCode: 200,
        responseTime: securityDuration,
        userId: 'test-user',
        ipAddress: '127.0.0.1'
      })
      
      // Test caching of security tokens
      const csrfToken = security.generateCSRFToken('test-session')
      await cache.set(`csrf:test-session`, csrfToken, 1800) // 30 minutes
      
      const cachedToken = await cache.get(`csrf:test-session`)
      if (cachedToken !== csrfToken) {
        throw new Error('Service interaction test failed')
      }
      
      this.addResult({
        component: 'Service Interactions',
        status: 'pass',
        message: 'Service-to-service interactions successful',
        duration: Date.now() - startTime
      })
    } catch (error) {
      this.addResult({
        component: 'Service Interactions',
        status: 'fail',
        message: `Service interactions failed: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }

  private addResult(result: Omit<IntegrationTestResult, 'duration'> & { duration: number }): void {
    this.results.push(result)
    
    const statusIcon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'
    console.log(`${statusIcon} ${result.component}: ${result.message} (${result.duration}ms)`)
    
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`)
    }
  }

  async cleanup(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect()
    }
  }
}

async function main() {
  const verifier = new SystemIntegrationVerifier()
  
  try {
    const results = await verifier.runAllTests()
    
    console.log('\n📊 Integration Test Summary:')
    console.log('=' .repeat(50))
    
    const passed = results.filter(r => r.status === 'pass').length
    const warnings = results.filter(r => r.status === 'warning').length
    const failed = results.filter(r => r.status === 'fail').length
    
    console.log(`✅ Passed: ${passed}`)
    console.log(`⚠️  Warnings: ${warnings}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`📈 Total: ${results.length}`)
    
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)
    console.log(`⏱️  Total Duration: ${totalDuration}ms`)
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:')
      results.filter(r => r.status === 'fail').forEach(r => {
        console.log(`   - ${r.component}: ${r.message}`)
      })
      process.exit(1)
    }
    
    if (warnings > 0) {
      console.log('\n⚠️  Warnings:')
      results.filter(r => r.status === 'warning').forEach(r => {
        console.log(`   - ${r.component}: ${r.message}`)
      })
    }
    
    console.log('\n🎉 System integration verification completed successfully!')
    
  } catch (error) {
    console.error('❌ Integration verification failed:', error)
    process.exit(1)
  } finally {
    await verifier.cleanup()
  }
}

if (require.main === module) {
  main()
}

export { SystemIntegrationVerifier, type IntegrationTestResult }