import { getCacheService } from '../services/cache/CacheService'

/**
 * Cache utility functions for common caching patterns
 */

/**
 * Cache keys generator for different data types
 */
export const CacheKeys = {
  user: {
    profile: (userId: string) => `user:${userId}:profile`,
    settings: (userId: string) => `user:${userId}:settings`,
    apiKeys: (userId: string) => `user:${userId}:api-keys`,
    notifications: (userId: string) => `user:${userId}:notifications`,
    usage: (userId: string, date?: string) => 
      `user:${userId}:usage${date ? `:${date}` : ''}`
  },
  
  paper: {
    details: (paperId: string) => `paper:${paperId}:details`,
    analysis: (paperId: string, provider?: string) => 
      `paper:${paperId}:analysis${provider ? `:${provider}` : ''}`,
    metadata: (paperId: string) => `paper:${paperId}:metadata`,
    content: (paperId: string) => `paper:${paperId}:content`
  },
  
  search: {
    results: (query: string, filters?: string) => {
      const filterHash = filters ? `:${Buffer.from(filters).toString('base64')}` : ''
      return `search:${Buffer.from(query).toString('base64')}${filterHash}`
    },
    suggestions: (query: string) => `search:suggestions:${Buffer.from(query).toString('base64')}`,
    facets: (type: string) => `search:facets:${type}`
  },
  
  ai: {
    analysis: (paperId: string, provider: string) => `ai:analysis:${paperId}:${provider}`,
    batch: (batchId: string) => `ai:batch:${batchId}`,
    usage: (userId: string, provider: string, date: string) => 
      `ai:usage:${userId}:${provider}:${date}`
  },
  
  system: {
    health: (component: string) => `system:health:${component}`,
    metrics: (type: string, period: string) => `system:metrics:${type}:${period}`,
    config: (key: string) => `system:config:${key}`
  },
  
  api: {
    response: (endpoint: string, params: string) => 
      `api:response:${endpoint}:${Buffer.from(params).toString('base64')}`,
    usage: (userId: string, endpoint: string, date: string) => 
      `api:usage:${userId}:${endpoint}:${date}`
  }
}

/**
 * Cache tags for smart invalidation
 */
export const CacheTags = {
  user: (userId: string) => [`user:${userId}`, 'users'],
  paper: (paperId: string) => [`paper:${paperId}`, 'papers'],
  search: () => ['search'],
  ai: (provider?: string) => provider ? [`ai:${provider}`, 'ai'] : ['ai'],
  system: () => ['system'],
  api: (endpoint: string) => [`api:${endpoint}`, 'api']
}

/**
 * Common TTL values (in seconds)
 */
export const CacheTTL = {
  SHORT: 60,           // 1 minute
  MEDIUM: 300,         // 5 minutes
  LONG: 1800,          // 30 minutes
  HOUR: 3600,          // 1 hour
  DAY: 86400,          // 24 hours
  WEEK: 604800,        // 7 days
  MONTH: 2592000       // 30 days
}

/**
 * Cache wrapper for database queries
 */
export async function cacheQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  options: {
    ttl?: number
    tags?: string[]
    compress?: boolean
  } = {}
): Promise<T> {
  const cacheService = getCacheService()
  
  return cacheService.getOrSet(key, queryFn, {
    ttl: options.ttl || CacheTTL.MEDIUM,
    tags: options.tags,
    compress: options.compress
  })
}

/**
 * Cache wrapper for API calls
 */
export async function cacheApiCall<T>(
  endpoint: string,
  params: Record<string, any>,
  apiFn: () => Promise<T>,
  options: {
    ttl?: number
    userId?: string
  } = {}
): Promise<T> {
  const cacheService = getCacheService()
  const paramsString = JSON.stringify(params)
  const key = CacheKeys.api.response(endpoint, paramsString)
  
  return cacheService.getOrSet(key, apiFn, {
    ttl: options.ttl || CacheTTL.SHORT,
    tags: CacheTags.api(endpoint)
  })
}

/**
 * Cache user-specific data
 */
export async function cacheUserData<T>(
  userId: string,
  dataType: string,
  dataFn: () => Promise<T>,
  ttl: number = CacheTTL.HOUR
): Promise<T> {
  const cacheService = getCacheService()
  const key = `user:${userId}:${dataType}`
  
  return cacheService.getOrSet(key, dataFn, {
    ttl,
    tags: CacheTags.user(userId)
  })
}

/**
 * Cache paper analysis results
 */
export async function cachePaperAnalysis<T>(
  paperId: string,
  provider: string,
  analysisFn: () => Promise<T>
): Promise<T> {
  const cacheService = getCacheService()
  const key = CacheKeys.ai.analysis(paperId, provider)
  
  return cacheService.getOrSet(key, analysisFn, {
    ttl: CacheTTL.DAY,
    tags: [...CacheTags.paper(paperId), ...CacheTags.ai(provider)],
    compress: true
  })
}

