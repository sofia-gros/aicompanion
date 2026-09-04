import { AvatarSpeakPayload, DownloadProgressPayload, LLMTokenPayload, SearchConfig, SystemConfig, SystemUsage } from '../types/events';

/**
 * Wails v2 Window オブジェクトの型定義
 */
declare global {
  interface Window {
    runtime?: {
      EventsOn: (eventName: string, callback: (...args: any[]) => void) => void;
      EventsEmit: (eventName: string, ...args: any[]) => void;
      WindowSetSize: (width: number, height: number) => void;
    };
    go?: {
      main?: {
        App?: {
          SendMessage: (text: string) => Promise<void>;
          SwitchDisplayMode: (mode: string) => Promise<void>;
          SetClickThrough: (enabled: boolean) => Promise<void>;
          SetLLMPreset: (tier: string) => Promise<void>;
          SetTTSProvider: (engine: string, speakerID: number) => Promise<void>;
          GetSystemConfig: () => Promise<SystemConfig>;
          UpdateSystemConfig: (cfg: SystemConfig) => Promise<void>;
          ClearConversationHistory: () => Promise<void>;
          SetLive2DParameter: (param: string, value: number) => Promise<void>;
          StartModelDownload: (modelKey: string) => Promise<void>;
          CancelModelDownload: () => Promise<void>;
        };
      };
    };
  }
}

/**
 * Wails RPC およびイベント通信を仲介するブリッジクラス
 */
export class WailsBridge {
  /**
   * Wails環境下で実行されているかどうかを判定します。
   */
  public static isWails(): boolean {
    return typeof window !== 'undefined' && !!window.go && !!window.runtime;
  }

  /**
   * ユーザーメッセージをバックエンドへ送信します。
   */
  public static async sendMessage(text: string): Promise<void> {
    if (this.isWails() && window.go?.main?.App?.SendMessage) {
      await window.go.main.App.SendMessage(text);
    } else {
      console.log('[Mock/Dev] sendMessage:', text);
    }
  }

  /**
   * 独立した透過アバター常駐別ウィンドウを立ち上げます。
   */
  public static async launchOverlayWindow(): Promise<void> {
    if (this.isWails() && (window.go?.main?.App as any)?.LaunchOverlayWindow) {
      await (window.go?.main?.App as any).LaunchOverlayWindow();
    } else {
      window.open('/avatar.html', '_blank', 'width=450,height=700,menubar=no,toolbar=no');
    }
  }

  /**
   * LLM推論サーバーおよび対話音声パイプラインを開始します。
   */
  public static async startServices(): Promise<void> {
    if (this.isWails() && (window.go?.main?.App as any)?.StartServices) {
      await (window.go?.main?.App as any).StartServices();
    }
  }

  /**
   * LLM推論サーバーおよび対話音声を停止します。
   */
  public static async stopServices(): Promise<void> {
    if (this.isWails() && (window.go?.main?.App as any)?.StopServices) {
      await (window.go?.main?.App as any).StopServices();
    }
  }

  /**
   * PCのハードウェアスペックと推奨LLM情報を取得します。
   */
  public static async getSystemSpec(): Promise<any> {
    if (this.isWails() && (window.go?.main?.App as any)?.GetSystemSpec) {
      return await (window.go?.main?.App as any).GetSystemSpec();
    }
    return {
      totalRamGb: 8,
      availableRamGb: 4,
      recommendedTier: 'tier0_5b',
      recommendation: '8GB環境: 超軽量な0.5Bモデルが最も安定して動作します。',
    };
  }

  /**
   * ダウンロード済みGGUFモデル一覧を取得します。
   */
  public static async getDownloadedModels(): Promise<string[]> {
    if (this.isWails() && (window.go?.main?.App as any)?.GetDownloadedModels) {
      return await (window.go?.main?.App as any).GetDownloadedModels();
    }
    return [];
  }

  /**
   * Live2Dモデルのテスト用パラメータを反映します。
   */
  public static async setLive2DParameter(param: string, value: number): Promise<void> {
    if (this.isWails() && window.go?.main?.App?.SetLive2DParameter) {
      await window.go.main.App.SetLive2DParameter(param, value);
    }
  }

  /**
   * 会話履歴（短期記憶および長期記憶）を初期化・消去します。
   */
  public static async clearConversationHistory(): Promise<void> {
    if (this.isWails() && (window.go?.main?.App as any)?.ClearConversationHistory) {
      await (window.go?.main?.App as any).ClearConversationHistory();
    }
  }

  /**
   * アクティブキャラクターの設定（名前、性格、口調、一人称/二人称、対話例）をLLMに同期します。
   */
  public static async setCharacterProfile(char: any): Promise<void> {
    if (this.isWails() && (window.go?.main?.App as any)?.SetCharacterProfile) {
      await (window.go?.main?.App as any).SetCharacterProfile({
        id: char.id,
        name: char.name,
        personality: char.personality,
        toneRule: char.toneRule,
        firstPerson: char.firstPerson,
        secondPerson: char.secondPerson,
        ttsEngine: char.ttsEngine,
        speakerId: char.speakerId || 0,
        examples: char.examples || [],
      });
    }
  }

  /**
   * 現在のモデルダウンロード保存先フォルダーを取得します。
   */
  public static async getModelDirectory(): Promise<string> {
    if (this.isWails() && (window.go?.main?.App as any)?.GetModelDirectory) {
      return await (window.go?.main?.App as any).GetModelDirectory();
    }
    return 'models';
  }

