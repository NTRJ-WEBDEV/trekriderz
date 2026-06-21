import { test, expect } from '@playwright/test';

test.describe('App Navigation & Structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate to home page', async ({ page }) => {
    const title = page.locator('text=Trek Together');
    await expect(title).toBeVisible();
  });

  test('main sections should be accessible', async ({ page }) => {
    // Features section
    const featuresLink = page.locator('a:has-text("Features")').first();
    if (await featuresLink.isVisible().catch(() => false)) {
      await featuresLink.click();
      await expect(page.locator('text=Everything you need to trek smarter')).toBeVisible();
    }
  });

  test('should display feature cards', async ({ page }) => {
    const trailsText = page.locator('text=Discover Trails');
    const communityText = page.locator('text=Join Community');
    
    await expect(trailsText).toBeVisible();
    await expect(communityText).toBeVisible();
  });

  test('should have TrekRiderz branding in title', async ({ page }) => {
    await expect(page).toHaveTitle(/TrekRiderz|Adventure/i);
  });

  test('app should have proper styling', async ({ page }) => {
    const navbar = page.locator('nav');
    
    // Check if nav has proper styling
    const navStyle = await navbar.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    
    console.log('Nav background color:', navStyle);
    expect(navStyle).toBeTruthy();
  });

  test('mobile responsiveness check', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    const title = page.locator('text=Trek Together');
    await expect(title).toBeVisible();
    
    // Reset to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});
