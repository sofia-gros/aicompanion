# 全体設計書: デスクトップAIコンパニオン システムアーキテクチャ

## 1. システム全体構成

本システムは、**Godot Engine風スタジオエディタ（shadcn/ui）**、**デスクトップ透過常駐オーバーレイ**、および **OBS Directブラウザソース（100%透過配信）** の3形態を同一のGoバックエンドからシームレスに提供するハイブリッドアーキテクチャを採用する。
アバターレンダラーは、GPU負荷が極小でNeurosama風の愛嬌を持つ **Live2D をプライマリ（本命）** とし、将来的なVRM 3Dにも対応可能な構造とする。

```mermaid
graph TB
    subgraph Clients["表示クライアント層 (3大モード)"]
        Studio["Godot風 Studio (Wails Window / shadcn/ui)"]
        Overlay["デスクトップ透過常駐 (Frameless Click-Through)"]
        OBS["OBS Studio / 配信ソフト (Browser Source :18923/avatar)"]
    end

    subgraph Backend["バックエンド (Go Orchestrator)"]
        WailsBridge["Wails IPC & Native Window Controller"]
        HttpWsServer["Local HTTP & WebSocket Stream Server (:18923)"]
        ProcMgr["Process Lifecycle Manager (Job Object)"]
        DialoguePipe["Streaming Dialogue Pipeline"]
        SentenceSplit["Realtime Sentence Splitter"]
        TTSLayer["Pluggable TTS Provider Layer"]
        ModelMgr["LLM Tier & Prompt/Few-Shot Manager"]
        MemMgr["Memory Manager (Pure-Go SQLite)"]
        WinNative["Windows Platform API (Click-Through)"]
    end

    subgraph External["外部エンジン"]
        LLM["llama-server (C++ GGUF / GBNF / Context-Shift)"]
        TTS_V["VOICEVOX (:50021)"]
        TTS_S["Style-Bert-VITS2 (:5000)"]
    end

    subgraph Storage["データ永続化"]
        DB[(SQLite DB)]
    end

    Studio <-->|Wails Events / RPC| WailsBridge
    Overlay <-->|Wails Events / RPC| WailsBridge
    OBS <-->|HTTP / WebSocket Stream| HttpWsServer
    
    WailsBridge <--> DialoguePipe
    HttpWsServer <--> DialoguePipe
    DialoguePipe --> SentenceSplit
    SentenceSplit --> TTSLayer
    TTSLayer -->|HTTP POST| TTS_V
    TTSLayer -->|HTTP POST| TTS_S
    DialoguePipe --> ModelMgr
    ModelMgr -->|SSE /completion| LLM
    DialoguePipe <--> MemMgr
    MemMgr <--> DB
    ProcMgr -.->|Windows Job Object 連動強制終了| LLM
    ProcMgr -.->|Windows Job Object 連動強制終了| TTS_S
    WailsBridge -->|SetWindowLongPtr| WinNative
```

---

## 2. 3大表示モードの仕組み

| モード | ウィンドウ形態 | 用途 | 特徴 |
| :--- | :--- | :--- | :--- |
| **Studio Mode** | 通常デスクトップウィンドウ (1280x800等) | 設定・調整・対話テスト・デバッグ | Godot風4ペインUI。インスペクターで全設定をリアルタイム変更 |
| **Companion Overlay** | フレームレス透過ウィンドウ (450x700等) | 日常のデスクトップ常駐 | キャラ外クリック透過（`WS_EX_TRANSPARENT`）、ドラッグ移動 |
| **OBS Direct Browser Source** | OBS内蔵ブラウザソース (`http://localhost:18923/avatar`) | ゲーム配信・雑談配信・VTuber共演 | **緑背景不要の100%アルファ透過**。緑フリンジ皆無、OBSキャプチャGPU負荷最小 |

---

## 3. シーケンス詳細仕様

### 3.1 起動シーケンス (Application Startup)
```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant Main as Wails main.go / app.go
    participant Job as Windows Job Object
    participant DB as SQLite DB
    participant Server as Local HTTP/WS (:18923)
    participant Proc as Process Manager
    participant LLM as llama-server (:8080)
    participant TTS as VOICEVOX (:50021)
    participant FE as Frontend (Studio UI)

    User->>Main: アプリケーション起動
    Main->>Job: Job Object作成 (KILL_ON_JOB_CLOSE 設定)
    Main->>DB: DB接続 & マイグレーション
    Main->>Server: HTTP/WSサーバー起動 (ポート 18923)
    Main->>Proc: 外部プロセス起動 & 死活確認
    Proc->>LLM: llama-server.exe 起動 & Job Object登録
    Proc->>TTS: VOICEVOX 接続確認 (GET /version)
    Proc-->>Main: 全外部エンジン Ready
    Main->>FE: Wails WebView2 画面描画開始
    FE->>Main: frontend-ready イベント
    Main->>FE: system-status 送信 (初期設定完了)
```

