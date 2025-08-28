import { test, expect } from '@playwright/test';

test.describe('AI Analysis', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@email.com');
    await page.fill('input[type="password"]', '1234567890');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display AI model selector', async ({ page }) => {
    await page.goto('/settings');
    
    await expect(page.locator('[data-testid="ai-model-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="openai-toggle"]')).toBeVisible();
    await expect(page.locator('[data-testid="anthropic-toggle"]')).toBeVisible();
  });

  test('should manage API keys', async ({ page }) => {
    await page.goto('/settings');
    
    // Open API key manager
    await page.click('[data-testid="api-key-manager-button"]');
    
    // Check API key inputs are visible
    await expect(page.locator('[data-testid="openai-key-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="anthropic-key-input"]')).toBeVisible();
  });

  test('should trigger AI analysis on paper', async ({ page }) => {
    await page.goto('/papers');
    
    // Wait for papers and open first paper
    await page.waitForSelector('[data-testid="paper-card"]', { timeout: 5000 });
    await page.click('[data-testid="paper-card"]');
    
    // Go to AI Analysis tab
    await page.click('[data-testid="ai-analysis-tab"]');
    
    // Check analysis section is visible
    await expect(page.locator('[data-testid="ai-analysis-section"]')).toBeVisible();
    
    // Trigger analysis if not already done
    const analyzeButton = page.locator('[data-testid="analyze-button"]');
    if (await analyzeButton.isVisible()) {
      await analyzeButton.click();
      
      // Wait for analysis to complete
      await page.waitForSelector('[data-testid="analysis-results"]', { timeout: 30000 });
    }
    
    // Check results are displayed
    await expect(page.locator('[data-testid="analysis-results"]')).toBeVisible();
  });

  test('should compare AI model results', async ({ page }) => {
    await page.goto('/papers');
    
    // Wait for papers and open first paper
    await page.waitForSelector('[data-testid="paper-card"]', { timeout: 5000 });
    await page.click('[data-testid="paper-card"]');
    
    // Go to AI Analysis tab
    await page.click('[data-testid="ai-analysis-tab"]');
    
    // Check comparison view
    await expect(page.locator('[data-testid="analysis-comparison"]')).toBeVisible();
    
    // Check model tabs
    const modelTabs = page.locator('[data-testid="model-tab"]');
    await expect(modelTabs).toHaveCount(4); // OpenAI, Anthropic, xAI, Gemini
  });

  test('should display analysis confidence scores', async ({ page }) => {
    await page.goto('/papers');
    
    // Wait for papers and open first paper
    await page.waitForSelector('[data-testid="paper-card"]', { timeout: 5000 });
    await page.click('[data-testid="paper-card"]');
    
    // Go to AI Analysis tab
    await page.click('[data-testid="ai-analysis-tab"]');
    
    // Check confidence scores are displayed
    await expect(page.locator('[data-testid="confidence-score"]')).toBeVisible();
  });
});