---
trigger: always_on
---

# アーキテクチャ境界遵守規約 (Architecture Rules)

## 1. プロセス管理の厳格運用
- 外部プロセス（`llama-server.exe`, Style-Bert-VITS2）の起動・停止は必ず `pkg/process/manager.go` を介すること。
- 直接 `exec.Command` を他パッケージで裸で実行してはならない。
- Windows Job Object（`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`）の管理下に必ず登録すること。

## 2. フロントエンドとバックエンドの責務分離
- フロントエンド（React）はUI描画、アバター制御（視線追従、リップシンク）、音声バッファ再生に専念する。
- 句分割、プロンプト組み立て、TTS呼び出し、記憶検索などのビジネスロジックは必ずGoバックエンド（`pkg/pipeline`）で行う。
- WailsのIPCイベント通信は、`docs/system_architecture.md` に規定されたイベント名・データ構造を厳密に遵守する。

## 3. ストレージと記憶アクセス
- データベース操作はすべて `pkg/memory` パッケージ内にカプセル化する。
- Cgo（GCC/Clang）に依存する拡張機能の直接リンクは行わず、Pure-Go SQLiteドライバを使用する。
- 記憶検索時のベクトルコサイン類似度計算は、インメモリの高速並列計算関数（Goネイティブ）で行う。
