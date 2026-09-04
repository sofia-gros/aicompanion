import { test, expect } from '@playwright/test';

test('Live2DおよびVRMのネイティブレンダリング検証', async ({ page }) => {
  test.setTimeout(60000);
  page.on('console', msg => console.log(`[Console] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[PageError] ${err.message}`));
  page.on('request', req => console.log(`[Request] ${req.url()}`));
  page.on('requestfailed', req => console.log(`[RequestFailed] ${req.url()}: ${req.failure()?.errorText}`));

  await page.goto('/');
  await page.waitForTimeout(6000);

  // Live2D キャンバスの存在確認
  const canvas = page.locator('canvas');
  await page.screenshot({ path: '../test_live2d.png' });

  // VRMに切り替え
  const vrmBtn = page.locator('button:has-text("VRM")');
  await vrmBtn.click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '../test_vrm.png' });
});
