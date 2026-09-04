---
name: companion-dev
description: デスクトップAIコンパニオン開発ワークフロー、外部依存検証、ビルド・テスト支援スキル
---

# AIコンパニオン開発ワークフロースキル (companion-dev)

本スキルは、デスクトップ常駐型AIコンパニオンの開発・検証・ビルドを円滑に行い、バグや環境トラブルを未然に防ぐための標準手順を提供します。

---

## 1. 開発環境前提条件チェック

開発作業を開始する前に、必要なツールチェーンが整っているかを確認します。

```powershell
# Go バージョン確認 (1.24+ 推奨)
go version

# Node.js & npm バージョン確認 (Node 22/24+ 推奨)
node -v
npm -v

# Wails CLI バージョン確認 (v2.11+ 推奨)
wails version
```

---

## 2. 実装時の絶対遵守ルール (Quick Checklist)

1. **DOCコメント・インラインコメントは必ず「日本語」で記述する。**
2. **外部プロセスの起動**:
   - 必ず `pkg/process/job_windows.go` で生成された Job Object に登録する。
   - `exec.Command` を裸で放置し、ゾンビプロセスを発生させてはならない。
3. **音声合成の拡張性 (TTS Provider)**:
   - 音声合成処理を呼ぶ際は、必ず `pkg/tts.TTSProvider` インターフェース経由で行う。
   - Style-Bert-VITS2, VOICEVOX, または開発用 MockTTS の切り替えに対応させる。
4. **Cgo非依存**:
   - SQLiteは `modernc.org/sqlite` を使用し、外部Cコンパイラ（gcc/clang）に依存しない。

---

## 3. 開発モード実行手順

### 3.1 外部サーバー非依存（モック）での迅速なフロント・UI開発
外部の `llama-server.exe` や VOICEVOX が手元にない状態でもフロントエンドとパイプラインをテストできるよう、Goバックエンドにモックモードを備えます。

```powershell
# Wails 開発サーバーの起動 (ホットリロード有効)
wails dev
```

### 3.2 外部サーバーのヘルスチェックコマンド
開発中に外部エンジンと接続テストを行う際の確認コマンド：

```powershell
# llama-server の稼働確認
curl http://127.0.0.1:8080/health

# VOICEVOX の稼働確認
curl http://127.0.0.1:50021/version

# Style-Bert-VITS2 の稼働確認
curl http://127.0.0.1:5000/
```

---

## 4. ビルド＆検証コマンド

### 4.1 Go バックエンド単体テスト
```powershell
go test -v ./pkg/...
```

### 4.2 フロントエンド型チェック＆リント
```powershell
cd frontend
npm run build # TypeScriptコンパイル (tsc -b) & Viteビルド
cd ..
```

### 4.3 プロダクションバイナリビルド
```powershell
wails build -clean
```
ビルドされたバイナリは `build/bin/aicompanion.exe` に出力されます。
