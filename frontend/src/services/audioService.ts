import { AvatarSpeakPayload } from '../types/events';

/**
 * 再生待ちキューに格納される音声チャンク情報
 */
export interface QueuedAudioChunk {
  seqId: number;
  isLast: boolean;
  audioBuffer: AudioBuffer;
  text: string;
  emotion: string;
}

/**
 * Web Audio APIを用いた順序保証型音声再生キューおよびリップシンク解析サービス
 */
export class AudioService {
  private ctx: AudioContext;
  private queue: QueuedAudioChunk[] = [];
  private nextExpectedSeq: number = 1;
  private isPlaying: boolean = false;
  private analyser: AnalyserNode;
  private nextStartTime: number = 0;
  private onEmotionChange?: (emotion: string) => void;
  private onPlaybackStateChange?: (isPlaying: boolean) => void;

  constructor(
    onEmotionChange?: (emotion: string) => void,
    onPlaybackStateChange?: (isPlaying: boolean) => void
  ) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.connect(this.ctx.destination);
    this.onEmotionChange = onEmotionChange;
    this.onPlaybackStateChange = onPlaybackStateChange;
  }

  /**
   * 受信したBase64音声チャンクをデコードして再生キューへ登録します。
   */
  public async pushChunk(payload: AvatarSpeakPayload): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    const rawData = atob(payload.audioBase64);
    const bytes = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      bytes[i] = rawData.charCodeAt(i);
    }

    try {
      const audioBuffer = await this.ctx.decodeAudioData(bytes.buffer);
      this.queue.push({
        seqId: payload.seqId,
        isLast: payload.isLast,
        audioBuffer,
        text: payload.text,
        emotion: payload.emotion,
      });
      this.queue.sort((a, b) => a.seqId - b.seqId);
      this.processQueue();
    } catch (err) {
      console.error('音声データのデコードに失敗しました:', err);
    }
  }

  /**
   * 期待するシーケンス番号のチャンクを順番に再生します。
   */
  private processQueue(): void {
    if (this.queue.length === 0) return;

    const nextChunkIndex = this.queue.findIndex((c) => c.seqId === this.nextExpectedSeq);
    if (nextChunkIndex === -1) return; // 順序到着待ち

    const chunk = this.queue.splice(nextChunkIndex, 1)[0];
    this.nextExpectedSeq++;

    if (this.onEmotionChange) {
      this.onEmotionChange(chunk.emotion);
    }

    this.playBuffer(chunk);
  }

  /**
   * 指定バッファをスケジュール再生します。
   */
  private playBuffer(chunk: QueuedAudioChunk): void {
    const source = this.ctx.createBufferSource();
    source.buffer = chunk.audioBuffer;
    source.connect(this.analyser);

    const currentTime = this.ctx.currentTime;
    const startTime = Math.max(currentTime, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + chunk.audioBuffer.duration;

    if (!this.isPlaying) {
      this.isPlaying = true;
      if (this.onPlaybackStateChange) this.onPlaybackStateChange(true);
    }

    source.onended = () => {
      if (chunk.isLast && this.queue.length === 0) {
        this.isPlaying = false;
        this.nextExpectedSeq = 1;
        this.nextStartTime = 0;
        if (this.onPlaybackStateChange) this.onPlaybackStateChange(false);
      }
      this.processQueue();
    };
  }

  /**
   * AnalyserNodeから現在の音量（RMS）を取得し、口開度 (0.0〜1.0) を算出します。
   */
  public getMouthOpen(sensitivity: number = 1.0): number {
    if (!this.isPlaying) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    // 0.0〜1.0へスケーリング
    return Math.min(1.0, (average / 60) * sensitivity);
  }

  /**
   * 再生を即時停止しキューをクリアします。
   */
  public stop(): void {
    this.queue = [];
    this.nextExpectedSeq = 1;
    this.nextStartTime = 0;
    this.isPlaying = false;
    if (this.onPlaybackStateChange) this.onPlaybackStateChange(false);
  }
}
