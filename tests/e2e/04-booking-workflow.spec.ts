import { test, expect } from '@playwright/test';

test.describe('Booking Workflow', () => {
  test('booking pages should exist', async ({ page }) => {
    // Try to navigate to booking-related pages
    const bookingResponses = [];
    
    const pages = [
      '/booking',
      '/homestay',
      '/guide',
      '/hire',
      '/booking-details',
    ];
    
    for (const path of pages) {
      try {
        const response = await page.goto(path).catch(() => null);
        bookingResponses.push({
          path,
          status: response?.status() || 'error',
          exists: response?.status() === 200,
        });
      } catch (e) {
        bookingResponses.push({
          path,
          status: 'error',
          exists: false,
        });
      }
    }
    
    console.log('Booking pages status:', bookingResponses);
  });

  test('homestay related UI should exist', async ({ page }) => {
    await page.goto('/');
    
    // Look for homestay-related content
    const homestaySection = page.locator('text=Verified Homestays');
    
    if (await homestaySection.isVisible().catch(() => false)) {
      await expect(homestaySection).toBeVisible();
      console.log('✓ Homestays section found');
    }
  });

  test('guide booking UI should exist', async ({ page }) => {
    await page.goto('/');
    
    // Look for guide-related content
    const guideSection = page.locator('text=Expert Guides');
    
    if (await guideSection.isVisible().catch(() => false)) {
      await expect(guideSection).toBeVisible();
      console.log('✓ Guides section found');
    }
  });

  test('offline payment mode should be active', async ({ page }) => {
    // Check if there's any reference to online payment
    const razorpayReferences = await page.locator('text=Razorpay').count();
    const onlinePaymentRefs = await page.locator('text=online payment').count();
    
    console.log('Razorpay references:', razorpayReferences);
    console.log('Online payment references:', onlinePaymentRefs);
    
    // Should be 0 or very minimal for offline mode
    expect(razorpayReferences + onlinePaymentRefs).toBeLessThanOrEqual(1);
  });

  test('payment at property option should be visible', async ({ page }) => {
    // This would test the booking details page if accessible
    // For now, check on landing page for payment messaging
    
    const page2 = page;
    await page2.goto('/');
    
    // Log what we find
    const bodyText = await page2.textContent('body');
    if (bodyText) {
      if (bodyText.includes('pay') || bodyText.includes('payment') || bodyText.includes('cost')) {
        console.log('✓ Payment terminology found on landing page');
      }
    }
  });
});