/**
 * Cache search results
 */
export async function cacheSearchResults<T>(
  query: string,
  filters: Record<string, any>,
  searchFn: () => Promise<T>,
  ttl: number = CacheTTL.MEDIUM
): Promise<T> {
  const cacheService = getCacheService()
  const filtersString = JSON.stringify(filters)
  const key = CacheKeys.search.results(query, filtersString)
  
  return cacheService.getOrSet(key, searchFn, {
    ttl,
    tags: CacheTags.search()
  })
}

/**
 * Invalidate user-related caches
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  const cacheService = getCacheService()
  await cacheService.invalidateByTags(CacheTags.user(userId))
}

/**
 * Invalidate paper-related caches
 */
export async function invalidatePaperCache(paperId: string): Promise<void> {
  const cacheService = getCacheService()
  await cacheService.invalidateByTags(CacheTags.paper(paperId))
}

/**
 * Invalidate search caches
 */
export async function invalidateSearchCache(): Promise<void> {
  const cacheService = getCacheService()
  await cacheService.invalidateByTags(CacheTags.search())
}

/**
 * Warm up commonly accessed data
 */
export async function warmUpCache(): Promise<void> {
  const cacheService = getCacheService()
  
  const warmUpData = [
    {
      key: CacheKeys.system.config('app'),
      factory: async () => ({
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }),
      options: { ttl: CacheTTL.HOUR }
    },
    {
      key: CacheKeys.search.facets('journals'),
      factory: async () => {
        // This would typically fetch from database
        return ['Nature', 'Science', 'Cell', 'PNAS']
      },
      options: { ttl: CacheTTL.DAY }
    }
  ]
  
  await cacheService.warmUp(warmUpData)
}

/**
 * Cache decorator for class methods
 */
export function CacheResult(options: {
  keyGenerator: (...args: any[]) => string
  ttl?: number
  tags?: string[]
}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    
    descriptor.value = async function (...args: any[]) {
      const cacheService = getCacheService()
      const key = options.keyGenerator(...args)
      
      const cached = await cacheService.get(key)
      if (cached !== null) {
        return cached
      }
      
      const result = await method.apply(this, args)
      
      await cacheService.set(key, result, {
        ttl: options.ttl || CacheTTL.MEDIUM,
        tags: options.tags
      })
      
      return result
    }
    
    return descriptor
  }
}

/**
 * Batch cache operations for better performance
 */
export async function batchCacheGet<T>(
  keys: string[]
): Promise<Map<string, T | null>> {
  const cacheService = getCacheService()
  return cacheService.mget<T>(keys)
}

/**
 * Cache health utilities
 */
export async function getCacheHealth(): Promise<{
  status: 'healthy' | 'unhealthy'
  metrics: any
  recommendations: string[]
}> {
  const cacheService = getCacheService()
  const health = await cacheService.healthCheck()
  const stats = cacheService.getStats()
  
  const recommendations: string[] = []
  const hitRate = stats.hits + stats.misses > 0 
    ? (stats.hits / (stats.hits + stats.misses)) * 100 
    : 0
  
  if (hitRate < 70) {
    recommendations.push('Consider reviewing cache TTL settings')
  }
  
  if (stats.memoryUsage > 100 * 1024 * 1024) { // 100MB
    recommendations.push('High memory usage - consider cache cleanup')
  }
  
  return {
    status: health.status,
    metrics: {
      ...stats,
      hitRate: hitRate.toFixed(2) + '%'
    },
    recommendations
  }
}

/**
 * Cache debugging utilities
 */
export const CacheDebug = {
  async inspectKey(key: string): Promise<{
    exists: boolean
    value?: any
    size?: number
    ttl?: number
  }> {
    const cacheService = getCacheService()
    const value = await cacheService.get(key)
    
    return {
      exists: value !== null,
      value: value,
      size: value ? JSON.stringify(value).length : 0
    }
  },
  
  async listKeys(pattern: string = '*'): Promise<string[]> {
    // This would need Redis KEYS command - implement based on your Redis setup
    return []
  },
  
  getStats() {
    const cacheService = getCacheService()
    return cacheService.getStats()
  }
}

export default {
  CacheKeys,
  CacheTags,
  CacheTTL,
  cacheQuery,
  cacheApiCall,
  cacheUserData,
  cachePaperAnalysis,
  cacheSearchResults,
  invalidateUserCache,
  invalidatePaperCache,
  invalidateSearchCache,
  warmUpCache,
  CacheResult,
  batchCacheGet,
  getCacheHealth,
  CacheDebug
}