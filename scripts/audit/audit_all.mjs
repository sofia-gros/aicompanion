// 品質・不備総合監査ランナー (audit_all.mjs)
// 規約検査、UIモック検査、Goテスト、フロントエンドビルド検査を網羅的に実行し、
// システム全体に不備や欠落がないかを一元的に判定します。

import { spawnSync } from 'child_process';
import path from 'path';

const ROOT_DIR = path.resolve('.');
let hasFailures = false;

function runStep(name, cmd, args, cwd = ROOT_DIR) {
  console.log(`\n============================================================`);
  console.log(`>>> 監査ステップ: ${name}`);
  console.log(`コマンド: ${cmd} ${args.join(' ')} (CWD: ${cwd})`);
  console.log(`============================================================`);

  const res = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: true
  });

  if (res.status !== 0) {
    console.error(`\n[FAIL] ステップ「${name}」で不備が検出されました。(終了コード: ${res.status})`);
    hasFailures = true;
    return false;
  } else {
    console.log(`\n[PASS] ステップ「${name}」を正常にクリアしました。`);
    return true;
  }
}

console.log(`############################################################`);
console.log(`# AI Companion Studio 総合品質監査システム`);
console.log(`############################################################`);

// 1. コーディング規約・アーキテクチャ監査
runStep(
  '1. コーディング規約・アーキテクチャ検査 (絵文字/Cgo/JobObject/日本語Doc)',
  'node',
  ['scripts/audit/audit_code_rules.mjs']
);

// 2. UI不備・モック残存静的監査
runStep(
  '2. UI不備・モック残存検査 (空ハンドラ/モック表記/重複UI/any型)',
  'node',
  ['scripts/audit/audit_ui_mocks.mjs']
);

// 3. Go バックエンド単体テスト
runStep(
  '3. Go バックエンド単体テスト (パイプライン・プロセス管理・メモリ)',
  'go',
  ['test', '-v', './pkg/...']
);

// 4. フロントエンド型チェック & ビルド整合性検証
runStep(
  '4. フロントエンド TypeScript コンパイル検証 (tsc -b)',
  'npx',
  ['tsc', '-b'],
  path.join(ROOT_DIR, 'frontend')
);

console.log(`\n############################################################`);
if (hasFailures) {
  console.error(`# 総合判定: [FAIL] 一部の監査項目で不備・エラーが検出されました。`);
  console.error(`# 上記のログを確認して不備を解消してください。`);
  console.log(`############################################################`);
  process.exit(1);
} else {
  console.log(`# 総合判定: [PASS] すべての品質監査項目を完全クリアしました。`);
  console.log(`# システムの品質・規約遵守・動作整合性が保証されています。`);
  console.log(`############################################################`);
  process.exit(0);
}
