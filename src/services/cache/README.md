# Caching System

A comprehensive multi-layer caching system with Redis backend, local memory cache, performance monitoring, and smart invalidation capabilities.

## Features

- **Multi-layer Caching**: L1 (local memory) + L2 (Redis) for optimal performance
- **Smart Compression**: Automatic compression for large values
- **Cache Tags**: Tag-based invalidation for related data
- **Pattern Matching**: Wildcard-based cache invalidation
- **Performance Monitoring**: Real-time metrics and health scoring
- **Batch Operations**: Efficient multi-key operations
- **Cache Warm-up**: Pre-populate cache with commonly accessed data
- **Health Checks**: Built-in diagnostics and recovery
- **TTL Management**: Flexible time-to-live configurations

## Quick Start

### Basic Usage

```typescript
import { getCacheService } from './services/cache/CacheService'

const cacheService = getCacheService()

// Set a value
await cacheService.set('user:123', { name: 'John Doe' }, { ttl: 3600 })

// Get a value
const user = await cacheService.get('user:123')

// Delete a value
await cacheService.delete('user:123')
```

### Using Utility Functions

```typescript
import { cacheQuery, CacheKeys, CacheTTL } from './utils/cache'

// Cache database query results
const userData = await cacheQuery(
  CacheKeys.user.profile('123'),
  () => fetchUserFromDatabase('123'),
  { ttl: CacheTTL.HOUR }
)
```

### Cache Invalidation

```typescript
import { invalidateUserCache } from './utils/cache'

// Invalidate all user-related cache
await invalidateUserCache('123')

// Invalidate by pattern
await cacheService.invalidatePattern('user:*:profile')

// Invalidate by tags
await cacheService.invalidateByTags(['users', 'profiles'])
```

## Architecture

### Multi-Layer Design

```
┌─────────────────┐
│   Application   │
└─────────────────┘
         │
┌─────────────────┐
│  Cache Service  │
└─────────────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│  L1   │ │  L2   │
│ Local │ │ Redis │
│Memory │ │       │
└───────┘ └───────┘
```

### Cache Flow

1. **GET Request**: Check L1 → Check L2 → Return null if not found
2. **SET Request**: Store in L1 → Store in L2 → Handle tags/compression
3. **DELETE Request**: Remove from L1 → Remove from L2

## Configuration

### Environment Variables

```bash
# Redis connection
REDIS_URL=redis://localhost:6379

# Cache settings (optional)
CACHE_DEFAULT_TTL=3600
CACHE_COMPRESSION_THRESHOLD=1024
CACHE_LOCAL_MAX_SIZE=1000
CACHE_LOCAL_TTL=300000
```

### Cache Patterns

The system includes predefined cache patterns with automatic TTL:

```typescript
const patterns = {
  'user:*:profile': { ttl: 3600 },      // 1 hour
  'paper:*:analysis': { ttl: 86400 },   // 24 hours
  'search:*': { ttl: 1800 },            // 30 minutes
  'api:*:usage': { ttl: 300 },          // 5 minutes
}
```

## API Reference

### CacheService

#### Core Methods

```typescript
// Get value from cache
get<T>(key: string): Promise<T | null>

// Set value in cache
set<T>(key: string, value: T, options?: CacheOptions): Promise<void>

// Delete value from cache
delete(key: string): Promise<boolean>

// Get or set pattern
getOrSet<T>(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T>
```

#### Batch Operations

```typescript
// Batch get multiple keys
mget<T>(keys: string[]): Promise<Map<string, T | null>>

// Batch set multiple keys
mset(entries: Array<{key: string, value: any, options?: CacheOptions}>): Promise<void>
```

#### Invalidation

```typescript
// Invalidate by pattern
invalidatePattern(pattern: string): Promise<number>

// Invalidate by tags
invalidateByTags(tags: string[]): Promise<number>

// Clear all cache
clear(): Promise<void>
```

#### Monitoring

```typescript
// Get cache statistics
getStats(): CacheStats

// Health check
healthCheck(): Promise<{status: 'healthy' | 'unhealthy', details: any}>

// Warm up cache
warmUp(data: WarmUpData[]): Promise<void>
```

### CacheOptions

```typescript
interface CacheOptions {
  ttl?: number          // Time to live in seconds
  localTtl?: number     // Local cache TTL in milliseconds
  compress?: boolean    // Force compression
  tags?: string[]       // Cache tags for invalidation
}
```

### Cache Monitoring

```typescript
import CacheMonitor from './services/cache/CacheMonitor'

const monitor = new CacheMonitor(cacheService)
monitor.startMonitoring(60000) // Monitor every minute

// Get performance metrics
const metrics = monitor.getMetrics()
console.log('Hit rate:', metrics.hitRate)
console.log('Hot keys:', metrics.hotKeys)

// Get health score (0-100)
const score = monitor.getHealthScore()

// Get optimization recommendations
const optimization = await monitor.optimizeCache()
```

## Utility Functions

### Cache Keys

Predefined key generators for consistent naming:

