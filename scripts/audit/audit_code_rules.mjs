// 規約・アーキテクチャ検査スクリプト
// 絵文字の完全排除、日本語DOCコメントの遵守、Cgo非依存、Windows Job Object経由でのプロセス管理を検証します。

import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve('.');

// 絵文字正規表現 (サロゲートペアおよび基本絵文字ブロック)
const EMOJI_REGEX = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u26FF]|[\u2700-\u27BF]/g;

// 日本語文字判定 (ひらがな、カタカナ、漢字)
const JAPANESE_CHAR_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;

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

// 走査対象ディレクトリ内のファイルを再帰的に取得
function getFiles(dir, exts, excludes = ['node_modules', '.git', 'dist', 'bin']) {
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

// 1. 絵文字完全排除の検査
function checkEmojiCompliance() {
  console.log('\n--- 1. 絵文字完全排除チェック ---');
  const filesToCheck = [
    ...getFiles(path.join(ROOT_DIR, 'frontend', 'src'), ['.ts', '.tsx', '.css']),
    ...getFiles(path.join(ROOT_DIR, 'pkg'), ['.go']),
    ...getFiles(path.join(ROOT_DIR, 'docs'), ['.md']),
    path.join(ROOT_DIR, 'README.md'),
    path.join(ROOT_DIR, 'main.go'),
    path.join(ROOT_DIR, 'app.go')
  ].filter(f => fs.existsSync(f));

  let emojiCount = 0;
  for (const file of filesToCheck) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      const matches = line.match(EMOJI_REGEX);
      if (matches) {
        logError(path.relative(ROOT_DIR, file), idx + 1, `絵文字を検出しました: ${matches.join(' ')}`);
        emojiCount += matches.length;
      }
    });
  }

  if (emojiCount === 0) {
    logPass('全対象ファイルで絵文字ゼロを確認しました。');
  }
}

// 2. Cgo 非依存チェック (Pure-Go SQLite 遵守)
function checkCgoDependency() {
  console.log('\n--- 2. Cgo 非依存チェック ---');
  const goFiles = [
    ...getFiles(path.join(ROOT_DIR, 'pkg'), ['.go']),
    path.join(ROOT_DIR, 'main.go'),
    path.join(ROOT_DIR, 'app.go')
  ].filter(f => fs.existsSync(f));

  let cgoFound = false;
  for (const file of goFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (/import\s+("C"|`C`)/.test(content)) {
      logError(path.relative(ROOT_DIR, file), null, 'Cgo 依存 (import "C") が検出されました。Pure-Go ライブラリを使用してください。');
      cgoFound = true;
    }
  }

  if (!cgoFound) {
    logPass('Cgo (import "C") への依存ゼロを確認しました。');
  }
}

// 3. 外部プロセス管理チェック (Windows Job Object 遵守)
function checkProcessManagement() {
  console.log('\n--- 3. 外部プロセス管理チェック (Windows Job Object) ---');
  const goFiles = [
    ...getFiles(path.join(ROOT_DIR, 'pkg'), ['.go']),
    path.join(ROOT_DIR, 'main.go'),
    path.join(ROOT_DIR, 'app.go')
  ].filter(f => fs.existsSync(f));

  let rawExecCount = 0;
  for (const file of goFiles) {
    const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    // pkg/process/ 配下はプロセス管理コアなので許可
    if (rel.startsWith('pkg/process/')) continue;

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      // コメント行はスキップ
      if (line.trim().startsWith('//')) return;
      if (line.includes('exec.Command(')) {
        logError(rel, idx + 1, 'exec.Command の裸呼び出しを検出しました。必ず pkg/process/manager.go (Job Object) を介して実行してください。');
        rawExecCount++;
      }
    });
  }

  if (rawExecCount === 0) {
    logPass('全外部プロセス呼び出しが Job Object 管理下で行われていることを確認しました。');
  }
}

// 4. 日本語 DOC コメント検査
function checkJapaneseDocComments() {
  console.log('\n--- 4. 日本語 DOC コメント遵守チェック ---');
  const goFiles = [
    ...getFiles(path.join(ROOT_DIR, 'pkg'), ['.go']),
    path.join(ROOT_DIR, 'app.go')
  ].filter(f => fs.existsSync(f));

  let missingCommentCount = 0;
  for (const file of goFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 公開関数または型の定義を検出 (例: func ExportedFunc, type ExportedType)
      const isExported = /^(func\s+(\([a-zA-Z0-9_*]+\)\s+)?[A-Z][a-zA-Z0-9_]*|type\s+[A-Z][a-zA-Z0-9_]*)/.test(line.trim());
      if (isExported) {
        // 直前の行に日本語コメントがあるか確認
        let hasJapaneseComment = false;
        let prevIdx = i - 1;
        while (prevIdx >= 0 && lines[prevIdx].trim().startsWith('//')) {
          if (JAPANESE_CHAR_REGEX.test(lines[prevIdx])) {
            hasJapaneseComment = true;
            break;
          }
          prevIdx--;
        }
        if (!hasJapaneseComment) {
          logWarn(path.relative(ROOT_DIR, file), i + 1, `公開シンボルの直前に日本語DOCコメントがありません: "${line.trim().substring(0, 40)}..."`);
          missingCommentCount++;
        }
      }
    }
  }

  if (missingCommentCount === 0) {
    logPass('すべての主要な公開シンボルに日本語DOCコメントが存在することを確認しました。');
  }
}

console.log('=== 規約・アーキテクチャ適合性監査開始 ===');
checkEmojiCompliance();
checkCgoDependency();
checkProcessManagement();
checkJapaneseDocComments();

console.log('\n========================================');
console.log(`監査結果: エラー ${totalErrors} 件, 警告 ${totalWarnings} 件`);
if (totalErrors > 0) {
  console.error('重大な規約違反またはアーキテクチャ不備が存在します。修正してください。');
  process.exit(1);
} else {
  console.log('すべての規約・アーキテクチャ監査をクリアしました。');
  process.exit(0);
}