  /**
   * モデルダウンロード保存先フォルダーを設定します。
   */
  public static async setModelDirectory(dir: string): Promise<void> {
    if (this.isWails() && (window.go?.main?.App as any)?.SetModelDirectory) {
      await (window.go?.main?.App as any).SetModelDirectory(dir);
    }
  }

  /**
   * OS標準のフォルダー選択ダイアログを開いて保存先フォルダーを選択します。
   */
  public static async selectModelDirectory(): Promise<string> {
    if (this.isWails() && (window.go?.main?.App as any)?.SelectModelDirectory) {
      return await (window.go?.main?.App as any).SelectModelDirectory();
    }
    return 'models';
  }

  /**
   * 表示モード（studio / overlay）を切り替えます。
   */
  public static async switchDisplayMode(mode: string): Promise<void> {
    if (this.isWails() && window.go?.main?.App?.SwitchDisplayMode) {
      await window.go.main.App.SwitchDisplayMode(mode);
    }
  }

  /**
   * マウス透過を切り替えます。
   */
  public static async setClickThrough(enabled: boolean): Promise<void> {
    if (this.isWails() && window.go?.main?.App?.SetClickThrough) {
      await window.go.main.App.SetClickThrough(enabled);
    }
  }

  /**
   * LLMティアプリセットを切り替えます。
   */
  public static async setLLMPreset(tier: string): Promise<void> {
    if (this.isWails() && window.go?.main?.App?.SetLLMPreset) {
      await window.go.main.App.SetLLMPreset(tier);
    }
  }

  /**
   * 音声エンジンおよび話者IDを切り替えます。
   */
  public static async setTTSProvider(engine: string, speakerId: number): Promise<void> {
    if (this.isWails() && window.go?.main?.App?.SetTTSProvider) {
      await window.go.main.App.SetTTSProvider(engine, speakerId);
    }
  }

  /**
   * モデルダウンロードを開始します。
   */
  public static async startModelDownload(modelKey: string): Promise<void> {
    if (this.isWails() && window.go?.main?.App?.StartModelDownload) {
      await window.go.main.App.StartModelDownload(modelKey);
    } else {
      console.log('[Mock/Dev] startModelDownload:', modelKey);
    }
  }

  /**
   * モデルダウンロードを中断します。
   */
  public static async cancelModelDownload(): Promise<void> {
    if (this.isWails() && window.go?.main?.App?.CancelModelDownload) {
      await window.go.main.App.CancelModelDownload();
    }
  }

  /**
   * リアルタイムのPCリソース使用状況（CPU, RAM, ROM, GPU）を取得します。
   */
  public static async getSystemUsage(): Promise<SystemUsage> {
    if (this.isWails() && (window.go?.main?.App as any)?.GetSystemUsage) {
      return await (window.go?.main?.App as any).GetSystemUsage();
    }
    return {
      cpuPercent: 0,
      ramPercent: 0,
      ramUsedGb: 0,
      ramTotalGb: 0,
      romPercent: 0,
      romFreeGb: 0,
      romTotalGb: 0,
      gpuInfo: 'GPUアクセラレーション有効 (自動オフロード)',
    };
  }

  /**
   * 指定されたGGUFモデルに推論サーバーを切り替えます。
   */
  public static async switchModel(modelFileName: string): Promise<void> {
    if (this.isWails() && (window.go?.main?.App as any)?.SwitchModel) {
      await (window.go?.main?.App as any).SwitchModel(modelFileName);
    }
  }

  /**
   * Web検索・情報解決設定を取得します。
   */
  public static async getSearchConfig(): Promise<SearchConfig> {
    if (this.isWails() && (window.go?.main?.App as any)?.GetSearchConfig) {
      return await (window.go?.main?.App as any).GetSearchConfig();
    }
    return {
      enabled: true,
      tavilyApiKey: '',
      cloudApiKey: '',
      cloudApiBaseUrl: 'https://api.openai.com/v1',
      cloudApiModel: 'gpt-4o-mini',
      classifierMode: 'regex',
      classifierModel: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    };
  }

  /**
   * Web検索・情報解決設定を保存します。
   */
  public static async saveSearchConfig(cfg: SearchConfig): Promise<void> {
    if (this.isWails() && (window.go?.main?.App as any)?.SaveSearchConfig) {
      await (window.go?.main?.App as any).SaveSearchConfig(cfg);
    }
  }

  /**
   * Wailsイベントリスナーを登録します。
   */
  public static onEvent(
    handlers: {
      onSpeak?: (payload: AvatarSpeakPayload) => void;
      onToken?: (payload: LLMTokenPayload) => void;
      onProgress?: (payload: DownloadProgressPayload) => void;
      onDownloadedModelsUpdated?: (models: string[]) => void;
      onSystemLog?: (msg: string) => void;
      onSystemStatus?: (status: any) => void;
    }
  ): () => void {
    if (!this.isWails() || !window.runtime) {
      return () => {};
    }

    if (handlers.onSpeak) {
      window.runtime.EventsOn('avatar-speak', handlers.onSpeak);
    }
    if (handlers.onToken) {
      window.runtime.EventsOn('llm-token', handlers.onToken);
    }
    if (handlers.onProgress) {
      window.runtime.EventsOn('download-progress', handlers.onProgress);
    }
    if (handlers.onDownloadedModelsUpdated) {
      window.runtime.EventsOn('downloaded-models-updated', handlers.onDownloadedModelsUpdated);
    }
    if (handlers.onSystemLog) {
      window.runtime.EventsOn('system-log', handlers.onSystemLog);
    }
    if (handlers.onSystemStatus) {
      window.runtime.EventsOn('system-status', handlers.onSystemStatus);
    }

    return () => {
      // クリーンアップ
    };
  }
}
