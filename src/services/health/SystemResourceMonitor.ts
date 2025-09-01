import { NotificationService } from '../notifications/NotificationService'

export interface ResourceMetrics {
  timestamp: Date
  memory: {
    used: number
    total: number
    percentage: number
    heapUsed: number
    heapTotal: number
    external: number
  }
  cpu: {
    user: number
    system: number
    percentage: number
    loadAverage: number[]
  }
  process: {
    uptime: number
    pid: number
    version: string
    activeHandles: number
    activeRequests: number
  }
  eventLoop: {
    delay: number
    utilization: number
  }
}

export interface ResourceAlert {
  id: string
  type: 'memory' | 'cpu' | 'eventloop' | 'process'
  severity: 'warning' | 'critical'
  message: string
  value: number
  threshold: number
  timestamp: Date
  resolved?: Date
}

export interface ResourceThresholds {
  memory: {
    warning: number // percentage
    critical: number // percentage
  }
  cpu: {
    warning: number // percentage
    critical: number // percentage
  }
  eventLoop: {
    delayWarning: number // milliseconds
    delayCritical: number // milliseconds
    utilizationWarning: number // percentage
    utilizationCritical: number // percentage
  }
}

export class SystemResourceMonitor {
  private notificationService: NotificationService
  private thresholds: ResourceThresholds
  private intervalId: NodeJS.Timeout | null = null
  private metricsHistory: ResourceMetrics[] = []
  private activeAlerts: Map<string, ResourceAlert> = new Map()
  private monitoringInterval: number

  constructor(
    notificationService: NotificationService,
    thresholds: ResourceThresholds,
    monitoringInterval: number = 30000 // 30 seconds
  ) {
    this.notificationService = notificationService
    this.thresholds = thresholds
    this.monitoringInterval = monitoringInterval
  }

