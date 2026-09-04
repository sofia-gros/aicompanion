# Antigravity プロジェクト開発規約 (GEMINI.md)

本ファイルは、AIアシスタント（Antigravity）が本プロジェクトで作業を行う際の最優先遵守事項を定義します。

---

## 1. 最優先グローバルルール

### 1.1 DOCコメントおよびコード内解説は必ず「日本語」で記述すること
- すべてのGoソースコードの型・関数・メソッドのDocコメント、パッケージコメント、コード内インラインコメントは**日本語**で記述しなければなりません。
- TypeScript / React コンポーネント、フック、型定義のJSDocコメントも**日本語**で記述しなければなりません。

### 1.2 最新安定版（Latest Stable）の採用と維持
- Go (1.24+ / 最新安定版)、Node.js (LTS/Current)、TypeScript (5.x)、Vite (6.x)、Three.js、Wails (v2.11+) 等の依存ライブラリは、最新安定版を基準とします。
- ライブラリの固有制約（例: `pixi-live2d-display` は PixiJS v7 安定版を要求）がある場合は、設計書（`docs/library_specifications.md`）の整合性指定に従います。

---

## 2. 実装・設計の絶対原則（バグ根絶基準）

### 2.1 外部プロセスのゾンビ化ゼロ保証 (Windows Job Object)
- `llama-server.exe` や TTSサーバーなどの外部プロセスを起動する際は、必ず Windows Job Object (`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`) に登録すること。
- 親プロセス（Go）がクラッシュや強制終了しても、子プロセスがOS上に孤立残留してポート衝突やリソースリークを起こすことを絶対に防ぐ。

### 2.2 Cコンパイラ（Cgo）非依存の徹底
- バックエンドのSQLiteおよびベクトル記憶管理は、外部Cコンパイラ（GCC/Clang）を要求しない Pure-Go ライブラリ（`modernc.org/sqlite`）を使用し、Windows環境でのビルド失敗を根絶する。

### 2.3 音声パイプラインのシーケンス順序保証
- 非同期並列で生成されるTTS音声チャンクは、必ずバックエンドで `seqId` を付与し、フロントエンドの `AudioService` でシーケンス番号順に整列して連結再生すること。

### 2.4 型安全性の徹底
- TypeScriptでは `any` の使用を禁止し、厳格な型（`strict: true`）を維持する。
- GoとTypeScript間で送受信するIPCイベントデータは、`docs/system_architecture.md` に定義されたインターフェース定義と100%一致させる。

---

## 3. 参照ドキュメント
- [プロジェクト概要書](file:///a:/Project/aicompanion/docs/overview.md)
- [全体設計書](file:///a:/Project/aicompanion/docs/system_architecture.md)
- [フロントエンド設計書](file:///a:/Project/aicompanion/docs/frontend_design.md)
- [バックエンド設計書](file:///a:/Project/aicompanion/docs/backend_design.md)
- [使用ライブラリ仕様書](file:///a:/Project/aicompanion/docs/library_specifications.md)
