import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load landing page with hero section', async ({ page }) => {
    // Check hero title
    const title = page.locator('text=Trek Together');
    await expect(title).toBeVisible();
    
    // Check TrekRiderz logo
    const logo = page.locator('text=TrekRiderz');
    await expect(logo).toBeVisible();
  });

  test('should have navigation links', async ({ page }) => {
    // Check navbar exists
    const navbar = page.locator('nav');
    await expect(navbar).toBeVisible();
    
    // Check important links
    const featuresLink = page.locator('a:has-text("Features")').first();
    await expect(featuresLink).toBeVisible();
    
    const downloadButton = page.locator('a:has-text("Download on Google Play")');
    await expect(downloadButton).toBeVisible();
  });

  test('should display features section', async ({ page }) => {
    // Scroll to features
    const featuresSection = page.locator('text=Everything you need to trek smarter');
    await expect(featuresSection).toBeVisible();
    
    // Check feature cards exist
    const trailsFeature = page.locator('text=Discover Trails');
    const communityFeature = page.locator('text=Join Community');
    
    await expect(trailsFeature).toBeVisible();
    await expect(communityFeature).toBeVisible();
  });

  test('should have stats section', async ({ page }) => {
    // Check stats
    const travelers = page.locator('text=10K+');
    await expect(travelers).toBeVisible();
    
    const homestaysCount = page.locator('text=500+');
    await expect(homestaysCount).toBeVisible();
  });

  test('should have download button', async ({ page }) => {
    const downloadBtn = page.locator('a:has-text("Download on Google Play")');
    await expect(downloadBtn).toBeVisible();
    
    // Check it's clickable
    await expect(downloadBtn).toBeEnabled();
  });

  test('navigation should be responsive', async ({ page }) => {
    const navbar = page.locator('nav');
    await expect(navbar).toBeVisible();
    
    // Logo should always be visible
    const logo = page.locator('text=TrekRiderz').first();
    await expect(logo).toBeVisible();
  });
});
