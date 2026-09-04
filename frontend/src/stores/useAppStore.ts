import { create } from 'zustand';
import { DownloadProgressPayload, SearchConfig, SystemConfig, SystemSpec, SystemUsage } from '../types/events';
import { CharacterProfile, DEFAULT_CHARACTERS } from '../types/character';
import { WailsBridge } from '../services/wailsBridge';

/**
 * 対話ステートマシンの状態型
 */
export type CompanionState = 'idle' | 'listening' | 'thinking' | 'speaking';

/**
 * 対話テストチャット履歴メッセージの型定義
 */
export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  characterName?: string;
  text: string;
  timestamp: string;
  emotion?: string;
  audioBase64?: string;
}

/**
 * アプリケーション全体のグローバル状態インターフェース
 */
interface AppState {
  // キャラクター管理
  characters: CharacterProfile[];
  activeCharacterId: string;
  activeModelPath: string;
  avatarType: 'live2d' | 'vrm';
  vrmModelUrl: string;
  isCharacterModalOpen: boolean;
  isSettingsModalOpen: boolean;

  // 対話・音声状態
  companionState: CompanionState;
  currentSubtitle: string;
  streamingText: string;
  isAudioPlaying: boolean;
  isMicListening: boolean;
  currentEmotion: string;
  chatMessages: ChatMessage[];

  // サービス稼働マスター状態
  isServicesRunning: boolean;
  downloadedModels: string[];
  activeModelFileName: string;
  systemSpec: SystemSpec | null;
  systemUsage: SystemUsage | null;

  // システム設定 & Web情報解決設定
  config: SystemConfig;
  searchConfig: SearchConfig;

  // ダウンロード状態
  downloadProgress: DownloadProgressPayload | null;
  isDownloaderOpen: boolean;
  modelDir: string;

  // UI・ビューポート状態
  viewportBg: 'checker' | 'green' | 'magenta' | 'dark';
  testParamMouth: number;
  testParamEye: number;

  // パフォーマンスメトリクス
  tokensPerSec: number;
  firstAudioLatencyMs: number;
  fps: number;
  logs: string[];

