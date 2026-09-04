import React, { useRef } from 'react';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAppStore } from '../../stores/useAppStore';
import { WailsBridge } from '../../services/wailsBridge';
import { CharacterProfile } from '../../types/character';
import {
  User,
  Sparkles,
  Volume2,
  Cpu,
  Upload,
  Download,
  Trash2,
  Check,
  FolderOpen,
} from 'lucide-react';

interface InspectorProps {
  selectedNodeId: string;
}

/**
 * 選択中のキャラクターノード（Profile, Model, Voice, AI Brain）に応じた完全動的インスペクター
 */
export const Inspector: React.FC<InspectorProps> = ({ selectedNodeId }) => {
  const {
    characters,
    activeCharacterId,
    selectCharacter,
    saveCharacter,
    config,
    updateConfig,
    setAvatarType,
    setVrmModelUrl,
    testParamMouth,
    setTestParamMouth,
    testParamEye,
    setTestParamEye,
    setCurrentEmotion,
    addLog,
  } = useAppStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // ノードIDのパース: "char:{charId}:{category}" またはフォールバック
  const parts = selectedNodeId.split(':');
  const targetCharId = parts[0] === 'char' && parts[1] ? parts[1] : activeCharacterId;
  const category = parts[2] || 'profile';

  const char = characters.find((c) => c.id === targetCharId) || characters[0];
  const isActive = char?.id === activeCharacterId;

  if (!char) {
    return (
      <div className="h-full bg-zinc-900/90 p-4 text-xs text-zinc-500 flex items-center justify-center">
        ノードを選択してください
      </div>
    );
  }

  const updateChar = (partial: Partial<CharacterProfile>) => {
    const updated = { ...char, ...partial };
    saveCharacter(updated);
    if (isActive) {
      if (partial.avatarType) setAvatarType(partial.avatarType);
      if (partial.vrmModelPath) setVrmModelUrl(partial.vrmModelPath);
    }
  };

  // キャラクター書き出し (.companion.json)
  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(char, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `${char.id}.companion.json`;
    a.click();
    addLog(`[Export] キャラクター設定を書き出しました: ${char.name}`);
  };

  // キャラクター読み込み
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string) as CharacterProfile;
        if (imported.name && imported.id) {
          saveCharacter(imported);
          selectCharacter(imported.id);
          addLog(`[Import] キャラクターをインポートしました: ${imported.name}`);
        }
      } catch (err) {
        addLog('[Import] インポートに失敗しました (JSONフォーマットエラー)');
      }
    };
    reader.readAsText(file);
  };

  // モデルファイル選択
  const handleModelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    if (file.name.endsWith('.vrm')) {
      updateChar({ vrmModelPath: fileUrl, avatarType: 'vrm' });
      addLog(`[Model] ローカルVRMモデルをロードしました: ${file.name}`);
    } else {
      updateChar({ modelPath: fileUrl, avatarType: 'live2d' });
      addLog(`[Model] ローカルLive2Dモデルをロードしました: ${file.name}`);
    }
  };

  const handleClearHistory = async () => {
    await WailsBridge.clearConversationHistory();
    addLog(`[Memory] ${char.name} の会話記憶をリセットしました`);
  };

  return (
    <div className="h-full bg-zinc-900/90 flex flex-col border-l border-zinc-800 select-none text-xs">
      {/* インスペクターヘッダー */}
      <div className="h-7 px-3 flex items-center justify-between border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
        <span className="truncate">Inspector: {char.name}</span>
        {isActive ? (
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center gap-0.5">
            <Check className="w-2.5 h-2.5" /> 稼働中
          </span>
        ) : (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => selectCharacter(char.id)}
            className="h-5 px-1.5 text-[10px] text-indigo-300 hover:text-white hover:bg-indigo-600/30"
          >
            召喚
          </Button>
        )}
      </div>

      <div className="flex-1 p-3 overflow-y-auto space-y-4">
        {/* ==================== 1. PROFILE ノード ==================== */}
        {category === 'profile' && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-zinc-200 font-semibold border-b border-zinc-800 pb-1.5">
              <User className="w-4 h-4 text-indigo-400" />
              <span>プロファイル基本情報</span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">名前</label>
              <input
                type="text"
                value={char.name}
                onChange={(e) => updateChar({ name: e.target.value })}
                className="w-full h-7 bg-zinc-950 border border-zinc-700 rounded px-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">説明・概要</label>
              <textarea
                value={char.description}
                rows={2}
                onChange={(e) => updateChar({ description: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-zinc-100 focus:outline-none focus:border-indigo-500 resize-none text-[11px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">性格・ロールプレイプロンプト</label>
              <textarea
                value={char.personality}
                rows={3}
                onChange={(e) => updateChar({ personality: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-zinc-100 focus:outline-none focus:border-indigo-500 resize-none text-[11px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400">一人称</label>
                <input
                  type="text"
                  value={char.firstPerson}
                  onChange={(e) => updateChar({ firstPerson: e.target.value })}
                  className="w-full h-7 bg-zinc-950 border border-zinc-700 rounded px-2 text-zinc-100 focus:outline-none focus:border-indigo-500 text-[11px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400">二人称</label>
                <input
                  type="text"
                  value={char.secondPerson}
                  onChange={(e) => updateChar({ secondPerson: e.target.value })}
                  className="w-full h-7 bg-zinc-950 border border-zinc-700 rounded px-2 text-zinc-100 focus:outline-none focus:border-indigo-500 text-[11px]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">口調ルール（語尾・話し方）</label>
              <input
                type="text"
                value={char.toneRule}
                onChange={(e) => updateChar({ toneRule: e.target.value })}
                className="w-full h-7 bg-zinc-950 border border-zinc-700 rounded px-2 text-zinc-100 focus:outline-none focus:border-indigo-500 text-[11px]"
              />
            </div>

            {/* キャラクター共有・エクスポート/インポート */}
            <div className="pt-2 border-t border-zinc-800 space-y-2">
              <span className="text-[11px] font-semibold text-zinc-400">キャラクター共有</span>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={handleExport}
                  className="gap-1 text-zinc-200 border-zinc-700 hover:bg-zinc-800 whitespace-nowrap text-[11px]"
                  title="キャラクター設定を .companion.json として書き出し"
                >
                  <Download className="w-3 h-3 shrink-0" />
                  <span>設定書き出し</span>
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => importInputRef.current?.click()}
                  className="gap-1 text-zinc-200 border-zinc-700 hover:bg-zinc-800 whitespace-nowrap text-[11px]"
                  title="外部の .companion.json ファイルを読み込み"
                >
                  <Upload className="w-3 h-3 shrink-0" />
                  <span>設定読み込み</span>
                </Button>
                <input
                  type="file"
                  ref={importInputRef}
                  onChange={handleImport}
                  accept=".json,.companion"
                  className="hidden"
                />
              </div>
            </div>
          </div>
        )}

        {/* ==================== 2. MODEL ノード ==================== */}
        {category === 'model' && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-zinc-200 font-semibold border-b border-zinc-800 pb-1.5">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span>アバターモデル設定 (2D / 3D)</span>
            </div>

            {/* レンダラー種別 */}
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">レンダラー形式</label>
              <Select
                value={char.avatarType || 'live2d'}
                onValueChange={(v) => updateChar({ avatarType: v as any })}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live2d">Live2D (Cubism 4)</SelectItem>
                  <SelectItem value="vrm">VRM (3D モデル)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* モデルファイルピッカー */}
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">
                {char.avatarType === 'vrm' ? 'VRM モデルファイル (.vrm)' : 'Live2D モデル (.model3.json)'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={char.avatarType === 'vrm' ? char.vrmModelPath || '' : char.modelPath}
                  onChange={(e) =>
                    char.avatarType === 'vrm'
                      ? updateChar({ vrmModelPath: e.target.value })
                      : updateChar({ modelPath: e.target.value })
                  }
                  className="flex-1 h-7 bg-zinc-950 border border-zinc-700 rounded px-2 text-zinc-100 text-[11px]"
                />
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1 shrink-0"
                  title="ローカルファイルを選択"
                >
                  <FolderOpen className="w-3 h-3" />
                  選択
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleModelFileSelect}
                  accept={char.avatarType === 'vrm' ? '.vrm' : '.json'}
                  className="hidden"
                />
              </div>
            </div>

            {/* 漫符エフェクト ON/OFF */}
            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="font-medium text-zinc-200">感情漫符エフェクト</span>
                <p className="text-[10px] text-zinc-500">頭上にハートやキラキラが浮かぶ演出</p>
              </div>
              <Switch
                checked={char.enableEmoteEffect ?? true}
                onCheckedChange={(c) => updateChar({ enableEmoteEffect: c })}
              />
            </div>

            {/* 感度スライダー */}
            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-400 text-[11px]">
                  <span>リップシンク感度</span>
                  <span className="font-mono text-zinc-300">{config.lipSyncSensitivity.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[config.lipSyncSensitivity]}
                  min={0.2}
                  max={3.0}
                  step={0.1}
                  onValueChange={(val) => updateConfig({ lipSyncSensitivity: val[0] })}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-zinc-400 text-[11px]">
                  <span>視線追従感度</span>
                  <span className="font-mono text-zinc-300">{config.eyeTrackingSensitivity.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[config.eyeTrackingSensitivity]}
                  min={0.2}
                  max={3.0}
                  step={0.1}
                  onValueChange={(val) => updateConfig({ eyeTrackingSensitivity: val[0] })}
                />
              </div>
            </div>

            {/* 手動モデル動作テスト（口開閉・視線・表情プレビュー） */}
            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <span className="text-[11px] font-semibold text-zinc-300">手動動作テスト（プレビュー）</span>

              <div className="space-y-1">
                <div className="flex justify-between text-zinc-400 text-[10px]">
                  <span>口開度テスト (Mouth Open)</span>
                  <span className="font-mono text-zinc-300">{testParamMouth.toFixed(2)}</span>
                </div>
                <Slider
                  value={[testParamMouth]}
                  min={0.0}
                  max={1.0}
                  step={0.05}
                  onValueChange={(val) => {
                    setTestParamMouth(val[0]);
                    WailsBridge.setLive2DParameter('ParamMouthOpenY', val[0]);
                  }}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-zinc-400 text-[10px]">
                  <span>視線左右テスト (Eye X)</span>
                  <span className="font-mono text-zinc-300">{testParamEye.toFixed(2)}</span>
                </div>
                <Slider
                  value={[testParamEye]}
                  min={-1.0}
                  max={1.0}
                  step={0.1}
                  onValueChange={(val) => {
                    setTestParamEye(val[0]);
                    WailsBridge.setLive2DParameter('ParamEyeBallX', val[0]);
                  }}
                />
              </div>

              <div className="space-y-1 pt-1">
                <span className="text-[10px] text-zinc-400">表情プレビュー切替</span>
                <div className="grid grid-cols-4 gap-1 text-[10px]">
                  {['neutral', 'happy', 'angry', 'surprised'].map((emo) => (
                    <button
                      key={emo}
                      onClick={() => setCurrentEmotion(emo)}
                      className="py-1 rounded bg-zinc-800 hover:bg-indigo-600 text-zinc-300 hover:text-white transition-colors cursor-pointer capitalize"
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 3. VOICE ノード ==================== */}
        {category === 'voice' && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-zinc-200 font-semibold border-b border-zinc-800 pb-1.5">
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span>音声合成エンジン (TTS)</span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">TTSエンジン</label>
              <Select
                value={char.ttsEngine}
                onValueChange={async (v) => {
                  updateChar({ ttsEngine: v as any });
                  if (isActive) await WailsBridge.setTTSProvider(v, char.speakerId);
                }}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="windows-tts">Windows標準 (Haruka・推奨)</SelectItem>
                  <SelectItem value="voicevox">VOICEVOX (:50021)</SelectItem>
                  <SelectItem value="style-bert-vits2">Style-Bert-VITS2 (:5000)</SelectItem>
                  <SelectItem value="mock">内蔵Mock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">話者ID (VOICEVOX / SBV2用)</label>
              <input
                type="number"
                value={char.speakerId}
                onChange={(e) => updateChar({ speakerId: parseInt(e.target.value) || 0 })}
                className="w-full h-7 bg-zinc-950 border border-zinc-700 rounded px-2 text-zinc-100 text-xs"
              />
            </div>

            <div className="space-y-1 pt-2">
              <div className="flex justify-between text-zinc-400 text-[11px]">
                <span>マスター音量</span>
                <span className="font-mono text-zinc-300">{Math.round(config.volume * 100)}%</span>
              </div>
              <Slider
                value={[config.volume]}
                min={0.0}
                max={1.0}
                step={0.05}
                onValueChange={(val) => updateConfig({ volume: val[0] })}
              />
            </div>
          </div>
        )}

        {/* ==================== 4. AI BRAIN ノード ==================== */}
        {category === 'brain' && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-zinc-200 font-semibold border-b border-zinc-800 pb-1.5">
              <Cpu className="w-4 h-4 text-amber-400" />
              <span>AI推論 ＆ 自発的対話設定</span>
            </div>

            {/* 推論温度 */}
            <div className="space-y-1">
              <div className="flex justify-between text-zinc-400 text-[11px]">
                <span>推論温度 (Temperature)</span>
                <span className="font-mono text-zinc-300">{(char.temperature ?? 0.7).toFixed(2)}</span>
              </div>
              <Slider
                value={[char.temperature ?? 0.7]}
                min={0.1}
                max={1.5}
                step={0.05}
                onValueChange={(val) => updateChar({ temperature: val[0] })}
              />
            </div>

            {/* 自発的発話 (独り言・見守り) */}
            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-zinc-200">自発的発話 (独り言・見守り)</span>
                  <p className="text-[10px] text-zinc-500">作業の合間に声をかけてくれる機能</p>
                </div>
                <Switch
                  checked={char.enableProactiveSpeech ?? true}
                  onCheckedChange={(c) => updateChar({ enableProactiveSpeech: c })}
                />
              </div>

              {(char.enableProactiveSpeech ?? true) && (
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-900">
                  <span className="text-zinc-400">発話間隔</span>
                  <div className="w-28">
                    <Select
                      value={String(char.proactiveIntervalMinutes || 5)}
                      onValueChange={(v) => updateChar({ proactiveIntervalMinutes: parseInt(v) })}
                    >
                      <SelectTrigger className="h-6 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3分おき</SelectItem>
                        <SelectItem value="5">5分おき (推奨)</SelectItem>
                        <SelectItem value="10">10分おき</SelectItem>
                        <SelectItem value="15">15分おき</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* プッシュ・トゥ・トーク (PTT) */}
            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="font-medium text-zinc-200">プッシュ・トゥ・トーク (PTT)</span>
                <p className="text-[10px] text-zinc-500">Space長押し中のみマイク音声を拾う</p>
              </div>
              <Switch
                checked={char.enablePushToTalk ?? false}
                onCheckedChange={(c) => updateChar({ enablePushToTalk: c })}
              />
            </div>

            {/* 会話記憶クリア */}
            <div className="pt-2 border-t border-zinc-800 space-y-1.5">
              <span className="text-[11px] font-semibold text-zinc-400">長期・短期会話記憶</span>
              <Button
                size="xs"
                variant="destructive"
                onClick={handleClearHistory}
                className="w-full gap-1 text-rose-300 bg-rose-950/60 border border-rose-800/60 hover:bg-rose-900/60"
              >
                <Trash2 className="w-3 h-3" />
                会話記憶を完全消去 (リセット)
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
