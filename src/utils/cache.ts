// In-memory cache with TTL support
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }

  getStats(): {
    size: number
    keys: string[]
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clear()
  }
}

// Global cache instance
export const cache = new MemoryCache()

// Cache key generators
export const cacheKeys = {
  papers: (userId?: string) => `papers:${userId || 'all'}`,
  paper: (id: string) => `paper:${id}`,
  aiAnalysis: (paperId: string, provider: string) => `ai_analysis:${paperId}:${provider}`,
  searchResults: (query: string, filters?: any) => 
    `search:${query}:${JSON.stringify(filters || {})}`,
  ragResponse: (question: string, context?: string) => 
    `rag:${question}:${context || ''}`,
  userEvaluation: (paperId: string) => `evaluation:${paperId}`,
  zoteroSync: (userId?: string) => `zotero_sync:${userId || 'default'}`,
  dashboardStats: (userId?: string) => `dashboard_stats:${userId || 'default'}`,
  apiKeyValidation: (service: string, keyHash: string) => `api_key:${service}:${keyHash}`
}

// Cache TTL constants (in milliseconds)
export const cacheTTL = {
  papers: 5 * 60 * 1000,        // 5 minutes
  paper: 10 * 60 * 1000,        // 10 minutes
  aiAnalysis: 60 * 60 * 1000,   // 1 hour
  searchResults: 15 * 60 * 1000, // 15 minutes
  ragResponse: 30 * 60 * 1000,   // 30 minutes
  userEvaluation: 5 * 60 * 1000, // 5 minutes
  zoteroSync: 10 * 60 * 1000,    // 10 minutes
  dashboardStats: 5 * 60 * 1000, // 5 minutes
  apiKeyValidation: 24 * 60 * 60 * 1000 // 24 hours
}

// Cache middleware for API routes
export function withCache<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      // Try to get from cache first
      const cached = cache.get<T>(key)
      if (cached !== null) {
        resolve(cached)
        return
      }

      // Fetch fresh data
      const data = await fetchFn()
      
      // Store in cache
      cache.set(key, data, ttl)
      
      resolve(data)
    } catch (error) {
      reject(error)
    }
  })
}

// Cache invalidation helpers
export const invalidateCache = {
  papers: () => {
    const keys = cache.getStats().keys
    keys.forEach(key => {
      if (key.startsWith('papers:') || key.startsWith('paper:')) {
        cache.delete(key)
      }
    })
  },
  
  paper: (paperId: string) => {
    cache.delete(cacheKeys.paper(paperId))
    cache.delete(cacheKeys.userEvaluation(paperId))
    // Also invalidate papers list
    invalidateCache.papers()
  },
  
  aiAnalysis: (paperId: string, provider?: string) => {
    if (provider) {
      cache.delete(cacheKeys.aiAnalysis(paperId, provider))
    } else {
      // Invalidate all AI analyses for this paper
      const keys = cache.getStats().keys
      keys.forEach(key => {
        if (key.startsWith(`ai_analysis:${paperId}:`)) {
          cache.delete(key)
        }
      })
    }
  },
  
  search: () => {
    const keys = cache.getStats().keys
    keys.forEach(key => {
      if (key.startsWith('search:') || key.startsWith('rag:')) {
        cache.delete(key)
      }
    })
  },
  
  userEvaluation: (paperId: string) => {
    cache.delete(cacheKeys.userEvaluation(paperId))
    invalidateCache.papers() // Evaluations affect paper lists
  },
  
  dashboardStats: () => {
    const keys = cache.getStats().keys
    keys.forEach(key => {
      if (key.startsWith('dashboard_stats:')) {
        cache.delete(key)
      }
    })
  },
  
  all: () => {
    cache.clear()
  }
}

// Client-side cache for React Query
export const queryKeys = {
  papers: ['papers'] as const,
  paper: (id: string) => ['paper', id] as const,
  aiAnalyses: (paperId: string) => ['aiAnalyses', paperId] as const,
  searchResults: (query: string) => ['searchResults', query] as const,
  ragChat: ['ragChat'] as const,
  userEvaluations: ['userEvaluations'] as const,
  dashboardStats: ['dashboardStats'] as const,
  zoteroSync: ['zoteroSync'] as const,
  apiKeys: ['apiKeys'] as const
}

// React Query default options
export const queryOptions = {
  staleTime: 5 * 60 * 1000,     // 5 minutes
  cacheTime: 10 * 60 * 1000,    // 10 minutes
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  retry: 2
}