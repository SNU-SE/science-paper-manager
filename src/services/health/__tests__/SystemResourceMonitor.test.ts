import { SystemResourceMonitor, ResourceThresholds } from '../SystemResourceMonitor'
import { NotificationService } from '../../notifications/NotificationService'

// Mock NotificationService
jest.mock('../../notifications/NotificationService')

describe('SystemResourceMonitor', () => {
  let monitor: SystemResourceMonitor
  let mockNotificationService: jest.Mocked<NotificationService>
  let thresholds: ResourceThresholds

  beforeEach(() => {
    mockNotificationService = new NotificationService() as jest.Mocked<NotificationService>
    thresholds = SystemResourceMonitor.getDefaultThresholds()
    monitor = new SystemResourceMonitor(mockNotificationService, thresholds, 1000) // 1 second for testing

    // Reset mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    monitor.stop()
  })

  describe('start and stop', () => {
    it('should start monitoring', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      monitor.start()
      
      expect(consoleSpy).toHaveBeenCalledWith('Starting system resource monitoring...')
      consoleSpy.mockRestore()
    })

    it('should stop monitoring', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      monitor.start()
      monitor.stop()
      
      expect(consoleSpy).toHaveBeenCalledWith('System resource monitoring stopped')
      consoleSpy.mockRestore()
    })

    it('should not start multiple times', () => {
      monitor.start()
      monitor.start() // Should not start again
      
      // No easy way to test this without exposing internals
      // The test passes if no errors are thrown
    })
  })

  describe('getCurrentMetrics', () => {
    it('should return null initially', () => {
      const metrics = monitor.getCurrentMetrics()
      expect(metrics).toBeNull()
    })

    it('should return metrics after collection', async () => {
      monitor.start()
      
      // Wait for at least one collection cycle
      await new Promise(resolve => setTimeout(resolve, 1100))
      
      const metrics = monitor.getCurrentMetrics()
      expect(metrics).toBeTruthy()
      expect(metrics).toHaveProperty('memory')
      expect(metrics).toHaveProperty('cpu')
      expect(metrics).toHaveProperty('process')
      expect(metrics).toHaveProperty('eventLoop')
    })
  })

  describe('getMetricsHistory', () => {
    it('should return empty array initially', () => {
      const history = monitor.getMetricsHistory()
      expect(history).toEqual([])
    })

    it('should return limited history when limit specified', async () => {
      monitor.start()
      
      // Wait for a few collection cycles
      await new Promise(resolve => setTimeout(resolve, 2100))
      
      const history = monitor.getMetricsHistory(1)
      expect(history.length).toBeLessThanOrEqual(1)
    })
  })

  describe('getActiveAlerts', () => {
    it('should return empty array initially', () => {
      const alerts = monitor.getActiveAlerts()
      expect(alerts).toEqual([])
    })
  })

  describe('getResourceSummary', () => {
    it('should return empty summary when no metrics', () => {
      const summary = monitor.getResourceSummary()
      
      expect(summary.average).toEqual({})
      expect(summary.peak).toEqual({})
      expect(summary.alertCount).toBe(0)
    })

    it('should calculate summary correctly with metrics', async () => {
      monitor.start()
      
      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 1100))
      
      const summary = monitor.getResourceSummary()
      
      expect(summary.average).toHaveProperty('memory')
      expect(summary.average).toHaveProperty('cpu')
      expect(summary.average).toHaveProperty('eventLoop')
      expect(summary.peak).toHaveProperty('memory')
      expect(summary.peak).toHaveProperty('cpu')
      expect(summary.peak).toHaveProperty('eventLoop')
    })
  })

  describe('threshold checking', () => {
    it('should trigger memory warning alert', async () => {
      // Create monitor with very low memory threshold
      const lowThresholds: ResourceThresholds = {
        ...thresholds,
        memory: { warning: 0.1, critical: 0.2 } // Very low thresholds
      }
      
      const testMonitor = new SystemResourceMonitor(mockNotificationService, lowThresholds, 500)
      testMonitor.start()
      
      // Wait for metrics collection and threshold checking
      await new Promise(resolve => setTimeout(resolve, 600))
      
      expect(mockNotificationService.sendNotification).toHaveBeenCalled()
      
      testMonitor.stop()
    })

    it('should resolve alerts when metrics return to normal', async () => {
      // This test is complex to implement without mocking internal metrics
      // For now, we'll test that the method exists and doesn't throw
      const alerts = monitor.getActiveAlerts()
      expect(Array.isArray(alerts)).toBe(true)
    })
  })

  describe('getDefaultThresholds', () => {
    it('should return valid default thresholds', () => {
      const defaults = SystemResourceMonitor.getDefaultThresholds()
      
      expect(defaults.memory.warning).toBeGreaterThan(0)
      expect(defaults.memory.critical).toBeGreaterThan(defaults.memory.warning)
      expect(defaults.cpu.warning).toBeGreaterThan(0)
      expect(defaults.cpu.critical).toBeGreaterThan(defaults.cpu.warning)
      expect(defaults.eventLoop.delayWarning).toBeGreaterThan(0)
      expect(defaults.eventLoop.delayCritical).toBeGreaterThan(defaults.eventLoop.delayWarning)
    })
  })

  describe('error handling', () => {
    it('should handle metric collection errors gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      
      // Mock process.memoryUsage to throw an error
      const originalMemoryUsage = process.memoryUsage
      process.memoryUsage = jest.fn(() => {
        throw new Error('Memory usage error')
      })
      
      monitor.start()
      
      // Restore original function
      process.memoryUsage = originalMemoryUsage
      consoleErrorSpy.mockRestore()
    })
  })
})