  start(): void {
    if (this.intervalId) {
      return
    }

    console.log('Starting system resource monitoring...')
    this.intervalId = setInterval(
      () => this.collectMetrics(),
      this.monitoringInterval
    )

    // Collect initial metrics
    this.collectMetrics()
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('System resource monitoring stopped')
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.gatherResourceMetrics()
      this.metricsHistory.push(metrics)

      // Keep only last 1000 metrics (about 8 hours at 30s intervals)
      if (this.metricsHistory.length > 1000) {
        this.metricsHistory.splice(0, this.metricsHistory.length - 1000)
      }

      // Check for threshold violations
      await this.checkThresholds(metrics)
    } catch (error) {
      console.error('Error collecting resource metrics:', error)
    }
  }

  private async gatherResourceMetrics(): Promise<ResourceMetrics> {
    const memoryUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    
    // Calculate memory percentage
    const totalSystemMemory = this.estimateSystemMemory()
    const processMemory = memoryUsage.rss
    const memoryPercentage = (processMemory / totalSystemMemory) * 100

    // Calculate CPU percentage (simplified)
    const cpuPercentage = this.calculateCPUPercentage(cpuUsage)

    // Get load average (Unix-like systems)
    const loadAverage = this.getLoadAverage()

    // Measure event loop delay
    const eventLoopDelay = await this.measureEventLoopDelay()
    const eventLoopUtilization = this.getEventLoopUtilization()

    return {
      timestamp: new Date(),
      memory: {
        used: processMemory,
        total: totalSystemMemory,
        percentage: memoryPercentage,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        percentage: cpuPercentage,
        loadAverage
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        version: process.version,
        activeHandles: (process as any)._getActiveHandles?.()?.length || 0,
        activeRequests: (process as any)._getActiveRequests?.()?.length || 0
      },
      eventLoop: {
        delay: eventLoopDelay,
        utilization: eventLoopUtilization
      }
    }
  }

  private estimateSystemMemory(): number {
    // This is a rough estimation - in production, you might want to use a library like 'os'
    // or system-specific commands to get actual system memory
    return 8 * 1024 * 1024 * 1024 // 8GB default estimation
  }

  private calculateCPUPercentage(cpuUsage: NodeJS.CpuUsage): number {
    // This is a simplified calculation
    // In practice, you'd want to compare with previous measurements
    const totalCPU = cpuUsage.user + cpuUsage.system
    return Math.min((totalCPU / 1000000) * 100, 100) // Convert to percentage, cap at 100%
  }

  private getLoadAverage(): number[] {
    try {
      const os = require('os')
      return os.loadavg()
    } catch {
      return [0, 0, 0] // Fallback for systems that don't support load average
    }
  }

  private async measureEventLoopDelay(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint()
      
      // Use setTimeout as fallback if setImmediate is not available (e.g., in test environments)
      const scheduleCallback = typeof setImmediate !== 'undefined' ? setImmediate : setTimeout
      
      scheduleCallback(() => {
        const delay = Number(process.hrtime.bigint() - start) / 1000000 // Convert to milliseconds
        resolve(delay)
      })
    })
  }

  private getEventLoopUtilization(): number {
    try {
      const { performance } = require('perf_hooks')
      if (performance.eventLoopUtilization) {
        const utilization = performance.eventLoopUtilization()
        return utilization.utilization * 100 // Convert to percentage
      }
    } catch {
      // Fallback if eventLoopUtilization is not available
    }
    return 0
  }

  private async checkThresholds(metrics: ResourceMetrics): Promise<void> {
    // Check memory thresholds
    await this.checkMemoryThresholds(metrics)
    
    // Check CPU thresholds
    await this.checkCPUThresholds(metrics)
    
    // Check event loop thresholds
    await this.checkEventLoopThresholds(metrics)
  }

  private async checkMemoryThresholds(metrics: ResourceMetrics): Promise<void> {
    const memoryPercentage = metrics.memory.percentage
    const alertId = 'memory_usage'

    if (memoryPercentage >= this.thresholds.memory.critical) {
      await this.triggerAlert({
        id: alertId,
        type: 'memory',
        severity: 'critical',
        message: `Critical memory usage: ${memoryPercentage.toFixed(1)}%`,
        value: memoryPercentage,
        threshold: this.thresholds.memory.critical,
        timestamp: metrics.timestamp
      })
    } else if (memoryPercentage >= this.thresholds.memory.warning) {
      await this.triggerAlert({
        id: alertId,
        type: 'memory',
        severity: 'warning',
        message: `High memory usage: ${memoryPercentage.toFixed(1)}%`,
        value: memoryPercentage,
        threshold: this.thresholds.memory.warning,
        timestamp: metrics.timestamp
      })
    } else {
      await this.resolveAlert(alertId)
    }
  }

  private async checkCPUThresholds(metrics: ResourceMetrics): Promise<void> {
    const cpuPercentage = metrics.cpu.percentage
    const alertId = 'cpu_usage'

    if (cpuPercentage >= this.thresholds.cpu.critical) {
      await this.triggerAlert({
        id: alertId,
        type: 'cpu',
        severity: 'critical',
        message: `Critical CPU usage: ${cpuPercentage.toFixed(1)}%`,
        value: cpuPercentage,
        threshold: this.thresholds.cpu.critical,
        timestamp: metrics.timestamp
      })
    } else if (cpuPercentage >= this.thresholds.cpu.warning) {
      await this.triggerAlert({
        id: alertId,
        type: 'cpu',
        severity: 'warning',
        message: `High CPU usage: ${cpuPercentage.toFixed(1)}%`,
        value: cpuPercentage,
        threshold: this.thresholds.cpu.warning,
        timestamp: metrics.timestamp
      })
    } else {
      await this.resolveAlert(alertId)
    }
  }

  private async checkEventLoopThresholds(metrics: ResourceMetrics): Promise<void> {
    const delay = metrics.eventLoop.delay
    const utilization = metrics.eventLoop.utilization

    // Check event loop delay
    const delayAlertId = 'eventloop_delay'
    if (delay >= this.thresholds.eventLoop.delayCritical) {
      await this.triggerAlert({
        id: delayAlertId,
        type: 'eventloop',
        severity: 'critical',
        message: `Critical event loop delay: ${delay.toFixed(1)}ms`,
        value: delay,
        threshold: this.thresholds.eventLoop.delayCritical,
        timestamp: metrics.timestamp
      })
    } else if (delay >= this.thresholds.eventLoop.delayWarning) {
      await this.triggerAlert({
        id: delayAlertId,
        type: 'eventloop',
        severity: 'warning',
        message: `High event loop delay: ${delay.toFixed(1)}ms`,
        value: delay,
        threshold: this.thresholds.eventLoop.delayWarning,
        timestamp: metrics.timestamp
      })
    } else {
      await this.resolveAlert(delayAlertId)
    }

    // Check event loop utilization
    const utilizationAlertId = 'eventloop_utilization'
    if (utilization >= this.thresholds.eventLoop.utilizationCritical) {
      await this.triggerAlert({
        id: utilizationAlertId,
        type: 'eventloop',
        severity: 'critical',
        message: `Critical event loop utilization: ${utilization.toFixed(1)}%`,
        value: utilization,
        threshold: this.thresholds.eventLoop.utilizationCritical,
        timestamp: metrics.timestamp
      })
    } else if (utilization >= this.thresholds.eventLoop.utilizationWarning) {
      await this.triggerAlert({
        id: utilizationAlertId,
        type: 'eventloop',
        severity: 'warning',
        message: `High event loop utilization: ${utilization.toFixed(1)}%`,
        value: utilization,
        threshold: this.thresholds.eventLoop.utilizationWarning,
        timestamp: metrics.timestamp
      })
    } else {
      await this.resolveAlert(utilizationAlertId)
    }
  }

  private async triggerAlert(alert: ResourceAlert): Promise<void> {
    const existingAlert = this.activeAlerts.get(alert.id)
    
    // Don't spam alerts - only send if this is a new alert or severity increased
    if (!existingAlert || existingAlert.severity !== alert.severity) {
      this.activeAlerts.set(alert.id, alert)
      
      await this.notificationService.sendNotification('admin', {
        id: `resource_alert_${alert.id}_${Date.now()}`,
        userId: 'admin',
        type: 'system_alert',
        title: `System Resource Alert - ${alert.type.toUpperCase()}`,
        message: alert.message,
        data: {
          alertType: alert.type,
          severity: alert.severity,
          value: alert.value,
          threshold: alert.threshold,
          timestamp: alert.timestamp
        },
        priority: alert.severity === 'critical' ? 'urgent' : 'high',
        createdAt: new Date()
      })

      console.warn(`Resource alert triggered: ${alert.message}`)
    }
  }

  private async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId)
    if (alert) {
      alert.resolved = new Date()
      this.activeAlerts.delete(alertId)
      
      await this.notificationService.sendNotification('admin', {
        id: `resource_resolved_${alertId}_${Date.now()}`,
        userId: 'admin',
        type: 'system_recovery',
        title: `System Resource Alert Resolved - ${alert.type.toUpperCase()}`,
        message: `${alert.type} usage has returned to normal levels`,
        data: {
          alertType: alert.type,
          resolvedAt: alert.resolved,
          originalAlert: alert
        },
        priority: 'medium',
        createdAt: new Date()
      })

      console.info(`Resource alert resolved: ${alert.type}`)
    }
  }

  getCurrentMetrics(): ResourceMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null
  }

  getMetricsHistory(limit?: number): ResourceMetrics[] {
    if (limit) {
      return this.metricsHistory.slice(-limit)
    }
    return [...this.metricsHistory]
  }

  getActiveAlerts(): ResourceAlert[] {
    return Array.from(this.activeAlerts.values())
  }

  getResourceSummary(timeRange: number = 3600000): { // 1 hour default
    average: Partial<ResourceMetrics>
    peak: Partial<ResourceMetrics>
    alertCount: number
  } {
    const cutoff = new Date(Date.now() - timeRange)
    const recentMetrics = this.metricsHistory.filter(m => m.timestamp >= cutoff)
    
    if (recentMetrics.length === 0) {
      return {
        average: {},
        peak: {},
        alertCount: 0
      }
    }

    // Calculate averages
    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memory.percentage, 0) / recentMetrics.length
    const avgCPU = recentMetrics.reduce((sum, m) => sum + m.cpu.percentage, 0) / recentMetrics.length
    const avgEventLoopDelay = recentMetrics.reduce((sum, m) => sum + m.eventLoop.delay, 0) / recentMetrics.length

    // Find peaks
    const peakMemory = Math.max(...recentMetrics.map(m => m.memory.percentage))
    const peakCPU = Math.max(...recentMetrics.map(m => m.cpu.percentage))
    const peakEventLoopDelay = Math.max(...recentMetrics.map(m => m.eventLoop.delay))

    return {
      average: {
        memory: { percentage: avgMemory } as any,
        cpu: { percentage: avgCPU } as any,
        eventLoop: { delay: avgEventLoopDelay } as any
      },
      peak: {
        memory: { percentage: peakMemory } as any,
        cpu: { percentage: peakCPU } as any,
        eventLoop: { delay: peakEventLoopDelay } as any
      },
      alertCount: this.activeAlerts.size
    }
  }

  static getDefaultThresholds(): ResourceThresholds {
    return {
      memory: {
        warning: 70, // 70%
        critical: 85 // 85%
      },
      cpu: {
        warning: 70, // 70%
        critical: 90 // 90%
      },
      eventLoop: {
        delayWarning: 10, // 10ms
        delayCritical: 50, // 50ms
        utilizationWarning: 70, // 70%
        utilizationCritical: 90 // 90%
      }
    }
  }
}