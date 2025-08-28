import { test, expect } from '@playwright/test';

test.describe('Paper Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@email.com');
    await page.fill('input[type="password"]', '1234567890');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display papers page', async ({ page }) => {
    await page.goto('/papers');
    
    await expect(page.locator('h1')).toContainText('Papers');
    await expect(page.locator('[data-testid="paper-upload-button"]')).toBeVisible();
  });

  test('should open paper upload dialog', async ({ page }) => {
    await page.goto('/papers');
    
    await page.click('[data-testid="paper-upload-button"]');
    
    // Check upload dialog is open
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-upload-area"]')).toBeVisible();
  });

  test('should display paper cards when papers exist', async ({ page }) => {
    await page.goto('/papers');
    
    // Wait for papers to load
    await page.waitForSelector('[data-testid="paper-card"]', { timeout: 5000 });
    
    // Check paper card elements
    const paperCard = page.locator('[data-testid="paper-card"]').first();
    await expect(paperCard).toBeVisible();
    await expect(paperCard.locator('[data-testid="paper-title"]')).toBeVisible();
    await expect(paperCard.locator('[data-testid="paper-authors"]')).toBeVisible();
  });

  test('should open paper detail when clicking on paper', async ({ page }) => {
    await page.goto('/papers');
    
    // Wait for papers to load and click first paper
    await page.waitForSelector('[data-testid="paper-card"]', { timeout: 5000 });
    await page.click('[data-testid="paper-card"]');
    
    // Check paper detail dialog is open
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="paper-detail-tabs"]')).toBeVisible();
  });

  test('should update reading status', async ({ page }) => {
    await page.goto('/papers');
    
    // Wait for papers and open first paper
    await page.waitForSelector('[data-testid="paper-card"]', { timeout: 5000 });
    await page.click('[data-testid="paper-card"]');
    
    // Change reading status
    await page.click('[data-testid="reading-status-select"]');
    await page.click('[data-value="reading"]');
    
    // Check status is updated
    await expect(page.locator('[data-testid="reading-status-select"]')).toContainText('Reading');
  });

  test('should add rating to paper', async ({ page }) => {
    await page.goto('/papers');
    
    // Wait for papers and open first paper
    await page.waitForSelector('[data-testid="paper-card"]', { timeout: 5000 });
    await page.click('[data-testid="paper-card"]');
    
    // Click on 4th star
    await page.click('[data-testid="star-rating"] [data-star="4"]');
    
    // Check rating is set
    await expect(page.locator('[data-testid="star-rating"]')).toHaveAttribute('data-rating', '4');
  });
});