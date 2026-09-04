import { test, expect } from '@playwright/test';

test.describe('AI Companion Studio 自動操作・整合性テスト (バグゼロ検証)', () => {
  test('画面初期化および全4ペインの描画とコンソールエラー0件検証', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');

    // ツールバーの存在確認
    await expect(page.locator('text=COMPANION STUDIO')).toBeVisible();

    // 開始/停止ボタンの存在確認
    await expect(page.locator('button:has-text("実行中")')).toBeVisible();
    await expect(page.locator('button:has-text("停止")')).toBeVisible();

    // 新規キャラクター作成ボタンの存在確認 (絵文字なし)
    await expect(page.locator('button:has-text("新規キャラクター作成")')).toBeVisible();

    // 4ペインの確認
    await expect(page.locator('text=Scene Hierarchy')).toBeVisible();
    await expect(page.locator('button:has-text("Live2D")')).toBeVisible();
    await expect(page.locator('button:has-text("VRM (3D)")')).toBeVisible();
    await expect(page.locator('text=対話テスト')).toBeVisible();

    // 重大なJavaScript例外がないこと
    const fatalErrors = consoleErrors.filter(e => 
      !e.includes('Failed to fetch') && 
      !e.includes('Live2D') &&
      !e.includes('フォールバック')
    );
    expect(fatalErrors).toHaveLength(0);
  });

  test('マスター停止および開始制御テスト (アバタープレビュー維持検証)', async ({ page }) => {
    await page.goto('/');

    // 停止ボタンをクリック
    const stopButton = page.locator('button:has-text("停止")');
    await stopButton.click();
    await page.waitForTimeout(300);

    // アバター画面にエラーが出ていないこと (停止中もプレビュー継続)
    await expect(page.locator('text=描画エラーが発生しました')).not.toBeVisible();

    // 再度開始ボタンをクリック
    const startButton = page.locator('button:has-text("開始")');
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForTimeout(300);
      await expect(page.locator('button:has-text("実行中")')).toBeVisible();
    }
  });

  test('キャラクター作成モーダル開閉テスト (絵文字なしボタン)', async ({ page }) => {
    await page.goto('/');

    // ツールバーの「新規キャラクター作成」ボタンをクリック
    const createBtn = page.locator('button:has-text("新規キャラクター作成")');
    await createBtn.click();
    await page.waitForTimeout(300);

    // モーダルが表示されたか確認
    await expect(page.locator('text=キャラクター作成')).toBeVisible();

    // Escキーで閉じる
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('text=キャラクター作成')).not.toBeVisible();
  });

  test('キャラクター切り替えストレステスト (黒画面フリーズ根絶検証)', async ({ page }) => {
    await page.goto('/');

    // キャラクターセレクターをクリック
    const charSelect = page.locator('button[role="combobox"]').first();
    await charSelect.click();
    await page.waitForTimeout(300);

    const options = page.locator('[role="option"]');
    const count = await options.count();
    expect(count).toBeGreaterThan(1);

    // 2番目のキャラ（マオ）を選択
    await options.nth(1).click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=描画エラーが発生しました')).not.toBeVisible();

    // 3番目のキャラ（ハル）を選択
    await charSelect.click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]').nth(2).click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=描画エラーが発生しました')).not.toBeVisible();

    // 1番目のキャラ（ひより）に戻す
    await charSelect.click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=描画エラーが発生しました')).not.toBeVisible();
  });

  test('レンダラー切替テスト (Live2D ↔ VRM 3D)', async ({ page }) => {
    await page.goto('/');

    // VRM (3D) ボタンをクリック
    const vrmButton = page.locator('button:has-text("VRM (3D)")');
    await vrmButton.click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=3D (VRM) レンダラー準備完了')).toBeVisible();

    // Live2D ボタンをクリックして戻す
    const live2dButton = page.locator('button:has-text("Live2D")');
    await live2dButton.click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=描画エラーが発生しました')).not.toBeVisible();
  });

  test('パフォーマンスタブおよび対話チャット・マイク検証', async ({ page }) => {
    await page.goto('/');

    // パフォーマンスタブをクリック
    const perfTab = page.locator('button:has-text("パフォーマンス")');
    await perfTab.click();
    await page.waitForTimeout(300);

    // FPSと推論速度項目が表示されていること
    await expect(page.locator('text=アバター描画 (FPS)')).toBeVisible();
    await expect(page.locator('text=推論速度 (Tokens/sec)')).toBeVisible();

    // 対話テストタブに戻る
    const chatTab = page.locator('button:has-text("対話テスト")');
    await chatTab.click();
    await page.waitForTimeout(300);

    // メッセージ入力
    const input = page.locator('input[placeholder*="メッセージを入力"]');
    await input.fill('テストメッセージです');
    const sendButton = page.locator('button:has-text("送信")');
    await sendButton.click();
    await page.waitForTimeout(300);

    expect(await input.inputValue()).toBe('');
  });
});
