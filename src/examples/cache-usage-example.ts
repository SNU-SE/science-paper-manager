/**
 * Example usage of the caching system
 * This demonstrates how to use the multi-layer caching system in your application
 */

import { getCacheService } from '../services/cache/CacheService'
import CacheMonitor from '../services/cache/CacheMonitor'
import { 
  cacheQuery, 
  cacheUserData, 
  cachePaperAnalysis,
  invalidateUserCache,
  CacheKeys,
  CacheTags,
  CacheTTL 
} from '../utils/cache'

// Initialize cache service and monitoring
const cacheService = getCacheService()
const cacheMonitor = new CacheMonitor(cacheService)

// Start monitoring (in production, you'd do this in your app initialization)
cacheMonitor.startMonitoring(60000) // Monitor every minute

/**
 * Example 1: Basic cache operations
 */
async function basicCacheExample() {
  console.log('=== Basic Cache Operations ===')
  
  // Set a value with TTL
  await cacheService.set('user:123:profile', {
    id: 123,
    name: 'John Doe',
    email: 'john@example.com'
  }, {
    ttl: CacheTTL.HOUR,
    tags: CacheTags.user('123')
  })
  
  // Get the value
  const userProfile = await cacheService.get('user:123:profile')
  console.log('Retrieved user profile:', userProfile)
  
  // Check cache stats
  const stats = cacheService.getStats()
  console.log('Cache stats:', stats)
}

/**
 * Example 2: Database query caching
 */
async function databaseQueryCacheExample() {
  console.log('=== Database Query Caching ===')
  
  // Simulate a database query function
  const fetchUserFromDB = async (userId: string) => {
    console.log(`Fetching user ${userId} from database...`)
    // Simulate database delay
    await new Promise(resolve => setTimeout(resolve, 100))
    return {
      id: userId,
      name: `User ${userId}`,
      email: `user${userId}@example.com`,
      createdAt: new Date()
    }
  }
  
  // First call - will hit database
  console.time('First call')
  const user1 = await cacheQuery(
    CacheKeys.user.profile('456'),
    () => fetchUserFromDB('456'),
    { ttl: CacheTTL.HOUR, tags: CacheTags.user('456') }
  )
  console.timeEnd('First call')
  console.log('User data:', user1)
  
  // Second call - will hit cache
  console.time('Second call')
  const user2 = await cacheQuery(
    CacheKeys.user.profile('456'),
    () => fetchUserFromDB('456'),
    { ttl: CacheTTL.HOUR, tags: CacheTags.user('456') }
  )
  console.timeEnd('Second call')
  console.log('User data (cached):', user2)
}

/**
 * Example 3: AI analysis result caching
 */
async function aiAnalysisCacheExample() {
  console.log('=== AI Analysis Caching ===')
  
  // Simulate AI analysis function
  const performAIAnalysis = async (paperId: string, provider: string) => {
    console.log(`Performing AI analysis for paper ${paperId} with ${provider}...`)
    await new Promise(resolve => setTimeout(resolve, 200))
    return {
      paperId,
      provider,
      summary: `AI-generated summary for paper ${paperId}`,
      score: Math.random(),
      keywords: ['machine learning', 'neural networks', 'deep learning'],
      analyzedAt: new Date()
    }
  }
  
  // Cache AI analysis result
  const analysisResult = await cachePaperAnalysis(
    'paper-789',
    'openai',
    () => performAIAnalysis('paper-789', 'openai')
  )
  
  console.log('AI Analysis Result:', analysisResult)
}

/**
 * Example 4: Cache invalidation patterns
 */
async function cacheInvalidationExample() {
  console.log('=== Cache Invalidation ===')
  
  // Set up some test data
  await cacheService.set('user:100:profile', { id: 100, name: 'Alice' }, {
    ttl: CacheTTL.HOUR,
    tags: ['user:100', 'users']
  })
  
  await cacheService.set('user:100:settings', { theme: 'dark' }, {
    ttl: CacheTTL.HOUR,
    tags: ['user:100', 'users']
  })
  
  await cacheService.set('user:101:profile', { id: 101, name: 'Bob' }, {
    ttl: CacheTTL.HOUR,
    tags: ['user:101', 'users']
  })
  
  console.log('Before invalidation:')
  console.log('User 100 profile:', await cacheService.get('user:100:profile'))
  console.log('User 100 settings:', await cacheService.get('user:100:settings'))
  console.log('User 101 profile:', await cacheService.get('user:101:profile'))
  
  // Invalidate specific user's cache
  await invalidateUserCache('100')
  
  console.log('After invalidating user 100:')
  console.log('User 100 profile:', await cacheService.get('user:100:profile'))
  console.log('User 100 settings:', await cacheService.get('user:100:settings'))
  console.log('User 101 profile:', await cacheService.get('user:101:profile'))
  
  // Invalidate by pattern
  await cacheService.invalidatePattern('user:*:profile')
  
  console.log('After invalidating all profiles:')
  console.log('User 101 profile:', await cacheService.get('user:101:profile'))
}

