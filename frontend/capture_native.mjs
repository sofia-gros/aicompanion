import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';

const PREVIEW_PORT = 4174;
const SCREENSHOT_DIR = "a:\\Project\\aicompanion\\docs\\screenshots";

console.log("=== Vite preview (ポート " + PREVIEW_PORT + ") 起動 ===");
const preview = spawn("npx", ["vite", "preview", "--port", String(PREVIEW_PORT), "--strictPort"], {
  cwd: "a:\\Project\\aicompanion\\frontend",
  shell: true
});

preview.stdout.on('data', d => console.log(`[Preview] ${d}`));
preview.stderr.on('data', d => console.error(`[Preview ERR] ${d}`));

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  await wait(3000);
  console.log("Playwright 起動 (GPUフラグ有効化)...");
  const browser = await chromium.launch({
    args: [
      '--use-gl=angle',
      '--use-angle=d3d11',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[Browser PageError] ${err.message}`));

  // 1. Studio メイン画面 (Live2D バストアップ完全描画)
  console.log("1. Studio メイン画面読み込み中...");
  await page.goto(`http://localhost:${PREVIEW_PORT}/`, { waitUntil: 'networkidle' });
  await wait(4000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'app_studio.png') });
  console.log("-> app_studio.png 保存完了");

  // 2. VRM 3Dモード (Seed-san 完全描画)
  console.log("2. VRM 3Dモードに切り替え中...");
  const vrmBtn = await page.$('button:has-text("VRM")');
  if (vrmBtn) {
    await vrmBtn.click();
    await wait(4000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'vrm_3d_mode.png') });
    console.log("-> vrm_3d_mode.png 保存完了");
  }

  // 3. モデル入手モーダル
  console.log("3. モデル入手モーダルを開く...");
  const modelBtn = await page.$('button:has-text("モデル入手")');
  if (modelBtn) {
    await modelBtn.click();
    await wait(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'model_downloader.png') });
    console.log("-> model_downloader.png 保存完了");
    await page.keyboard.press('Escape');
    await wait(500);
  }

  // 4. キャラクター作成モーダル
  console.log("4. キャラクター作成モーダルを開く...");
  const newCharBtn = await page.$('button[title="新規キャラクター追加"]');
  if (newCharBtn) {
    await newCharBtn.click();
    await wait(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'character_customizer.png') });
    console.log("-> character_customizer.png 保存完了");
    const cancelBtn = await page.$('button:has-text("キャンセル")');
    if (cancelBtn) await cancelBtn.click();
    else await page.keyboard.press('Escape');
    await wait(500);
  }

  // 5. 本物のデスクトップ常駐オーバーレイ画面 (デスクトップ作業画面 + Live2D 透過オーバーレイ)
  console.log("5. デスクトップ常駐オーバーレイ画面 (作業環境 + Live2D 透過オーバーレイ) 撮影中...");
  const desktopPage = await context.newPage();
  await desktopPage.setViewportSize({ width: 1280, height: 800 });
  
  // デスクトップ作業環境 (VS Code + ターミナル風) のHTMLに、右下オーバーレイとして avatar.html を iframe 埋め込み
  const desktopHtml = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "BIZ UDPGothic", sans-serif; }
        body { background: #1e1e1e; color: #d4d4d4; width: 100vw; height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
        /* Windows 風タイトルバー / エディタ UI */
        .window-header { background: #323233; height: 35px; display: flex; align-items: center; padding: 0 16px; font-size: 12px; color: #cccccc; border-bottom: 1px solid #252526; justify-content: space-between; }
        .editor-container { display: flex; flex: 1; overflow: hidden; }
        .sidebar { width: 220px; background: #252526; border-right: 1px solid #1e1e1e; padding: 12px; font-size: 13px; }
        .sidebar-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #858585; margin-bottom: 8px; font-weight: bold; }
        .file-item { padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 8px; color: #cccccc; font-size: 12px; }
        .file-item.active { background: #37373d; color: #ffffff; }
        .editor-main { flex: 1; display: flex; flex-direction: column; background: #1e1e1e; }
        .tab-bar { background: #2d2d2d; height: 35px; display: flex; align-items: center; border-bottom: 1px solid #1e1e1e; }
        .tab { background: #1e1e1e; color: #ffffff; padding: 8px 16px; font-size: 12px; border-top: 2px solid #007acc; display: flex; align-items: center; gap: 6px; }
        .code-area { flex: 1; padding: 16px; font-family: Consolas, "Courier New", monospace; font-size: 13px; line-height: 1.6; color: #9cdcfe; }
        .code-line { display: flex; }
        .line-num { width: 35px; color: #858585; user-select: none; }
        .terminal-panel { height: 160px; background: #181818; border-top: 1px solid #2d2d2d; padding: 12px 16px; font-family: Consolas, monospace; font-size: 12px; }
        .terminal-header { font-size: 11px; color: #858585; margin-bottom: 6px; font-weight: bold; text-transform: uppercase; }
        .terminal-text { color: #4ec9b0; }
        /* Windows タスクバー */
        .taskbar { height: 42px; background: #101010; border-top: 1px solid #282828; display: flex; align-items: center; padding: 0 16px; justify-content: space-between; z-index: 1000; }
        .taskbar-start { display: flex; align-items: center; gap: 12px; }
        .start-btn { width: 28px; height: 28px; background: #0078d4; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; }
        .taskbar-app { background: #2d2d2d; padding: 4px 12px; border-radius: 4px; font-size: 12px; border-bottom: 2px solid #007acc; }
        .taskbar-time { font-size: 12px; color: #aaaaaa; text-align: right; }
        /* 透明アバター常駐オーバーレイ iframe */
        .avatar-overlay-iframe {
          position: fixed;
          right: 20px;
          bottom: 48px;
          width: 380px;
          height: 520px;
          border: none;
          background: transparent;
          z-index: 9999;
          pointer-events: none;
        }
      </style>
    </head>
    <body>
      <div class="window-header">
        <span>Visual Studio Code - aicompanion</span>
        <span style="color: #666;">- □ ×</span>
      </div>
      <div class="editor-container">
        <div class="sidebar">
          <div class="sidebar-title">エクスプローラー</div>
          <div class="file-item active">📄 main.go</div>
          <div class="file-item">📄 pipeline.go</div>
          <div class="file-item">📄 memory.go</div>
          <div class="file-item">📁 pkg/tts</div>
        </div>
        <div class="editor-main">
          <div class="tab-bar">
            <div class="tab"><span>Go</span> main.go</div>
          </div>
          <div class="code-area">
            <div class="code-line"><span class="line-num">1</span><span><span style="color:#c586c0">package</span> main</span></div>
            <div class="code-line"><span class="line-num">2</span><span></span></div>
            <div class="code-line"><span class="line-num">3</span><span><span style="color:#6a9955">// AI Companion デスクトップ常駐エージェント</span></span></div>
            <div class="code-line"><span class="line-num">4</span><span><span style="color:#c586c0">func</span> <span style="color:#dcdcaa">main</span>() {</span></div>
            <div class="code-line"><span class="line-num">5</span><span>    app := NewApp()</span></div>
            <div class="code-line"><span class="line-num">6</span><span>    app.StartBackgroundWorker()</span></div>
            <div class="code-line"><span class="line-num">7</span><span>    <span style="color:#6a9955">// 常駐オーバーレイウィンドウ表示</span></span></div>
            <div class="code-line"><span class="line-num">8</span><span>    wails.Run(app.Options())</span></div>
            <div class="code-line"><span class="line-num">9</span><span>}</span></div>
          </div>
          <div class="terminal-panel">
            <div class="terminal-header">ターミナル - powershell</div>
            <div class="terminal-text">[17:35:02] AI Companion Engine: llama-server (Gemma-4-2B) online</div>
            <div class="terminal-text">[17:35:03] Style-Bert-VITS2: TTS Engine online (Port 50021)</div>
            <div class="terminal-text" style="color: #dcdcaa;">[17:35:04] 常駐オーバーレイ: 起動完了 (透明描画アクティブ)</div>
          </div>
        </div>
      </div>
      <div class="taskbar">
        <div class="taskbar-start">
          <div class="start-btn">田</div>
          <div class="taskbar-app">Visual Studio Code</div>
          <div class="taskbar-app" style="background: rgba(99, 102, 241, 0.2); border-bottom-color: #6366f1;">AI Companion</div>
        </div>
        <div class="taskbar-time">17:35<br>2026/09/04</div>
      </div>
      <!-- 本物の avatar.html を iframe 埋め込み (WebGL Live2D + 字幕) -->
      <iframe class="avatar-overlay-iframe" src="http://localhost:${PREVIEW_PORT}/avatar.html?text=プログラミングお疲れさま！少し休憩しよう？" allowtransparency="true"></iframe>
    </body>
    </html>
  `;
  await desktopPage.setContent(desktopHtml);
  // iframe内のモデルロードと描画完了を待機
  await wait(6000);
  await desktopPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_overlay.png') });
  console.log("-> desktop_overlay.png 保存完了");

  // 6. 単体透明ウィンドウ (avatar_window.png)
  console.log("6. 単体透明ウィンドウ (avatar_window.png) 撮影中...");
  const avatarPage = await context.newPage();
  await avatarPage.setViewportSize({ width: 400, height: 600 });
  await avatarPage.goto(`http://localhost:${PREVIEW_PORT}/avatar.html?text=ご主人様、今日もお疲れ様です！`, { waitUntil: 'networkidle' });
  await wait(5000);
  await avatarPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'avatar_window.png') });
  console.log("-> avatar_window.png 保存完了");

  await browser.close();
  preview.kill();
  console.log("=== 全キャプチャ完了 ===");
  process.exit(0);
}

run().catch(err => {
  console.error("キャプチャ実行エラー:", err);
  preview.kill();
  process.exit(1);
});
