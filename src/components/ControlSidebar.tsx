import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import {
  Aperture,
  ArrowLeftRight,
  ImagePlus,
  Maximize2,
  RotateCcw,
  Sliders,
  Trash2,
  Type,
} from 'lucide-react';
import {
  EDGE_EFFECT_PRESETS,
  FONT_PRESETS,
  MOCKUP_OPTIONS,
  MockupOptionId,
  MockupTextConfig,
  SIZE_PRESETS,
  SceneAsset,
  getDefaultTitleYPercent,
  normalizeDimensions,
} from '../utils/mockupPresets';

export type SidebarTab = 'scene' | 'effect' | 'size' | 'text';

interface ControlSidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  selectedOption: MockupOptionId;
  scenes: SceneAsset[];
  activeSceneId: string;
  onSelectScene: (id: string) => void;
  onDeleteScene: (id: string) => void;
  onRestoreDefaultScenes: () => void;
  onOpenHtmlExtractor: () => void;
  onUploadImageFallback: (file: File) => void;
  width: number;
  height: number;
  cornerRadiusRatio: number;
  onChangeSize: (w: number, h: number, cornerRadiusRatio?: number) => void;
  config: MockupTextConfig;
  onChangeConfig: (patch: Partial<MockupTextConfig>) => void;
}

