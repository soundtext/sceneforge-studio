import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Download, FileCode2, Layers, Loader2, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { domToCanvas } from 'modern-screenshot';
import {
  ExtractedHtmlAsset,
  extractHtmlTitle,
  extractStaticAssetsFromHtml,
  injectCaptureBridge,
  validateHtmlFile,
} from '../utils/htmlSceneParser';
import {
  markTextBoxesInLiveDom,
  resolveIframeViewportBackground,
  stripTextAndTextBoxesFromClone,
  unmarkTextBoxesInLiveDom,
} from '../utils/domTextStripper';
import { SAMPLE_GAME_HTML } from '../utils/sampleGameHtml';
import { SceneAsset } from '../utils/mockupPresets';

interface HtmlSceneExtractorProps {
  onSceneCaptured: (scene: SceneAsset, setAsActive: boolean) => void;
  onClose?: () => void;
}

interface BridgeReadyStats {
  canvasCount: number;
  imgCount: number;
  svgCount: number;
  scenes: string[];
}

export function HtmlSceneExtractor({ onSceneCaptured, onClose }: HtmlSceneExtractorProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingUploadTokenRef = useRef<string | null>(null);
  const dispatchedTokenRef = useRef<string | null>(null);
  const startedCleanTokensRef = useRef<Set<string>>(new Set());
  const processedTokensRef = useRef<Set<string>>(new Set());
  const batchResolversRef = useRef<Map<string, () => void>>(new Map());
  const safetyTimerRef = useRef<number | null>(null);

  const [fileName, setFileName] = useState<string>('demo-scarlet-scenes.html');
  const [rawHtml, setRawHtml] = useState<string>(SAMPLE_GAME_HTML);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isCapturingAll, setIsCapturingAll] = useState<boolean>(false);
  const [isAutoCapturing, setIsAutoCapturing] = useState<boolean>(false);
  const [autoCaptureOnUpload, setAutoCaptureOnUpload] = useState<boolean>(true);
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [bridgeStats, setBridgeStats] = useState<BridgeReadyStats>({
    canvasCount: 0,
    imgCount: 0,
    svgCount: 0,
    scenes: [],
  });

  const htmlTitle = useMemo(() => extractHtmlTitle(rawHtml), [rawHtml]);
  const injectedHtml = useMemo(() => injectCaptureBridge(rawHtml), [rawHtml]);
  const staticAssets = useMemo<ExtractedHtmlAsset[]>(
    () => extractStaticAssetsFromHtml(rawHtml),
    [rawHtml]
  );

  const clearSafetyTimer = useCallback(() => {
    if (safetyTimerRef.current !== null) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const resolveBatchWaiter = useCallback((reqId: string | null) => {
    if (!reqId) return;
    const resolver = batchResolversRef.current.get(reqId);
    if (resolver) {
      batchResolversRef.current.delete(reqId);
      resolver();
    }
  }, []);

  const finalizeCapturedScene = useCallback(
    (
      reqId: string | null,
      dataUrl: string,
      width: number,
      height: number,
      sourceKind: string,
      isAuto: boolean
    ) => {
      if (reqId) {
        if (processedTokensRef.current.has(reqId)) return;
        processedTokensRef.current.add(reqId);
        if (pendingUploadTokenRef.current === reqId) {
          pendingUploadTokenRef.current = null;
          clearSafetyTimer();
          setIsAutoCapturing(false);
        }
      }

      const id = `html-cap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newScene: SceneAsset = {
        id,
        name: `${htmlTitle} (${sourceKind || 'scene'})`,
        source: 'html-capture',
        dataUrl,
        width: Math.max(1, Math.round(width || 1280)),
        height: Math.max(1, Math.round(height || 720)),
        createdAt: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
      onSceneCaptured(newScene, true);
      setErrorMsg(null);
      setStatusMsg(
        isAuto
          ? `Scene pertama dari "${fileName}" otomatis ditangkap tanpa kotak teks (${newScene.width} × ${newScene.height}px) dan diterapkan.`
          : `Scene berhasil ditangkap tanpa kotak teks (${newScene.width} × ${newScene.height}px) dan diterapkan.`
      );
      resolveBatchWaiter(reqId);
    },
    [clearSafetyTimer, fileName, htmlTitle, onSceneCaptured, resolveBatchWaiter]
  );

  const captureCleanIframeViewport = useCallback(
    async (reqId: string | null, isAuto: boolean) => {
      const iframe = iframeRef.current;
      const iframeDoc = iframe?.contentDocument;
      const iframeWin = iframe?.contentWindow;

      if (!iframe || !iframeDoc || !iframeDoc.body || !iframeWin) {
        iframeWin?.postMessage({ type: 'SCENEFORGE_CAPTURE', requestId: reqId, auto: isAuto }, '*');
        return;
      }

      const viewportWidth = Math.max(
        1,
        Math.round(iframeDoc.documentElement?.clientWidth || iframe.clientWidth || 1280)
      );
      const viewportHeight = Math.max(
        1,
        Math.round(iframeDoc.documentElement?.clientHeight || iframe.clientHeight || 720)
      );
      const captureScale = Math.min(2.5, Math.max(1.5, 1280 / Math.max(320, viewportWidth)));

      let markedEls: Element[] = [];
      try {
        markedEls = markTextBoxesInLiveDom(iframeDoc.body, viewportWidth, viewportHeight);
        const resolvedBg = resolveIframeViewportBackground(iframeDoc);

        const capturedCanvas = await domToCanvas(iframeDoc.body, {
          width: viewportWidth,
          height: viewportHeight,
          scale: captureScale,
          font: false,
          backgroundColor: resolvedBg.backgroundColor,
          style: {
            margin: '0',
            width: `${viewportWidth}px`,
            height: `${viewportHeight}px`,
            overflow: 'hidden',
            ...(resolvedBg.backgroundImage
              ? {
                  backgroundImage: resolvedBg.backgroundImage,
                  backgroundSize: resolvedBg.backgroundSize || 'cover',
                  backgroundPosition: resolvedBg.backgroundPosition || 'center',
                  backgroundRepeat: resolvedBg.backgroundRepeat || 'no-repeat',
                }
              : {}),
          },
          onCloneNode: (cloned) => {
            stripTextAndTextBoxesFromClone(cloned);
          },
        });

        const dataUrl = capturedCanvas.toDataURL('image/png');
        finalizeCapturedScene(
          reqId,
          dataUrl,
          capturedCanvas.width,
          capturedCanvas.height,
          'scene-bersih',
          isAuto
        );
      } catch {
        // Fallback to direct canvas/img/svg capture if DOM serialization is blocked
        iframeWin.postMessage({ type: 'SCENEFORGE_CAPTURE', requestId: reqId, auto: isAuto }, '*');
      } finally {
        unmarkTextBoxesInLiveDom(markedEls);
        iframeWin.postMessage({ type: 'SCENEFORGE_RESTORE_FRAME' }, '*');
      }
    },
    [finalizeCapturedScene]
  );

  const dispatchPendingAutoCapture = useCallback(() => {
    const token = pendingUploadTokenRef.current;
    if (!token || dispatchedTokenRef.current === token) return;
    const targetWin = iframeRef.current?.contentWindow;
    if (!targetWin) return;

    dispatchedTokenRef.current = token;
    targetWin.postMessage(
      { type: 'SCENEFORGE_WAIT_AND_CAPTURE', requestId: token, timeoutMs: 3500 },
      '*'
    );

    clearSafetyTimer();
    safetyTimerRef.current = window.setTimeout(() => {
      if (pendingUploadTokenRef.current === token) {
        pendingUploadTokenRef.current = null;
        setIsAutoCapturing(false);
        setErrorMsg(
          'Waktu tunggu tangkap otomatis habis sebelum game merespons. Anda bisa mengklik Play di pratinjau lalu menekan "Ambil Scene Saat Ini".'
        );
      }
    }, 6000);
  }, [clearSafetyTimer]);

  useEffect(() => {
    const waiters = batchResolversRef.current;
    return () => {
      clearSafetyTimer();
      waiters.clear();
    };
  }, [clearSafetyTimer]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'SCENEFORGE_READY') {
        setBridgeStats({
          canvasCount: Number(data.canvasCount) || 0,
          imgCount: Number(data.imgCount) || 0,
          svgCount: Number(data.svgCount) || 0,
          scenes: Array.isArray(data.scenes) ? data.scenes : [],
        });
        dispatchPendingAutoCapture();
      }

      if (data.type === 'SCENEFORGE_CLEAN_FRAME_READY') {
        const reqId = typeof data.requestId === 'string' ? data.requestId : null;
        if (reqId) {
          if (startedCleanTokensRef.current.has(reqId)) return;
          startedCleanTokensRef.current.add(reqId);
        }
        void captureCleanIframeViewport(reqId, Boolean(data.auto));
        return;
      }

      if (data.type === 'SCENEFORGE_CAPTURED') {
        const reqId = typeof data.requestId === 'string' ? data.requestId : null;
        if (data.ok && typeof data.dataUrl === 'string') {
          finalizeCapturedScene(
            reqId,
            data.dataUrl,
            Number(data.width) || 1280,
            Number(data.height) || 720,
            typeof data.sourceKind === 'string' ? data.sourceKind : 'scene',
            Boolean(data.auto)
          );
        } else {
          if (reqId) {
            if (processedTokensRef.current.has(reqId)) return;
            processedTokensRef.current.add(reqId);
            if (pendingUploadTokenRef.current === reqId) {
              pendingUploadTokenRef.current = null;
              clearSafetyTimer();
              setIsAutoCapturing(false);
            }
          }
          setErrorMsg(
            data.error || 'Tidak dapat menangkap scene dari file HTML ini.'
          );
          resolveBatchWaiter(reqId);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [
    captureCleanIframeViewport,
    clearSafetyTimer,
    dispatchPendingAutoCapture,
    finalizeCapturedScene,
    resolveBatchWaiter,
  ]);

  const loadHtmlFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const validation = validateHtmlFile(file.name, file.size, content);
      if (!validation.valid) {
        setErrorMsg(validation.error || 'File HTML tidak valid.');
        setStatusMsg(null);
        return;
      }

      clearSafetyTimer();
      dispatchedTokenRef.current = null;
      setErrorMsg(null);

      if (autoCaptureOnUpload) {
        const token = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        pendingUploadTokenRef.current = token;
        setIsAutoCapturing(true);
        setStatusMsg(`File "${file.name}" dimuat. Menunggu scene pertama siap ditangkap...`);
      } else {
        pendingUploadTokenRef.current = null;
        setIsAutoCapturing(false);
        setStatusMsg(`File "${file.name}" dimuat. Klik "Ambil Scene Saat Ini" untuk menangkap latar.`);
      }

      setFileName(file.name);
      setRawHtml(content);
      setIframeKey((k) => k + 1);
      setBridgeStats({ canvasCount: 0, imgCount: 0, svgCount: 0, scenes: [] });
    };
    reader.onerror = () => {
      setErrorMsg('Gagal membaca file HTML dari perangkat Anda.');
    };
    reader.readAsText(file);
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadHtmlFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadHtmlFile(file);
  };

  const requestCapture = () => {
    clearSafetyTimer();
    pendingUploadTokenRef.current = null;
    setIsAutoCapturing(false);
    setErrorMsg(null);
    const targetWin = iframeRef.current?.contentWindow;
    if (!targetWin) {
      setErrorMsg('Pratinjau HTML belum siap.');
      return;
    }
    const token = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    targetWin.postMessage(
      { type: 'SCENEFORGE_PREPARE_CLEAN_FRAME', requestId: token, auto: false },
      '*'
    );
  };

  const handleCaptureAllDetectedScenes = async () => {
    const targetWin = iframeRef.current?.contentWindow;
    if (!targetWin || bridgeStats.scenes.length === 0) return;

    setIsCapturingAll(true);
    setErrorMsg(null);
    for (let i = 0; i < bridgeStats.scenes.length; i++) {
      const sceneName = bridgeStats.scenes[i];
      targetWin.postMessage({ type: 'SCENEFORGE_SELECT_SCENE', sceneName }, '*');
      await new Promise((r) => setTimeout(r, 220));
      const token = `batch-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(() => {
          batchResolversRef.current.delete(token);
          resolve();
        }, 2500);
        batchResolversRef.current.set(token, () => {
          window.clearTimeout(timer);
          resolve();
        });
        targetWin.postMessage(
          { type: 'SCENEFORGE_PREPARE_CLEAN_FRAME', requestId: token, auto: false },
          '*'
        );
      });
    }
    setIsCapturingAll(false);
    setStatusMsg(`${bridgeStats.scenes.length} scene game berhasil ditangkap tanpa kotak teks ke galeri.`);
  };

  const handleLoadSampleHtml = () => {
    clearSafetyTimer();
    pendingUploadTokenRef.current = null;
    setIsAutoCapturing(false);
    setErrorMsg(null);
    setFileName('demo-scarlet-scenes.html');
    setRawHtml(SAMPLE_GAME_HTML);
    setIframeKey((k) => k + 1);
    setStatusMsg('Demo game HTML multi-scene dimuat.');
  };

  const handleDownloadSampleHtml = () => {
    const blob = new Blob([SAMPLE_GAME_HTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contoh-scene-game.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUseStaticAsset = (asset: ExtractedHtmlAsset) => {
    const img = new Image();
    img.onload = () => {
      onSceneCaptured(
        {
          id: `${asset.id}-${Date.now()}`,
          name: asset.name,
          source: 'html-embedded',
          dataUrl: asset.dataUrl,
          width: img.naturalWidth || 1280,
          height: img.naturalHeight || 720,
          createdAt: new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
        true
      );
      setStatusMsg(`"${asset.name}" diterapkan sebagai latar belakang mockup.`);
    };
    img.src = asset.dataUrl;
  };

  return (
    <section
      aria-label="Ekstraktor Scene Game HTML"
      className="bg-[#12151C] border border-slate-800 rounded-xl overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Ekstraktor Scene Game dari File HTML
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Unggah file .html game Anda, pilih atau mainkan scene, lalu tangkap frame sebagai foto latar belakang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadSampleHtml}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Unduh Contoh HTML
          </button>
          <button
            type="button"
            onClick={handleLoadSampleHtml}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <FileCode2 className="w-3.5 h-3.5" aria-hidden="true" />
            Muat Demo HTML
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Tutup Panel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
        {/* Left: Upload & Scene controls */}
        <div className="lg:col-span-4 p-5 space-y-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border border-dashed rounded-xl p-5 text-center transition-colors ${
              isDragging
                ? 'border-rose-500 bg-rose-500/10'
                : 'border-slate-700 bg-[#0E1117] hover:border-slate-600'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm,text/html"
              onChange={handleFileInput}
              className="sr-only"
              id="html-scene-upload"
            />
            <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2.5" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-200">
              Seret file HTML game ke sini
            </p>
            <p className="text-xs text-slate-400 mt-1 mb-3">
              Mendukung HTML5 Canvas, WebGL, SVG, dan gambar tertanam (.html / .htm)
            </p>
            <label
              htmlFor="html-scene-upload"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg cursor-pointer transition-colors"
            >
              Pilih File HTML
            </label>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>File aktif</span>
              <span className="font-mono-tabular text-slate-200 truncate max-w-[180px]" title={fileName}>
                {fileName}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Elemen terdeteksi</span>
              <span className="font-mono-tabular text-slate-200">
                {bridgeStats.canvasCount} Canvas · {bridgeStats.imgCount} Img · {bridgeStats.svgCount} SVG
              </span>
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
            <label className="flex items-center justify-between gap-3 py-1 cursor-pointer select-none">
              <span className="text-xs font-medium text-slate-300">
                Tangkap otomatis saat unggah HTML
              </span>
              <input
                type="checkbox"
                checked={autoCaptureOnUpload}
                onChange={(e) => setAutoCaptureOnUpload(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-[#0E1117] accent-rose-600 cursor-pointer shrink-0"
              />
            </label>

            <button
              type="button"
              onClick={requestCapture}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap"
            >
              {isAutoCapturing ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Camera className="w-4 h-4" aria-hidden="true" />
              )}
              {isAutoCapturing ? 'Menangkap Frame Pertama...' : 'Ambil Scene Saat Ini'}
            </button>

            {bridgeStats.scenes.length > 1 && (
              <button
                type="button"
                onClick={handleCaptureAllDetectedScenes}
                disabled={isCapturingAll}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                {isCapturingAll
                  ? 'Menangkap Semua Scene...'
                  : `Tangkap Otomatis ${bridgeStats.scenes.length} Scene`}
              </button>
            )}
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-950/60 border border-rose-800/70 text-xs text-rose-200"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {statusMsg && !errorMsg && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200"
            >
              {isAutoCapturing ? (
                <Loader2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <span>{statusMsg}</span>
            </div>
          )}

          {staticAssets.length > 0 && (
            <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
              <p className="text-xs font-medium text-slate-300">
                Aset Tertanam Ditemukan ({staticAssets.length})
              </p>
              <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                {staticAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => handleUseStaticAsset(asset)}
                    title={`Gunakan ${asset.name}`}
                    className="group relative aspect-video rounded-md overflow-hidden border border-slate-700 hover:border-rose-500 bg-slate-900 transition-colors"
                  >
                    <img
                      src={asset.dataUrl}
                      alt={asset.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Live interactive HTML scene viewport */}
        <div className="lg:col-span-8 p-5 flex flex-col gap-3 bg-[#090B10]">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-300 truncate">{htmlTitle}</span>
            <span>Klik tombol scene di dalam game, lalu tekan Ambil Scene Saat Ini</span>
          </div>
          <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-800 bg-black">
            <iframe
              key={iframeKey}
              ref={iframeRef}
              title={`Pratinjau Scene HTML: ${fileName}`}
              srcDoc={injectedHtml}
              sandbox="allow-scripts allow-same-origin"
              className="w-full h-full border-0"
              onLoad={() => {
                iframeRef.current?.contentWindow?.postMessage(
                  { type: 'SCENEFORGE_PING' },
                  '*'
                );
                dispatchPendingAutoCapture();
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