/**
 * Example 5: Batch operations
 */
async function batchOperationsExample() {
  console.log('=== Batch Operations ===')
  
  // Set up multiple keys
  const users = [
    { id: '200', name: 'Charlie', email: 'charlie@example.com' },
    { id: '201', name: 'Diana', email: 'diana@example.com' },
    { id: '202', name: 'Eve', email: 'eve@example.com' }
  ]
  
  // Set multiple values
  for (const user of users) {
    await cacheService.set(`user:${user.id}:profile`, user, { ttl: CacheTTL.HOUR })
  }
  
  // Batch get multiple keys
  const keys = users.map(user => `user:${user.id}:profile`)
  const results = await cacheService.mget(keys)
  
  console.log('Batch get results:')
  results.forEach((value, key) => {
    console.log(`${key}:`, value)
  })
}

/**
 * Example 6: Cache monitoring and optimization
 */
async function monitoringExample() {
  console.log('=== Cache Monitoring ===')
  
  // Record some cache activity for monitoring
  cacheMonitor.recordKeyAccess('user:123:profile')
  cacheMonitor.recordKeyAccess('user:123:profile')
  cacheMonitor.recordKeyAccess('paper:456:analysis')
  cacheMonitor.recordResponseTime(25)
  cacheMonitor.recordResponseTime(30)
  cacheMonitor.recordResponseTime(45)
  
  // Get metrics
  const metrics = cacheMonitor.getMetrics()
  console.log('Cache Metrics:')
  console.log('- Hit Rate:', metrics.hitRate.toFixed(2) + '%')
  console.log('- Average Response Time:', metrics.averageResponseTime.toFixed(2) + 'ms')
  console.log('- Hot Keys:', metrics.hotKeys)
  console.log('- Recommendations:', metrics.recommendations)
  
  // Get health score
  const healthScore = cacheMonitor.getHealthScore()
  console.log('Cache Health Score:', healthScore + '%')
  
  // Get optimization suggestions
  const optimization = await cacheMonitor.optimizeCache()
  console.log('Optimization Suggestions:', optimization.recommendations)
}

/**
 * Example 7: Cache warm-up
 */
async function warmUpExample() {
  console.log('=== Cache Warm-up ===')
  
  const warmUpData = [
    {
      key: 'system:config:app',
      factory: async () => ({
        version: '1.0.0',
        features: ['ai-analysis', 'search', 'notifications'],
        maintenance: false
      }),
      options: { ttl: CacheTTL.DAY }
    },
    {
      key: 'system:stats:daily',
      factory: async () => ({
        users: 1250,
        papers: 5600,
        analyses: 890,
        date: new Date().toISOString().split('T')[0]
      }),
      options: { ttl: CacheTTL.HOUR }
    }
  ]
  
  await cacheService.warmUp(warmUpData)
  console.log('Cache warmed up successfully')
  
  // Verify warm-up data
  const appConfig = await cacheService.get('system:config:app')
  const dailyStats = await cacheService.get('system:stats:daily')
  
  console.log('App Config:', appConfig)
  console.log('Daily Stats:', dailyStats)
}

/**
 * Example 8: Health check
 */
async function healthCheckExample() {
  console.log('=== Health Check ===')
  
  const health = await cacheService.healthCheck()
  console.log('Cache Health:', health)
  
  if (health.status === 'healthy') {
    console.log('✅ Cache system is healthy')
  } else {
    console.log('❌ Cache system has issues:', health.details.error)
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    await basicCacheExample()
    console.log('\n')
    
    await databaseQueryCacheExample()
    console.log('\n')
    
    await aiAnalysisCacheExample()
    console.log('\n')
    
    await cacheInvalidationExample()
    console.log('\n')
    
    await batchOperationsExample()
    console.log('\n')
    
    await monitoringExample()
    console.log('\n')
    
    await warmUpExample()
    console.log('\n')
    
    await healthCheckExample()
    
  } catch (error) {
    console.error('Example error:', error)
  } finally {
    // Clean up
    cacheMonitor.stopMonitoring()
    await cacheService.clear()
    console.log('\n=== Examples completed ===')
  }
}

// Export for use in other files
export {
  basicCacheExample,
  databaseQueryCacheExample,
  aiAnalysisCacheExample,
  cacheInvalidationExample,
  batchOperationsExample,
  monitoringExample,
  warmUpExample,
  healthCheckExample,
  runAllExamples
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples()
}