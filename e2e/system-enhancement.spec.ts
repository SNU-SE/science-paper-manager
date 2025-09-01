/**
 * End-to-End Tests for System Enhancement Features
 * 
 * Comprehensive E2E tests that verify the complete user workflows
 * for all system enhancement features including background processing,
 * monitoring, security, notifications, and backup systems.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// Test configuration
const TEST_CONFIG = {
  baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
  supabase: {
    url: process.env.TEST_SUPABASE_URL || 'http://localhost:54321',
    key: process.env.TEST_SUPABASE_ANON_KEY || 'test-key'
  },
  testUser: {
    email: 'e2e-test@example.com',
    password: 'testpassword123'
  }
}

test.describe('System Enhancement E2E Tests', () => {
  let context: BrowserContext
  let page: Page
  let supabase: any
  let testUserId: string

  test.beforeAll(async ({ browser }) => {
    // Create browser context
    context = await browser.newContext()
    page = await context.newPage()

    // Initialize Supabase client
    supabase = createClient(TEST_CONFIG.supabase.url, TEST_CONFIG.supabase.key)

    // Create test user
    const { data: user } = await supabase.auth.signUp({
      email: TEST_CONFIG.testUser.email,
      password: TEST_CONFIG.testUser.password
    })
    testUserId = user?.user?.id || 'e2e-test-user-id'

    // Navigate to application
    await page.goto(TEST_CONFIG.baseURL)
  })

  test.afterAll(async () => {
    // Cleanup test data
    if (testUserId) {
      await supabase.from('papers').delete().eq('user_id', testUserId)
      await supabase.from('background_jobs').delete().eq('user_id', testUserId)
      await supabase.from('notifications').delete().eq('user_id', testUserId)
      await supabase.from('user_evaluations').delete().eq('user_id', testUserId)
    }

    await context.close()
  })

  test.beforeEach(async () => {
    // Login before each test
    await page.goto(`${TEST_CONFIG.baseURL}/login`)
    await page.fill('[data-testid="email-input"]', TEST_CONFIG.testUser.email)
    await page.fill('[data-testid="password-input"]', TEST_CONFIG.testUser.password)
    await page.click('[data-testid="login-button"]')
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard')
  })

  test.describe('Background AI Analysis Workflow', () => {
    test('should complete full AI analysis workflow with real-time updates', async () => {
      // 1. Navigate to upload page
      await page.click('[data-testid="upload-paper-button"]')
      await page.waitForURL('**/upload')

      // 2. Upload a test paper
      const fileInput = page.locator('[data-testid="file-input"]')
      await fileInput.setInputFiles({
        name: 'test-paper.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Mock PDF content for testing')
      })

      await page.fill('[data-testid="paper-title"]', 'E2E Test Paper: Machine Learning Applications')
      await page.fill('[data-testid="paper-abstract"]', 'This is a test paper for E2E testing of AI analysis features. It covers machine learning, neural networks, and artificial intelligence applications.')
      
      await page.click('[data-testid="upload-button"]')

      // 3. Wait for upload completion and get paper ID
      await page.waitForSelector('[data-testid="upload-success"]')
      const paperUrl = page.url()
      const paperId = paperUrl.split('/').pop()

      // 4. Navigate to paper detail page
      await page.goto(`${TEST_CONFIG.baseURL}/papers/${paperId}`)

      // 5. Start AI analysis
      await page.click('[data-testid="start-ai-analysis"]')

      // 6. Select AI providers
      await page.check('[data-testid="provider-openai"]')
      await page.check('[data-testid="provider-anthropic"]')
      await page.click('[data-testid="confirm-analysis"]')

      // 7. Verify background job was created
      await expect(page.locator('[data-testid="analysis-status"]')).toContainText('Analysis started')
      await expect(page.locator('[data-testid="job-progress"]')).toBeVisible()

      // 8. Wait for real-time progress updates
      await page.waitForSelector('[data-testid="progress-bar"]')
      
      // Monitor progress updates
      let progressUpdates = 0
      page.on('websocket', ws => {
        ws.on('framereceived', event => {
          const data = JSON.parse(event.payload.toString())
          if (data.type === 'job_progress') {
            progressUpdates++
          }
        })
      })

      // 9. Wait for analysis completion (with timeout)
      await page.waitForSelector('[data-testid="analysis-complete"]', { timeout: 30000 })

      // 10. Verify analysis results are displayed
      await expect(page.locator('[data-testid="openai-results"]')).toBeVisible()
      await expect(page.locator('[data-testid="anthropic-results"]')).toBeVisible()

      // 11. Verify summary and key points are shown
      await expect(page.locator('[data-testid="ai-summary"]')).not.toBeEmpty()
      await expect(page.locator('[data-testid="key-points"]')).toBeVisible()

      // 12. Verify notification was received
      await page.click('[data-testid="notifications-bell"]')
      await expect(page.locator('[data-testid="notification-item"]')).toContainText('AI Analysis Complete')

      // 13. Verify progress updates were received
      expect(progressUpdates).toBeGreaterThan(0)
    })

    test('should handle analysis failures gracefully', async () => {
      // Create a paper that will cause analysis to fail
      await page.goto(`${TEST_CONFIG.baseURL}/upload`)
      
      const fileInput = page.locator('[data-testid="file-input"]')
      await fileInput.setInputFiles({
        name: 'invalid-paper.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('') // Empty content to trigger failure
      })

      await page.fill('[data-testid="paper-title"]', 'Invalid Paper for Failure Test')
      await page.click('[data-testid="upload-button"]')

      await page.waitForSelector('[data-testid="upload-success"]')
      const paperUrl = page.url()
      const paperId = paperUrl.split('/').pop()

      await page.goto(`${TEST_CONFIG.baseURL}/papers/${paperId}`)
      await page.click('[data-testid="start-ai-analysis"]')
      await page.check('[data-testid="provider-openai"]')
      await page.click('[data-testid="confirm-analysis"]')

      // Wait for failure notification
      await page.waitForSelector('[data-testid="analysis-failed"]', { timeout: 15000 })
      
      // Verify error message is shown
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      
      // Verify retry option is available
      await expect(page.locator('[data-testid="retry-analysis"]')).toBeVisible()
    })
  })

  test.describe('Advanced Search and Filtering', () => {
    test('should perform advanced search with multiple filters', async () => {
      // First, create some test papers with different characteristics
      await createTestPapersForSearch()

      // Navigate to search page
      await page.goto(`${TEST_CONFIG.baseURL}/search`)

      // 1. Test text search
      await page.fill('[data-testid="search-input"]', 'machine learning')
      await page.click('[data-testid="search-button"]')
      
      await page.waitForSelector('[data-testid="search-results"]')
      await expect(page.locator('[data-testid="result-item"]')).toHaveCount(3, { timeout: 5000 })

      // 2. Apply rating filter
      await page.click('[data-testid="filters-toggle"]')
      await page.selectOption('[data-testid="rating-filter"]', '4')
      await page.click('[data-testid="apply-filters"]')

      await page.waitForSelector('[data-testid="search-results"]')
      const highRatedResults = page.locator('[data-testid="result-item"]')
      await expect(highRatedResults).toHaveCountGreaterThan(0)

      // 3. Apply date range filter
      await page.fill('[data-testid="date-from"]', '2023-01-01')
      await page.fill('[data-testid="date-to"]', '2024-01-01')
      await page.click('[data-testid="apply-filters"]')

      await page.waitForSelector('[data-testid="search-results"]')

      // 4. Apply tag filter
      await page.click('[data-testid="tag-filter-ai"]')
      await page.click('[data-testid="apply-filters"]')

      await page.waitForSelector('[data-testid="search-results"]')

      // 5. Test sorting options
      await page.selectOption('[data-testid="sort-by"]', 'publication_year')
      await page.waitForSelector('[data-testid="search-results"]')

      // Verify results are sorted by publication year
      const resultTitles = await page.locator('[data-testid="result-title"]').allTextContents()
      expect(resultTitles.length).toBeGreaterThan(0)

      // 6. Clear filters
      await page.click('[data-testid="clear-filters"]')
      await page.waitForSelector('[data-testid="search-results"]')
    })

    test('should provide search suggestions and autocomplete', async () => {
      await page.goto(`${TEST_CONFIG.baseURL}/search`)

      // Type partial search term
      await page.fill('[data-testid="search-input"]', 'mach')
      
      // Wait for suggestions to appear
      await page.waitForSelector('[data-testid="search-suggestions"]')
      
      // Verify suggestions are shown
      await expect(page.locator('[data-testid="suggestion-item"]')).toHaveCountGreaterThan(0)
      
      // Click on a suggestion
      await page.click('[data-testid="suggestion-item"]')
      
      // Verify search was performed
      await page.waitForSelector('[data-testid="search-results"]')
    })

    async function createTestPapersForSearch() {
      const testPapers = [
        {
          title: 'Advanced Machine Learning Techniques',
          abstract: 'Comprehensive study of machine learning algorithms',
          publication_year: 2023,
          journal: 'AI Research Journal',
          user_id: testUserId
        },
        {
          title: 'Neural Networks in Computer Vision',
          abstract: 'Application of neural networks for image recognition',
          publication_year: 2022,
          journal: 'Computer Vision Quarterly',
          user_id: testUserId
        },
        {
          title: 'Deep Learning for Natural Language Processing',
          abstract: 'Using deep learning for text analysis and understanding',
          publication_year: 2024,
          journal: 'NLP Today',
          user_id: testUserId
        }
      ]

      for (const paper of testPapers) {
        const { data: insertedPaper } = await supabase
          .from('papers')
          .insert(paper)
          .select()
          .single()

        // Add evaluations
        await supabase.from('user_evaluations').insert({
          paper_id: insertedPaper.id,
          user_id: testUserId,
          rating: 4 + Math.random(),
          tags: ['ai', 'machine-learning', 'research']
        })
      }
    }
  })

  test.describe('Performance Monitoring Dashboard', () => {
    test('should display real-time performance metrics', async () => {
      // Navigate to admin performance dashboard
      await page.goto(`${TEST_CONFIG.baseURL}/admin/performance`)

      // Verify dashboard components are loaded
      await expect(page.locator('[data-testid="performance-dashboard"]')).toBeVisible()
      await expect(page.locator('[data-testid="api-metrics-chart"]')).toBeVisible()
      await expect(page.locator('[data-testid="database-metrics"]')).toBeVisible()
      await expect(page.locator('[data-testid="system-resources"]')).toBeVisible()

      // Generate some API activity to see metrics
      await page.goto(`${TEST_CONFIG.baseURL}/papers`)
      await page.goto(`${TEST_CONFIG.baseURL}/search`)
      await page.goto(`${TEST_CONFIG.baseURL}/dashboard`)

      // Return to performance dashboard
      await page.goto(`${TEST_CONFIG.baseURL}/admin/performance`)

      // Wait for metrics to update
      await page.waitForTimeout(2000)

      // Verify metrics are displayed
      await expect(page.locator('[data-testid="total-requests"]')).not.toHaveText('0')
      await expect(page.locator('[data-testid="average-response-time"]')).toBeVisible()
      await expect(page.locator('[data-testid="error-rate"]')).toBeVisible()

      // Test real-time updates
      const initialRequestCount = await page.locator('[data-testid="total-requests"]').textContent()
      
      // Make another request
      await page.goto(`${TEST_CONFIG.baseURL}/papers`)
      await page.goto(`${TEST_CONFIG.baseURL}/admin/performance`)
      
      // Wait for update
      await page.waitForTimeout(3000)
      
      const updatedRequestCount = await page.locator('[data-testid="total-requests"]').textContent()
      expect(updatedRequestCount).not.toBe(initialRequestCount)
    })

    test('should show performance alerts when thresholds are exceeded', async () => {
      await page.goto(`${TEST_CONFIG.baseURL}/admin/performance`)

      // Simulate slow requests by making many concurrent requests
      const promises = Array.from({ length: 10 }, () => 
        page.goto(`${TEST_CONFIG.baseURL}/search?q=test`)
      )
      await Promise.all(promises)

      // Return to performance dashboard
      await page.goto(`${TEST_CONFIG.baseURL}/admin/performance`)
      
      // Wait for alerts to appear
      await page.waitForSelector('[data-testid="performance-alerts"]', { timeout: 10000 })
      
      // Verify alert is shown
      await expect(page.locator('[data-testid="alert-item"]')).toBeVisible()
    })
  })

  test.describe('Security Features', () => {
    test('should manage API keys securely', async () => {
      await page.goto(`${TEST_CONFIG.baseURL}/settings`)

      // Navigate to API keys section
      await page.click('[data-testid="api-keys-tab"]')

      // Add new API key
      await page.click('[data-testid="add-api-key"]')
      await page.selectOption('[data-testid="provider-select"]', 'openai')
      await page.fill('[data-testid="api-key-input"]', 'sk-test-key-12345')
      await page.click('[data-testid="save-api-key"]')

      // Verify key was saved (should be masked)
      await expect(page.locator('[data-testid="api-key-display"]')).toContainText('sk-***')

      // Test key validation
      await page.click('[data-testid="validate-key"]')
      await page.waitForSelector('[data-testid="validation-result"]')
      await expect(page.locator('[data-testid="validation-status"]')).toBeVisible()

      // Delete API key
      await page.click('[data-testid="delete-api-key"]')
      await page.click('[data-testid="confirm-delete"]')
      
      // Verify key was deleted
      await expect(page.locator('[data-testid="api-key-display"]')).not.toBeVisible()
    })

    test('should detect and handle suspicious activity', async () => {
      // Simulate suspicious activity by making many rapid requests
      for (let i = 0; i < 20; i++) {
        await page.goto(`${TEST_CONFIG.baseURL}/papers`)
        await page.waitForTimeout(100)
      }

      // Navigate to security dashboard
      await page.goto(`${TEST_CONFIG.baseURL}/admin/security`)

      // Wait for security analysis
      await page.waitForTimeout(5000)

      // Check if suspicious activity was detected
      await expect(page.locator('[data-testid="security-alerts"]')).toBeVisible()
      
      // Verify alert details
      const alertItems = page.locator('[data-testid="alert-item"]')
      if (await alertItems.count() > 0) {
        await expect(alertItems.first()).toContainText('High frequency requests')
      }
    })
  })

  test.describe('Real-time Notifications', () => {
    test('should receive and display real-time notifications', async () => {
      // Open notifications panel
      await page.click('[data-testid="notifications-bell"]')
      
      // Verify notifications panel is open
      await expect(page.locator('[data-testid="notifications-panel"]')).toBeVisible()

      // Trigger a notification by starting an AI analysis
      await page.goto(`${TEST_CONFIG.baseURL}/upload`)
      
      const fileInput = page.locator('[data-testid="file-input"]')
      await fileInput.setInputFiles({
        name: 'notification-test.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Test content for notifications')
      })

      await page.fill('[data-testid="paper-title"]', 'Notification Test Paper')
      await page.click('[data-testid="upload-button"]')

      // Wait for upload notification
      await page.waitForSelector('[data-testid="notification-toast"]', { timeout: 10000 })
      
      // Verify notification content
      await expect(page.locator('[data-testid="notification-toast"]')).toContainText('Paper uploaded successfully')

      // Check notifications panel
      await page.click('[data-testid="notifications-bell"]')
      await expect(page.locator('[data-testid="notification-item"]')).toHaveCountGreaterThan(0)

      // Mark notification as read
      await page.click('[data-testid="notification-item"]')
      await expect(page.locator('[data-testid="notification-item"]')).toHaveClass(/read/)
    })

    test('should manage notification settings', async () => {
      await page.goto(`${TEST_CONFIG.baseURL}/settings`)
      await page.click('[data-testid="notifications-tab"]')

      // Toggle notification types
      await page.uncheck('[data-testid="ai-analysis-notifications"]')
      await page.check('[data-testid="system-update-notifications"]')
      
      // Save settings
      await page.click('[data-testid="save-notification-settings"]')
      
      // Verify settings were saved
      await expect(page.locator('[data-testid="settings-saved"]')).toBeVisible()

      // Reload page and verify settings persist
      await page.reload()
      await expect(page.locator('[data-testid="ai-analysis-notifications"]')).not.toBeChecked()
      await expect(page.locator('[data-testid="system-update-notifications"]')).toBeChecked()
    })
  })

  test.describe('Backup and Recovery', () => {
    test('should create and manage backups', async () => {
      await page.goto(`${TEST_CONFIG.baseURL}/admin/backup`)

      // Verify backup dashboard is loaded
      await expect(page.locator('[data-testid="backup-dashboard"]')).toBeVisible()

      // Create a new backup
      await page.click('[data-testid="create-backup"]')
      await page.selectOption('[data-testid="backup-type"]', 'incremental')
      await page.click('[data-testid="start-backup"]')

      // Wait for backup to complete
      await page.waitForSelector('[data-testid="backup-complete"]', { timeout: 30000 })

      // Verify backup appears in list
      await expect(page.locator('[data-testid="backup-item"]')).toHaveCountGreaterThan(0)

      // Verify backup details
      const backupItem = page.locator('[data-testid="backup-item"]').first()
      await expect(backupItem.locator('[data-testid="backup-status"]')).toContainText('success')
      await expect(backupItem.locator('[data-testid="backup-size"]')).toBeVisible()
      await expect(backupItem.locator('[data-testid="backup-checksum"]')).toBeVisible()

      // Test backup validation
      await backupItem.locator('[data-testid="validate-backup"]').click()
      await page.waitForSelector('[data-testid="validation-complete"]')
      await expect(page.locator('[data-testid="validation-result"]')).toContainText('valid')
    })

    test('should schedule automatic backups', async () => {
      await page.goto(`${TEST_CONFIG.baseURL}/admin/backup`)
      await page.click('[data-testid="backup-schedules-tab"]')

      // Create new backup schedule
      await page.click('[data-testid="create-schedule"]')
      await page.fill('[data-testid="schedule-name"]', 'Daily Backup')
      await page.selectOption('[data-testid="schedule-type"]', 'incremental')
      await page.fill('[data-testid="cron-expression"]', '0 2 * * *') // Daily at 2 AM
      await page.click('[data-testid="save-schedule"]')

      // Verify schedule was created
      await expect(page.locator('[data-testid="schedule-item"]')).toContainText('Daily Backup')
      await expect(page.locator('[data-testid="schedule-status"]')).toContainText('active')

      // Test schedule modification
      await page.click('[data-testid="edit-schedule"]')
      await page.fill('[data-testid="cron-expression"]', '0 3 * * *') // Change to 3 AM
      await page.click('[data-testid="save-schedule"]')

      // Verify changes were saved
      await expect(page.locator('[data-testid="schedule-cron"]')).toContainText('0 3 * * *')
    })
  })

  test.describe('System Health Monitoring', () => {
    test('should display system health status', async () => {
      await page.goto(`${TEST_CONFIG.baseURL}/admin/health`)

      // Verify health dashboard components
      await expect(page.locator('[data-testid="health-dashboard"]')).toBeVisible()
      await expect(page.locator('[data-testid="overall-status"]')).toBeVisible()
      await expect(page.locator('[data-testid="service-status-database"]')).toBeVisible()
      await expect(page.locator('[data-testid="service-status-redis"]')).toBeVisible()
      await expect(page.locator('[data-testid="service-status-storage"]')).toBeVisible()

      // Verify system resources
      await expect(page.locator('[data-testid="cpu-usage"]')).toBeVisible()
      await expect(page.locator('[data-testid="memory-usage"]')).toBeVisible()
      await expect(page.locator('[data-testid="disk-usage"]')).toBeVisible()

      // Check health status values
      const overallStatus = await page.locator('[data-testid="overall-status"]').textContent()
      expect(['healthy', 'degraded', 'unhealthy']).toContain(overallStatus?.toLowerCase())
    })

    test('should show health history and trends', async () => {
      await page.goto(`${TEST_CONFIG.baseURL}/admin/health`)
      await page.click('[data-testid="health-history-tab"]')

      // Verify health history chart
      await expect(page.locator('[data-testid="health-history-chart"]')).toBeVisible()
      
      // Verify time range selector
      await page.selectOption('[data-testid="time-range"]', '24h')
      await page.waitForSelector('[data-testid="health-history-chart"]')

      // Verify incident log
      await expect(page.locator('[data-testid="incident-log"]')).toBeVisible()
    })
  })

  test.describe('API Usage Tracking', () => {
    test('should track and display API usage statistics', async () => {
      // Generate some API usage
      await page.goto(`${TEST_CONFIG.baseURL}/papers`)
      await page.goto(`${TEST_CONFIG.baseURL}/search`)
      await page.goto(`${TEST_CONFIG.baseURL}/dashboard`)

      // Navigate to usage dashboard
      await page.goto(`${TEST_CONFIG.baseURL}/admin/usage`)

      // Verify usage dashboard
      await expect(page.locator('[data-testid="usage-dashboard"]')).toBeVisible()
      await expect(page.locator('[data-testid="total-requests"]')).toBeVisible()
      await expect(page.locator('[data-testid="usage-by-endpoint"]')).toBeVisible()
      await expect(page.locator('[data-testid="usage-by-user"]')).toBeVisible()

      // Check usage statistics
      const totalRequests = await page.locator('[data-testid="total-requests"]').textContent()
      expect(parseInt(totalRequests || '0')).toBeGreaterThan(0)
    })

    test('should enforce usage limits', async () => {
      // Set a low usage limit for testing
      await page.goto(`${TEST_CONFIG.baseURL}/admin/usage`)
      await page.click('[data-testid="user-limits-tab"]')
      
      // Find test user and set limit
      await page.fill('[data-testid="search-user"]', TEST_CONFIG.testUser.email)
      await page.click('[data-testid="search-button"]')
      
      await page.click('[data-testid="edit-limits"]')
      await page.fill('[data-testid="ai-analysis-limit"]', '1')
      await page.click('[data-testid="save-limits"]')

      // Try to exceed the limit
      await page.goto(`${TEST_CONFIG.baseURL}/upload`)
      
      // Upload first paper (should succeed)
      let fileInput = page.locator('[data-testid="file-input"]')
      await fileInput.setInputFiles({
        name: 'limit-test-1.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Test content 1')
      })
      await page.fill('[data-testid="paper-title"]', 'Limit Test Paper 1')
      await page.click('[data-testid="upload-button"]')
      
      await page.waitForSelector('[data-testid="upload-success"]')
      
      // Try to start AI analysis (should succeed - first use)
      const paperUrl = page.url()
      const paperId = paperUrl.split('/').pop()
      await page.goto(`${TEST_CONFIG.baseURL}/papers/${paperId}`)
      await page.click('[data-testid="start-ai-analysis"]')
      await page.check('[data-testid="provider-openai"]')
      await page.click('[data-testid="confirm-analysis"]')
      
      // Wait for analysis to complete
      await page.waitForSelector('[data-testid="analysis-complete"]', { timeout: 30000 })

      // Upload second paper
      await page.goto(`${TEST_CONFIG.baseURL}/upload`)
      fileInput = page.locator('[data-testid="file-input"]')
      await fileInput.setInputFiles({
        name: 'limit-test-2.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Test content 2')
      })
      await page.fill('[data-testid="paper-title"]', 'Limit Test Paper 2')
      await page.click('[data-testid="upload-button"]')
      
      await page.waitForSelector('[data-testid="upload-success"]')
      
      // Try to start AI analysis (should fail - limit exceeded)
      const secondPaperUrl = page.url()
      const secondPaperId = secondPaperUrl.split('/').pop()
      await page.goto(`${TEST_CONFIG.baseURL}/papers/${secondPaperId}`)
      await page.click('[data-testid="start-ai-analysis"]')
      
      // Should show limit exceeded message
      await expect(page.locator('[data-testid="limit-exceeded"]')).toBeVisible()
      await expect(page.locator('[data-testid="limit-exceeded"]')).toContainText('daily limit')
    })
  })

  test.describe('Cache System Performance', () => {
    test('should demonstrate cache performance improvements', async () => {
      // First request (cache miss)
      const startTime1 = Date.now()
      await page.goto(`${TEST_CONFIG.baseURL}/papers`)
      await page.waitForSelector('[data-testid="papers-list"]')
      const loadTime1 = Date.now() - startTime1

      // Second request (cache hit)
      const startTime2 = Date.now()
      await page.reload()
      await page.waitForSelector('[data-testid="papers-list"]')
      const loadTime2 = Date.now() - startTime2

      // Cache hit should be faster
      expect(loadTime2).toBeLessThan(loadTime1)

      // Navigate to cache dashboard to verify cache usage
      await page.goto(`${TEST_CONFIG.baseURL}/admin/cache`)
      
      await expect(page.locator('[data-testid="cache-dashboard"]')).toBeVisible()
      await expect(page.locator('[data-testid="cache-hit-rate"]')).toBeVisible()
      
      const hitRate = await page.locator('[data-testid="cache-hit-rate"]').textContent()
      expect(parseFloat(hitRate || '0')).toBeGreaterThan(0)
    })
  })
})