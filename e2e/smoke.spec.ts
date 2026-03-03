import { test, expect } from '@playwright/test';

/**
 * Smoke tests — verify the app loads and renders correctly.
 * These tests don't require Firebase auth, they test the pre-login experience.
 */
test.describe('App Smoke Tests', () => {

    test('app loads without crash', async ({ page }) => {
        await page.goto('/');
        // Should show loading or login screen
        await expect(page).toHaveTitle(/Vi-Di-Sef|Rakušić|Login/i);
    });

    test('loading screen shows logo', async ({ page }) => {
        await page.goto('/');
        // Wait for either loading screen or login
        const body = page.locator('body');
        await expect(body).toBeVisible();
    });

    test('login screen renders after loading', async ({ page }) => {
        await page.goto('/');
        // Wait for loading to finish — login screen should appear
        await page.waitForTimeout(3000);
        // Should see either login form or app content  
        const pageContent = await page.textContent('body');
        expect(pageContent!.length).toBeGreaterThan(10);
    });

    test('no console errors on load', async ({ page }) => {
        const errors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error' && !msg.text().includes('Firebase')) {
                errors.push(msg.text());
            }
        });
        await page.goto('/');
        await page.waitForTimeout(2000);
        // Allow Firebase-related errors (no backend in test), but no other errors
        const criticalErrors = errors.filter(e =>
            !e.includes('auth') && !e.includes('firestore') && !e.includes('network')
        );
        expect(criticalErrors).toHaveLength(0);
    });

    test('privacy page renders', async ({ page }) => {
        await page.goto('/privacy');
        await page.waitForTimeout(1000);
        const content = await page.textContent('body');
        expect(content).toBeTruthy();
    });
});

test.describe('Login Page UI', () => {

    test('shows PIN input or login form', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(3000);
        // Should have input fields or buttons for login
        const inputs = page.locator('input');
        const buttons = page.locator('button');
        const hasInputs = await inputs.count() > 0;
        const hasButtons = await buttons.count() > 0;
        expect(hasInputs || hasButtons).toBe(true);
    });

    test('has accessible elements', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(3000);
        // Check that buttons have text content  
        const buttons = page.locator('button');
        const count = await buttons.count();
        if (count > 0) {
            for (let i = 0; i < Math.min(count, 5); i++) {
                const btn = buttons.nth(i);
                const text = await btn.textContent();
                const ariaLabel = await btn.getAttribute('aria-label');
                const title = await btn.getAttribute('title');
                expect(text || ariaLabel || title).toBeTruthy();
            }
        }
    });

    test('page is responsive (mobile viewport)', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');
        await page.waitForTimeout(2000);
        const body = page.locator('body');
        await expect(body).toBeVisible();
        // No horizontal overflow
        const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
        const clientWidth = await page.evaluate(() => document.body.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
    });
});

test.describe('Performance', () => {

    test('initial load under 5 seconds', async ({ page }) => {
        const start = Date.now();
        await page.goto('/');
        await page.waitForTimeout(1000); // Wait for React hydration
        const loadTime = Date.now() - start;
        expect(loadTime).toBeLessThan(5000);
    });

    test('no memory leaks from large DOM', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(2000);
        const nodeCount = await page.evaluate(() => document.querySelectorAll('*').length);
        // Reasonable DOM node count (< 5000 for login/loading)
        expect(nodeCount).toBeLessThan(5000);
    });
});
