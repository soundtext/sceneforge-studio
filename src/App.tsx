import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileCode2 } from 'lucide-react';
import { ControlSidebar, SidebarTab } from './components/ControlSidebar';
import { HtmlSceneExtractor } from './components/HtmlSceneExtractor';
import { MockupGalleryStage, StageViewMode } from './components/MockupGalleryStage';
import {
  DEFAULT_TEXT_CONFIG,
  ExportFormat,
  MOCKUP_OPTIONS,
  MockupOptionId,
  MockupTextConfig,
  SceneAsset,
  deleteSceneFromGallery,
} from './utils/mockupPresets';
import { exportCanvasAsImage, renderMockupToCanvas } from './utils/mockupRenderer';

function createInitialProceduralSceneDataUrl(variant: 'scarlet' | 'obsidian'): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const sky = ctx.createLinearGradient(0, 0, 0, 720);
  if (variant === 'scarlet') {
    sky.addColorStop(0, '#0a121c');
    sky.addColorStop(0.5, '#1b2c3b');
    sky.addColorStop(1, '#090d12');
  } else {
    sky.addColorStop(0, '#140b19');
    sky.addColorStop(0.55, '#2d142c');
    sky.addColorStop(1, '#09070d');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1280, 720);

  const glow = ctx.createRadialGradient(
    variant === 'scarlet' ? 820 : 520,
    190,
    20,
    variant === 'scarlet' ? 820 : 520,
    190,
    460
  );
  glow.addColorStop(
    0,
    variant === 'scarlet' ? 'rgba(226, 232, 240, 0.36)' : 'rgba(244, 63, 94, 0.42)'
  );
  glow.addColorStop(
    0.45,
    variant === 'scarlet' ? 'rgba(148, 163, 184, 0.14)' : 'rgba(159, 18, 57, 0.18)'
  );
  glow.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1280, 720);

  ctx.fillStyle = variant === 'scarlet' ? '#121d28' : '#190f20';
  ctx.beginPath();
  ctx.moveTo(0, 720);
  for (let x = 0; x <= 1280; x += 32) {
    const y = 490 - Math.abs(Math.sin(x * 0.0045)) * 140 - Math.cos(x * 0.002) * 35;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(1280, 720);
  ctx.closePath();
  ctx.fill();

  if (variant === 'scarlet') {
    const crimsonMist = ctx.createRadialGradient(540, 420, 20, 540, 420, 380);
    crimsonMist.addColorStop(0, 'rgba(225, 29, 72, 0.34)');
    crimsonMist.addColorStop(0.5, 'rgba(159, 18, 57, 0.14)');
    crimsonMist.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = crimsonMist;
    ctx.fillRect(0, 0, 1280, 720);

    ctx.fillStyle = '#0d141d';
    ctx.fillRect(465, 250, 28, 470);
    ctx.fillRect(585, 250, 28, 470);
    ctx.fillRect(450, 235, 178, 26);

    const rune = ctx.createRadialGradient(540, 340, 2, 540, 340, 90);
    rune.addColorStop(0, 'rgba(251, 113, 133, 0.95)');
    rune.addColorStop(0.3, 'rgba(225, 29, 72, 0.45)');
    rune.addColorStop(1, 'rgba(225, 29, 72, 0)');
    ctx.fillStyle = rune;
    ctx.fillRect(440, 240, 200, 200);
  } else {
    ctx.fillStyle = '#0d0812';
    [
      [440, 220, 72],
      [555, 130, 118],
      [705, 195, 86],
    ].forEach(([tx, ty, tw]) => {
      ctx.fillRect(tx, ty, tw, 720 - ty);
      ctx.beginPath();
      ctx.moveTo(tx - 10, ty);
      ctx.lineTo(tx + tw / 2, ty - 70);
      ctx.lineTo(tx + tw + 10, ty);
      ctx.closePath();
      ctx.fill();
    });
  }

  ctx.fillStyle = '#080b10';
  for (let i = 0; i < 18; i++) {
    const x = (i * 107 + 20) % 1320;
    const h = 220 + ((i * 53) % 210);
    ctx.beginPath();
    ctx.moveTo(x - 32, 720);
    ctx.lineTo(x, 720 - h);
    ctx.lineTo(x + 32, 720);
    ctx.closePath();
    ctx.fill();
  }

  const fog = ctx.createLinearGradient(0, 480, 0, 720);
  fog.addColorStop(0, 'rgba(15, 23, 34, 0)');
  fog.addColorStop(1, 'rgba(7, 10, 15, 0.85)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, 480, 1280, 240);

  for (let i = 0; i < 36; i++) {
    const px = (i * 173 + 60) % 1240;
    const py = 120 + ((i * 89) % 520);
    const pr = 1 + (i % 3) * 0.9;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(251, 113, 133, 0.55)' : 'rgba(226, 232, 240, 0.35)';
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas.toDataURL('image/png');
}

export default function App() {
  const initialScenes = useMemo<SceneAsset[]>(() => {
    const scarletSceneUrl =
      typeof document !== 'undefined' ? createInitialProceduralSceneDataUrl('scarlet') : '';
    const obsidianSceneUrl =
      typeof document !== 'undefined' ? createInitialProceduralSceneDataUrl('obsidian') : '';

    return [
      {
        id: 'preset-scarlet-woods',
        name: 'Hutan Scarlet (Demo Scene)',
        source: 'preset',
        dataUrl: scarletSceneUrl,
        width: 1280,
        height: 720,
        createdAt: 'Bawaan',
      },
      {
        id: 'preset-obsidian-citadel',
        name: 'Benteng Obsidian (Demo Scene)',
        source: 'preset',
        dataUrl: obsidianSceneUrl,
        width: 1280,
        height: 720,
        createdAt: 'Bawaan',
      },
      {
        id: 'preset-scarlet-reference',
        name: 'Scarlet Veil (Key Art)',
        source: 'preset',
        dataUrl: '/assets/aistudio/image_3f8dd795.png',
        width: 1024,
        height: 576,
        createdAt: 'Referensi',
      },
      {
        id: 'preset-racing-reference',
        name: 'Apex Mountain (Referensi)',
        source: 'preset',
        dataUrl: '/assets/aistudio/image_5639335d.png',
        width: 1280,
        height: 720,
        createdAt: 'Referensi',
      },
      {
        id: 'preset-hunter-reference',
        name: 'Dark Woods Hunter (Referensi)',
        source: 'preset',
        dataUrl: '/assets/aistudio/image_ce267b82.png',
        width: 1280,
        height: 720,
        createdAt: 'Referensi',
      },
    ];
  }, []);

  const [scenes, setScenes] = useState<SceneAsset[]>(initialScenes);
  const [activeSceneId, setActiveSceneId] = useState<string>(initialScenes[0].id);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  const [selectedOption, setSelectedOption] = useState<MockupOptionId>('key-art');
  const [viewMode, setViewMode] = useState<StageViewMode>('grid');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('scene');
  const [showExtractor, setShowExtractor] = useState<boolean>(false);

  const [width, setWidth] = useState<number>(1920);
  const [height, setHeight] = useState<number>(1080);
  const [cornerRadiusRatio, setCornerRadiusRatio] = useState<number>(0);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [config, setConfig] = useState<MockupTextConfig>(DEFAULT_TEXT_CONFIG);

  const activeScene = useMemo(
    () => scenes.find((s) => s.id === activeSceneId) ?? scenes[0] ?? null,
    [scenes, activeSceneId]
  );

  useEffect(() => {
    if (!activeScene?.dataUrl) {
      setBgImage(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) setBgImage(img);
    };
    img.onerror = () => {
      if (!cancelled) setBgImage(null);
    };
    img.src = activeScene.dataUrl;
    return () => {
      cancelled = true;
    };
  }, [activeScene]);

  const handleSceneCaptured = useCallback((scene: SceneAsset, setAsActive: boolean) => {
    setScenes((prev) => [scene, ...prev]);
    if (setAsActive) {
      setActiveSceneId(scene.id);
    }
  }, []);

  const handleDeleteScene = useCallback(
    (id: string) => {
      setScenes((prev) => {
        const { nextScenes, nextActiveId } = deleteSceneFromGallery(
          prev,
          activeSceneId,
          id
        );
        setActiveSceneId(nextActiveId);
        return nextScenes;
      });
    },
    [activeSceneId]
  );

  const handleRestoreDefaultScenes = useCallback(() => {
    setScenes((prev) => {
      const existingIds = new Set(prev.map((s) => s.id));
      const missingDefaults = initialScenes.filter((s) => !existingIds.has(s.id));
      const merged = [...prev, ...missingDefaults];
      if (!activeSceneId && merged.length > 0) {
        setActiveSceneId(merged[0].id);
      }
      return merged;
    });
  }, [activeSceneId, initialScenes]);

  const handleUploadImageFallback = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      const probe = new Image();
      probe.onload = () => {
        const asset: SceneAsset = {
          id: `upload-${Date.now()}`,
          name: file.name.replace(/\.[^.]+$/, ''),
          source: 'upload',
          dataUrl,
          width: probe.naturalWidth || 1280,
          height: probe.naturalHeight || 720,
          createdAt: new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        setScenes((prev) => [asset, ...prev]);
        setActiveSceneId(asset.id);
      };
      probe.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleChangeConfig = useCallback((patch: Partial<MockupTextConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleQuickExportActive = () => {
    const offscreen = document.createElement('canvas');
    renderMockupToCanvas(
      offscreen,
      selectedOption,
      width,
      height,
      config,
      bgImage,
      cornerRadiusRatio
    );
    const slug = (config.title || 'mockup')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    exportCanvasAsImage(
      offscreen,
      `${slug}-${selectedOption}-${width}x${height}.${exportFormat}`,
      exportFormat
    );
  };

  const selectedMeta =
    MOCKUP_OPTIONS.find((o) => o.id === selectedOption) ?? MOCKUP_OPTIONS[0];

  return (
    <div className="min-h-screen bg-[#0B0D11] text-slate-100 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="border-b border-slate-800/90 bg-[#0B0D11]/95 sticky top-0 z-30 backdrop-blur-sm">
        <div className="max-w-[1440px] mx-auto px-5 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            SceneForge
          </a>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav
            aria-label="Navigasi Utama"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400"
          >
            <button
              type="button"
              onClick={() => {
                setShowExtractor(false);
                setViewMode('grid');
              }}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {MOCKUP_OPTIONS.length} Opsi Mockup
            </button>
            <button
              type="button"
              onClick={() => setShowExtractor((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                showExtractor ? 'text-rose-400' : 'hover:text-white'
              }`}
            >
              <FileCode2 className="w-4 h-4" aria-hidden="true" />
              Ekstrak HTML
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('effect')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Efek Pinggir
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('size')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Variasi Ukuran
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('text')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Kustom Teks
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleQuickExportActive}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              Ekspor Opsi {selectedMeta.index} ({exportFormat.toUpperCase()})
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Workspace */}
      <main id="top" className="flex-1 max-w-[1440px] w-full mx-auto px-5 py-6 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Studio Mockup Scene Game
            </h1>
            <p className="text-sm text-slate-400">
              Tangkap latar belakang dari file HTML game Anda, terapkan efek pinggir estetik, atur ukuran kustom, dan unduh dari {MOCKUP_OPTIONS.length} opsi komposisi mockup dalam format PNG atau JPG.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowExtractor((prev) => !prev)}
            aria-expanded={showExtractor}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-100 bg-[#161A23] hover:bg-[#1E2430] border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <FileCode2 className="w-4 h-4 text-rose-400" aria-hidden="true" />
            {showExtractor ? 'Sembunyikan Ekstraktor HTML' : 'Unggah & Ekstrak Scene HTML'}
          </button>
        </div>

        {showExtractor && (
          <HtmlSceneExtractor
            onSceneCaptured={handleSceneCaptured}
            onClose={() => setShowExtractor(false)}
          />
        )}

        <div className="flex flex-col lg:flex-row items-start gap-6">
          <ControlSidebar
            activeTab={sidebarTab}
            onTabChange={setSidebarTab}
            selectedOption={selectedOption}
            scenes={scenes}
            activeSceneId={activeSceneId}
            onSelectScene={setActiveSceneId}
            onDeleteScene={handleDeleteScene}
            onRestoreDefaultScenes={handleRestoreDefaultScenes}
            onOpenHtmlExtractor={() => setShowExtractor(true)}
            onUploadImageFallback={handleUploadImageFallback}
            width={width}
            height={height}
            cornerRadiusRatio={cornerRadiusRatio}
            onChangeSize={(w, h, nextRadius) => {
              setWidth(w);
              setHeight(h);
              if (typeof nextRadius === 'number') {
                setCornerRadiusRatio(nextRadius);
              }
            }}
            config={config}
            onChangeConfig={handleChangeConfig}
          />

          <MockupGalleryStage
            selectedOption={selectedOption}
            onSelectOption={setSelectedOption}
            viewMode={viewMode}
            onChangeViewMode={setViewMode}
            width={width}
            height={height}
            cornerRadiusRatio={cornerRadiusRatio}
            config={config}
            bgImage={bgImage}
            activeSceneName={activeScene?.name ?? ''}
            exportFormat={exportFormat}
            onChangeExportFormat={setExportFormat}
          />
        </div>
      </main>
    </div>
  );
}
