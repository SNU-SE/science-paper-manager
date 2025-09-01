import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'

export interface HealthStatus {
  service: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime?: number
  lastCheck: Date
  error?: string
  metadata?: Record<string, any>
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  services: HealthStatus[]
  timestamp: Date
  uptime: number
}

export interface HealthCheckConfig {
  database: {
    enabled: boolean
    timeout: number
    criticalQueries: string[]
  }
  redis: {
    enabled: boolean
    timeout: number
  }
  externalAPIs: {
    enabled: boolean
    endpoints: Array<{
      name: string
      url: string
      timeout: number
      critical: boolean
    }>
  }
  system: {
    enabled: boolean
    memoryThreshold: number // percentage
    cpuThreshold: number // percentage
  }
}

export class HealthCheckService {
  private config: HealthCheckConfig
  private startTime: Date
  private lastHealthCheck: SystemHealth | null = null

  constructor(config: HealthCheckConfig) {
    this.config = config
    this.startTime = new Date()
  }

  async performHealthCheck(): Promise<SystemHealth> {
    const services: HealthStatus[] = []

    // Check database health
    if (this.config.database.enabled) {
      services.push(await this.checkDatabaseHealth())
    }

    // Check Redis health
    if (this.config.redis.enabled) {
      services.push(await this.checkRedisHealth())
    }

    // Check external APIs
    if (this.config.externalAPIs.enabled) {
      const apiChecks = await Promise.all(
        this.config.externalAPIs.endpoints.map(endpoint => 
          this.checkExternalAPIHealth(endpoint)
        )
      )
      services.push(...apiChecks)
    }

    // Check system resources
    if (this.config.system.enabled) {
      services.push(await this.checkSystemResources())
    }

    // Determine overall health
    const overall = this.determineOverallHealth(services)

    const systemHealth: SystemHealth = {
      overall,
      services,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime.getTime()
    }

    this.lastHealthCheck = systemHealth
    return systemHealth
  }

  private async checkDatabaseHealth(): Promise<HealthStatus> {
    const startTime = Date.now()
    
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // Basic connectivity test
      const { data, error } = await Promise.race([
        supabase.from('papers').select('count').limit(1),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database timeout')), this.config.database.timeout)
        )
      ]) as any

      if (error) throw error

      const responseTime = Date.now() - startTime

      // Run critical queries if configured
      const criticalQueryResults = await this.runCriticalQueries(supabase)

      return {
        service: 'database',
        status: responseTime > 1000 ? 'degraded' : 'healthy',
        responseTime,
        lastCheck: new Date(),
        metadata: {
          connectionPool: 'active',
          criticalQueries: criticalQueryResults
        }
      }
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown database error'
      }
    }
  }

  private async runCriticalQueries(supabase: any): Promise<Record<string, any>> {
    const results: Record<string, any> = {}

    for (const query of this.config.database.criticalQueries) {
      try {
        const startTime = Date.now()
        const { data, error } = await supabase.rpc('execute_health_query', { query })
        
        results[query] = {
          success: !error,
          responseTime: Date.now() - startTime,
          error: error?.message
        }
      } catch (error) {
        results[query] = {
          success: false,
          error: error instanceof Error ? error.message : 'Query failed'
        }
      }
    }

    return results
  }

  private async checkRedisHealth(): Promise<HealthStatus> {
    const startTime = Date.now()
    let redis: Redis | null = null

    try {
      redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
      
      // Test basic operations
      const testKey = `health_check_${Date.now()}`
      await redis.set(testKey, 'test', 'EX', 10)
      const value = await redis.get(testKey)
      await redis.del(testKey)

      if (value !== 'test') {
        throw new Error('Redis read/write test failed')
      }

      const responseTime = Date.now() - startTime
      const info = await redis.info('memory')
      
      return {
        service: 'redis',
        status: responseTime > 500 ? 'degraded' : 'healthy',
        responseTime,
        lastCheck: new Date(),
        metadata: {
          memoryUsage: this.parseRedisMemoryInfo(info)
        }
      }
    } catch (error) {
      return {
        service: 'redis',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown Redis error'
      }
    } finally {
      if (redis) {
        redis.disconnect()
      }
    }
  }

  private parseRedisMemoryInfo(info: string): Record<string, string> {
    const lines = info.split('\r\n')
    const memoryInfo: Record<string, string> = {}
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':')
        if (key.includes('memory')) {
          memoryInfo[key] = value
        }
      }
    })
    
    return memoryInfo
  }

  private async checkExternalAPIHealth(endpoint: {
    name: string
    url: string
    timeout: number
    critical: boolean
  }): Promise<HealthStatus> {
    const startTime = Date.now()

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), endpoint.timeout)

      const response = await fetch(endpoint.url, {
        method: 'HEAD',
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime

      return {
        service: `external_api_${endpoint.name}`,
        status: response.ok ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: new Date(),
        metadata: {
          statusCode: response.status,
          critical: endpoint.critical
        }
      }
    } catch (error) {
      return {
        service: `external_api_${endpoint.name}`,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'API check failed',
        metadata: {
          critical: endpoint.critical
        }
      }
    }
  }

  private async checkSystemResources(): Promise<HealthStatus> {
    try {
      const memoryUsage = process.memoryUsage()
      const cpuUsage = process.cpuUsage()
      
      // Calculate memory percentage (rough estimation)
      const totalMemory = memoryUsage.heapTotal + memoryUsage.external
      const usedMemory = memoryUsage.heapUsed
      const memoryPercentage = (usedMemory / totalMemory) * 100

      // CPU usage calculation (simplified)
      const cpuPercentage = (cpuUsage.user + cpuUsage.system) / 1000000 // Convert to seconds

      const memoryStatus = memoryPercentage > this.config.system.memoryThreshold ? 'degraded' : 'healthy'
      const cpuStatus = cpuPercentage > this.config.system.cpuThreshold ? 'degraded' : 'healthy'
      
      const overallStatus = memoryStatus === 'degraded' || cpuStatus === 'degraded' ? 'degraded' : 'healthy'

      return {
        service: 'system_resources',
        status: overallStatus,
        lastCheck: new Date(),
        metadata: {
          memory: {
            used: usedMemory,
            total: totalMemory,
            percentage: memoryPercentage
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system,
            percentage: cpuPercentage
          },
          uptime: process.uptime()
        }
      }
    } catch (error) {
      return {
        service: 'system_resources',
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'System resource check failed'
      }
    }
  }

  private determineOverallHealth(services: HealthStatus[]): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthyServices = services.filter(s => s.status === 'unhealthy')
    const degradedServices = services.filter(s => s.status === 'degraded')

    // Check for critical services
    const criticalUnhealthy = unhealthyServices.some(s => 
      s.service === 'database' || 
      (s.service.startsWith('external_api_') && s.metadata?.critical)
    )

    if (criticalUnhealthy || unhealthyServices.length > services.length / 2) {
      return 'unhealthy'
    }

    if (unhealthyServices.length > 0 || degradedServices.length > 0) {
      return 'degraded'
    }

    return 'healthy'
  }

  getLastHealthCheck(): SystemHealth | null {
    return this.lastHealthCheck
  }

  async getServiceStatus(serviceName: string): Promise<HealthStatus | null> {
    if (!this.lastHealthCheck) {
      await this.performHealthCheck()
    }

    return this.lastHealthCheck?.services.find(s => s.service === serviceName) || null
  }
}