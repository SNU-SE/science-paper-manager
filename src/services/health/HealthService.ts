import { HealthCheckService, HealthCheckConfig, SystemHealth } from './HealthCheckService'
import { AutoRecoveryService, RecoveryConfig } from './AutoRecoveryService'
import { SystemResourceMonitor, ResourceThresholds } from './SystemResourceMonitor'
import { NotificationService } from '../notifications/NotificationService'

export interface HealthServiceConfig {
  healthCheck: HealthCheckConfig
  autoRecovery: RecoveryConfig
  resourceMonitoring: {
    enabled: boolean
    thresholds: ResourceThresholds
    interval: number
  }
}

export class HealthService {
  private healthCheckService: HealthCheckService
  private autoRecoveryService: AutoRecoveryService
  private resourceMonitor: SystemResourceMonitor
  private notificationService: NotificationService
  private config: HealthServiceConfig

  constructor(config: HealthServiceConfig) {
    this.config = config
    this.notificationService = new NotificationService()
    
    // Initialize services
    this.healthCheckService = new HealthCheckService(config.healthCheck)
    this.autoRecoveryService = new AutoRecoveryService(
      this.healthCheckService,
      this.notificationService,
      config.autoRecovery
    )
    this.resourceMonitor = new SystemResourceMonitor(
      this.notificationService,
      config.resourceMonitoring.thresholds,
      config.resourceMonitoring.interval
    )
  }

  async start(): Promise<void> {
    console.log('Starting Health Service...')
    
    // Start resource monitoring
    if (this.config.resourceMonitoring.enabled) {
      this.resourceMonitor.start()
    }

    // Start auto-recovery service
    this.autoRecoveryService.start()

    // Perform initial health check
    await this.healthCheckService.performHealthCheck()

    console.log('Health Service started successfully')
  }

  async stop(): Promise<void> {
    console.log('Stopping Health Service...')
    
    this.resourceMonitor.stop()
    this.autoRecoveryService.stop()
    
    console.log('Health Service stopped')
  }

  async getSystemHealth(): Promise<SystemHealth> {
    return await this.healthCheckService.performHealthCheck()
  }

  async getServiceStatus(serviceName: string) {
    return await this.healthCheckService.getServiceStatus(serviceName)
  }

  getCurrentResourceMetrics() {
    return this.resourceMonitor.getCurrentMetrics()
  }

  getResourceHistory(limit?: number) {
    return this.resourceMonitor.getMetricsHistory(limit)
  }

  getActiveResourceAlerts() {
    return this.resourceMonitor.getActiveAlerts()
  }

  getRecoveryStats() {
    return this.autoRecoveryService.getRecoveryStats()
  }

  getRecoveryHistory(actionId?: string) {
    return this.autoRecoveryService.getRecoveryHistory(actionId)
  }

  getResourceSummary(timeRange?: number) {
    return this.resourceMonitor.getResourceSummary(timeRange)
  }

  // Create default configuration
  static createDefaultConfig(): HealthServiceConfig {
    return {
      healthCheck: {
        database: {
          enabled: true,
          timeout: 5000,
          criticalQueries: [
            'SELECT 1',
            'SELECT COUNT(*) FROM papers LIMIT 1'
          ]
        },
        redis: {
          enabled: true,
          timeout: 3000
        },
        externalAPIs: {
          enabled: true,
          endpoints: [
            {
              name: 'openai',
              url: 'https://api.openai.com/v1/models',
              timeout: 5000,
              critical: true
            },
            {
              name: 'anthropic',
              url: 'https://api.anthropic.com/v1/messages',
              timeout: 5000,
              critical: false
            }
          ]
        },
        system: {
          enabled: true,
          memoryThreshold: 80,
          cpuThreshold: 80
        }
      },
      autoRecovery: {
        enabled: true,
        checkInterval: 60000, // 1 minute
        actions: AutoRecoveryService.createDefaultRecoveryActions(),
        alertThreshold: 3
      },
      resourceMonitoring: {
        enabled: true,
        thresholds: SystemResourceMonitor.getDefaultThresholds(),
        interval: 30000 // 30 seconds
      }
    }
  }
}

// Singleton instance for global access
let healthServiceInstance: HealthService | null = null

export function getHealthService(): HealthService {
  if (!healthServiceInstance) {
    const config = HealthService.createDefaultConfig()
    healthServiceInstance = new HealthService(config)
  }
  return healthServiceInstance
}

export function initializeHealthService(config?: HealthServiceConfig): HealthService {
  const finalConfig = config || HealthService.createDefaultConfig()
  healthServiceInstance = new HealthService(finalConfig)
  return healthServiceInstance
}