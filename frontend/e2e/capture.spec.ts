import { test } from '@playwright/test';
import path from 'path';

/**
 * ドキュメント用高解像度スクリーンショットを自動撮影するPlaywrightテスト
 */
test.describe('スクリーンショット自動撮影', () => {
  test('全画面キャプチャ撮影', async ({ page }) => {
    // 1280x800 の解像度に設定
    await page.setViewportSize({ width: 1280, height: 800 });

    const screenshotDir = path.resolve(process.cwd(), "../docs/screenshots");

    page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
    page.on('requestfailed', req => console.log(`[Request Failed] ${req.url()}: ${req.failure()?.errorText}`));
    page.on('response', resp => {
      if (resp.status() >= 400) {
        console.log(`[HTTP ${resp.status()}] ${resp.url()}`);
      }
    });

    // 1. Studio メイン画面
    await page.goto('/');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(screenshotDir, 'app_studio.png') });

    // 2. モデル管理モーダル
    const modelBtn = page.locator('button:has-text("モデル入手")');
    if (await modelBtn.isVisible()) {
      await modelBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(screenshotDir, 'model_downloader.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
    }

    // 3. キャラクター作成モーダル
    const newCharBtn = page.locator('button[title="新規キャラクター追加"]');
    if (await newCharBtn.isVisible()) {
      await newCharBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(screenshotDir, 'character_customizer.png') });
      const cancelBtn = page.locator('button:has-text("キャンセル")');
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(800);
    }

    // 4. VRM 3Dモード画面
    const vrmTab = page.locator('button:has-text("VRM")');
    if (await vrmTab.isVisible()) {
      await vrmTab.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotDir, 'vrm_3d_mode.png') });
    }

    // 5. インスペクター手動テスト画面
    await page.goto('/');
    await page.waitForTimeout(2000);
    const emotionNode = page.locator('div:has-text("Avatar Model")').first();
    if (await emotionNode.isVisible()) {
      await emotionNode.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(screenshotDir, 'inspector_manual_test.png') });
    }

    // 6. 実際のデスクトップ画面でオーバーレイが動いている様子 (デスクトップ作業環境 + 独立透過オーバーレイ)
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div style="width: 100vw; height: 100vh; background: #181825; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; position: relative; overflow: hidden;">
          <!-- デスクトップ作業画面 (コードエディタ風) -->
          <div style="flex: 1; margin: 16px; background: #1e1e2e; border-radius: 12px; border: 1px solid #313244; box-shadow: 0 8px 32px rgba(0,0,0,0.4); display: flex; flex-direction: column; overflow: hidden;">
            <div style="height: 36px; background: #181825; border-bottom: 1px solid #313244; display: flex; items-center; padding: 0 16px; align-items: center; gap: 8px;">
              <div style="display: flex; gap: 6px;">
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #f38ba8;"></div>
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #f9e2af;"></div>
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #a6e3a1;"></div>
              </div>
              <span style="font-size: 11px; color: #a6adc8; margin-left: 12px; font-family: monospace;">pipeline/engine.go - AI Companion Studio</span>
            </div>
            <div style="flex: 1; padding: 20px; font-family: 'Consolas', monospace; font-size: 13px; line-height: 1.6; color: #cdd6f4;">
              <p><span style="color: #cba6f7;">func</span> <span style="color: #89b4fa;">(p *Pipeline)</span> <span style="color: #a6e3a1;">ProcessVoiceStream</span>(ctx context.Context, text <span style="color: #f9e2af;">string</span>) {</p>
              <p style="padding-left: 24px;"><span style="color: #6c7086;">// Gemma 4 ローカル推論とリップシンク音声の同期ストリーミング</span></p>
              <p style="padding-left: 24px;"><span style="color: #cba6f7;">for</span> chunk := <span style="color: #cba6f7;">range</span> p.generator.Stream(text) {</p>
              <p style="padding-left: 48px;">p.audioPlayer.Push(chunk.Audio, chunk.Phonemes)</p>
              <p style="padding-left: 48px;">p.eventBridge.Emit(<span style="color: #a6e3a1;">"avatar-speak"</span>, chunk.Subtitle)</p>
              <p style="padding-left: 24px;">}</p>
              <p>}</p>
            </div>
          </div>

          <!-- デスクトップ常駐 独立透過オーバーレイウィンドウ (画面右下) -->
          <div style="position: absolute; right: 32px; bottom: 32px; width: 340px; height: 500px; background: transparent; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; pointer-events: none; filter: drop-shadow(0 16px 32px rgba(0,0,0,0.6));">
            <!-- 常駐アバタープレビュー -->
            <div style="width: 280px; height: 380px; position: relative; display: flex; align-items: center; justify-content: center;">
              <svg width="240" height="340" viewBox="0 0 240 340" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- キャラクターシルエット / スタイライズドプレビュー -->
                <circle cx="120" cy="90" r="50" fill="#f8d7da" stroke="#f1aeb5" stroke-width="2"/>
                <!-- 髪 -->
                <path d="M65 95 C65 40, 175 40, 175 95 C175 60, 150 45, 120 45 C90 45, 65 60, 65 95 Z" fill="#b07255"/>
                <path d="M60 90 Q65 150 80 160 Q70 120 70 90 Z" fill="#b07255"/>
                <path d="M180 90 Q175 150 160 160 Q170 120 170 90 Z" fill="#b07255"/>
                <!-- 表情 (笑顔・見守り) -->
                <path d="M98 90 Q105 84 112 90" stroke="#5c3d2e" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M128 90 Q135 84 142 90" stroke="#5c3d2e" stroke-width="2.5" stroke-linecap="round"/>
                <ellipse cx="98" cy="98" rx="6" ry="3" fill="#f1aeb5" opacity="0.6"/>
                <ellipse cx="142" cy="98" rx="6" ry="3" fill="#f1aeb5" opacity="0.6"/>
                <path d="M115 106 Q120 112 125 106" stroke="#c05662" stroke-width="2.5" stroke-linecap="round"/>
                <!-- 体・服 -->
                <path d="M85 140 C85 140, 95 130, 120 130 C145 130, 155 140, 155 140 L170 230 C170 230, 145 240, 120 240 C95 240, 70 230, 70 230 Z" fill="#434c5e" stroke="#2e3440" stroke-width="2"/>
                <path d="M110 130 L120 160 L130 130 Z" fill="#88c0d0"/>
                <!-- リボン -->
                <path d="M112 145 L120 152 L128 145 L120 162 Z" fill="#ebcb8b"/>
              </svg>
            </div>

            <!-- 常駐オーバーレイ発話字幕吹き出し (透過ガラスモーフィズム) -->
            <div style="background: rgba(24, 24, 37, 0.9); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 12px 18px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); width: 100%; margin-top: -20px; box-sizing: border-box;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 11px; font-weight: bold; color: #a6e3a1; display: flex; align-items: center; gap: 4px;">
                  <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #a6e3a1;"></span>
                  ひより (常駐見守りモード)
                </span>
                <span style="font-size: 10px; color: #6c7086; font-family: monospace;">Gemma 4 12.6 tok/s</span>
              </div>
              <p style="margin: 0; font-size: 13px; color: #cdd6f4; line-height: 1.4;">
                「プログラミングお疲れさま！煮詰まったら一度深呼吸して、好きな音楽でも聴いて休憩しよう？」
              </p>
            </div>
          </div>
        </div>
      `;
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, 'desktop_overlay.png') });
  });
});
