import { test, expect } from '@playwright/test'

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin dashboard
    await page.goto('/admin')
  })

  test('should display admin dashboard layout', async ({ page }) => {
    // Check if the admin layout is rendered
    await expect(page.locator('h1')).toContainText('Admin Dashboard')
    
    // Check if navigation items are present
    await expect(page.locator('text=Dashboard')).toBeVisible()
    await expect(page.locator('text=Performance')).toBeVisible()
    await expect(page.locator('text=Health')).toBeVisible()
    await expect(page.locator('text=Security')).toBeVisible()
    await expect(page.locator('text=Users')).toBeVisible()
    await expect(page.locator('text=Jobs')).toBeVisible()
    await expect(page.locator('text=Backup')).toBeVisible()
    await expect(page.locator('text=Cache')).toBeVisible()
  })

  test('should display system overview cards', async ({ page }) => {
    // Check for overview cards
    await expect(page.locator('text=System Status')).toBeVisible()
    await expect(page.locator('text=Active Users')).toBeVisible()
    await expect(page.locator('text=Background Jobs')).toBeVisible()
    await expect(page.locator('text=Response Time')).toBeVisible()
  })

  test('should display resource usage cards', async ({ page }) => {
    // Check for resource usage cards
    await expect(page.locator('text=Memory Usage')).toBeVisible()
    await expect(page.locator('text=CPU Usage')).toBeVisible()
    await expect(page.locator('text=Disk Usage')).toBeVisible()
  })

  test('should display service status cards', async ({ page }) => {
    // Check for service status cards
    await expect(page.locator('text=Security Status')).toBeVisible()
    await expect(page.locator('text=Backup Status')).toBeVisible()
    await expect(page.locator('text=Cache Performance')).toBeVisible()
  })

  test('should have working tabs', async ({ page }) => {
    // Check if tabs are present and clickable
    await expect(page.locator('text=Background Jobs')).toBeVisible()
    await expect(page.locator('text=User Activity')).toBeVisible()
    await expect(page.locator('text=Security Events')).toBeVisible()

    // Click on User Activity tab
    await page.click('text=User Activity')
    await expect(page.locator('text=Monitor current user sessions')).toBeVisible()

    // Click on Security Events tab
    await page.click('text=Security Events')
    await expect(page.locator('text=Monitor security incidents')).toBeVisible()
  })

  test('should navigate to performance page', async ({ page }) => {
    await page.click('text=Performance')
    await expect(page).toHaveURL('/admin/performance')
    await expect(page.locator('h1')).toContainText('Performance')
  })

  test('should navigate to health page', async ({ page }) => {
    await page.click('text=Health')
    await expect(page).toHaveURL('/admin/health')
    await expect(page.locator('h1')).toContainText('System Health')
  })

  test('should navigate to security page', async ({ page }) => {
    await page.click('text=Security')
    await expect(page).toHaveURL('/admin/security')
  })

  test('should navigate to users page', async ({ page }) => {
    await page.click('text=Users')
    await expect(page).toHaveURL('/admin/users')
    await expect(page.locator('h1')).toContainText('User Management')
  })

  test('should navigate to jobs page', async ({ page }) => {
    await page.click('text=Jobs')
    await expect(page).toHaveURL('/admin/jobs')
    await expect(page.locator('h1')).toContainText('Background Jobs')
  })

  test('should navigate to backup page', async ({ page }) => {
    await page.click('text=Backup')
    await expect(page).toHaveURL('/admin/backup')
    await expect(page.locator('h1')).toContainText('Backup Management')
  })

  test('should navigate to cache page', async ({ page }) => {
    await page.click('text=Cache')
    await expect(page).toHaveURL('/admin/cache')
  })

  test('should have refresh functionality', async ({ page }) => {
    // Check if refresh button is present
    await expect(page.locator('text=Refresh')).toBeVisible()
    
    // Click refresh button
    await page.click('text=Refresh')
    
    // Should not navigate away from the page
    await expect(page).toHaveURL('/admin')
  })

  test('should have auto-refresh toggle', async ({ page }) => {
    // Check if auto-refresh toggle is present
    await expect(page.locator('text=Auto-refresh')).toBeVisible()
    
    // Click auto-refresh toggle
    await page.click('text=Auto-refresh: On')
    await expect(page.locator('text=Auto-refresh: Off')).toBeVisible()
  })

  test('should display quick status in sidebar', async ({ page }) => {
    // Check if quick status section is visible
    await expect(page.locator('text=Quick Status')).toBeVisible()
    await expect(page.locator('text=System Status')).toBeVisible()
    await expect(page.locator('text=Active Users')).toBeVisible()
    await expect(page.locator('text=Background Jobs')).toBeVisible()
  })
})

test.describe('Admin Dashboard - User Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/users')
  })

  test('should display user management interface', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('User Management')
    await expect(page.locator('text=Manage users, monitor activity')).toBeVisible()
  })

  test('should have user statistics cards', async ({ page }) => {
    await expect(page.locator('text=Total Users')).toBeVisible()
    await expect(page.locator('text=Active Users')).toBeVisible()
    await expect(page.locator('text=New Today')).toBeVisible()
    await expect(page.locator('text=Suspended')).toBeVisible()
  })

  test('should have user management tabs', async ({ page }) => {
    await expect(page.locator('text=All Users')).toBeVisible()
    await expect(page.locator('text=User Activity')).toBeVisible()
    await expect(page.locator('text=Top Users')).toBeVisible()
  })

  test('should have search functionality', async ({ page }) => {
    await expect(page.locator('input[placeholder="Search users..."]')).toBeVisible()
  })
})

test.describe('Admin Dashboard - Background Jobs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/jobs')
  })

  test('should display background jobs interface', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Background Jobs')
    await expect(page.locator('text=Monitor and manage background processing tasks')).toBeVisible()
  })

  test('should have job statistics cards', async ({ page }) => {
    await expect(page.locator('text=Total Jobs')).toBeVisible()
    await expect(page.locator('text=Running')).toBeVisible()
    await expect(page.locator('text=Completed')).toBeVisible()
    await expect(page.locator('text=Avg Duration')).toBeVisible()
  })

  test('should have job management tabs', async ({ page }) => {
    await expect(page.locator('text=Job History')).toBeVisible()
    await expect(page.locator('text=Queue Status')).toBeVisible()
  })

  test('should have job search and filter functionality', async ({ page }) => {
    await expect(page.locator('input[placeholder="Search jobs..."]')).toBeVisible()
    await expect(page.locator('select')).toBeVisible() // Status filter dropdown
  })
})