  // アクション群
  setModelDir: (dir: string) => void;
  deleteCharacter: (id: string) => void;
  duplicateCharacter: (id: string) => void;
  setServicesRunning: (running: boolean) => void;
  setDownloadedModels: (models: string[]) => void;
  switchActiveModel: (fileName: string) => void;
  setSystemSpec: (spec: SystemSpec) => void;
  setSystemUsage: (usage: SystemUsage) => void;
  setFps: (fps: number) => void;
  setTokensPerSec: (tps: number) => void;
  setFirstAudioLatencyMs: (ms: number) => void;
  selectCharacter: (id: string) => void;
  saveCharacter: (char: CharacterProfile) => void;
  setAvatarType: (type: 'live2d' | 'vrm') => void;
  setVrmModelUrl: (url: string) => void;
  setIsCharacterModalOpen: (open: boolean) => void;
  setIsSettingsModalOpen: (open: boolean) => void;
  setCompanionState: (state: CompanionState) => void;
  setCurrentSubtitle: (text: string) => void;
  appendStreamingText: (token: string, isFirst: boolean) => void;
  clearStreamingText: () => void;
  setIsAudioPlaying: (playing: boolean) => void;
  setIsMicListening: (listening: boolean) => void;
  setCurrentEmotion: (emotion: string) => void;
  updateConfig: (partial: Partial<SystemConfig>) => void;
  setSearchConfig: (cfg: SearchConfig) => void;
  updateSearchConfig: (partial: Partial<SearchConfig>) => void;
  setDownloadProgress: (progress: DownloadProgressPayload | null) => void;
  setIsDownloaderOpen: (open: boolean) => void;
  setViewportBg: (bg: 'checker' | 'green' | 'magenta' | 'dark') => void;
  setTestParamMouth: (val: number) => void;
  setTestParamEye: (val: number) => void;
  setMetrics: (tokSec: number, latency: number) => void;
  addLog: (msg: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  clearChatMessages: () => void;
}

/**
 * Zustand によるグローバルストア実装
 */
export const useAppStore = create<AppState>((set, get) => ({
  characters: DEFAULT_CHARACTERS,
  activeCharacterId: 'hiyori',
  activeModelPath: DEFAULT_CHARACTERS[0].modelPath,
  avatarType: 'live2d',
  vrmModelUrl: DEFAULT_CHARACTERS[0].vrmModelPath || '/vrm/Seed-san.vrm',
  isCharacterModalOpen: false,
  isSettingsModalOpen: false,

  companionState: 'idle',
  currentSubtitle: '',
  streamingText: '',
  isAudioPlaying: false,
  isMicListening: false,
  currentEmotion: 'neutral',

  isServicesRunning: true,
  downloadedModels: [],
  activeModelFileName: '',
  systemSpec: null,
  systemUsage: null,

  config: {
    displayMode: 'studio',
    isClickThrough: false,
    llmTier: 'tier0_5b',
    ttsEngine: 'windows-tts',
    speakerId: 0,
    volume: 1.0,
    lipSyncSensitivity: 1.0,
    eyeTrackingSensitivity: 1.0,
  },

  searchConfig: {
    enabled: true,
    tavilyApiKey: '',
    cloudApiKey: '',
    cloudApiBaseUrl: 'https://api.openai.com/v1',
    cloudApiModel: 'gpt-4o-mini',
    classifierMode: 'regex',
    classifierModel: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
  },

  downloadProgress: null,
  isDownloaderOpen: false,

  viewportBg: 'checker',
  testParamMouth: 0,
  testParamEye: 0,

  tokensPerSec: 0,
  firstAudioLatencyMs: 0,
  fps: 60,
  logs: ['[System] AI Companion Studio 起動完了 (キャラクター: ひより)'],

  setServicesRunning: (running) => set({ isServicesRunning: running }),
  setDownloadedModels: (models) => {
    set({ downloadedModels: models });
    if (models.length > 0 && !get().activeModelFileName) {
      set({ activeModelFileName: models[0] });
    }
  },
  switchActiveModel: (fileName) => {
    set({ activeModelFileName: fileName });
    WailsBridge.switchModel(fileName);
    get().addLog(`[推論] モデルを切り替えました: ${fileName}`);
  },
  setSystemUsage: (usage) => set({ systemUsage: usage }),
  setSystemSpec: (spec) => set({ systemSpec: spec }),
  setFps: (fps) => set({ fps }),
  setTokensPerSec: (tps) => set({ tokensPerSec: tps }),
  setFirstAudioLatencyMs: (ms) => set({ firstAudioLatencyMs: ms }),

  modelDir: 'models',

  setModelDir: (dir) => {
    set({ modelDir: dir });
    WailsBridge.setModelDirectory(dir);
  },

  deleteCharacter: (id: string) => {
    const s = get();
    if (s.characters.length <= 1) {
      s.addLog('[Character] 最後の1体のため削除できません');
      return;
    }
    const target = s.characters.find((c) => c.id === id);
    const updated = s.characters.filter((c) => c.id !== id);
    let nextActiveId = s.activeCharacterId;
    if (s.activeCharacterId === id) {
      nextActiveId = updated[0].id;
    }
    set({
      characters: updated,
      activeCharacterId: nextActiveId,
      logs: [...s.logs, `[Character] キャラクター削除: ${target?.name || id}`],
    });
    const nextChar = updated.find((c) => c.id === nextActiveId);
    if (nextChar) {
      s.selectCharacter(nextChar.id);
    }
  },

  duplicateCharacter: (id: string) => {
    const s = get();
    const source = s.characters.find((c) => c.id === id);
    if (!source) return;

    const copyId = `${source.id}_copy_${Date.now().toString().slice(-4)}`;
    const copyChar: CharacterProfile = {
      ...source,
      id: copyId,
      name: `${source.name} (コピー)`,
    };
    s.saveCharacter(copyChar);
    s.selectCharacter(copyChar.id);
    s.addLog(`[Character] キャラクターを複製しました: ${copyChar.name}`);
  },

  setAvatarType: (type) =>
    set((s) => ({
      avatarType: type,
      vrmModelUrl: s.vrmModelUrl || '/vrm/Seed-san.vrm',
      logs: [...s.logs, `[Avatar] レンダラー切替: ${type.toUpperCase()}`],
    })),
  setVrmModelUrl: (url) => set({ vrmModelUrl: url || '/vrm/Seed-san.vrm' }),

  selectCharacter: (id: string) => {
    const char = get().characters.find((c) => c.id === id);
    if (!char) return;
    set((s) => ({
      activeCharacterId: id,
      activeModelPath: char.modelPath,
      avatarType: char.avatarType || 'live2d',
      vrmModelUrl: char.vrmModelPath || s.vrmModelUrl || '/vrm/Seed-san.vrm',
      config: {
        ...s.config,
        ttsEngine: char.ttsEngine,
        speakerId: char.speakerId,
      },
      logs: [...s.logs, `[Character] キャラクター切替: ${char.name}`],
    }));
    WailsBridge.setCharacterProfile(char);
    WailsBridge.setTTSProvider(char.ttsEngine, char.speakerId);
  },

  saveCharacter: (char: CharacterProfile) => {
    set((s) => {
      const existsIndex = s.characters.findIndex((c) => c.id === char.id);
      let updated: CharacterProfile[];
      if (existsIndex >= 0) {
        updated = [...s.characters];
        updated[existsIndex] = char;
      } else {
        updated = [...s.characters, char];
      }
      return {
        characters: updated,
        activeCharacterId: char.id,
        activeModelPath: char.modelPath,
        avatarType: char.avatarType || 'live2d',
        vrmModelUrl: char.vrmModelPath || '/vrm/Seed-san.vrm',
        logs: [...s.logs, `[Character] キャラクター保存: ${char.name}`],
      };
    });
    WailsBridge.setCharacterProfile(char);
    WailsBridge.setTTSProvider(char.ttsEngine, char.speakerId);
  },

  setIsCharacterModalOpen: (open) => set({ isCharacterModalOpen: open }),
  setCompanionState: (state) => set({ companionState: state }),
  setCurrentSubtitle: (text) => set({ currentSubtitle: text }),
  appendStreamingText: (token, isFirst) =>
    set((s) => ({
      streamingText: isFirst ? token : s.streamingText + token,
      companionState: 'thinking',
    })),
  clearStreamingText: () => set({ streamingText: '' }),
  setIsAudioPlaying: (playing) =>
    set({
      isAudioPlaying: playing,
      companionState: playing ? 'speaking' : 'idle',
    }),
  setIsMicListening: (listening) =>
    set({
      isMicListening: listening,
      companionState: listening ? 'listening' : 'idle',
    }),
  setCurrentEmotion: (emotion) => set({ currentEmotion: emotion }),
  setIsSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),
  updateConfig: (partial) =>
    set((s) => ({ config: { ...s.config, ...partial } })),
  setSearchConfig: (cfg) => {
    set({ searchConfig: cfg });
    WailsBridge.saveSearchConfig(cfg);
  },
  updateSearchConfig: (partial) => {
    const next = { ...get().searchConfig, ...partial };
    set({ searchConfig: next });
    WailsBridge.saveSearchConfig(next);
  },
  setDownloadProgress: (progress) => set({ downloadProgress: progress }),
  setIsDownloaderOpen: (open) => set({ isDownloaderOpen: open }),
  setViewportBg: (bg) => set({ viewportBg: bg }),
  setTestParamMouth: (val) => set({ testParamMouth: val }),
  setTestParamEye: (val) => set({ testParamEye: val }),
  setMetrics: (tokSec, latency) =>
    set({ tokensPerSec: tokSec, firstAudioLatencyMs: latency }),
  addLog: (msg) =>
    set((s) => ({
      logs: [...s.logs.slice(-99), `[${new Date().toLocaleTimeString()}] ${msg}`],
    })),
  chatMessages: [
    {
      id: 'welcome',
      sender: 'assistant',
      characterName: 'ひより',
      text: 'こんにちは！AI Companion Studio へようこそ！何でも話しかけてね！',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ],
  addChatMessage: (msg) =>
    set((s) => ({
      chatMessages: [...s.chatMessages.slice(-49), msg],
    })),
  clearChatMessages: () => set({ chatMessages: [] }),
}));
