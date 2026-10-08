import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => { await page.goto('/index.html'); });

test('guide links reach the demos and offer a return path', async ({ page }) => {
  for (const target of ['#revealBtn', '#scr-card', '#img-card']) {
    await page.locator(`#walkthrough a[href="${target}"]`).click();
    await expect(page.locator(target)).toBeInViewport();
  }
  await page.locator('#img-card a[href="#walkthrough"]').click();
  await expect(page.locator('#walkthrough-h')).toBeInViewport();
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
