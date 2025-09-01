import { CacheService, CacheStats } from './CacheService'

export interface CacheMetrics {
  hitRate: number
  missRate: number
  localHitRate: number
  redisHitRate: number
  averageResponseTime: number
  memoryEfficiency: number
  keyDistribution: Record<string, number>
  hotKeys: Array<{ key: string; accessCount: number }>
  recommendations: string[]
}

export interface CacheAlert {
  type: 'performance' | 'memory' | 'error'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: Date
  metrics?: Partial<CacheMetrics>
}

export class CacheMonitor {
  private cacheService: CacheService
  private metricsHistory: CacheStats[] = []
  private keyAccessCounts: Map<string, number> = new Map()
  private responseTimeHistory: number[] = []
  private alerts: CacheAlert[] = []
  private monitoringInterval: NodeJS.Timeout | null = null

  constructor(cacheService: CacheService) {
    this.cacheService = cacheService
  }

  /**
   * Start monitoring cache performance
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
      this.analyzePerformance()
      this.cleanupOldData()
    }, intervalMs)
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
  }

  /**
   * Record cache access for key tracking
   */
  recordKeyAccess(key: string): void {
    const currentCount = this.keyAccessCounts.get(key) || 0
    this.keyAccessCounts.set(key, currentCount + 1)
  }

  /**
   * Record response time for performance tracking
   */
  recordResponseTime(timeMs: number): void {
    this.responseTimeHistory.push(timeMs)
    
    // Keep only last 1000 measurements
    if (this.responseTimeHistory.length > 1000) {
      this.responseTimeHistory.shift()
    }
  }

  /**
   * Get comprehensive cache metrics
   */
  getMetrics(): CacheMetrics {
    const stats = this.cacheService.getStats()
    const totalRequests = stats.hits + stats.misses
    
    const hitRate = totalRequests > 0 ? (stats.hits / totalRequests) * 100 : 0
    const missRate = totalRequests > 0 ? (stats.misses / totalRequests) * 100 : 0
    const localHitRate = stats.hits > 0 ? (stats.localHits / stats.hits) * 100 : 0
    const redisHitRate = stats.hits > 0 ? (stats.redisHits / stats.hits) * 100 : 0

    const averageResponseTime = this.responseTimeHistory.length > 0
      ? this.responseTimeHistory.reduce((a, b) => a + b, 0) / this.responseTimeHistory.length
      : 0

    const memoryEfficiency = this.calculateMemoryEfficiency(stats)
    const keyDistribution = this.getKeyDistribution()
    const hotKeys = this.getHotKeys()
    const recommendations = this.generateRecommendations(stats, hitRate, memoryEfficiency)

    return {
      hitRate,
      missRate,
      localHitRate,
      redisHitRate,
      averageResponseTime,
      memoryEfficiency,
      keyDistribution,
      hotKeys,
      recommendations
    }
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit: number = 50): CacheAlert[] {
    return this.alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  /**
   * Get cache health score (0-100)
   */
  getHealthScore(): number {
    const metrics = this.getMetrics()
    let score = 100

    // Hit rate impact (40% of score)
    if (metrics.hitRate < 50) score -= 40
    else if (metrics.hitRate < 70) score -= 20
    else if (metrics.hitRate < 85) score -= 10

    // Response time impact (30% of score)
    if (metrics.averageResponseTime > 100) score -= 30
    else if (metrics.averageResponseTime > 50) score -= 15
    else if (metrics.averageResponseTime > 20) score -= 5

    // Memory efficiency impact (20% of score)
    if (metrics.memoryEfficiency < 50) score -= 20
    else if (metrics.memoryEfficiency < 70) score -= 10
    else if (metrics.memoryEfficiency < 85) score -= 5

    // Alert severity impact (10% of score)
    const criticalAlerts = this.alerts.filter(a => a.severity === 'critical').length
    const highAlerts = this.alerts.filter(a => a.severity === 'high').length
    
    score -= criticalAlerts * 5
    score -= highAlerts * 2

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Optimize cache configuration based on metrics
   */
  async optimizeCache(): Promise<{ applied: string[]; recommendations: string[] }> {
    const metrics = this.getMetrics()
    const applied: string[] = []
    const recommendations: string[] = []

    // Auto-optimization based on metrics
    if (metrics.hitRate < 60) {
      // Increase local cache size if hit rate is low
      recommendations.push('Consider increasing local cache size')
      recommendations.push('Review TTL settings for frequently accessed keys')
    }

    if (metrics.averageResponseTime > 50) {
      // Performance optimization
      recommendations.push('Consider enabling compression for large values')
      recommendations.push('Review network latency to Redis instance')
    }

    if (metrics.memoryEfficiency < 70) {
      // Memory optimization
      recommendations.push('Consider implementing cache eviction policies')
      recommendations.push('Review key naming patterns for optimization')
    }

    // Hot key optimization
    if (metrics.hotKeys.length > 0) {
      const topHotKey = metrics.hotKeys[0]
      if (topHotKey.accessCount > 1000) {
        recommendations.push(`Consider pre-warming hot key: ${topHotKey.key}`)
      }
    }

    return { applied, recommendations }
  }

  // Private methods

  private collectMetrics(): void {
    const stats = this.cacheService.getStats()
    this.metricsHistory.push({
      ...stats,
      timestamp: Date.now()
    } as CacheStats & { timestamp: number })

    // Keep only last 24 hours of metrics (assuming 1-minute intervals)
    if (this.metricsHistory.length > 1440) {
      this.metricsHistory.shift()
    }
  }

  private analyzePerformance(): void {
    const metrics = this.getMetrics()
    const now = new Date()

    // Check for performance issues
    if (metrics.hitRate < 50) {
      this.addAlert({
        type: 'performance',
        severity: 'high',
        message: `Low cache hit rate: ${metrics.hitRate.toFixed(1)}%`,
        timestamp: now,
        metrics: { hitRate: metrics.hitRate }
      })
    }

    if (metrics.averageResponseTime > 100) {
      this.addAlert({
        type: 'performance',
        severity: 'medium',
        message: `High average response time: ${metrics.averageResponseTime.toFixed(1)}ms`,
        timestamp: now,
        metrics: { averageResponseTime: metrics.averageResponseTime }
      })
    }

    if (metrics.memoryEfficiency < 50) {
      this.addAlert({
        type: 'memory',
        severity: 'medium',
        message: `Low memory efficiency: ${metrics.memoryEfficiency.toFixed(1)}%`,
        timestamp: now,
        metrics: { memoryEfficiency: metrics.memoryEfficiency }
      })
    }

    // Check for hot keys that might need special handling
    const criticalHotKeys = metrics.hotKeys.filter(k => k.accessCount > 10000)
    if (criticalHotKeys.length > 0) {
      this.addAlert({
        type: 'performance',
        severity: 'medium',
        message: `Detected ${criticalHotKeys.length} hot keys with very high access counts`,
        timestamp: now
      })
    }
  }

  private addAlert(alert: CacheAlert): void {
    this.alerts.push(alert)
    
    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts.shift()
    }
  }

  private calculateMemoryEfficiency(stats: CacheStats): number {
    // Simple efficiency calculation based on hit rate and memory usage
    const hitRate = stats.hits + stats.misses > 0 
      ? (stats.hits / (stats.hits + stats.misses)) * 100 
      : 0
    
    // Assume good efficiency if we have high hit rate with reasonable memory usage
    const memoryScore = stats.memoryUsage < 100 * 1024 * 1024 ? 100 : 50 // 100MB threshold
    
    return (hitRate + memoryScore) / 2
  }

  private getKeyDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {}
    
    this.keyAccessCounts.forEach((count, key) => {
      const prefix = key.split(':')[0] || 'unknown'
      distribution[prefix] = (distribution[prefix] || 0) + count
    })
    
    return distribution
  }

