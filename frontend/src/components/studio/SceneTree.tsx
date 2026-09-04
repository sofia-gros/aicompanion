import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  User,
  Sparkles,
  Volume2,
  Cpu,
  Folder,
  Plus,
  Check,
  Copy,
  Trash2,
  Download,
  Play,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { CharacterProfile } from '../../types/character';

interface SceneTreeProps {
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
}

/**
 * キャラクター階層ベースのシーンツリーコンポーネント
 * （右クリックコンテキストメニューによるキャラ削除・複製・書き出し・召喚対応）
 */
export const SceneTree: React.FC<SceneTreeProps> = ({ selectedNodeId, onSelectNode }) => {
  const {
    characters,
    activeCharacterId,
    selectCharacter,
    deleteCharacter,
    duplicateCharacter,
    setIsCharacterModalOpen,
    addLog,
  } = useAppStore();

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    root: true,
    hiyori: true,
    mao: false,
    haru: false,
  });

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    char: CharacterProfile;
  } | null>(null);

  // コンテキストメニュー外クリックで閉じる
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const toggleFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleContextMenu = (e: React.MouseEvent, char: CharacterProfile) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      char,
    });
  };

  const handleExportChar = (char: CharacterProfile) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(char, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `${char.id}.companion.json`;
    a.click();
    addLog(`[Export] キャラクター設定を書き出しました: ${char.name}`);
  };

  return (
    <div className="relative h-full bg-zinc-900/90 flex flex-col border-r border-zinc-800 select-none">
      {/* ヘッダー */}
      <div className="h-7 px-3 flex items-center justify-between border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
        <span>Scene Hierarchy</span>
        <button
          onClick={() => setIsCharacterModalOpen(true)}
          className="p-1 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white cursor-pointer"
          title="新規キャラクター追加"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* キャラクター階層ツリー */}
      <div className="flex-1 p-2 overflow-y-auto space-y-1 text-xs">
        <div className="flex items-center gap-1.5 py-1 px-1.5 rounded text-zinc-400 font-semibold text-[11px]">
          <Folder className="w-3.5 h-3.5 text-indigo-400" />
          <span>Characters (Scene)</span>
        </div>

        {characters.map((char) => {
          const isOpen = openFolders[char.id] ?? false;
          const isActive = char.id === activeCharacterId;

          return (
            <div key={char.id} className="ml-2 border-l border-zinc-800 pl-1.5 space-y-0.5">
              {/* キャラクターフォルダーノード (右クリック対応) */}
              <div
                className={`group flex items-center justify-between py-1 px-2 rounded cursor-pointer transition-colors ${
                  selectedNodeId.startsWith(`char:${char.id}:`)
                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                    : 'hover:bg-zinc-800/60 text-zinc-300'
                }`}
                onClick={(e) => toggleFolder(char.id, e)}
                onContextMenu={(e) => handleContextMenu(e, char)}
                title="右クリックでメニュー（召喚・複製・書き出し・削除）"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="p-0.5 text-zinc-400 hover:text-zinc-200">
                    {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </span>
                  <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">{char.name}</span>
                </div>

                <div className="flex items-center gap-1">
                  {isActive ? (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center gap-0.5">
                      <Check className="w-2.5 h-2.5" />
                      稼働中
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        selectCharacter(char.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-[10px] px-1.5 py-0.2 rounded bg-zinc-700 hover:bg-indigo-600 text-zinc-200 transition-all cursor-pointer"
                      title="このキャラクターをビューポートにアクティブ化"
                    >
                      召喚
                    </button>
                  )}
                </div>
              </div>

              {/* サブノード群 (Profile, Model, Voice, AI Brain) */}
              {isOpen && (
                <div className="ml-4 border-l border-zinc-800 pl-2 space-y-0.5">
                  <div
                    onClick={() => onSelectNode(`char:${char.id}:profile`)}
                    className={`flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer transition-colors ${
                      selectedNodeId === `char:${char.id}:profile`
                        ? 'bg-indigo-600/30 text-indigo-200 font-medium'
                        : 'hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <User className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span className="truncate">Profile (基本情報・配布)</span>
                  </div>

                  <div
                    onClick={() => onSelectNode(`char:${char.id}:model`)}
                    className={`flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer transition-colors ${
                      selectedNodeId === `char:${char.id}:model`
                        ? 'bg-indigo-600/30 text-indigo-200 font-medium'
                        : 'hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 text-pink-400 shrink-0" />
                    <span className="truncate">Avatar Model (2D/3D・漫符)</span>
                  </div>

                  <div
                    onClick={() => onSelectNode(`char:${char.id}:voice`)}
                    className={`flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer transition-colors ${
                      selectedNodeId === `char:${char.id}:voice`
                        ? 'bg-indigo-600/30 text-indigo-200 font-medium'
                        : 'hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Volume2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="truncate">Voice / TTS (Haruka・音量)</span>
                  </div>

                  <div
                    onClick={() => onSelectNode(`char:${char.id}:brain`)}
                    className={`flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer transition-colors ${
                      selectedNodeId === `char:${char.id}:brain`
                        ? 'bg-indigo-600/30 text-indigo-200 font-medium'
                        : 'hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Cpu className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="truncate">AI Brain (LLM・独り言・PTT)</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 右クリックコンテキストメニュー (フローティング) */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-zinc-900 border border-zinc-700/80 rounded-md shadow-2xl py-1 min-w-44 text-xs font-medium text-zinc-200 animate-in fade-in"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] text-zinc-500 border-b border-zinc-800 font-mono">
            {contextMenu.char.name}
          </div>
          <button
            onClick={() => {
              selectCharacter(contextMenu.char.id);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-3 h-3 text-emerald-400" />
            <span>召喚 (アクティブ化)</span>
          </button>
          <button
            onClick={() => {
              duplicateCharacter(contextMenu.char.id);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
          >
            <Copy className="w-3 h-3 text-indigo-400" />
            <span>キャラクターを複製</span>
          </button>
          <button
            onClick={() => {
              handleExportChar(contextMenu.char);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-3 h-3 text-zinc-400" />
            <span>設定書き出し (.companion)</span>
          </button>
          <div className="my-1 border-t border-zinc-800" />
          <button
            onClick={() => {
              deleteCharacter(contextMenu.char.id);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-rose-950/80 text-rose-400 flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>キャラクターを削除</span>
          </button>
        </div>
      )}
    </div>
  );
};
