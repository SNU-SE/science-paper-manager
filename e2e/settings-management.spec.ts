import { test, expect } from '@playwright/test'

test.describe('Settings Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.fill('input[type="email"]', 'admin@email.com')
    await page.fill('input[type="password"]', '1234567890')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')
  })

  test.describe('AI Model Configuration', () => {
    test('should configure AI models and save settings', async ({ page }) => {
      await page.goto('/settings')
      
      // Navigate to AI Configuration tab
      await page.click('[data-testid="ai-configuration-tab"]')
      
      // Verify AI model selector is visible
      await expect(page.locator('[data-testid="ai-model-selector"]')).toBeVisible()
      
      // Configure OpenAI API key
      await page.click('[data-testid="openai-eye-button"]')
      await page.fill('[data-testid="openai-api-key-input"]', 'test-openai-key')
      await page.click('[data-testid="openai-save-button"]')
      
      // Wait for validation
      await expect(page.locator('[data-testid="openai-validation-success"]')).toBeVisible()
      
      // Enable OpenAI model
      await page.click('[data-testid="openai-model-toggle"]')
      
      // Verify model is active
      await expect(page.locator('[data-testid="openai-status-active"]')).toBeVisible()
      
      // Refresh page and verify settings persist
      await page.reload()
      await expect(page.locator('[data-testid="openai-status-active"]')).toBeVisible()
    })

    test('should handle API key validation errors', async ({ page }) => {
      await page.goto('/settings')
      await page.click('[data-testid="ai-configuration-tab"]')
      
      // Enter invalid API key
      await page.click('[data-testid="anthropic-eye-button"]')
      await page.fill('[data-testid="anthropic-api-key-input"]', 'invalid-key')
      await page.click('[data-testid="anthropic-save-button"]')
      
      // Verify error message is displayed
      await expect(page.locator('[data-testid="anthropic-validation-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="anthropic-validation-error"]')).toContainText('Invalid API key')
      
      // Verify model remains disabled
      await expect(page.locator('[data-testid="anthropic-model-toggle"]')).toBeDisabled()
    })

    test('should display usage statistics for active models', async ({ page }) => {
      await page.goto('/settings')
      await page.click('[data-testid="ai-configuration-tab"]')
      
      // Assuming OpenAI is already configured and has usage
      await expect(page.locator('[data-testid="openai-usage-stats"]')).toBeVisible()
      await expect(page.locator('[data-testid="openai-tokens-used"]')).toContainText(/\d+/)
      await expect(page.locator('[data-testid="openai-request-count"]')).toContainText(/\d+/)
      await expect(page.locator('[data-testid="openai-estimated-cost"]')).toContainText(/\$\d+\.\d+/)
    })
  })

  test.describe('Zotero Integration', () => {
    test('should configure Zotero connection', async ({ page }) => {
      await page.goto('/settings')
      
      // Navigate to Reference Manager tab
      await page.click('[data-testid="reference-manager-tab"]')
      
      // Verify Zotero configuration form is visible
      await expect(page.locator('[data-testid="zotero-config-form"]')).toBeVisible()
      
      // Fill in Zotero credentials
      await page.fill('[data-testid="zotero-user-id-input"]', 'test-zotero-user')
      await page.fill('[data-testid="zotero-api-key-input"]', 'test-zotero-key')
      
      // Select library type
      await page.click('[data-testid="zotero-library-type-select"]')
      await page.click('[data-value="user"]')
      
      // Connect Zotero
      await page.click('[data-testid="zotero-connect-button"]')
      
      // Wait for connection success
      await expect(page.locator('[data-testid="zotero-connection-success"]')).toBeVisible()
      await expect(page.locator('[data-testid="zotero-sync-status"]')).toBeVisible()
      
      // Verify auto-sync option is available
      await expect(page.locator('[data-testid="zotero-auto-sync-toggle"]')).toBeVisible()
    })

    test('should handle Zotero connection errors', async ({ page }) => {
      await page.goto('/settings')
      await page.click('[data-testid="reference-manager-tab"]')
      
      // Enter invalid credentials
      await page.fill('[data-testid="zotero-user-id-input"]', 'invalid-user')
      await page.fill('[data-testid="zotero-api-key-input"]', 'invalid-key')
      await page.click('[data-testid="zotero-connect-button"]')
      
      // Verify error message
      await expect(page.locator('[data-testid="zotero-connection-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="zotero-connection-error"]')).toContainText('Invalid API key')
    })

    test('should test Zotero connection', async ({ page }) => {
      await page.goto('/settings')
      await page.click('[data-testid="reference-manager-tab"]')
      
      // Assuming Zotero is already configured
      await expect(page.locator('[data-testid="zotero-test-connection-button"]')).toBeVisible()
      
      // Test connection
      await page.click('[data-testid="zotero-test-connection-button"]')
      
      // Verify connection test result
      await expect(page.locator('[data-testid="zotero-connection-test-result"]')).toBeVisible()
    })
  })

  test.describe('Settings Backup and Restore', () => {
    test('should export settings successfully', async ({ page }) => {
      await page.goto('/settings')
      
      // Navigate to backup section
      await page.click('[data-testid="backup-restore-tab"]')
      
      // Configure export options
      await page.check('[data-testid="export-ai-models-checkbox"]')
      await page.check('[data-testid="export-zotero-checkbox"]')
      
      // Start download
      const downloadPromise = page.waitForEvent('download')
      await page.click('[data-testid="export-settings-button"]')
      
      // Verify download starts
      const download = await downloadPromise
      expect(download.suggestedFilename()).toMatch(/settings-backup-.*\.json/)
    })

    test('should import settings successfully', async ({ page }) => {
      await page.goto('/settings')
      await page.click('[data-testid="backup-restore-tab"]')
      
      // Create a mock backup file
      const backupData = {
        metadata: {
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          userId: 'test-user',
          settingsCount: 1
        },
        data: {
          aiModels: [{
            provider: 'openai',
            model_name: 'gpt-4o',
            is_default: true,
            is_enabled: true
          }]
        }
      }
      
      // Upload backup file
      await page.setInputFiles(
        '[data-testid="backup-file-input"]',
        {
          name: 'test-backup.json',
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(backupData))
        }
      )
      
      // Preview import
      await expect(page.locator('[data-testid="import-preview"]')).toBeVisible()
      await expect(page.locator('[data-testid="preview-ai-models-count"]')).toContainText('1')
      
      // Confirm import
      await page.click('[data-testid="confirm-import-button"]')
      
      // Verify import success
      await expect(page.locator('[data-testid="import-success-message"]')).toBeVisible()
    })

    test('should handle encrypted backup files', async ({ page }) => {
      await page.goto('/settings')
      await page.click('[data-testid="backup-restore-tab"]')
      
      // Enable encryption for export
      await page.check('[data-testid="encrypt-backup-checkbox"]')
      await page.fill('[data-testid="backup-password-input"]', 'test-password')
      
      // Export encrypted backup
      const downloadPromise = page.waitForEvent('download')
      await page.click('[data-testid="export-settings-button"]')
      
      const download = await downloadPromise
      expect(download.suggestedFilename()).toMatch(/settings-backup-.*\.encrypted\.json/)
      
      // Import encrypted backup (would need password)
      await page.setInputFiles('[data-testid="backup-file-input"]', await download.path())
      
      // Should prompt for password
      await expect(page.locator('[data-testid="decrypt-password-input"]')).toBeVisible()
    })
  })

  test.describe('Navigation and User Experience', () => {
    test('should navigate between settings tabs correctly', async ({ page }) => {
      await page.goto('/settings')
      
      // Test tab navigation
      const tabs = [
        'ai-configuration-tab',
        'api-keys-tab',
        'cloud-storage-tab',
        'reference-manager-tab',
        'backup-restore-tab'
      ]
      
      for (const tab of tabs) {
        await page.click(`[data-testid="${tab}"]`)
        await expect(page.locator(`[data-testid="${tab}"]`)).toHaveClass(/active|selected/)
      }
    })

    test('should show loading states during operations', async ({ page }) => {
      await page.goto('/settings')
      await page.click('[data-testid="ai-configuration-tab"]')
      
      // Start API key validation
      await page.click('[data-testid="openai-eye-button"]')
      await page.fill('[data-testid="openai-api-key-input"]', 'test-key')
      await page.click('[data-testid="openai-save-button"]')
      
      // Verify loading state is shown
      await expect(page.locator('[data-testid="openai-validation-loading"]')).toBeVisible()
    })

    test('should maintain settings state across page navigation', async ({ page }) => {
      await page.goto('/settings')
      
      // Configure a setting
      await page.click('[data-testid="ai-configuration-tab"]')
      await page.click('[data-testid="openai-eye-button"]')
      await page.fill('[data-testid="openai-api-key-input"]', 'test-key')
      await page.click('[data-testid="openai-save-button"]')
      
      // Navigate away and back
      await page.goto('/dashboard')
      await page.goto('/settings')
      
      // Verify setting is maintained
      await page.click('[data-testid="ai-configuration-tab"]')
      await expect(page.locator('[data-testid="openai-status-configured"]')).toBeVisible()
    })
  })

  test.describe('Error Handling and Recovery', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate network failure
      await page.route('**/api/ai-keys/validate', route => route.abort())
      
      await page.goto('/settings')
      await page.click('[data-testid="ai-configuration-tab"]')
      
      // Try to validate API key
      await page.click('[data-testid="openai-eye-button"]')
      await page.fill('[data-testid="openai-api-key-input"]', 'test-key')
      await page.click('[data-testid="openai-save-button"]')
      
      // Verify error handling
      await expect(page.locator('[data-testid="network-error-message"]')).toBeVisible()
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
    })

    test('should provide clear error messages for validation failures', async ({ page }) => {
      await page.goto('/settings')
      await page.click('[data-testid="reference-manager-tab"]')
      
      // Enter incomplete Zotero configuration
      await page.fill('[data-testid="zotero-user-id-input"]', '')
      await page.fill('[data-testid="zotero-api-key-input"]', 'test-key')
      await page.click('[data-testid="zotero-connect-button"]')
      
      // Verify validation error
      await expect(page.locator('[data-testid="zotero-user-id-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="zotero-user-id-error"]')).toContainText('User ID is required')
    })

    test('should handle concurrent operations correctly', async ({ page }) => {
      await page.goto('/settings')
      
      // Start multiple operations simultaneously
      const operations = [
        page.click('[data-testid="ai-configuration-tab"]'),
        page.click('[data-testid="reference-manager-tab"]'),
        page.click('[data-testid="backup-restore-tab"]')
      ]
      
      await Promise.all(operations)
      
      // Verify no conflicts occurred
      await expect(page.locator('[data-testid="backup-restore-tab"]')).toHaveClass(/active|selected/)
    })
  })
})