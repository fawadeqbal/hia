import { expect, test } from '@playwright/test';

test('home page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
});

// TODO (scope 13): guest checkout with COD, logged-in checkout with online payment,
// multi-vendor cart split, coupon + gift card + loyalty stacking, return flow.
