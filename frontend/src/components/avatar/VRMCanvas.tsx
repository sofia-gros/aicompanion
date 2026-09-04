import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Box } from 'lucide-react';
import { AudioService } from '../../services/audioService';

interface VRMCanvasProps {
  modelUrl?: string;
  audioService: AudioService;
  sensitivity?: number;
  eyeSensitivity?: number;
}

/**
 * Three.js + @pixiv/three-vrm による高機能3Dアバター描画コンポーネント
 */
export const VRMCanvas: React.FC<VRMCanvasProps> = ({
  modelUrl = '',
  audioService,
  sensitivity = 1.0,
  eyeSensitivity = 1.0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const vrmRef = useRef<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;

  const eyeSensitivityRef = useRef(eyeSensitivity);
  eyeSensitivityRef.current = eyeSensitivity;

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    // 1. シーン・カメラ・レンダラー初期化
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30.0, width / height, 0.1, 20.0);
    camera.position.set(0.0, 1.4, 1.2);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    // 2. ライティング
    const light = new THREE.DirectionalLight(0xffffff, Math.PI);
    light.position.set(1.0, 1.0, 1.0).normalize();
    scene.add(light);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5 * Math.PI);
    scene.add(ambientLight);

    // 3. VRM ロード
    if (modelUrl) {
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));

      loader.load(
        modelUrl,
        (gltf) => {
          const vrm = gltf.userData.vrm;
          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.removeUnnecessaryJoints(gltf.scene);

          // モデル向き補正
          vrm.scene.rotation.y = Math.PI;
          scene.add(vrm.scene);
          vrmRef.current = vrm;
          setLoadError(null);
        },
        undefined,
        (err) => {
          console.warn('VRMモデルの読み込みに失敗しました:', err);
          setLoadError('VRMモデルのロードに失敗しました。URLまたはファイルパスをご確認ください。');
        }
      );
    }

    // 4. アニメーション＆リップシンク・視線追従ループ
    let animFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (vrmRef.current) {
        // リップシンク
        const mouthOpen = audioService.getMouthOpen(sensitivityRef.current);
        if (vrmRef.current.expressionManager) {
          vrmRef.current.expressionManager.setValue('aa', mouthOpen);
        }
        vrmRef.current.update(delta);
      }

      renderer.render(scene, camera);
    };
    animate();

    // 5. リサイズ処理
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameId);
      renderer.dispose();
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [modelUrl]);

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {(!modelUrl || loadError) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
          <div className="w-56 h-64 rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-950/20 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
              <Box className="w-10 h-10 text-emerald-400" />
            </div>
            <h4 className="text-sm font-semibold text-zinc-200">3D (VRM) レンダラー準備完了</h4>
            <p className="text-[11px] text-zinc-400 mt-1">
              {loadError ? loadError : '.vrm モデルファイルを指定すると3D表示へ切り替わります'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
