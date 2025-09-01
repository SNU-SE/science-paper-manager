import { HealthCheckService, HealthStatus, SystemHealth } from './HealthCheckService'
import { NotificationService } from '../notifications/NotificationService'

export interface RecoveryAction {
  id: string
  name: string
  description: string
  service: string
  condition: (status: HealthStatus) => boolean
  action: () => Promise<boolean>
  cooldown: number // milliseconds
  maxAttempts: number
}

export interface RecoveryAttempt {
  actionId: string
  timestamp: Date
  success: boolean
  error?: string
  attempt: number
}

export interface RecoveryConfig {
  enabled: boolean
  checkInterval: number // milliseconds
  actions: RecoveryAction[]
  alertThreshold: number // failed attempts before alerting
}

export class AutoRecoveryService {
  private healthCheckService: HealthCheckService
  private notificationService: NotificationService
  private config: RecoveryConfig
  private recoveryHistory: Map<string, RecoveryAttempt[]> = new Map()
  private lastActionTime: Map<string, Date> = new Map()
  private intervalId: NodeJS.Timeout | null = null

  constructor(
    healthCheckService: HealthCheckService,
    notificationService: NotificationService,
    config: RecoveryConfig
  ) {
    this.healthCheckService = healthCheckService
    this.notificationService = notificationService
    this.config = config
  }

