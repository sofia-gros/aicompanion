# デスクトップAIコンパニオン システム基本設計書

## 1. システム概要
本システムは、完全ローカル環境で動作するNeurosama風のデスクトップ常駐型AIコンパニオンである。
Python等の動的ランタイムを挟まず、Go/C++で構成された軽量ネイティブパイプラインを採用し、低遅延応答・透過描画・文字制御（絵文字の物理排除）・無制限対話を可能にする。

---

## 2. 全体アーキテクチャ

```text
+-----------------------------------------------------------------------------------+
| フロントエンド (Wails Webview / React + TypeScript)                               |
|  ├── Live2D / VRM 描画キャンバス (PixiJS / Three.js)                              |
|  ├── 音声再生・リップシンク (Web Audio API + AnalyserNode)                        |
|  └── UI / 設定パネル / ドラッグ & マウス透過エリア制御                            |
+-----------------------------------------------------------------------------------+
                                   ▲
                                   │ Wails Events (IPC / Stream)
                                   ▼
+-----------------------------------------------------------------------------------+
| バックエンド・オーケストレーター (Wails / Go)                                     |
|  ├── Process Manager (llama-server / TTS サーバーの起動・監視・シャットダウン)    |
|  ├── Dialogue Pipeline (LLMトークン受信 ➔ 句単位分割 ➔ TTS投入)                   |
|  └── Memory Manager (短期メモリ管理 + sqlite-vec による長期記憶検索)               |
+-----------------------------------------------------------------------------------+
           │                                 │                               │
 HTTP/SSE  │                       HTTP/POST │                     Cgo / Direct
           ▼                                 ▼                               ▼
+-----------------------+         +-----------------------+         +-----------------------+
| llama-server (C++)    |         | Style-Bert-VITS2 API  |         | SQLite + sqlite-vec   |
| ├── GGUF Model        |         | ├── Voice Synthesis   |         | ├── Short-term logs   |
| ├── GBNF Grammar      |         | └── Audio Stream      |         | └── Long-term Vector  |
| └── Context Shift     |         +-----------------------+         +-----------------------+
+-----------------------+
```

3. ディレクトリ構造
```
.
├── app.go                      # Wails アプリケーションエントリーポイント & IPCブリッジ
├── main.go                     # Wails 起動・ライフサイクル定義
├── bin/                        # ネイティブバイナリ配置領域
│   ├── llama-server.exe        # C++製 LLM推論サーバー
│   └── grammars/
│       └── no_emoji.gbnf       # 出力制約用 GBNF 文法ファイル
├── pkg/
│   ├── process/                # 外部プロセス（llama-server / TTS）管理
│   │   └── manager.go
│   ├── pipeline/               # 会話・ストリーミング・句分割パイプライン
│   │   └── dialogue.go
│   └── memory/                 # SQLite + sqlite-vec 記憶管理
│       └── store.go
└── frontend/                   # UI / アバター描画 (React + Vite)
    ├── index.html
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── Avatar2D.tsx    # PixiJS + Live2D
        │   └── Avatar3D.tsx    # Three.js + VRM
        └── services/
            └── audio.ts        # Web Audio API ＆ Lip-sync
```
4. バックエンド仕様 (Go Orchestrator)
4.1 プロセス管理 (Process Lifecycle Manager)

    概要: アプリ起動時に llama-server 等のサブプロセスを非同期起動し、正常終了を保証する。

    主要処理:

        Start(): exec.Command で ./bin/llama-server.exe を以下のオプションで起動。

            -m models/model.gguf

            -c 8192 (コンテキストサイズ)

            -cs (--context-shift 有効化: トークン上限到達時に古い会話を自動破棄)

            --keep -1 (先頭システムプロンプトのKVキャッシュを半永久固定)

            --grammar-file ./bin/grammars/no_emoji.gbnf (絵文字の絶対排除)

            -ngl 99 (全レイヤーVRAM使用)

        Stop(): Wailsの OnShutdown フックで親プロセス終了時に cmd.Process.Kill() を呼び出し、プロセスリークを防止。

