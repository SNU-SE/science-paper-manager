import { NextRequest, NextResponse } from 'next/server'
import { getCacheService } from '../services/cache/CacheService'
import crypto from 'crypto'

export interface CacheMiddlewareOptions {
  ttl?: number
  tags?: string[]
  keyGenerator?: (req: NextRequest) => string
  shouldCache?: (req: NextRequest, res: NextResponse) => boolean
  varyBy?: string[] // Headers to include in cache key
  compress?: boolean
  skipCache?: boolean
}

export interface CachedResponse {
  status: number
  headers: Record<string, string>
  body: any
  timestamp: number
}

/**
 * Cache middleware for API routes
 */
export function cacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const cacheService = getCacheService()
  
  return async function middleware(
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    // Skip caching for non-GET requests by default
    if (req.method !== 'GET' && !options.shouldCache) {
      return handler(req)
    }

    // Skip if explicitly disabled
    if (options.skipCache) {
      return handler(req)
    }

    const cacheKey = options.keyGenerator 
      ? options.keyGenerator(req)
      : generateCacheKey(req, options.varyBy)

    try {
      // Try to get from cache first
      const cached = await cacheService.get<CachedResponse>(cacheKey)
      
      if (cached && !isCacheExpired(cached, options.ttl)) {
        // Return cached response
        const response = new NextResponse(
          cached.body ? JSON.stringify(cached.body) : null,
          {
            status: cached.status,
            headers: {
              ...cached.headers,
              'X-Cache': 'HIT',
              'X-Cache-Key': cacheKey
            }
          }
        )
        
        return response
      }

      // Cache miss - execute handler
      const response = await handler(req)
      
      // Check if we should cache this response
      if (shouldCacheResponse(req, response, options)) {
        const responseData = await extractResponseData(response)
        
        const cacheData: CachedResponse = {
          status: response.status,
          headers: extractCacheableHeaders(response),
          body: responseData,
          timestamp: Date.now()
        }

        // Cache the response
        await cacheService.set(cacheKey, cacheData, {
          ttl: options.ttl || 300, // Default 5 minutes
          tags: options.tags,
          compress: options.compress
        })

        // Add cache headers to response
        response.headers.set('X-Cache', 'MISS')
        response.headers.set('X-Cache-Key', cacheKey)
      }

      return response
    } catch (error) {
      console.error('Cache middleware error:', error)
      // On cache error, proceed without caching
      return handler(req)
    }
  }
}

/**
 * Generate cache key based on request
 */
function generateCacheKey(req: NextRequest, varyBy?: string[]): string {
  const url = new URL(req.url)
  const baseKey = `api:${req.method}:${url.pathname}`
  
  const keyComponents = [baseKey]
  
  // Include query parameters
  const sortedParams = Array.from(url.searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
  
  if (sortedParams.length > 0) {
    const queryString = sortedParams
      .map(([key, value]) => `${key}=${value}`)
      .join('&')
    keyComponents.push(`query:${queryString}`)
  }
  
  // Include specified headers
  if (varyBy && varyBy.length > 0) {
    const headerValues = varyBy
      .map(header => `${header}:${req.headers.get(header) || ''}`)
      .join('|')
    keyComponents.push(`headers:${headerValues}`)
  }
  
  // Include user context if available
  const userId = req.headers.get('x-user-id') || req.headers.get('authorization')
  if (userId) {
    const userHash = crypto.createHash('md5').update(userId).digest('hex').substring(0, 8)
    keyComponents.push(`user:${userHash}`)
  }
  
  const fullKey = keyComponents.join(':')
  
  // Hash long keys to keep them manageable
  if (fullKey.length > 200) {
    return `hashed:${crypto.createHash('sha256').update(fullKey).digest('hex')}`
  }
  
  return fullKey
}

/**
 * Check if cached response is expired
 */
function isCacheExpired(cached: CachedResponse, ttl?: number): boolean {
  if (!ttl) return false
  
  const age = (Date.now() - cached.timestamp) / 1000
  return age > ttl
}

/**
 * Determine if response should be cached
 */
function shouldCacheResponse(
  req: NextRequest, 
  res: NextResponse, 
  options: CacheMiddlewareOptions
): boolean {
  // Use custom logic if provided
  if (options.shouldCache) {
    return options.shouldCache(req, res)
  }
  
  // Default caching rules
  if (res.status !== 200) {
    return false
  }
  
  // Don't cache responses with certain headers
  if (res.headers.get('cache-control')?.includes('no-cache')) {
    return false
  }
  
  if (res.headers.get('cache-control')?.includes('private')) {
    return false
  }
  
  // Don't cache very large responses by default
  const contentLength = res.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > 1024 * 1024) { // 1MB
    return false
  }
  
  return true
}

/**
 * Extract response data for caching
 */
async function extractResponseData(response: NextResponse): Promise<any> {
  const contentType = response.headers.get('content-type') || ''
  
  if (contentType.includes('application/json')) {
    try {
      const text = await response.text()
      return text ? JSON.parse(text) : null
    } catch {
      return null
    }
  }
  
  if (contentType.includes('text/')) {
    return await response.text()
  }
  
  // For other content types, don't cache the body
  return null
}

/**
 * Extract headers that should be cached
 */
function extractCacheableHeaders(response: NextResponse): Record<string, string> {
  const cacheableHeaders = [
    'content-type',
    'content-encoding',
    'etag',
    'last-modified'
  ]
  
  const headers: Record<string, string> = {}
  
  cacheableHeaders.forEach(header => {
    const value = response.headers.get(header)
    if (value) {
      headers[header] = value
    }
  })
  
  return headers
}

/**
 * Cache invalidation middleware
 */
export function cacheInvalidationMiddleware(patterns: string[] | ((req: NextRequest) => string[])) {
  const cacheService = getCacheService()
  
  return async function middleware(
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const response = await handler(req)
    
    // Only invalidate on successful mutations
    if (response.status >= 200 && response.status < 300 && req.method !== 'GET') {
      try {
        const invalidationPatterns = typeof patterns === 'function' 
          ? patterns(req) 
          : patterns
        
        for (const pattern of invalidationPatterns) {
          await cacheService.invalidatePattern(pattern)
        }
      } catch (error) {
        console.error('Cache invalidation error:', error)
      }
    }
    
    return response
  }
}

/**
 * Decorator for caching function results
 */
export function cached<T extends (...args: any[]) => Promise<any>>(
  options: {
    keyGenerator: (...args: Parameters<T>) => string
    ttl?: number
    tags?: string[]
  }
) {
  const cacheService = getCacheService()
  
  return function decorator(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function (...args: Parameters<T>) {
      const cacheKey = options.keyGenerator(...args)
      
      // Try cache first
      const cached = await cacheService.get(cacheKey)
      if (cached !== null) {
        return cached
      }
      
      // Execute original method
      const result = await originalMethod.apply(this, args)
      
      // Cache result
      await cacheService.set(cacheKey, result, {
        ttl: options.ttl,
        tags: options.tags
      })
      
      return result
    }
    
    return descriptor
  }
}

/**
 * Helper to create cache-aware API handler
 */
export function withCache<T extends (req: NextRequest) => Promise<NextResponse>>(
  handler: T,
  options: CacheMiddlewareOptions = {}
): T {
  const middleware = cacheMiddleware(options)
  
  return (async (req: NextRequest) => {
    return middleware(req, handler)
  }) as T
}

export default cacheMiddleware