  start(): void {
    if (!this.config.enabled || this.intervalId) {
      return
    }

    console.log('Starting auto-recovery service...')
    this.intervalId = setInterval(
      () => this.performRecoveryCheck(),
      this.config.checkInterval
    )
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('Auto-recovery service stopped')
    }
  }

  private async performRecoveryCheck(): Promise<void> {
    try {
      const systemHealth = await this.healthCheckService.performHealthCheck()
      
      if (systemHealth.overall === 'healthy') {
        return
      }

      // Check each unhealthy service for recovery actions
      for (const serviceStatus of systemHealth.services) {
        if (serviceStatus.status !== 'healthy') {
          await this.attemptServiceRecovery(serviceStatus)
        }
      }
    } catch (error) {
      console.error('Error during recovery check:', error)
    }
  }

  private async attemptServiceRecovery(serviceStatus: HealthStatus): Promise<void> {
    const applicableActions = this.config.actions.filter(action => 
      action.service === serviceStatus.service && action.condition(serviceStatus)
    )

    for (const action of applicableActions) {
      if (await this.shouldAttemptRecovery(action)) {
        await this.executeRecoveryAction(action, serviceStatus)
      }
    }
  }

  private async shouldAttemptRecovery(action: RecoveryAction): Promise<boolean> {
    const lastAttempt = this.lastActionTime.get(action.id)
    const now = new Date()

    // Check cooldown period
    if (lastAttempt && (now.getTime() - lastAttempt.getTime()) < action.cooldown) {
      return false
    }

    // Check max attempts
    const attempts = this.recoveryHistory.get(action.id) || []
    const recentAttempts = attempts.filter(attempt => 
      (now.getTime() - attempt.timestamp.getTime()) < 24 * 60 * 60 * 1000 // 24 hours
    )

    return recentAttempts.length < action.maxAttempts
  }

  private async executeRecoveryAction(action: RecoveryAction, serviceStatus: HealthStatus): Promise<void> {
    const attemptNumber = (this.recoveryHistory.get(action.id) || []).length + 1
    
    console.log(`Attempting recovery action: ${action.name} (attempt ${attemptNumber})`)
    
    try {
      const success = await action.action()
      
      const attempt: RecoveryAttempt = {
        actionId: action.id,
        timestamp: new Date(),
        success,
        attempt: attemptNumber
      }

      this.recordRecoveryAttempt(action.id, attempt)
      this.lastActionTime.set(action.id, new Date())

      if (success) {
        console.log(`Recovery action successful: ${action.name}`)
        await this.notificationService.sendNotification('admin', {
          id: `recovery_success_${action.id}_${Date.now()}`,
          userId: 'admin',
          type: 'system_recovery',
          title: 'Auto-Recovery Successful',
          message: `Successfully recovered ${action.service} using ${action.name}`,
          data: { action: action.name, service: action.service },
          priority: 'medium',
          createdAt: new Date()
        })
      } else {
        console.log(`Recovery action failed: ${action.name}`)
        await this.handleRecoveryFailure(action, attemptNumber)
      }
    } catch (error) {
      const attempt: RecoveryAttempt = {
        actionId: action.id,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt: attemptNumber
      }

      this.recordRecoveryAttempt(action.id, attempt)
      this.lastActionTime.set(action.id, new Date())

      console.error(`Recovery action error: ${action.name}`, error)
      await this.handleRecoveryFailure(action, attemptNumber)
    }
  }

  private recordRecoveryAttempt(actionId: string, attempt: RecoveryAttempt): void {
    const history = this.recoveryHistory.get(actionId) || []
    history.push(attempt)
    
    // Keep only recent attempts (last 100)
    if (history.length > 100) {
      history.splice(0, history.length - 100)
    }
    
    this.recoveryHistory.set(actionId, history)
  }

  private async handleRecoveryFailure(action: RecoveryAction, attemptNumber: number): Promise<void> {
    if (attemptNumber >= this.config.alertThreshold) {
      await this.notificationService.sendNotification('admin', {
        id: `recovery_failure_${action.id}_${Date.now()}`,
        userId: 'admin',
        type: 'system_alert',
        title: 'Auto-Recovery Failed',
        message: `Failed to recover ${action.service} after ${attemptNumber} attempts. Manual intervention required.`,
        data: { 
          action: action.name, 
          service: action.service, 
          attempts: attemptNumber 
        },
        priority: 'urgent',
        createdAt: new Date()
      })
    }
  }

  // Predefined recovery actions
  static createDefaultRecoveryActions(): RecoveryAction[] {
    return [
      {
        id: 'restart_redis_connection',
        name: 'Restart Redis Connection',
        description: 'Attempts to reconnect to Redis when connection is lost',
        service: 'redis',
        condition: (status) => status.status === 'unhealthy' && status.error?.includes('connection'),
        action: async () => {
          try {
            // This would typically restart the Redis connection pool
            // For now, we'll simulate a restart attempt
            await new Promise(resolve => setTimeout(resolve, 1000))
            return Math.random() > 0.3 // 70% success rate simulation
          } catch {
            return false
          }
        },
        cooldown: 5 * 60 * 1000, // 5 minutes
        maxAttempts: 3
      },
      {
        id: 'clear_memory_cache',
        name: 'Clear Memory Cache',
        description: 'Clears application memory cache when memory usage is high',
        service: 'system_resources',
        condition: (status) => {
          const memoryPercentage = status.metadata?.memory?.percentage
          return status.status === 'degraded' && memoryPercentage > 80
        },
        action: async () => {
          try {
            // Force garbage collection if available
            if (global.gc) {
              global.gc()
            }
            
            // Clear any application-level caches
            // This would be implemented based on your caching strategy
            
            return true
          } catch {
            return false
          }
        },
        cooldown: 10 * 60 * 1000, // 10 minutes
        maxAttempts: 2
      },
      {
        id: 'fallback_to_backup_api',
        name: 'Switch to Backup API',
        description: 'Switches to backup API endpoint when primary fails',
        service: 'external_api_openai',
        condition: (status) => status.status === 'unhealthy' && status.metadata?.critical,
        action: async () => {
          try {
            // This would implement API endpoint switching logic
            // For now, we'll simulate the switch
            console.log('Switching to backup API endpoint...')
            return true
          } catch {
            return false
          }
        },
        cooldown: 2 * 60 * 1000, // 2 minutes
        maxAttempts: 5
      },
      {
        id: 'restart_database_connection',
        name: 'Restart Database Connection',
        description: 'Attempts to restart database connection pool',
        service: 'database',
        condition: (status) => status.status === 'unhealthy' && status.responseTime && status.responseTime > 5000,
        action: async () => {
          try {
            // This would restart the database connection pool
            // Implementation depends on your database client
            await new Promise(resolve => setTimeout(resolve, 2000))
            return Math.random() > 0.2 // 80% success rate simulation
          } catch {
            return false
          }
        },
        cooldown: 15 * 60 * 1000, // 15 minutes
        maxAttempts: 2
      }
    ]
  }

  getRecoveryHistory(actionId?: string): Map<string, RecoveryAttempt[]> | RecoveryAttempt[] {
    if (actionId) {
      return this.recoveryHistory.get(actionId) || []
    }
    return this.recoveryHistory
  }

  getRecoveryStats(): {
    totalAttempts: number
    successfulAttempts: number
    failedAttempts: number
    actionStats: Record<string, { attempts: number; successes: number }>
  } {
    let totalAttempts = 0
    let successfulAttempts = 0
    let failedAttempts = 0
    const actionStats: Record<string, { attempts: number; successes: number }> = {}

    for (const [actionId, attempts] of this.recoveryHistory) {
      const successes = attempts.filter(a => a.success).length
      const failures = attempts.length - successes

      totalAttempts += attempts.length
      successfulAttempts += successes
      failedAttempts += failures

      actionStats[actionId] = {
        attempts: attempts.length,
        successes
      }
    }

    return {
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      actionStats
    }
  }
}