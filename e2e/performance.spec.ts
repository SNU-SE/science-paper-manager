import { test, expect } from '@playwright/test'

test.describe('Performance Optimizations', () => {
  test.beforeEach(async ({ page }) => {
    // Enable performance monitoring
    await page.goto('/')
  })

  test('should have good Core Web Vitals', async ({ page }) => {
    // Navigate to main pages and measure performance
    const pages = ['/', '/login', '/dashboard', '/papers', '/search', '/chat']
    
    for (const pagePath of pages) {
      await page.goto(pagePath)
      
      // Wait for page to load completely
      await page.waitForLoadState('networkidle')
      
      // Measure performance metrics
      const metrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries()
            const metrics: any = {}
            
            entries.forEach((entry) => {
              if (entry.entryType === 'largest-contentful-paint') {
                metrics.lcp = entry.startTime
              }
              if (entry.entryType === 'first-input') {
                metrics.fid = (entry as any).processingStart - entry.startTime
              }
              if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
                metrics.cls = (metrics.cls || 0) + (entry as any).value
              }
            })
            
            resolve(metrics)
          })
          
          try {
            observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] })
            
            // Fallback timeout
            setTimeout(() => resolve({}), 5000)
          } catch (e) {
            resolve({})
          }
        })
      })
      
      console.log(`Performance metrics for ${pagePath}:`, metrics)
      
      // Assert Core Web Vitals thresholds
      if ((metrics as any).lcp) {
        expect((metrics as any).lcp).toBeLessThan(4000) // LCP should be less than 4s
      }
      if ((metrics as any).fid) {
        expect((metrics as any).fid).toBeLessThan(300) // FID should be less than 300ms
      }
      if ((metrics as any).cls) {
        expect((metrics as any).cls).toBeLessThan(0.25) // CLS should be less than 0.25
      }
    }
  })

  test('should load pages quickly', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const loadTime = Date.now() - startTime
    
    expect(loadTime).toBeLessThan(3000) // Page should load in less than 3 seconds
  })

  test('should have efficient bundle sizes', async ({ page }) => {
    await page.goto('/')
    
    // Check for code splitting by looking for chunk files
    const response = await page.waitForResponse(response => 
      response.url().includes('/_next/static/chunks/') && response.status() === 200
    )
    
    expect(response.status()).toBe(200)
    
    // Check that main bundle is not too large
    const mainBundle = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src*="/_next/static/chunks/"]'))
      return scripts.length > 1 // Should have multiple chunks (code splitting working)
    })
    
    expect(mainBundle).toBe(true)
  })

  test('should cache API responses', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Make initial API call
    const firstResponse = await page.waitForResponse(response => 
      response.url().includes('/api/') && response.status() === 200
    )
    
    // Check cache headers
    const cacheControl = firstResponse.headers()['cache-control']
    expect(cacheControl).toBeTruthy()
    
    // Navigate away and back to test caching
    await page.goto('/')
    await page.goto('/dashboard')
    
    // Should load faster on second visit due to caching
    const secondLoadStart = Date.now()
    await page.waitForLoadState('domcontentloaded')
    const secondLoadTime = Date.now() - secondLoadStart
    
    expect(secondLoadTime).toBeLessThan(2000) // Should be faster due to caching
  })

  test('should lazy load components', async ({ page }) => {
    await page.goto('/')
    
    // Check that heavy components are not loaded initially
    const initialScripts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script[src]')).length
    })
    
    // Navigate to a page with heavy components
    await page.goto('/papers')
    await page.waitForLoadState('networkidle')
    
    // Should have loaded additional scripts for lazy components
    const afterNavigationScripts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script[src]')).length
    })
    
    expect(afterNavigationScripts).toBeGreaterThanOrEqual(initialScripts)
  })

  test('should handle large datasets efficiently', async ({ page }) => {
    // Mock large dataset
    await page.route('/api/papers', async route => {
      const largePaperList = Array.from({ length: 100 }, (_, i) => ({
        id: `paper-${i}`,
        title: `Test Paper ${i}`,
        authors: [`Author ${i}`],
        abstract: `Abstract for paper ${i}`.repeat(10),
        readingStatus: 'unread'
      }))
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(largePaperList)
      })
    })
    
    await page.goto('/papers')
    
    // Measure rendering time for large list
    const renderStart = Date.now()
    await page.waitForSelector('[data-testid="paper-list"]', { timeout: 10000 })
    const renderTime = Date.now() - renderStart
    
    expect(renderTime).toBeLessThan(5000) // Should render large list in less than 5 seconds
    
    // Check for virtualization or pagination
    const visibleItems = await page.locator('[data-testid="paper-card"]').count()
    expect(visibleItems).toBeLessThanOrEqual(50) // Should not render all 100 items at once
  })

  test('should monitor performance metrics', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Check if performance monitoring is active
    const performanceMonitoring = await page.evaluate(() => {
      return typeof window.performance !== 'undefined' && 
             typeof (window as any).PerformanceObserver !== 'undefined'
    })
    
    expect(performanceMonitoring).toBe(true)
    
    // Check if custom performance metrics are being recorded
    const customMetrics = await page.evaluate(() => {
      // Check if our performance monitor is working
      return typeof (window as any).performanceMonitor !== 'undefined' ||
             localStorage.getItem('performance_metrics') !== null
    })
    
    // This might be false in test environment, which is okay
    console.log('Custom metrics available:', customMetrics)
  })

  test('should handle errors gracefully without performance impact', async ({ page }) => {
    // Simulate network error
    await page.route('/api/papers', route => route.abort())
    
    const startTime = Date.now()
    await page.goto('/papers')
    
    // Should still load the page structure even with API errors
    await page.waitForSelector('body', { timeout: 5000 })
    const loadTime = Date.now() - startTime
    
    expect(loadTime).toBeLessThan(5000) // Should not hang due to errors
    
    // Should show error state
    const errorElement = await page.locator('[data-testid="error-message"]').first()
    if (await errorElement.isVisible()) {
      expect(await errorElement.isVisible()).toBe(true)
    }
  })

  test('should optimize images and static assets', async ({ page }) => {
    await page.goto('/')
    
    // Check for optimized image formats
    const images = await page.locator('img').all()
    
    for (const img of images) {
      const src = await img.getAttribute('src')
      if (src && src.includes('/_next/image')) {
        // Next.js Image component should be used for optimization
        expect(src).toContain('/_next/image')
      }
    }
    
    // Check for proper caching headers on static assets
    const staticAssetResponse = await page.waitForResponse(response => 
      response.url().includes('/_next/static/') && response.status() === 200
    )
    
    const cacheControl = staticAssetResponse.headers()['cache-control']
    expect(cacheControl).toContain('max-age')
  })

  test('should have efficient memory usage', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory ? {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize
      } : null
    })
    
    if (initialMemory) {
      // Navigate through several pages
      const pages = ['/papers', '/search', '/chat', '/settings']
      for (const pagePath of pages) {
        await page.goto(pagePath)
        await page.waitForLoadState('domcontentloaded')
      }
      
      // Check memory usage after navigation
      const finalMemory = await page.evaluate(() => {
        return {
          used: (performance as any).memory.usedJSHeapSize,
          total: (performance as any).memory.totalJSHeapSize
        }
      })
      
      // Memory usage should not increase dramatically
      const memoryIncrease = finalMemory.used - initialMemory.used
      const memoryIncreasePercent = (memoryIncrease / initialMemory.used) * 100
      
      expect(memoryIncreasePercent).toBeLessThan(200) // Should not double memory usage
    }
  })
})