```typescript
import { CacheKeys } from './utils/cache'

const userProfileKey = CacheKeys.user.profile('123')
const paperAnalysisKey = CacheKeys.paper.analysis('456', 'openai')
const searchResultsKey = CacheKeys.search.results('machine learning')
```

### Cache Tags

Predefined tags for smart invalidation:

```typescript
import { CacheTags } from './utils/cache'

const userTags = CacheTags.user('123')        // ['user:123', 'users']
const paperTags = CacheTags.paper('456')      // ['paper:456', 'papers']
const aiTags = CacheTags.ai('openai')         // ['ai:openai', 'ai']
```

### TTL Constants

```typescript
import { CacheTTL } from './utils/cache'

CacheTTL.SHORT   // 60 seconds
CacheTTL.MEDIUM  // 5 minutes
CacheTTL.LONG    // 30 minutes
CacheTTL.HOUR    // 1 hour
CacheTTL.DAY     // 24 hours
CacheTTL.WEEK    // 7 days
CacheTTL.MONTH   // 30 days
```

### Helper Functions

```typescript
// Cache database queries
await cacheQuery(key, queryFunction, options)

// Cache user-specific data
await cacheUserData(userId, dataType, dataFunction, ttl)

// Cache AI analysis results
await cachePaperAnalysis(paperId, provider, analysisFunction)

// Cache search results
await cacheSearchResults(query, filters, searchFunction, ttl)
```

## Middleware Integration

### API Route Caching

```typescript
import { cacheMiddleware } from './middleware/cacheMiddleware'

export const GET = cacheMiddleware({
  ttl: 300,
  tags: ['api', 'papers'],
  varyBy: ['authorization']
})(async (req) => {
  // Your API logic here
  return NextResponse.json(data)
})
```

### Cache Invalidation Middleware

```typescript
import { cacheInvalidationMiddleware } from './middleware/cacheMiddleware'

export const POST = cacheInvalidationMiddleware(['papers:*', 'search:*'])(
  async (req) => {
    // Your API logic here
    return NextResponse.json(result)
  }
)
```

## Performance Optimization

### Best Practices

1. **Use appropriate TTL values** based on data volatility
2. **Implement cache tags** for efficient invalidation
3. **Monitor hit rates** and adjust cache sizes accordingly
4. **Use batch operations** for multiple keys
5. **Enable compression** for large values
6. **Warm up cache** with frequently accessed data

### Monitoring Metrics

- **Hit Rate**: Percentage of cache hits vs total requests
- **Response Time**: Average cache operation time
- **Memory Usage**: Local cache memory consumption
- **Hot Keys**: Most frequently accessed keys
- **Error Rate**: Cache operation failures

### Optimization Strategies

1. **Increase local cache size** for high hit rates
2. **Adjust TTL values** based on access patterns
3. **Use cache warming** for predictable data
4. **Implement cache hierarchies** for different data types
5. **Monitor and alert** on performance degradation

## API Endpoints

### Cache Management API

```
GET    /api/cache              # Get cache overview
GET    /api/cache?action=stats # Get cache statistics
GET    /api/cache?action=health # Get health status
POST   /api/cache              # Cache operations (set, delete, etc.)
DELETE /api/cache              # Clear cache or patterns
```

### Cache Keys API

```
GET    /api/cache/keys         # List cache keys
DELETE /api/cache/keys         # Delete specific keys
```

## Dashboard

Access the cache dashboard at `/admin/cache` to:

- Monitor real-time performance metrics
- View cache health and alerts
- Analyze hot keys and usage patterns
- Get optimization recommendations
- Manage cache operations

## Testing

### Unit Tests

```bash
npm test -- --testPathPatterns="cache"
```

### Integration Tests

```bash
npm test -- --testPathPatterns="cache/integration"
```

### Performance Tests

```bash
npm run test:performance -- cache
```

## Troubleshooting

### Common Issues

1. **Low Hit Rate**
   - Check TTL settings
   - Verify cache key consistency
   - Review invalidation patterns

2. **High Memory Usage**
   - Reduce local cache size
   - Enable compression
   - Implement cache eviction

3. **Redis Connection Issues**
   - Check Redis server status
   - Verify connection string
   - Review network connectivity

4. **Performance Degradation**
   - Monitor response times
   - Check for hot keys
   - Review cache distribution

### Debug Mode

Enable debug logging:

```typescript
process.env.CACHE_DEBUG = 'true'
```

### Health Checks

The system provides comprehensive health checks:

```typescript
const health = await cacheService.healthCheck()
if (health.status === 'unhealthy') {
  console.error('Cache issues:', health.details)
}
```

## Examples

See `src/examples/cache-usage-example.ts` for comprehensive usage examples including:

- Basic cache operations
- Database query caching
- AI analysis result caching
- Cache invalidation patterns
- Batch operations
- Monitoring and optimization
- Cache warm-up strategies
- Health checks

## Contributing

When adding new cache functionality:

1. Follow the existing patterns for key naming
2. Add appropriate tests
3. Update documentation
4. Consider performance implications
5. Add monitoring metrics if needed

## License

This caching system is part of the Science Paper Manager project.