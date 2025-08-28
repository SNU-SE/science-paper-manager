import { test, expect } from '@playwright/test';

test.describe('Search and RAG', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@email.com');
    await page.fill('input[type="password"]', '1234567890');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display search page', async ({ page }) => {
    await page.goto('/search');
    
    await expect(page.locator('h1')).toContainText('Search');
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-button"]')).toBeVisible();
  });

  test('should perform semantic search', async ({ page }) => {
    await page.goto('/search');
    
    // Enter search query
    await page.fill('[data-testid="search-input"]', 'machine learning');
    await page.click('[data-testid="search-button"]');
    
    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });
    
    // Check results are displayed
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });

  test('should display chat interface', async ({ page }) => {
    await page.goto('/chat');
    
    await expect(page.locator('h1')).toContainText('RAG Chat');
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
  });

  test('should send RAG query and receive response', async ({ page }) => {
    await page.goto('/chat');
    
    // Enter question
    await page.fill('[data-testid="chat-input"]', 'What are the main findings in machine learning research?');
    await page.click('[data-testid="send-button"]');
    
    // Wait for response
    await page.waitForSelector('[data-testid="chat-message"]', { timeout: 15000 });
    
    // Check message is displayed
    const messages = page.locator('[data-testid="chat-message"]');
    await expect(messages).toHaveCount(2); // User message + AI response
  });

  test('should show search filters', async ({ page }) => {
    await page.goto('/search');
    
    // Open filters
    await page.click('[data-testid="filter-button"]');
    
    // Check filter options are visible
    await expect(page.locator('[data-testid="year-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-filter"]')).toBeVisible();
  });
});