/**
 * Web Speech API を用いたリアルタイムマイク音声認識 (STT) サービス
 */

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export type SpeechCallback = (text: string, isFinal: boolean) => void;

/**
 * マイクからの日本語音声をテキスト化する認識マネージャー
 */
export class SpeechService {
  private recognition: any = null;
  private isListening: boolean = false;
  private onResultCallback?: SpeechCallback;
  private onStateChangeCallback?: (isListening: boolean) => void;

  constructor(
    onResult?: SpeechCallback,
    onStateChange?: (isListening: boolean) => void
  ) {
    this.onResultCallback = onResult;
    this.onStateChangeCallback = onStateChange;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      this.recognition = new SpeechRec();
      this.recognition.lang = 'ja-JP';
      this.recognition.continuous = true;
      this.recognition.interimResults = true;

      this.recognition.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += transcript;
          } else {
            interimText += transcript;
          }
        }

        if (finalText && this.onResultCallback) {
          this.onResultCallback(finalText.trim(), true);
        } else if (interimText && this.onResultCallback) {
          this.onResultCallback(interimText.trim(), false);
        }
      };

      this.recognition.onerror = (err: any) => {
        console.warn('音声認識エラー:', err.error);
        if (err.error === 'not-allowed' || err.error === 'service-not-allowed') {
          this.stop();
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          // 常時待機モードの場合は自動再開
          try {
            this.recognition.start();
          } catch {
            // 既に起動している場合の例外回避
          }
        } else {
          if (this.onStateChangeCallback) this.onStateChangeCallback(false);
        }
      };
    }
  }

  /**
   * 音声認識に対応しているかどうかを返します。
   */
  public isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * マイク音声認識を開始します。
   */
  public start(): boolean {
    if (!this.recognition) return false;
    try {
      this.isListening = true;
      this.recognition.start();
      if (this.onStateChangeCallback) this.onStateChangeCallback(true);
      return true;
    } catch (e) {
      console.warn('音声認識の開始に失敗しました:', e);
      return false;
    }
  }

  /**
   * マイク音声認識を停止します。
   */
  public stop(): void {
    if (!this.recognition) return;
    this.isListening = false;
    try {
      this.recognition.stop();
    } catch {
      // 例外回避
    }
    if (this.onStateChangeCallback) this.onStateChangeCallback(false);
  }

  /**
   * 現在音声認識中かどうかを取得します。
   */
  public getIsListening(): boolean {
    return this.isListening;
  }
}
