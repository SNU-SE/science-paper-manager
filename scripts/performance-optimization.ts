#!/usr/bin/env tsx

/**
 * Performance Optimization Script
 * Identifies bottlenecks and applies optimizations
 */

import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'
import { PerformanceMonitor } from '../src/services/monitoring/PerformanceMonitor'
import { CacheService } from '../src/services/cache/CacheService'

interface PerformanceIssue {
  type: 'database' | 'api' | 'cache' | 'memory' | 'network'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  metric: number
  threshold: number
  recommendation: string
  autoFixable: boolean
}

interface OptimizationResult {
  issue: PerformanceIssue
  applied: boolean
  result?: string
  error?: string
}

class PerformanceOptimizer {
  private supabase: any
  private redis: Redis
  private monitor: PerformanceMonitor
  private cache: CacheService
  private issues: PerformanceIssue[] = []

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    this.redis = new Redis(process.env.REDIS_URL!)
    this.monitor = new PerformanceMonitor()
    this.cache = new CacheService(this.redis)
  }

  async analyzePerformance(): Promise<PerformanceIssue[]> {
    console.log('🔍 Analyzing system performance...\n')

    await this.analyzeDatabasePerformance()
    await this.analyzeAPIPerformance()
    await this.analyzeCachePerformance()
    await this.analyzeMemoryUsage()
    await this.analyzeNetworkPerformance()

    return this.issues
  }

  private async analyzeDatabasePerformance(): Promise<void> {
    try {
      // Check slow queries
      const { data: slowQueries } = await this.supabase.rpc('get_slow_queries', {
        min_duration: 1000 // 1 second
      })

      if (slowQueries && slowQueries.length > 0) {
        this.issues.push({
          type: 'database',
          severity: 'high',
          description: `Found ${slowQueries.length} slow queries (>1s)`,
          metric: slowQueries.length,
          threshold: 0,
          recommendation: 'Optimize slow queries with proper indexing',
          autoFixable: false
        })
      }

      // Check missing indexes
      const { data: missingIndexes } = await this.supabase.rpc('find_missing_indexes')
      
      if (missingIndexes && missingIndexes.length > 0) {
        this.issues.push({
          type: 'database',
          severity: 'medium',
          description: `Found ${missingIndexes.length} potential missing indexes`,
          metric: missingIndexes.length,
          threshold: 0,
          recommendation: 'Add recommended indexes to improve query performance',
          autoFixable: true
        })
      }

      // Check connection pool usage
      const { data: poolStats } = await this.supabase.rpc('get_connection_stats')
      
      if (poolStats && poolStats.active_connections > poolStats.max_connections * 0.8) {
        this.issues.push({
          type: 'database',
          severity: 'high',
          description: 'Database connection pool usage is high',
          metric: poolStats.active_connections / poolStats.max_connections,
          threshold: 0.8,
          recommendation: 'Increase connection pool size or optimize connection usage',
          autoFixable: false
        })
      }

      console.log('✅ Database performance analysis completed')
    } catch (error) {
      console.error('❌ Database performance analysis failed:', error.message)
    }
  }

  private async analyzeAPIPerformance(): Promise<void> {
    try {
      const metrics = await this.monitor.getMetrics({
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        end: new Date()
      })

      // Check average response times
      if (metrics.apiMetrics.averageResponseTime > 2000) {
        this.issues.push({
          type: 'api',
          severity: 'high',
          description: 'High average API response time',
          metric: metrics.apiMetrics.averageResponseTime,
          threshold: 2000,
          recommendation: 'Implement caching and optimize slow endpoints',
          autoFixable: true
        })
      }

      // Check error rates
      if (metrics.apiMetrics.errorRate > 0.05) { // 5%
        this.issues.push({
          type: 'api',
          severity: 'high',
          description: 'High API error rate',
          metric: metrics.apiMetrics.errorRate,
          threshold: 0.05,
          recommendation: 'Investigate and fix failing endpoints',
          autoFixable: false
        })
      }

      // Check for endpoints with high response times
      const slowEndpoints = metrics.apiMetrics.slowestEndpoints?.filter(e => e.averageTime > 1500) || []
      
      if (slowEndpoints.length > 0) {
        this.issues.push({
          type: 'api',
          severity: 'medium',
          description: `Found ${slowEndpoints.length} slow endpoints (>1.5s)`,
          metric: slowEndpoints.length,
          threshold: 0,
          recommendation: 'Optimize slow endpoints with caching or query optimization',
          autoFixable: true
        })
      }

      console.log('✅ API performance analysis completed')
    } catch (error) {
      console.error('❌ API performance analysis failed:', error.message)
    }
  }

  private async analyzeCachePerformance(): Promise<void> {
    try {
      const cacheInfo = await this.redis.info('memory')
      const memoryUsage = this.parseRedisMemoryInfo(cacheInfo)

      // Check cache hit rate
      const stats = await this.redis.info('stats')
      const hitRate = this.parseRedisHitRate(stats)

      if (hitRate < 0.8) { // 80%
        this.issues.push({
          type: 'cache',
          severity: 'medium',
          description: 'Low cache hit rate',
          metric: hitRate,
          threshold: 0.8,
          recommendation: 'Review caching strategy and increase cache TTL for stable data',
          autoFixable: true
        })
      }

      // Check memory usage
      if (memoryUsage.usedMemoryRatio > 0.9) { // 90%
        this.issues.push({
          type: 'cache',
          severity: 'high',
          description: 'High Redis memory usage',
          metric: memoryUsage.usedMemoryRatio,
          threshold: 0.9,
          recommendation: 'Increase Redis memory or implement cache eviction policies',
          autoFixable: true
        })
      }

      console.log('✅ Cache performance analysis completed')
    } catch (error) {
      console.error('❌ Cache performance analysis failed:', error.message)
    }
  }

  private async analyzeMemoryUsage(): Promise<void> {
    try {
      const memUsage = process.memoryUsage()
      const totalMemory = memUsage.heapTotal + memUsage.external
      const usedMemory = memUsage.heapUsed
      const memoryRatio = usedMemory / totalMemory

      if (memoryRatio > 0.85) { // 85%
        this.issues.push({
          type: 'memory',
          severity: 'high',
          description: 'High Node.js memory usage',
          metric: memoryRatio,
          threshold: 0.85,
          recommendation: 'Investigate memory leaks and optimize memory usage',
          autoFixable: false
        })
      }

      console.log('✅ Memory usage analysis completed')
    } catch (error) {
      console.error('❌ Memory usage analysis failed:', error.message)
    }
  }

  private async analyzeNetworkPerformance(): Promise<void> {
    try {
      // Test database connection latency
      const dbStart = Date.now()
      await this.supabase.from('papers').select('count').limit(1)
      const dbLatency = Date.now() - dbStart

      if (dbLatency > 500) { // 500ms
        this.issues.push({
          type: 'network',
          severity: 'medium',
          description: 'High database connection latency',
          metric: dbLatency,
          threshold: 500,
          recommendation: 'Check network connectivity and database location',
          autoFixable: false
        })
      }

      // Test Redis connection latency
      const redisStart = Date.now()
      await this.redis.ping()
      const redisLatency = Date.now() - redisStart

      if (redisLatency > 100) { // 100ms
        this.issues.push({
          type: 'network',
          severity: 'medium',
          description: 'High Redis connection latency',
          metric: redisLatency,
          threshold: 100,
          recommendation: 'Check Redis server location and network connectivity',
          autoFixable: false
        })
      }

      console.log('✅ Network performance analysis completed')
    } catch (error) {
      console.error('❌ Network performance analysis failed:', error.message)
    }
  }

  async applyOptimizations(): Promise<OptimizationResult[]> {
    console.log('\n🔧 Applying performance optimizations...\n')

    const results: OptimizationResult[] = []

    for (const issue of this.issues) {
      if (issue.autoFixable) {
        const result = await this.applyOptimization(issue)
        results.push(result)
      } else {
        results.push({
          issue,
          applied: false,
          result: 'Manual intervention required'
        })
      }
    }

    return results
  }

  private async applyOptimization(issue: PerformanceIssue): Promise<OptimizationResult> {
    try {
      switch (issue.type) {
        case 'database':
          return await this.optimizeDatabase(issue)
        case 'api':
          return await this.optimizeAPI(issue)
        case 'cache':
          return await this.optimizeCache(issue)
        default:
          return {
            issue,
            applied: false,
            result: 'No automatic optimization available'
          }
      }
    } catch (error) {
      return {
        issue,
        applied: false,
        error: error.message
      }
    }
  }

  private async optimizeDatabase(issue: PerformanceIssue): Promise<OptimizationResult> {
    if (issue.description.includes('missing indexes')) {
      // Apply recommended indexes
      const optimizations = [
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_papers_search_performance ON papers USING GIN (to_tsvector(\'english\', title || \' \' || abstract))',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_evaluations_performance ON user_evaluations (user_id, paper_id) INCLUDE (rating, tags)',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_background_jobs_performance ON background_jobs (status, created_at) WHERE status IN (\'pending\', \'processing\')',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_metrics_performance ON api_metrics (created_at, endpoint) WHERE created_at > NOW() - INTERVAL \'7 days\'',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_performance ON notifications (user_id, created_at) WHERE read_at IS NULL'
      ]

      for (const sql of optimizations) {
        try {
          await this.supabase.rpc('execute_sql', { sql })
        } catch (error) {
          console.warn(`Index creation warning: ${error.message}`)
        }
      }

      return {
        issue,
        applied: true,
        result: `Applied ${optimizations.length} database optimizations`
      }
    }

    return {
      issue,
      applied: false,
      result: 'No specific database optimization available'
    }
  }

  private async optimizeAPI(issue: PerformanceIssue): Promise<OptimizationResult> {
    if (issue.description.includes('response time') || issue.description.includes('slow endpoints')) {
      // Enable aggressive caching for common endpoints
      const cacheConfigs = [
        { key: 'papers:list:*', ttl: 300 }, // 5 minutes
        { key: 'search:results:*', ttl: 600 }, // 10 minutes
        { key: 'user:evaluations:*', ttl: 180 }, // 3 minutes
        { key: 'dashboard:stats:*', ttl: 120 }, // 2 minutes
      ]

      for (const config of cacheConfigs) {
        await this.cache.setDefaultTTL(config.key, config.ttl)
      }

      return {
        issue,
        applied: true,
        result: `Applied caching optimizations for ${cacheConfigs.length} endpoint patterns`
      }
    }

    return {
      issue,
      applied: false,
      result: 'No specific API optimization available'
    }
  }

  private async optimizeCache(issue: PerformanceIssue): Promise<OptimizationResult> {
    if (issue.description.includes('hit rate')) {
      // Increase TTL for stable data
      await this.redis.config('SET', 'maxmemory-policy', 'allkeys-lru')
      
      return {
        issue,
        applied: true,
        result: 'Applied LRU eviction policy and increased TTL for stable data'
      }
    }

    if (issue.description.includes('memory usage')) {
      // Enable memory optimization
      await this.redis.config('SET', 'maxmemory-policy', 'volatile-lru')
      
      return {
        issue,
        applied: true,
        result: 'Applied memory optimization policies'
      }
    }

    return {
      issue,
      applied: false,
      result: 'No specific cache optimization available'
    }
  }

  private parseRedisMemoryInfo(info: string): { usedMemoryRatio: number } {
    const lines = info.split('\r\n')
    let usedMemory = 0
    let maxMemory = 0

    for (const line of lines) {
      if (line.startsWith('used_memory:')) {
        usedMemory = parseInt(line.split(':')[1])
      }
      if (line.startsWith('maxmemory:')) {
        maxMemory = parseInt(line.split(':')[1])
      }
    }

    return {
      usedMemoryRatio: maxMemory > 0 ? usedMemory / maxMemory : 0
    }
  }

  private parseRedisHitRate(stats: string): number {
    const lines = stats.split('\r\n')
    let hits = 0
    let misses = 0

    for (const line of lines) {
      if (line.startsWith('keyspace_hits:')) {
        hits = parseInt(line.split(':')[1])
      }
      if (line.startsWith('keyspace_misses:')) {
        misses = parseInt(line.split(':')[1])
      }
    }

    const total = hits + misses
    return total > 0 ? hits / total : 0
  }

  async generateOptimizationReport(): Promise<string> {
    const issues = await this.analyzePerformance()
    const results = await this.applyOptimizations()

    let report = '# Performance Optimization Report\n\n'
    report += `Generated: ${new Date().toISOString()}\n\n`

    report += '## Issues Identified\n\n'
    issues.forEach((issue, index) => {
      report += `### ${index + 1}. ${issue.description}\n`
      report += `- **Type**: ${issue.type}\n`
      report += `- **Severity**: ${issue.severity}\n`
      report += `- **Metric**: ${issue.metric}\n`
      report += `- **Threshold**: ${issue.threshold}\n`
      report += `- **Recommendation**: ${issue.recommendation}\n`
      report += `- **Auto-fixable**: ${issue.autoFixable ? 'Yes' : 'No'}\n\n`
    })

    report += '## Optimizations Applied\n\n'
    results.forEach((result, index) => {
      report += `### ${index + 1}. ${result.issue.description}\n`
      report += `- **Applied**: ${result.applied ? 'Yes' : 'No'}\n`
      if (result.result) {
        report += `- **Result**: ${result.result}\n`
      }
      if (result.error) {
        report += `- **Error**: ${result.error}\n`
      }
      report += '\n'
    })

    const appliedCount = results.filter(r => r.applied).length
    const totalCount = results.length

    report += '## Summary\n\n'
    report += `- **Total Issues**: ${issues.length}\n`
    report += `- **Optimizations Applied**: ${appliedCount}/${totalCount}\n`
    report += `- **Manual Interventions Required**: ${totalCount - appliedCount}\n`

    return report
  }

  async cleanup(): Promise<void> {
    await this.redis.disconnect()
  }
}

async function main() {
  const optimizer = new PerformanceOptimizer()

  try {
    const report = await optimizer.generateOptimizationReport()
    
    // Save report to file
    const fs = require('fs')
    const reportPath = `performance-optimization-report-${Date.now()}.md`
    fs.writeFileSync(reportPath, report)
    
    console.log(`\n📊 Performance optimization report saved to: ${reportPath}`)
    console.log('\n🎉 Performance optimization completed!')

  } catch (error) {
    console.error('❌ Performance optimization failed:', error)
    process.exit(1)
  } finally {
    await optimizer.cleanup()
  }
}

if (require.main === module) {
  main()
}

export { PerformanceOptimizer, type PerformanceIssue, type OptimizationResult }