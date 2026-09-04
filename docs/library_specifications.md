# 使用ライブラリ・外部仕様書 (最新安定版対応)

## 1. ライブラリバージョン対応一覧表

すべてのライブラリは、最新安定版（Latest Stable）を採用し、安定性と新機能の恩恵を最大化します。

| ライブラリ / ツール | 最新推奨バージョン | 用途・役割 |
| :--- | :--- | :--- |
| **Wails** | `v2.11.0+` | GoとWebフロントエンドを結合するデスクトップフレームワーク |
| **shadcn/ui** | `latest (Tailwind v3/v4 + Radix)` | Godot風Studio画面のUIコンポーネントライブラリ |
| **PixiJS** | `^7.4.2` | 2D WebGLレンダラー (**Live2D本命**) ※v7安定版を指定 |
| **pixi-live2d-display** | `^0.4.0` | PixiJS用 Live2D Cubism 2/4 描画統合ライブラリ |
| **Live2D Cubism Core** | `4.x (Live2DCubismCore.min.js)` | Live2D公式ランタイムコア |
| **Three.js** | `^0.170.0+` | 3D WebGLレンダラー (VRM互換用) |
| **@pixiv/three-vrm** | `^3.0.0+` | Three.js用 VRM 0.x / 1.0 ロード・アニメーションプラグイン |
| **VOICEVOX** | `0.15+ / 最新リリース` | 幅広い話者に対応したローカル音声合成エンジン (HTTP API :50021) |
| **Style-Bert-VITS2** | `v2.4+ / 最新リリース` | 高品質日本語音声合成エンジン (Local HTTP API :5000) |
| **modernc.org/sqlite** | `latest` | Pure-Go SQLiteドライバ (Cgo/GCC不要) |
| **llama-server.exe** | `llama.cpp b4000+` | ローカルGGUFモデル推論エンジン |

---

## 2. 推奨LLMモデル一覧 ＆ Hugging Face ダウンロードURL

ワンクリックダウンローダーで自動取得する公式GGUFモデルの詳細仕様:

| キー (`modelKey`) | モデル名 | 量子化 | 容量 / VRAM | 対象PC環境 | Hugging Face ダウンロードURL |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `qwen2.5-0.5b` | **Qwen2.5-0.5B-Instruct** | Q4_K_M | 398 MB / 600 MB | **RAM 8GB PC (超軽量)** | `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf` |
| `qwen2.5-1.5b` | **Qwen2.5-1.5B-Instruct** | Q4_K_M | 1.1 GB / 1.5 GB | **RAM 8GB PC (推奨)** | `https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf` |
| `qwen2.5-3b` | **Qwen2.5-3B-Instruct** | Q4_K_M | 2.1 GB / 2.8 GB | ミドルPC (VRAM 4GB+) | `https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf` |
| `qwen2.5-7b` | **Qwen2.5-7B-Instruct** | Q4_K_M | 4.7 GB / 5.8 GB | ハイエンド (VRAM 8GB+) | `https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf` |

---

## 3. llama-server 起動オプション仕様

```bash
llama-server.exe \
  -m models/qwen2.5-1.5b-instruct-q4_k_m.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  -c 8192 \
  -cs \
  --keep -1 \
  --grammar-file bin/grammars/no_emoji.gbnf \
  -ngl 99 \
  --threads 6
```
- `-c 8192`: 最大コンテキスト長。
- `-cs` (`--context-shift`): 8192トークン超過時、古い会話ログをスライド破棄してエラーゼロを保証。
- `--keep -1`: システムプロンプトおよびFew-ShotのKVキャッシュを固定化。

---

## 4. OBS Studio ブラウザソース設定仕様 (100%透過配信)

1. **ソース追加**: OBSで「ブラウザ (Browser)」を追加。
2. **プロパティ設定**:
   - **URL**: `http://localhost:18923/avatar`
   - **幅 / 高さ**: `1920` / `1080`
   - **カスタムCSS**:
     ```css
     body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }
     ```
   - **「表示されていないときにソースをシャットダウン」**: オフ
3. **効果**:
   - クロマキー（緑背景抜き）が一切不要。緑フリンジ皆無の完全透過で最高画質合成。
