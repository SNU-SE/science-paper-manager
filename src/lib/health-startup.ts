import { initializeHealthService, HealthServiceConfig } from '@/services/health'

let healthServiceStarted = false

export async function startHealthService(): Promise<void> {
  if (healthServiceStarted) {
    console.log('Health service already started')
    return
  }

  try {
    console.log('Initializing health service...')
    
    // Create configuration based on environment
    const config: HealthServiceConfig = {
      healthCheck: {
        database: {
          enabled: true,
          timeout: parseInt(process.env.HEALTH_CHECK_DB_TIMEOUT || '5000'),
          criticalQueries: [
            'SELECT 1',
            'SELECT COUNT(*) FROM papers LIMIT 1',
            'SELECT COUNT(*) FROM auth.users LIMIT 1'
          ]
        },
        redis: {
          enabled: !!process.env.REDIS_URL,
          timeout: parseInt(process.env.HEALTH_CHECK_REDIS_TIMEOUT || '3000')
        },
        externalAPIs: {
          enabled: process.env.HEALTH_CHECK_EXTERNAL_APIS !== 'false',
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
          ].filter(endpoint => {
            // Only include endpoints if we have API keys configured
            if (endpoint.name === 'openai' && !process.env.OPENAI_API_KEY) return false
            if (endpoint.name === 'anthropic' && !process.env.ANTHROPIC_API_KEY) return false
            return true
          })
        },
        system: {
          enabled: true,
          memoryThreshold: parseInt(process.env.HEALTH_CHECK_MEMORY_THRESHOLD || '80'),
          cpuThreshold: parseInt(process.env.HEALTH_CHECK_CPU_THRESHOLD || '80')
        }
      },
      autoRecovery: {
        enabled: process.env.AUTO_RECOVERY_ENABLED !== 'false',
        checkInterval: parseInt(process.env.AUTO_RECOVERY_CHECK_INTERVAL || '60000'), // 1 minute
        actions: [], // Will be populated with default actions
        alertThreshold: parseInt(process.env.AUTO_RECOVERY_ALERT_THRESHOLD || '3')
      },
      resourceMonitoring: {
        enabled: process.env.RESOURCE_MONITORING_ENABLED !== 'false',
        thresholds: {
          memory: {
            warning: parseInt(process.env.MEMORY_WARNING_THRESHOLD || '70'),
            critical: parseInt(process.env.MEMORY_CRITICAL_THRESHOLD || '85')
          },
          cpu: {
            warning: parseInt(process.env.CPU_WARNING_THRESHOLD || '70'),
            critical: parseInt(process.env.CPU_CRITICAL_THRESHOLD || '90')
          },
          eventLoop: {
            delayWarning: parseInt(process.env.EVENT_LOOP_DELAY_WARNING || '10'),
            delayCritical: parseInt(process.env.EVENT_LOOP_DELAY_CRITICAL || '50'),
            utilizationWarning: parseInt(process.env.EVENT_LOOP_UTIL_WARNING || '70'),
            utilizationCritical: parseInt(process.env.EVENT_LOOP_UTIL_CRITICAL || '90')
          }
        },
        interval: parseInt(process.env.RESOURCE_MONITORING_INTERVAL || '30000') // 30 seconds
      }
    }

    const healthService = initializeHealthService(config)
    await healthService.start()
    
    healthServiceStarted = true
    console.log('Health service started successfully')

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down health service...')
      await healthService.stop()
      healthServiceStarted = false
      process.exit(0)
    }

    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)
    
  } catch (error) {
    console.error('Failed to start health service:', error)
    // Don't throw - we want the app to continue even if health monitoring fails
  }
}

export function isHealthServiceStarted(): boolean {
  return healthServiceStarted
}

// Auto-start in production
if (process.env.NODE_ENV === 'production' && process.env.AUTO_START_HEALTH_SERVICE !== 'false') {
  startHealthService().catch(error => {
    console.error('Auto-start health service failed:', error)
  })
}