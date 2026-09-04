import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { UserPlus } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { CharacterProfile } from '../../types/character';

interface CharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 新規キャラクター作成および編集ダイアログ
 */
export const CharacterModal: React.FC<CharacterModalProps> = ({ isOpen, onClose }) => {
  const { characters, activeCharacterId, saveCharacter, selectCharacter } = useAppStore();
  const current = characters.find((c) => c.id === activeCharacterId) || characters[0];

  const [name, setName] = useState(current?.name || '');
  const [description, setDescription] = useState(current?.description || '');
  const [personality, setPersonality] = useState(current?.personality || '');
  const [toneRule, setToneRule] = useState(current?.toneRule || '');
  const [firstPerson, setFirstPerson] = useState(current?.firstPerson || 'わたし');
  const [secondPerson, setSecondPerson] = useState(current?.secondPerson || 'あなた');
  const [modelPath, setModelPath] = useState(current?.modelPath || '/live2d/models/Hiyori/Hiyori.model3.json');
  const [ttsEngine, setTtsEngine] = useState<any>(current?.ttsEngine || 'windows-tts');

  const handleSave = () => {
    const newId = name.toLowerCase().replace(/\s+/g, '_') || `char_${Date.now()}`;
    const newChar: CharacterProfile = {
      id: newId,
      name,
      description,
      personality,
      toneRule,
      firstPerson,
      secondPerson,
      modelPath,
      ttsEngine,
      speakerId: 0,
      examples: [
        ['こんにちは！', `こんにちは！${firstPerson}は${name}だよ！`],
        ['今日の気分はどう？', `${secondPerson}と話せてとっても楽しいよ！`],
      ],
    };

    saveCharacter(newChar);
    selectCharacter(newChar.id);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-zinc-900 text-zinc-100 border-zinc-800 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            <span>キャラクター作成 ＆ プロファイル設定</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <p className="text-zinc-400 text-[11px]">
            AIコンパニオンの見た目（Live2Dモデル）・性格・口調・声を自由にカスタマイズして保存できます。
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-zinc-300 font-medium">キャラクター名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: ひより、ずんだもん、等"
                className="w-full h-8 bg-zinc-950 border border-zinc-700 rounded px-2.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-zinc-300 font-medium">Live2D アバターモデル</label>
              <Select value={modelPath} onValueChange={(val) => setModelPath(val)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="モデル選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="/live2d/models/Hiyori/Hiyori.model3.json">
                    ひより (Hiyori) - 元気な女子学生
                  </SelectItem>
                  <SelectItem value="/live2d/models/Mao/Mao.model3.json">
                    マオ (Mao) - 中華風美少女
                  </SelectItem>
                  <SelectItem value="/live2d/models/Haru/Haru.model3.json">
                    ハル (Haru) - 優しいお姉さん
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-zinc-300 font-medium">一言説明</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例: いつも元気に応援してくれる最高の相棒"
              className="w-full h-8 bg-zinc-950 border border-zinc-700 rounded px-2.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-zinc-300 font-medium">性格・プロンプト設定</label>
            <textarea
              rows={3}
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="例: 好奇心旺盛で前向き。ユーザーのプログラミングやゲームを応援するのが大好き。"
              className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-sans"
            />
          </div>

          <div className="space-y-1">
            <label className="text-zinc-300 font-medium">口調ルール（語尾・禁止事項など）</label>
            <textarea
              rows={2}
              value={toneRule}
              onChange={(e) => setToneRule(e.target.value)}
              placeholder="例: 親しい友達口調。「〜だよ！」「〜だね！」「〜かな？」。敬語は使わず絵文字は出力しない。"
              className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-sans"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-zinc-300 font-medium">一人称</label>
              <input
                type="text"
                value={firstPerson}
                onChange={(e) => setFirstPerson(e.target.value)}
                className="w-full h-8 bg-zinc-950 border border-zinc-700 rounded px-2.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-zinc-300 font-medium">二人称</label>
              <input
                type="text"
                value={secondPerson}
                onChange={(e) => setSecondPerson(e.target.value)}
                className="w-full h-8 bg-zinc-950 border border-zinc-700 rounded px-2.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-zinc-300 font-medium">音声エンジン</label>
              <Select value={ttsEngine} onValueChange={(val) => setTtsEngine(val)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="音声エンジン" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="windows-tts">Windows標準 (Haruka等)</SelectItem>
                  <SelectItem value="voicevox">VOICEVOX (:50021)</SelectItem>
                  <SelectItem value="style-bert-vits2">Style-Bert-VITS2 (:5000)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button size="sm" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 font-semibold" onClick={handleSave}>
              この設定で作成・保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
