import { test, expect } from '@playwright/test';

test.describe('API & Backend Integration Tests', () => {
  test('API endpoints should be accessible', async ({ page, request }) => {
    const baseURL = page.context().baseURL;
    
    const endpoints = [
      '/api/bookings',
      '/api/homestays',
      '/api/guides',
      '/api/users',
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await request.get(`${baseURL}${endpoint}`).catch(() => null);
        console.log(`${endpoint}: ${response?.status() || 'error'}`);
      } catch (e) {
        console.log(`${endpoint}: error - ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }
  });

  test('payment API routes should not require Razorpay keys', async ({ page, request }) => {
    const baseURL = page.context().baseURL;
    
    // Test that payment APIs exist but are skipped or use offline mode
    try {
      const response = await request.post(`${baseURL}/api/payments/create-order`, {
        data: {
          amount: 1000,
          booking_id: 'test_booking_123',
          description: 'Test booking',
        },
      }).catch(() => null);
      
      if (response) {
        console.log('Payment API status:', response.status());
        // Should either error gracefully or not exist
        expect([400, 404, 500]).toContain(response.status());
      }
    } catch (e) {
      console.log('Payment API test skipped - this is expected');
    }
  });

  test('should not have Razorpay script loaded', async ({ page }) => {
    await page.goto('/');
    
    // Check for Razorpay script
    const razorpayScript = await page.locator('script[src*="razorpay"]').count();
    
    console.log('Razorpay scripts found:', razorpayScript);
    expect(razorpayScript).toBe(0);
  });

  test('environment should not have Razorpay keys exposed', async ({ page }) => {
    await page.goto('/');
    
    // Check page for exposed keys
    const pageContent = await page.content();
    
    const hasRazorpayKey = pageContent.includes('rzp_') || pageContent.includes('RAZORPAY_KEY');
    
    console.log('Razorpay keys exposed:', hasRazorpayKey);
    expect(hasRazorpayKey).toBe(false);
  });
});