  private getHotKeys(): Array<{ key: string; accessCount: number }> {
    return Array.from(this.keyAccessCounts.entries())
      .map(([key, count]) => ({ key, accessCount: count }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10) // Top 10 hot keys
  }

  private generateRecommendations(stats: CacheStats, hitRate: number, memoryEfficiency: number): string[] {
    const recommendations: string[] = []

    if (hitRate < 70) {
      recommendations.push('Consider increasing cache TTL for frequently accessed data')
      recommendations.push('Review cache key patterns and implement cache warming')
    }

    if (hitRate > 95) {
      recommendations.push('Excellent hit rate! Consider reducing local cache size to save memory')
    }

    if (memoryEfficiency < 60) {
      recommendations.push('Implement cache compression for large values')
      recommendations.push('Review and optimize key naming conventions')
    }

    if (stats.localHits / Math.max(stats.hits, 1) < 0.3) {
      recommendations.push('Consider increasing local cache size or TTL')
    }

    if (this.responseTimeHistory.some(time => time > 200)) {
      recommendations.push('Some cache operations are slow - check Redis connection and network')
    }

    return recommendations
  }

  private cleanupOldData(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    
    // Clean up old key access counts (keep only recent data)
    const recentKeys = new Map<string, number>()
    this.keyAccessCounts.forEach((count, key) => {
      // Keep keys that have been accessed recently or have high counts
      if (count > 10) {
        recentKeys.set(key, Math.floor(count * 0.9)) // Decay old counts
      }
    })
    this.keyAccessCounts = recentKeys

    // Clean up old alerts
    this.alerts = this.alerts.filter(alert => 
      alert.timestamp.getTime() > oneHourAgo
    )
  }
}

export default CacheMonitor