### 3.2 対話ストリーミングシーケンス (Interactive Streaming)
```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant FE as Frontend (Studio / Overlay)
    participant Pipe as Dialogue Pipeline
    participant Split as Sentence Splitter
    participant TTS as TTS Provider (VOICEVOX/SBV2)
    participant Audio as Audio Engine
    participant OBS as OBS Studio (:18923/avatar)

    User->>FE: テキスト入力送信 ("user-message")
    FE->>Pipe: user-message(text: "調子はどう？")
    Pipe->>Pipe: プロンプト生成 (システム設定 + Few-Shot + 長期記憶 + 短期記憶)
    Pipe->>Pipe: LLM推論ストリーミング開始 (SSE /completion)
    
    loop トークン受信
        Pipe->>FE: llm-token(token)
        Pipe->>Split: トークン投入
        opt 句読点検知 (文確定)
            Split->>TTS: SynthesizeAsync(text, seqId: 1)
        end
    end
    
    par 並列TTS処理 & Wails/OBS同時ブロードキャスト
        TTS-->>Pipe: Audio Result for seqId 1
        Pipe->>FE: avatar-speak (seqId: 1, text, audioBase64, emotion: "happy")
        Pipe->>OBS: WebSocket broadcast (avatar-speak)
        FE->>Audio: キュー登録 & 即時再生開始 (AnalyserNode リップシンク)
        OBS->>OBS: OBS内ブラウザで即時再生 & リップシンク同期
    and
        TTS-->>Pipe: Audio Result for seqId 2
        Pipe->>FE: avatar-speak (seqId: 2, text, audioBase64, emotion: "neutral")
        Pipe->>OBS: WebSocket broadcast (avatar-speak)
        FE->>Audio: キュー登録 (seqId 1の終了に合わせシームレス連結再生)
        OBS->>OBS: OBS内ブラウザでシームレス連結再生
    end
```

---

## 4. 通信プロトコル仕様 (Wails Events ＆ RPC)

### 4.1 Wails Events 仕様
| イベント名 | 送信方向 | ペイロード型 | 説明 |
| :--- | :--- | :--- | :--- |
| `user-message` | FE ➔ BE | `{ "text": string }` | ユーザーのテキスト発言 |
| `llm-token` | BE ➔ FE | `{ "token": string, "isFirst": boolean }` | 画面へのリアルタイム文字表示用トークン |
| `avatar-speak` | BE ➔ FE & WS | `AvatarSpeakPayload` | 音声再生バイナリ、順序番号、感情、テキスト |
| `playback-state` | FE ➔ BE | `{ "state": "idle" \| "playing" }` | フロントエンドの音声再生ステータス |
| `system-status` | BE ➔ FE | `{ "llmReady": boolean, "ttsReady": boolean, "activeTTS": string, "activeTier": string }` | バックエンド初期化状態 |

#### `AvatarSpeakPayload` 型定義
```json
{
  "seqId": 1,
  "isLast": false,
  "text": "こんにちはなのだ！",
  "audioFormat": "audio/wav",
  "audioBase64": "UklGRi...",
  "emotion": "happy",
  "durationMs": 1200
}
```

### 4.2 Go バインディング RPC仕様 (`app.go`)
| メソッド名 | 引数 | 戻り値 | 説明 |
| :--- | :--- | :--- | :--- |
| `SwitchDisplayMode` | `mode string` (`"studio"` / `"overlay"`) | `error` | スタジオ画面と常駐オーバーレイ画面の切り替え |
| `SetClickThrough` | `enabled bool` | `error` | マウス透過（`WS_EX_TRANSPARENT`）の切り替え |
| `SetLLMPreset` | `tier string` (`"tier1"` / `"tier2"` / `"tier3"` / `"cloud"`) | `error` | スペック別LLMプリセットの切り替え |
| `SetTTSProvider` | `engine string, speakerID int` | `error` | 音声エンジン（`"voicevox"` / `"style-bert-vits2"`）と話者の変更 |
| `GetSystemConfig` | なし | `SystemConfig` | 現在の全設定情報の取得 |
| `UpdateSystemConfig` | `cfg SystemConfig` | `error` | 設定の更新とDB永続化 |
| `ClearConversationHistory` | なし | `error` | 短期会話ログの消去 |
| `SetLive2DParameter` | `param string, value float64` | `error` | インスペクターからの手動パラメータテスト注入 |
