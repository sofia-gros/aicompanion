// UI不備およびモック残存検査スクリプト
// フロントエンドコード内のモック残存、空ハンドラ、TODOコメント、重複ボタン、不正なany型を静的解析します。

import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve('.');
const FRONTEND_SRC = path.join(ROOT_DIR, 'frontend', 'src');

let totalErrors = 0;
let totalWarnings = 0;

function logError(file, line, msg) {
  console.error(`[FAIL] ${file}${line ? `:${line}` : ''} - ${msg}`);
  totalErrors++;
}

function logWarn(file, line, msg) {
  console.warn(`[WARN] ${file}${line ? `:${line}` : ''} - ${msg}`);
  totalWarnings++;
}

function logPass(msg) {
  console.log(`[PASS] ${msg}`);
}

function getFiles(dir, exts, excludes = ['node_modules', '.git', 'dist']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    if (excludes.includes(item.name)) continue;
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(getFiles(fullPath, exts, excludes));
    } else {
      const ext = path.extname(item.name).toLowerCase();
      if (exts.includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

// 1. モック文言・仮実装残存チェック
function checkMockRemnants() {
  console.log('\n--- 1. モック文言・未実装表記チェック ---');
  const files = getFiles(FRONTEND_SRC, ['.ts', '.tsx']);
  let mockCount = 0;

  for (const file of files) {
    const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      // コメント行で純粋な解説以外のモック表示
      if (/モック(表示|データ|UI|モード|ボタン)/.test(line) && !line.includes('//') && !line.includes('/*')) {
        logWarn(rel, idx + 1, `UI表示にモック文言が含まれています: "${line.trim().substring(0, 50)}"`);
        mockCount++;
      }
      if (/\b(TODO|FIXME|XXX)\b/i.test(line)) {
        // 残タスクの警告
        logWarn(rel, idx + 1, `未解決のタスクコメントが残っています: "${line.trim().substring(0, 50)}"`);
        mockCount++;
      }
    });
  }

  if (mockCount === 0) {
    logPass('未解決のモック文言およびTODOコメントは検出されませんでした。');
  }
}

// 2. 空ハンドラ (onClick={() => {}}) チェック
function checkEmptyHandlers() {
  console.log('\n--- 2. 空イベントハンドラ検査 (未接続ボタン) ---');
  const files = getFiles(FRONTEND_SRC, ['.tsx']);
  let emptyHandlerCount = 0;

  for (const file of files) {
    const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      // onClick={() => {}} または onClick={() => console.log(...)} などを検出
      if (/onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/.test(line)) {
        logError(rel, idx + 1, `クリックハンドラが空のまま放置されています: "${line.trim()}"`);
        emptyHandlerCount++;
      }
      if (/onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*console\.log\(.*\)\s*\}/.test(line)) {
        logWarn(rel, idx + 1, `コンソール出力のみの仮ハンドラです: "${line.trim()}"`);
        emptyHandlerCount++;
      }
    });
  }

  if (emptyHandlerCount === 0) {
    logPass('すべてのクリックハンドラが正しくロジックまたはステートに接続されています。');
  }
}

// 3. 重複ボタン・UI冗長性チェック
function checkDuplicateButtons() {
  console.log('\n--- 3. 同一画面内の重複ボタン検査 ---');
  const files = getFiles(FRONTEND_SRC, ['.tsx']);
  let duplicateCount = 0;

  for (const file of files) {
    const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf-8');

    // <button ...>ボタン名</button> を抽出
    const buttonRegex = /<button[^>]*>([\s\S]*?)<\/button>/g;
    const buttonTexts = [];
    let match;
    while ((match = buttonRegex.exec(content)) !== null) {
      // テキスト部分のみ抽出 (タグは除去)
      const text = match[1].replace(/<[^>]*>/g, '').trim();
      if (text.length > 0 && text.length < 20) {
        buttonTexts.push(text);
      }
    }

    // 重複検出 (同一ファイル内で完全に同じ名前のボタンが3個以上ある場合などに警告)
    const counts = {};
    for (const t of buttonTexts) {
      counts[t] = (counts[t] || 0) + 1;
    }

    for (const [t, cnt] of Object.entries(counts)) {
      if (cnt >= 3 && !['閉じる', 'キャンセル', '削除', '保存'].includes(t)) {
        logWarn(rel, null, `同一コンポーネント内に同名のボタン "${t}" が ${cnt} 個存在します。意図した設計か確認してください。`);
        duplicateCount++;
      }
    }
  }

  if (duplicateCount === 0) {
    logPass('同一画面内の不自然な重複ボタンは検出されませんでした。');
  }
}

// 4. 不正な any 型の使用チェック (strict TypeScript)
function checkTypeScriptAnyUsage() {
  console.log('\n--- 4. TypeScript any 型使用チェック ---');
  const files = getFiles(FRONTEND_SRC, ['.ts', '.tsx']);
  let anyCount = 0;

  for (const file of files) {
    const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    // WebGL ポリフィルや Live2D / Wails ランタイム境界等の許容ファイル
    if (
      rel.includes('Live2DCanvas.tsx') ||
      rel.includes('VRMCanvas.tsx') ||
      rel.includes('AvatarApp.tsx') ||
      rel.includes('wailsBridge.ts')
    ) {
      continue;
    }

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      // コメント行は除外
      if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
      if (/:\s*any\b/.test(line) || /as\s+any\b/.test(line)) {
        logWarn(rel, idx + 1, `any 型が検出されました。具体的な型または unknown を使用してください: "${line.trim().substring(0, 50)}"`);
        anyCount++;
      }
    });
  }

  if (anyCount === 0) {
    logPass('厳格な型安全性が維持されています (不当な any 型ゼロ)。');
  }
}

console.log('=== UI不備・モック残存静的監査開始 ===');
checkMockRemnants();
checkEmptyHandlers();
checkDuplicateButtons();
checkTypeScriptAnyUsage();

console.log('\n========================================');
console.log(`監査結果: エラー ${totalErrors} 件, 警告 ${totalWarnings} 件`);
if (totalErrors > 0) {
  console.error('未実装または不備のあるUI要素が存在します。修正してください。');
  process.exit(1);
} else {
  console.log('すべてのUI・モック監査をクリアしました。');
  process.exit(0);
}