export function ControlSidebar({
  activeTab,
  onTabChange,
  selectedOption,
  scenes,
  activeSceneId,
  onSelectScene,
  onDeleteScene,
  onRestoreDefaultScenes,
  onOpenHtmlExtractor,
  onUploadImageFallback,
  width,
  height,
  cornerRadiusRatio,
  onChangeSize,
  config,
  onChangeConfig,
}: ControlSidebarProps) {
  const [draftWidth, setDraftWidth] = useState<string>(String(width));
  const [draftHeight, setDraftHeight] = useState<string>(String(height));

  useEffect(() => {
    setDraftWidth(String(width));
  }, [width]);

  useEffect(() => {
    setDraftHeight(String(height));
  }, [height]);

  const handleImageFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadImageFallback(file);
    e.target.value = '';
  };

  const commitCustomSize = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const parsedW = Number(draftWidth);
    const parsedH = Number(draftHeight);
    const next = normalizeDimensions(
      Number.isFinite(parsedW) && parsedW > 0 ? parsedW : width,
      Number.isFinite(parsedH) && parsedH > 0 ? parsedH : height
    );
    setDraftWidth(String(next.width));
    setDraftHeight(String(next.height));
    onChangeSize(next.width, next.height, cornerRadiusRatio);
  };

  const isPresetSizeSelected = SIZE_PRESETS.some(
    (preset) =>
      width === preset.width &&
      height === preset.height &&
      Math.abs(cornerRadiusRatio - (preset.cornerRadiusRatio ?? 0)) < 0.002
  );

  return (
    <aside
      aria-label="Panel Pengaturan Mockup"
      className="w-full lg:w-[340px] xl:w-[360px] shrink-0 bg-[#12151C] border border-slate-800 rounded-xl flex flex-col overflow-hidden"
    >
      {/* Segmented Control Tabs */}
      <div
        role="tablist"
        aria-label="Kategori Pengaturan"
        className="grid grid-cols-4 gap-1 p-1.5 bg-[#0B0D11] border-b border-slate-800"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'scene'}
          onClick={() => onTabChange('scene')}
          className={`flex items-center justify-center gap-1 px-2 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'scene'
              ? 'bg-[#191E28] text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Scene
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'effect'}
          onClick={() => onTabChange('effect')}
          className={`flex items-center justify-center gap-1 px-2 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'effect'
              ? 'bg-[#191E28] text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Aperture className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Efek
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'size'}
          onClick={() => onTabChange('size')}
          className={`flex items-center justify-center gap-1 px-2 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'size'
              ? 'bg-[#191E28] text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Maximize2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Ukuran
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'text'}
          onClick={() => onTabChange('text')}
          className={`flex items-center justify-center gap-1 px-2 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'text'
              ? 'bg-[#191E28] text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Type className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Teks
        </button>
      </div>

      {/* Panel Content */}
      <div className="p-5 space-y-6 overflow-y-auto max-h-[780px]">
        {activeTab === 'scene' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">
                  Latar Scene Game
                </h3>
                <span className="text-xs font-mono-tabular text-slate-400">
                  {scenes.length} tersimpan
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pilih hasil tangkapan scene HTML, unggah file baru, atau hapus gambar dari galeri.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onOpenHtmlExtractor}
                className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors"
              >
                Buka Ekstraktor File HTML
              </button>

              <label className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-[#171B24] hover:bg-[#1E2430] border border-slate-700/80 rounded-lg cursor-pointer transition-colors">
                <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                Unggah Foto Manual (PNG/JPG)
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFile}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-300">
                  Galeri Latar Tersedia
                </p>
                {scenes.length < 5 && (
                  <button
                    type="button"
                    onClick={onRestoreDefaultScenes}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    Pulihkan Bawaan
                  </button>
                )}
              </div>

              {scenes.length === 0 ? (
                <div
                  data-testid="empty-scene-gallery"
                  className="p-4 rounded-lg border border-dashed border-slate-700 bg-[#0D1016] text-center space-y-2.5"
                >
                  <p className="text-xs text-slate-400">
                    Galeri kosong. Semua gambar latar telah dihapus.
                  </p>
                  <button
                    type="button"
                    onClick={onRestoreDefaultScenes}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    Pulihkan Gambar Bawaan
                  </button>
                </div>
              ) : (
                <div data-testid="scene-gallery-grid" className="grid grid-cols-2 gap-2.5">
                  {scenes.map((scene) => {
                    const isActive = scene.id === activeSceneId;
                    return (
                      <div
                        key={scene.id}
                        className={`relative group rounded-lg overflow-hidden border transition-colors ${
                          isActive
                            ? 'border-rose-500 bg-rose-500/10'
                            : 'border-slate-800 bg-[#0D1016] hover:border-slate-600'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectScene(scene.id)}
                          aria-pressed={isActive}
                          aria-label={`Pilih latar ${scene.name}`}
                          className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                          <div className="aspect-video w-full bg-slate-900 overflow-hidden">
                            <img
                              src={scene.dataUrl}
                              alt={scene.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-2 pr-7">
                            <p className="text-xs font-medium text-slate-200 truncate">
                              {scene.name}
                            </p>
                            <p className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">
                              {scene.width} × {scene.height}
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteScene(scene.id)}
                          aria-label={`Hapus gambar ${scene.name}`}
                          title={`Hapus ${scene.name}`}
                          className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-black/75 hover:bg-rose-600 text-slate-200 hover:text-white border border-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <p className="text-xs font-medium text-slate-300">
                Titik Fokus Crop Latar
              </p>
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <label htmlFor="focus-x-range">Posisi Horizontal (X)</label>
                  <span className="font-mono-tabular text-slate-200">{config.focusX}%</span>
                </div>
                <input
                  id="focus-x-range"
                  type="range"
                  min={0}
                  max={100}
                  value={config.focusX}
                  onChange={(e) => onChangeConfig({ focusX: Number(e.target.value) })}
                  className="w-full accent-rose-600"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <label htmlFor="focus-y-range">Posisi Vertikal (Y)</label>
                  <span className="font-mono-tabular text-slate-200">{config.focusY}%</span>
                </div>
                <input
                  id="focus-y-range"
                  type="range"
                  min={0}
                  max={100}
                  value={config.focusY}
                  onChange={(e) => onChangeConfig({ focusY: Number(e.target.value) })}
                  className="w-full accent-rose-600"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'effect' && (
          <div className="space-y-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-100">
                Efek Estetik Pinggir Game
              </h3>
              <p className="text-xs text-slate-400">
                Pilih template efek optik atau color grading di area pinggir layar agar scene game tampil lebih sinematik.
              </p>
            </div>

            <div className="space-y-2">
              {EDGE_EFFECT_PRESETS.map((preset) => {
                const isSelected = config.edgeEffect === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onChangeConfig({ edgeEffect: preset.id })}
                    aria-pressed={isSelected}
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-left transition-colors ${
                      isSelected
                        ? 'border-rose-500 bg-rose-500/10 text-white'
                        : 'border-slate-800 bg-[#0D1016] text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">{preset.label}</span>
                      {isSelected && (
                        <span className="text-[11px] font-medium text-rose-400 shrink-0">
                          Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {config.edgeEffect !== 'none' && (
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <label htmlFor="edge-effect-intensity">Intensitas Efek</label>
                  <span className="font-mono-tabular text-slate-200">
                    {Math.round(config.edgeEffectIntensity * 100)}%
                  </span>
                </div>
                <input
                  id="edge-effect-intensity"
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.05}
                  value={config.edgeEffectIntensity}
                  onChange={(e) =>
                    onChangeConfig({ edgeEffectIntensity: Number(e.target.value) })
                  }
                  className="w-full accent-rose-600"
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'size' && (
          <div className="space-y-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-100">
                Variasi & Ukuran Kustom
              </h3>
              <p className="text-xs text-slate-400">
                Seluruh {MOCKUP_OPTIONS.length} opsi mockup menyesuaikan rasio dan skala huruf secara otomatis.
              </p>
            </div>

            <div className="space-y-2">
              {SIZE_PRESETS.map((preset) => {
                const presetRadius = preset.cornerRadiusRatio ?? 0;
                const isSelected =
                  width === preset.width &&
                  height === preset.height &&
                  Math.abs(cornerRadiusRatio - presetRadius) < 0.002;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      onChangeSize(preset.width, preset.height, presetRadius)
                    }
                    aria-pressed={isSelected}
                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border text-left transition-colors ${
                      isSelected
                        ? 'border-rose-500 bg-rose-500/10 text-white'
                        : 'border-slate-800 bg-[#0D1016] text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap">
                        <span className="truncate">{preset.label}</span>
                        <span className="text-slate-400 font-normal shrink-0">·</span>
                        <span className="font-mono-tabular text-slate-300 shrink-0">
                          {preset.ratioLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {preset.usage}
                      </p>
                    </div>
                    <span className="text-xs font-mono-tabular text-slate-300 shrink-0">
                      {preset.width} × {preset.height}
                    </span>
                  </button>
                );
              })}
            </div>

            <form
              onSubmit={commitCustomSize}
              className="pt-3 border-t border-slate-800/80 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-slate-200">
                    Ukuran Kustom (px)
                  </span>
                  <span className="ml-2 text-[11px] font-mono-tabular text-slate-400">
                    {!isPresetSizeSelected ? 'Aktif' : '120–4096 px'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onChangeSize(height, width, cornerRadiusRatio)}
                  className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white px-2 py-1 rounded border border-slate-700 hover:border-slate-500 transition-colors whitespace-nowrap"
                >
                  <ArrowLeftRight className="w-3 h-3" aria-hidden="true" />
                  Tukar W/H
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="custom-width-input" className="block text-[11px] text-slate-400 mb-1">
                    Lebar (px)
                  </label>
                  <input
                    id="custom-width-input"
                    type="number"
                    min={120}
                    max={4096}
                    value={draftWidth}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraftWidth(val);
                      const num = Number(val);
                      if (Number.isFinite(num) && num >= 120 && num <= 4096) {
                        onChangeSize(Math.round(num), height, cornerRadiusRatio);
                      }
                    }}
                    onBlur={() => commitCustomSize()}
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-[#0B0D11] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label htmlFor="custom-height-input" className="block text-[11px] text-slate-400 mb-1">
                    Tinggi (px)
                  </label>
                  <input
                    id="custom-height-input"
                    type="number"
                    min={120}
                    max={4096}
                    value={draftHeight}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraftHeight(val);
                      const num = Number(val);
                      if (Number.isFinite(num) && num >= 120 && num <= 4096) {
                        onChangeSize(width, Math.round(num), cornerRadiusRatio);
                      }
                    }}
                    onBlur={() => commitCustomSize()}
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-[#0B0D11] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full px-3.5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
              >
                Terapkan Ukuran Kustom
              </button>

              <div className="pt-1">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <label htmlFor="corner-radius-range">Sudut Membulat (Rounded)</label>
                  <span className="font-mono-tabular text-slate-200">
                    {Math.round(Math.min(width, height) * cornerRadiusRatio)} px
                  </span>
                </div>
                <input
                  id="corner-radius-range"
                  type="range"
                  min={0}
                  max={0.12}
                  step={0.001}
                  value={cornerRadiusRatio}
                  onChange={(e) =>
                    onChangeSize(width, height, Number(e.target.value))
                  }
                  className="w-full accent-rose-600"
                />
              </div>
            </form>
          </div>
        )}

        {activeTab === 'text' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-100">
                Kustomisasi Teks & Gaya
              </h3>
              <p className="text-xs text-slate-400">
                Setiap perubahan langsung diperbarui di seluruh {MOCKUP_OPTIONS.length} opsi mockup.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="mockup-title-input" className="block text-xs text-slate-300 mb-1">
                  Judul Utama
                </label>
                <input
                  id="mockup-title-input"
                  type="text"
                  value={config.title}
                  onChange={(e) => onChangeConfig({ title: e.target.value })}
                  placeholder="Contoh: SCARLET VEIL"
                  className="w-full px-3 py-2 text-xs bg-[#0B0D11] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label htmlFor="mockup-subtitle-input" className="block text-xs text-slate-300 mb-1">
                  Subjudul / Tagline
                </label>
                <input
                  id="mockup-subtitle-input"
                  type="text"
                  value={config.subtitle}
                  onChange={(e) => onChangeConfig({ subtitle: e.target.value })}
                  placeholder="Contoh: BABAK BARU DI HUTAN KABUT"
                  className="w-full px-3 py-2 text-xs bg-[#0B0D11] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="mockup-badge-input" className="block text-xs text-slate-300 mb-1">
                    Label Atas
                  </label>
                  <input
                    id="mockup-badge-input"
                    type="text"
                    value={config.badge}
                    onChange={(e) => onChangeConfig({ badge: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-[#0B0D11] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label htmlFor="mockup-cta-input" className="block text-xs text-slate-300 mb-1">
                    Teks Tombol CTA
                  </label>
                  <input
                    id="mockup-cta-input"
                    type="text"
                    value={config.ctaText}
                    onChange={(e) => onChangeConfig({ ctaText: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-[#0B0D11] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="mockup-footer-input" className="block text-xs text-slate-300 mb-1">
                  Info Studio / Footer
                </label>
                <input
                  id="mockup-footer-input"
                  type="text"
                  value={config.footerMeta}
                  onChange={(e) => onChangeConfig({ footerMeta: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-[#0B0D11] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 space-y-3">
              <div>
                <label htmlFor="mockup-font-select" className="block text-xs text-slate-300 mb-1">
                  Jenis Huruf (Font)
                </label>
                <select
                  id="mockup-font-select"
                  value={config.fontId}
                  onChange={(e) => onChangeConfig({ fontId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-[#0B0D11] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-rose-500"
                >
                  {FONT_PRESETS.map((font) => (
                    <option key={font.id} value={font.id}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="text-color-input" className="block text-xs text-slate-300 mb-1">
                    Warna Teks
                  </label>
                  <div className="flex items-center gap-2 bg-[#0B0D11] border border-slate-700 rounded-lg px-2.5 py-1.5">
                    <input
                      id="text-color-input"
                      type="color"
                      value={config.textColor}
                      onChange={(e) => onChangeConfig({ textColor: e.target.value })}
                      className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span className="text-xs font-mono-tabular text-slate-300 uppercase">
                      {config.textColor}
                    </span>
                  </div>
                </div>
                <div>
                  <label htmlFor="accent-color-input" className="block text-xs text-slate-300 mb-1">
                    Warna Aksen
                  </label>
                  <div className="flex items-center gap-2 bg-[#0B0D11] border border-slate-700 rounded-lg px-2.5 py-1.5">
                    <input
                      id="accent-color-input"
                      type="color"
                      value={config.accentColor}
                      onChange={(e) => onChangeConfig({ accentColor: e.target.value })}
                      className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span className="text-xs font-mono-tabular text-slate-300 uppercase">
                      {config.accentColor}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <span className="block text-xs text-slate-300 mb-1.5">Perataan Teks</span>
                <div className="grid grid-cols-4 gap-1 p-1 bg-[#0B0D11] border border-slate-800 rounded-lg">
                  {(
                    [
                      ['auto', 'Otomatis'],
                      ['left', 'Kiri'],
                      ['center', 'Tengah'],
                      ['right', 'Kanan'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onChangeConfig({ align: val })}
                      className={`py-1.5 text-[11px] font-medium rounded-md transition-colors ${
                        config.align === val
                          ? 'bg-[#191E28] text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <label htmlFor="title-scale-range">Ukuran Judul</label>
                  <span className="font-mono-tabular text-slate-200">
                    {Math.round(config.titleScale * 100)}%
                  </span>
                </div>
                <input
                  id="title-scale-range"
                  type="range"
                  min={0.65}
                  max={1.55}
                  step={0.05}
                  value={config.titleScale}
                  onChange={(e) => onChangeConfig({ titleScale: Number(e.target.value) })}
                  className="w-full accent-rose-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <label htmlFor="title-y-range">Posisi Vertikal Judul</label>
                  <div className="flex items-center gap-2">
                    {config.titleY !== null && (
                      <button
                        type="button"
                        onClick={() => onChangeConfig({ titleY: null })}
                        className="text-[11px] font-medium text-rose-400 hover:text-rose-300 transition-colors"
                      >
                        Otomatis
                      </button>
                    )}
                    <span className="font-mono-tabular text-slate-200">
                      {config.titleY === null
                        ? `Otomatis (${getDefaultTitleYPercent(selectedOption)}%)`
                        : `${config.titleY}%`}
                    </span>
                  </div>
                </div>
                <input
                  id="title-y-range"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={config.titleY ?? getDefaultTitleYPercent(selectedOption)}
                  onChange={(e) => onChangeConfig({ titleY: Number(e.target.value) })}
                  className="w-full accent-rose-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <label htmlFor="letter-spacing-range">Spasi Huruf</label>
                  <span className="font-mono-tabular text-slate-200">
                    {config.letterSpacing.toFixed(2)}em
                  </span>
                </div>
                <input
                  id="letter-spacing-range"
                  type="range"
                  min={0}
                  max={0.32}
                  step={0.02}
                  value={config.letterSpacing}
                  onChange={(e) => onChangeConfig({ letterSpacing: Number(e.target.value) })}
                  className="w-full accent-rose-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <label htmlFor="scrim-opacity-range">Gelap Overlay Latar</label>
                  <span className="font-mono-tabular text-slate-200">
                    {Math.round(config.scrimOpacity * 100)}%
                  </span>
                </div>
                <input
                  id="scrim-opacity-range"
                  type="range"
                  min={0.1}
                  max={0.95}
                  step={0.05}
                  value={config.scrimOpacity}
                  onChange={(e) => onChangeConfig({ scrimOpacity: Number(e.target.value) })}
                  className="w-full accent-rose-600"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label htmlFor="toggle-emblem" className="text-xs text-slate-300">
                  Tampilkan Emblem Logo
                </label>
                <input
                  id="toggle-emblem"
                  type="checkbox"
                  checked={config.showEmblem}
                  onChange={(e) => onChangeConfig({ showEmblem: e.target.checked })}
                  className="w-4 h-4 accent-rose-600 rounded"
                />
              </div>

              {config.showEmblem && (
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['diamond', 'Berlian'],
                      ['crest', 'Perisai'],
                      ['ring', 'Cincin'],
                    ] as const
                  ).map(([styleKey, label]) => (
                    <button
                      key={styleKey}
                      type="button"
                      onClick={() => onChangeConfig({ emblemStyle: styleKey })}
                      className={`py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        config.emblemStyle === styleKey
                          ? 'border-rose-500 bg-rose-500/15 text-white'
                          : 'border-slate-800 bg-[#0D1016] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
