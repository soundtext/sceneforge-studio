import { useCallback, useMemo, useState } from 'react';
import { Download, Eye, Grid2X2 } from 'lucide-react';
import {
  EDGE_EFFECT_PRESETS,
  ExportFormat,
  MOCKUP_OPTIONS,
  MockupGroup,
  MockupOptionId,
  MockupTextConfig,
} from '../utils/mockupPresets';
import { exportCanvasAsImage, renderMockupToCanvas } from '../utils/mockupRenderer';
import { MockupCanvas } from './MockupCanvas';

export type StageViewMode = 'grid' | 'focus';
export type MockupGroupFilter = 'all' | MockupGroup;

interface MockupGalleryStageProps {
  selectedOption: MockupOptionId;
  onSelectOption: (id: MockupOptionId) => void;
  viewMode: StageViewMode;
  onChangeViewMode: (mode: StageViewMode) => void;
  width: number;
  height: number;
  cornerRadiusRatio: number;
  config: MockupTextConfig;
  bgImage: HTMLImageElement | null;
  activeSceneName: string;
  exportFormat: ExportFormat;
  onChangeExportFormat: (format: ExportFormat) => void;
}

export function MockupGalleryStage({
  selectedOption,
  onSelectOption,
  viewMode,
  onChangeViewMode,
  width,
  height,
  cornerRadiusRatio,
  config,
  bgImage,
  activeSceneName,
  exportFormat,
  onChangeExportFormat,
}: MockupGalleryStageProps) {
  const [groupFilter, setGroupFilter] = useState<MockupGroupFilter>('all');

  const visibleOptions = useMemo(() => {
    if (groupFilter === 'all') return MOCKUP_OPTIONS;
    return MOCKUP_OPTIONS.filter((o) => o.group === groupFilter);
  }, [groupFilter]);

  const slugifyTitle = (config.title || 'mockup')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const classicCount = useMemo(
    () => MOCKUP_OPTIONS.filter((o) => o.group === 'classic').length,
    []
  );
  const referenceCount = useMemo(
    () => MOCKUP_OPTIONS.filter((o) => o.group === 'reference').length,
    []
  );

  const exportFullRes = useCallback(
    (optionId: MockupOptionId, fileName: string) => {
      const offscreen = document.createElement('canvas');
      renderMockupToCanvas(
        offscreen,
        optionId,
        width,
        height,
        config,
        bgImage,
        cornerRadiusRatio
      );
      exportCanvasAsImage(offscreen, fileName, exportFormat);
    },
    [width, height, cornerRadiusRatio, config, bgImage, exportFormat]
  );

  const handleExportSingle = (optionId: MockupOptionId) => {
    exportFullRes(
      optionId,
      `${slugifyTitle}-${optionId}-${width}x${height}.${exportFormat}`
    );
  };

  const handleExportVisible = () => {
    visibleOptions.forEach((opt, idx) => {
      setTimeout(() => {
        exportFullRes(
          opt.id,
          `${slugifyTitle}-opsi-${opt.index}-${opt.id}-${width}x${height}.${exportFormat}`
        );
      }, idx * 140);
    });
  };

  const selectedMeta =
    MOCKUP_OPTIONS.find((o) => o.id === selectedOption) ?? MOCKUP_OPTIONS[0];
  const activeEffectMeta = EDGE_EFFECT_PRESETS.find((e) => e.id === config.edgeEffect);
  const formatUpper = exportFormat.toUpperCase();

  return (
    <div className="flex-1 min-w-0 space-y-5">
      {/* Stage Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#12151C] border border-slate-800 rounded-xl px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-medium text-slate-200">
              {visibleOptions.length} Opsi Mockup
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular text-slate-300">
              {width} × {height} px
            </span>
            {cornerRadiusRatio > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-300">Kartu Rounded</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="truncate max-w-[160px] text-slate-300">
              {activeSceneName || 'Latar Bawaan'}
            </span>
            {config.edgeEffect !== 'none' && activeEffectMeta && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate max-w-[160px] text-rose-300">
                  {activeEffectMeta.label}
                </span>
              </>
            )}
          </div>

          {viewMode === 'grid' && (
            <div
              role="group"
              aria-label="Filter Variasi Mockup"
              className="flex items-center gap-1 p-1 bg-[#0B0D11] border border-slate-800 rounded-lg"
            >
              {(
                [
                  ['all', `Semua (${MOCKUP_OPTIONS.length})`],
                  ['classic', `Klasik (01–0${classicCount})`],
                  ['reference', `Referensi (0${classicCount + 1}–0${classicCount + referenceCount})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setGroupFilter(key)}
                  aria-pressed={groupFilter === key}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    groupFilter === key
                      ? 'bg-[#191E28] text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 bg-[#0B0D11] border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => onChangeViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'grid'
                  ? 'bg-[#191E28] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid2X2 className="w-3.5 h-3.5" aria-hidden="true" />
              Galeri Opsi
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode('focus')}
              aria-pressed={viewMode === 'focus'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'focus'
                  ? 'bg-[#191E28] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              Fokus Opsi {selectedMeta.index}
            </button>
          </div>

          <div
            role="group"
            aria-label="Format Unduhan"
            className="flex items-center gap-1 p-1 bg-[#0B0D11] border border-slate-800 rounded-lg"
          >
            {(['png', 'jpg'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => onChangeExportFormat(fmt)}
                aria-pressed={exportFormat === fmt}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 uppercase ${
                  exportFormat === fmt
                    ? 'bg-[#191E28] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportVisible}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Unduh {visibleOptions.length} Opsi ({formatUpper})
          </button>
        </div>
      </div>

      {/* Focus View */}
      {viewMode === 'focus' && (
        <div className="space-y-4">
          <div className="bg-[#12151C] border border-slate-800 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-white">
                  {selectedMeta.index}. {selectedMeta.name}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedMeta.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleExportSingle(selectedMeta.id)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                Unduh Opsi {selectedMeta.index} ({formatUpper})
              </button>
            </div>

            <div className="w-full bg-[#07090D] rounded-lg border border-slate-800/80 p-4 flex items-center justify-center overflow-hidden">
              <MockupCanvas
                optionId={selectedMeta.id}
                width={width}
                height={height}
                cornerRadiusRatio={cornerRadiusRatio}
                config={config}
                bgImage={bgImage}
                previewMaxEdge={1200}
                testId={`focus-canvas-${selectedMeta.id}`}
                className={`max-w-full max-h-[620px] w-auto h-auto shadow-2xl ${
                  cornerRadiusRatio > 0 ? '' : 'rounded'
                }`}
              />
            </div>
          </div>

          {/* Quick strip for switching among all options */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {MOCKUP_OPTIONS.map((opt) => {
              const isActive = opt.id === selectedOption;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelectOption(opt.id)}
                  aria-pressed={isActive}
                  className={`p-2.5 rounded-xl border text-left transition-colors ${
                    isActive
                      ? 'border-rose-500 bg-rose-500/10'
                      : 'border-slate-800 bg-[#12151C] hover:border-slate-600'
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-100 truncate">
                    {opt.index}. {opt.name}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {opt.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid View: All visible Mockup Options rendered live */}
      {viewMode === 'grid' && (
        <div
          data-testid="mockup-options-grid"
          className="grid grid-cols-1 xl:grid-cols-2 gap-5"
        >
          {visibleOptions.map((opt, idx) => {
            const isSelected = opt.id === selectedOption;
            const spanClass =
              idx === 0 && visibleOptions.length % 2 === 1 ? 'xl:col-span-2' : '';
            return (
              <article
                key={opt.id}
                className={`${spanClass} bg-[#12151C] border rounded-xl overflow-hidden transition-colors ${
                  isSelected ? 'border-rose-500/80' : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => onSelectOption(opt.id)}
                    className="text-left min-w-0 flex-1 group"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-100 group-hover:text-white">
                      <span>
                        {opt.index}. {opt.name}
                      </span>
                      {isSelected && (
                        <span className="text-xs font-medium text-rose-400">
                          · Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {opt.subtitle} · {opt.description}
                    </p>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectOption(opt.id);
                        onChangeViewMode('focus');
                      }}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Perbesar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportSingle(opt.id)}
                      aria-label={`Unduh ${opt.name}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      Unduh {formatUpper}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectOption(opt.id)}
                  aria-label={`Pilih ${opt.name}`}
                  className="w-full p-4 bg-[#080A0F] flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <MockupCanvas
                    optionId={opt.id}
                    width={width}
                    height={height}
                    cornerRadiusRatio={cornerRadiusRatio}
                    config={config}
                    bgImage={bgImage}
                    previewMaxEdge={spanClass ? 880 : 640}
                    testId={`mockup-canvas-${opt.id}`}
                    className={`max-w-full w-auto h-auto shadow-lg ${
                      cornerRadiusRatio > 0 ? '' : 'rounded'
                    } ${spanClass ? 'max-h-[400px]' : 'max-h-[290px]'}`}
                  />
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