4.2 会話パイプライン (Dialogue Pipeline)

    ユーザー入力受領: フロントからテキストを受け取る。

    コンテキスト構築:

        固定システムプロンプト (キャラ設定)

        sqlite-vec から検索した関連「長期記憶」

        直近 N ターンの「短期記憶」

    LLM推論ストリーミング: http://127.0.0.1:8080/completion へリクエスト。

    リアルタイム句分割 & 並列TTS処理:

        受信したトークンを Go 内でバッファリング。

        句読点（。 ！ ？ \n）を検知した時点でバッファ文字列を抽出し、非同期で TTS サーバーへ送信。

        生成された音声バイナリ (WAV/PCM) とテキストを統合し、Wails Events (audio-chunk-ready) でフロントへ送出。

4.3 記憶管理 (Memory Manager)

    データベース: sqlite-vec を組み込んだ SQLite 単一ファイル。

    テーブル定義:

        conversations: (id INTEGER, role TEXT, content TEXT, timestamp DATETIME)

        memories: (id INTEGER, summary TEXT, embedding FLOAT[1536])

    動作仕様:

        短期記憶が 20 ターンを超えた場合、過去の古い 10 ターンをバックグラウンドで要約。
        
        要約結果のベクトルを生成して memories に格納し、短期記憶テーブルから削除

5. フロントエンド仕様 (React / TypeScript)
5.1 透過ウィンドウ & ウィンドウ操作

    ウィンドウ透過: wails.json にて "transparent": true, "frameless": true を設定。

    ドラッグ移動: CSS に --wails-draggable: drag を付与したヘッダーエリアでアバター移動可能。

    マウス透過 (Click-Through):

        アバター枠外をクリック透過させる場合、Go 側の OS ネイティブ API (Windows SetWindowLongPtr 等) を Wails 経由でトグル呼び出し。

5.2 アバター表示 (Live2D / VRM)Live2D: PixiJS + pixi-live2d-displayマウスカーソル追従 (mousemove イベントから model.focus(x, y) を更新)。表情モーション切り替え機能。VRM: Three.js + @pixiv/three-vrm背景アルファ（alpha: true）を有効にした WebGLRenderer を使用。VRMLookAt による視線制御。5.3 リップシンク ＆ Web Audio 再生バックエンドから audio-chunk-ready イベント経由で音声バイナリ（Base64 または ArrayBuffer）を受信。AudioContext にキューイングして途切れなく連続再生 (AudioBufferSourceNode)。再生中、AnalyserNode からリアルタイムの音量（RMS）を取得。音量値を 0.0〜1.0 に正規化し、アバターの口開度パラメータ（Live2D: ParamMouthOpenY / VRM: BlendShape aa）に毎フレーム適用。6. インターフェース & API 仕様6.1 Wails IPC イベント仕様イベント名送信方向データ型説明user-messageFE ➔ BE{ text: string }ユーザーのテキスト入力llm-tokenBE ➔ FE{ token: string }テキスト描画用トークンストリームaudio-chunk-readyBE ➔ FE{ audio: string, text: string }TTSで生成された音声データ(Base64)set-click-throughFE ➔ BE{ enabled: boolean }マウス透過モードの切替要求6.2 llama-server API 仕様Endpoint: POST http://127.0.0.1:8080/completionRequest Payload:
```json
{
  "prompt": "<System Prompt>\nUser: こんにちは\nAssistant:",
  "stream": true,
  "n_predict": 256,
  "temperature": 0.7,
  "grammar": "root ::= [^\\u1F600-\\u1F64F\\u1F300-\\u1F5FF\\u1F680-\\u1F6FF\\u2600-\\u26FF\\u2700-\\u27BF]+"
}
```
6.3 Style-Bert-VITS2 API 仕様

    Endpoint: GET/POST http://127.0.0.1:5000/voice

    Params: text (合成するテキスト), model_id (モデルID), speaker_id (話者ID)

7. 制御・制約定義
7.1 GBNF 文法制御 (no_emoji.gbnf)

生成トークンの確率分布において、下記コードポイントに属する絵文字文字コードを物理的に選択不可にする。

    U+1F600 - U+1F64F (Emoticons)

    U+1F300 - U+1F5FF (Misc Symbols and Pictographs)

    U+1F680 - U+1F6FF (Transport and Map)

    U+2600 - U+26FF (Misc Symbols)

7.2 コンテキスト溢れ防止設計

    コンテキスト長: 8,192 トークン

    Context Shift: 8,192 トークン超過時、先頭のシステムプロンプト（約 500 トークン分）を残し、中間の古い会話ログから順に切り詰めて破棄（エラー停止ゼロ保証）。
