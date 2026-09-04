import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { Sparkles } from 'lucide-react';
import { AudioService } from '../../services/audioService';

// ヘッドレスブラウザや一部GPU環境でのシェーダーMAXユニット0例外を防止する安全ラッパー
if (typeof window !== 'undefined' && !(window as any).__webgl_patched) {
  (window as any).__webgl_patched = true;
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  (HTMLCanvasElement.prototype as any).getContext = function (this: HTMLCanvasElement, ...args: any[]): any {
    const ctx = origGetContext.apply(this, args as any);
    const contextType = args[0];
    if (ctx && (contextType === 'webgl' || contextType === 'webgl2' || contextType === 'experimental-webgl')) {
      const gl = ctx as unknown as WebGLRenderingContext;
      const origGetParam = gl.getParameter.bind(gl);
      gl.getParameter = function (pname: number): any {
        if (pname === gl.MAX_TEXTURE_IMAGE_UNITS) {
          const val = origGetParam(pname);
          return typeof val === 'number' && val > 0 ? val : 16;
        }
        if (pname === (gl as any).MAX_FRAGMENT_UNIFORM_VECTORS) {
          const val = origGetParam(pname);
          return typeof val === 'number' && val > 0 ? val : 16;
        }
        return origGetParam(pname);
      };
    }
    return ctx;
  };
}

interface Live2DCanvasProps {
  modelPath?: string;
  audioService: AudioService;
  emotion?: string;
  sensitivity?: number;
  eyeSensitivity?: number;
  onModelLoaded?: (modelName: string) => void;
}

/**
 * PixiJS v7 を用いた安全・軽量 Live2D レンダラーコンポーネント
 * (キャンバスやPixi Applicationの破棄を行わず、モデルのみを安全に差分ロードします)
 */
export const Live2DCanvas: React.FC<Live2DCanvasProps> = ({
  modelPath = '',
  audioService,
  emotion = 'neutral',
  sensitivity = 1.0,
  eyeSensitivity = 1.0,
  onModelLoaded,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);

  // 感度パラメータをRefで保持し、不要な再レンダリング・破棄を防止
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;

  const eyeSensitivityRef = useRef(eyeSensitivity);
  eyeSensitivityRef.current = eyeSensitivity;

  // 1. PixiJS Application の初期化 (初回マウント時のみ実行)
  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      (Live2DModel as any).registerTicker(PIXI.Ticker);
    } catch {
      // 登録済み回避
    }

    const app = new PIXI.Application({
      view: canvasRef.current,
      backgroundAlpha: 0,
      autoStart: true,
      resizeTo: canvasRef.current.parentElement || window,
      antialias: true,
    });
    appRef.current = app;
    setIsAppReady(true);

    // 毎フレームのリップシンクアニメーションループ
    const tickerCallback = () => {
      const mouthOpen = audioService.getMouthOpen(sensitivityRef.current);

      if (modelRef.current?.internalModel?.coreModel) {
        const core = modelRef.current.internalModel.coreModel;
        core.setParameterValueById('ParamMouthOpenY', mouthOpen);
      }
    };
    app.ticker.add(tickerCallback);

    // マウス視線追従イベント
    const handleMouseMove = (e: MouseEvent) => {
      if (!modelRef.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const normX = ((e.clientX - rect.left) / rect.width - 0.5) * 2 * eyeSensitivityRef.current;
      const normY = ((e.clientY - rect.top) / rect.height - 0.5) * -2 * eyeSensitivityRef.current;

      if (modelRef.current.focus) {
        modelRef.current.focus(normX, normY);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (appRef.current) {
        try {
          appRef.current.ticker?.remove(tickerCallback);
          if (modelRef.current) {
            appRef.current.stage?.removeChild(modelRef.current);
            modelRef.current.destroy();
            modelRef.current = null;
          }
          appRef.current.destroy(false, { children: true });
        } catch {
          // 解放例外安全吸収
        }
        appRef.current = null;
      }
      setIsAppReady(false);
    };
  }, []); // 依存配列は空！絶対に再実行しない

  // 2. モデル変更時の差分ロード処理 (modelPath または isAppReady が変わった時に実行)
  useEffect(() => {
    const app = appRef.current;
    if (!app || !modelPath || !isAppReady) return;

    let isCurrent = true;

    // 既存モデルを安全に削除・解放
    if (modelRef.current) {
      app.stage.removeChild(modelRef.current);
      try {
        modelRef.current.destroy({ children: true });
      } catch {
        // 解放例外の安全な無視
      }
      modelRef.current = null;
    }

    setIsLoaded(false);
    setLoadError(null);

    console.log('[Live2D] Loading model from path:', modelPath);

    // 新モデルのロード
    Live2DModel.from(modelPath, { autoInteract: false })
      .then((model: any) => {
        console.log('[Live2D] Model loaded successfully! Raw width:', model.width, 'Raw height:', model.height, 'app.screen:', app.screen.width, app.screen.height);
        if (!isCurrent || !appRef.current) {
          model.destroy({ children: true });
          return;
        }
        modelRef.current = model;

        // バストアップ表示のスケールと位置計算（胸から上が中央に大きく映るように最適化）
        const mWidth = model.width > 0 ? model.width : 2000;
        const mHeight = model.height > 0 ? model.height : 2000;

        // 上半身（頭部〜胸）が画面高さの約80%を美しく占めるスケールを算出
        let scale = app.screen.height / (mHeight * 0.42);
        if (!isFinite(scale) || scale <= 0) scale = 0.22;

        model.scale.set(scale, scale);
        model.anchor.set(0.5, 0.18); // 頭部〜首元を基準アンカーに設定
        model.position.set(app.screen.width / 2, app.screen.height * 0.22);
        console.log('[Live2D] Applied bust-up scale:', scale, 'position:', model.position.x, model.position.y);

        app.stage.addChild(model as any);
        setIsLoaded(true);
        setLoadError(null);
        if (onModelLoaded) onModelLoaded(modelPath);
      })
      .catch((err) => {
        if (!isCurrent) return;
        console.error('[Live2D Error] モデルの読み込みに失敗しました:', err);
        setLoadError(`モデルの読み込みに失敗しました (${modelPath})`);
      });

    return () => {
      isCurrent = false;
    };
  }, [modelPath, isAppReady]);

  // 3. 感情・発話ステート変更時のモーション・表情自動トリガー
  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;

    try {
      if (emotion === 'happy') {
        // 笑顔・喜びモーション
        if (model.motion) model.motion('TapBody');
        if (model.expression) model.expression(0);
      } else if (emotion === 'surprised') {
        // 驚きモーション
        if (model.motion) model.motion('Flick');
        if (model.expression) model.expression(1);
      } else if (emotion === 'sad' || emotion === 'angry') {
        if (model.expression) model.expression(2);
      } else {
        // アイドル待機
        if (model.motion) model.motion('Idle');
      }
    } catch {
      // モデルごとに定義が異なる場合の安全なフォールバック
    }
  }, [emotion]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />

      {(!modelPath || loadError) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
          <div className="w-56 h-64 rounded-2xl border-2 border-dashed border-indigo-500/40 bg-indigo-950/20 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center mb-3">
              <Sparkles className="w-10 h-10 text-indigo-400" />
            </div>
            <h4 className="text-sm font-semibold text-zinc-200">Live2D レンダラー準備完了</h4>
            <p className="text-[11px] text-zinc-400 mt-1">
              {loadError ? loadError : 'モデル配置待機中 (リップシンク・視線追従稼働中)'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
