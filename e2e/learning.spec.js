import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => { await page.goto('/index.html'); });

test('tour carries instructions through each stop and returns keyboard focus', async ({ page }) => {
  await page.fill('#secret', 'keep my experiment');
  await page.locator('[data-tour-step="0"]').focus();
  await page.keyboard.press('Enter');
  for (const [i, target] of ['#secret-sentence', '#scr-card', '#img-card'].entries()) {
    await expect(page.locator(`${target} #tourGuide`)).toBeVisible();
    await expect(page.locator('#tourHeading')).toBeFocused();
    await expect(page.locator('#tourHeading')).toBeInViewport();
    await expect(page.locator('#tourHeading')).toContainText(`Stop ${i + 1} of 3`);
    await page.click('#tourNext');
  }
  await expect(page.locator('#tourGuide')).toBeHidden();
  await expect(page.locator('#challenge-h')).toBeFocused();
  await page.click('[data-tour-step="2"]');
  await page.click('#tourBack');
  await expect(page.locator('#scr-card #tourGuide')).toBeVisible();
  await page.click('#tourExit');
  await expect(page.locator('#walkthrough-h')).toBeFocused();
  await expect(page.locator('#walkthrough-h')).toBeInViewport();
  await expect(page.locator('#secret')).toHaveValue('keep my experiment');
  await page.click('[data-tour-step="1"]');
  await page.click('#reset');
  await expect(page.locator('#tourGuide')).toBeHidden();
});

test('deeper explanations expand by keyboard and the active tour fits a phone', async ({ page }) => {
  await page.setViewportSize({width: 360, height: 740});
  const explanation = page.locator('.learn-more').first();
  await expect(explanation).not.toHaveAttribute('open', '');
  await explanation.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(explanation).toHaveAttribute('open', '');
  await expect(page.locator('#matrix')).toBeVisible();
  await page.click('[data-tour-step="2"]');
  await expect(page.locator('#tourHeading')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const results = await new AxeBuilder({ page }).include('#tourGuide')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
});

test('challenge explains a wrong answer and completes all six cases', async ({ page }) => {
  await expect(page.locator('#challengeNext')).toBeHidden();
  await page.check('input[name="detectorAnswer"][value="normalise"]');
  await page.click('#challengeCheck');
  await expect(page.locator('#challengeFeedback')).toContainText('For this scenario, use unusual-codepoint inspection');
  await page.check('input[name="detectorAnswer"][value="codepoint"]');
  await page.click('#challengeCheck');
  await expect(page.locator('#challengeFeedback')).toContainText('Yes.');
  await page.click('#challengeNext');
  for (const answer of ['dom', 'media', 'clipboard', 'normalise', 'confusable']) {
    await expect(page.locator('#challenge-h')).toBeFocused();
    await expect(page.locator('#challengeNext')).toBeHidden();
    await expect(page.locator('#challengeFeedback')).toBeEmpty();
    await page.check(`input[name="detectorAnswer"][value="${answer}"]`);
    await page.click('#challengeCheck');
    await expect(page.locator('#challengeFeedback')).toContainText('Yes.');
    const href = await page.locator('#challengeDemo').getAttribute('href');
    await expect(page.locator(href)).toHaveCount(1);
    await page.click('#challengeNext');
  }
  await expect(page.locator('#challengeForm')).toBeHidden();
  await expect(page.locator('#challengeProgress')).toHaveText('Six scenarios explored');
  await page.click('#challengeRestart');
  await expect(page.locator('#challengeProgress')).toHaveText('Scenario 1 of 6');
  await expect(page.locator('input[name="detectorAnswer"]:checked')).toHaveCount(0);
});

test('keyboard submission works and global Reset clears challenge state', async ({ page }) => {
  await page.locator('input[name="detectorAnswer"][value="codepoint"]').focus();
  await page.keyboard.press('Space');
  await page.locator('#challengeCheck').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#challengeFeedback')).toContainText('Yes.');
  await page.click('#challengeNext');
  await page.click('#reset');
  await expect(page.locator('#challengeProgress')).toHaveText('Scenario 1 of 6');
  await expect(page.locator('#challengeFeedback')).toBeEmpty();
  await expect(page.locator('#challengeDemo')).toBeHidden();
  await expect(page.locator('#challengeNext')).toBeHidden();
});

test('learning sections remain accessible with answer feedback visible', async ({ page }) => {
  await page.check('input[name="detectorAnswer"][value="codepoint"]');
  await page.click('#challengeCheck');
  const results = await new AxeBuilder({ page }).include('#walkthrough').include('#detector-challenge')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
});
