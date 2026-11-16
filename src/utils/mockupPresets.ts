export type MockupOptionId =
  | 'key-art'
  | 'store-capsule'
  | 'minimal-vignette'
  | 'framed-showcase'
  | 'monumental-waypoint'
  | 'tactical-split-panel';

export type MockupGroup = 'classic' | 'reference';

export type EdgeEffectId =
  | 'none'
  | 'motion-blur'
  | 'chromatic-vignette'
  | 'rgb-separation'
  | 'prism-distortion'
  | 'directional-motion-blur'
  | 'directional-blur'
  | 'glitch-displacement';

export type ExportFormat = 'png' | 'jpg';

export interface EdgeEffectPreset {
  id: EdgeEffectId;
  label: string;
  description: string;
}

export interface MockupOptionMeta {
  id: MockupOptionId;
  index: string;
  group: MockupGroup;
  name: string;
  subtitle: string;
  description: string;
  defaultAlign: 'left' | 'center' | 'right';
}

export interface SizePreset {
  id: string;
  label: string;
  ratioLabel: string;
  width: number;
  height: number;
  cornerRadiusRatio?: number;
  usage: string;
}

export interface FontPreset {
  id: string;
  label: string;
  family: string;
  category: string;
}

export interface MockupTextConfig {
  title: string;
  subtitle: string;
  badge: string;
  ctaText: string;
  footerMeta: string;
  fontId: string;
  textColor: string;
  accentColor: string;
  titleScale: number; // 0.6 to 1.6
  letterSpacing: number; // 0 to 0.35 em
  scrimOpacity: number; // 0.1 to 0.95
  shadowStrength: number; // 0 to 1
  showEmblem: boolean;
  emblemStyle: 'diamond' | 'crest' | 'ring';
  align: 'auto' | 'left' | 'center' | 'right';
  titleY: number | null; // null = otomatis per template, 0..100 (%)
  focusX: number; // 0 to 100 (%)
  focusY: number; // 0 to 100 (%)
  edgeEffect: EdgeEffectId;
  edgeEffectIntensity: number; // 0.2 to 1.0
}

export interface SceneAsset {
  id: string;
  name: string;
  source: 'preset' | 'html-capture' | 'html-embedded' | 'upload';
  dataUrl: string;
  width: number;
  height: number;
  createdAt: string;
}

export const EDGE_EFFECT_PRESETS: EdgeEffectPreset[] = [
  {
    id: 'none',
    label: 'Original (Tanpa Efek)',
    description: 'Menampilkan latar scene game asli tanpa filter atau efek tambahan.',
  },
  {
    id: 'motion-blur',
    label: 'Motion Blur',
    description: 'Zoom blur radial halus dengan speed lines dan bloom, pusat tetap tajam seperti key art game aksi.',
  },
  {
    id: 'chromatic-vignette',
    label: 'Chromatic Aberration Vignette',
    description: 'Aberasi lensa radial realistis yang menguat ke tepi, kelembutan lensa, dan vignette sinematik.',
  },
  {
    id: 'rgb-separation',
    label: 'RGB Separation',
    description: 'Split kanal R/G/B gaya broadcast esports dengan band yang diperkuat dan scanline halus.',
  },
  {
    id: 'prism-distortion',
    label: 'Prism Distortion',
    description: 'Pecahan kaca prisma dengan refraksi, dispersi spektral, kilau tepi, dan light leak.',
  },
  {
    id: 'directional-motion-blur',
    label: 'Directional Motion Blur',
    description: 'Blur kecepatan horizontal ala game balap dengan streak yang mengambil warna dari scene.',
  },
  {
    id: 'directional-blur',
    label: 'Directional Blur',
    description: 'Depth-of-field diagonal (tilt-shift) dengan bokeh otomatis dari titik terang scene.',
  },
  {
    id: 'glitch-displacement',
    label: 'Glitch Displacement',
    description: 'Slice tergeser, macroblock korup, split RGB lokal, garis data, dan scanline di tepi.',
  },
];

export const MOCKUP_OPTIONS: MockupOptionMeta[] = [
  {
    id: 'key-art',
    index: '01',
    group: 'classic',
    name: 'Key Art Sinematik',
    subtitle: 'Judul & Emblem Bawah',
    description: 'Komposisi poster utama dengan emblem geometris sejajar judul serif dan scrim gelap di sisi bawah.',
    defaultAlign: 'center',
  },
  {
    id: 'store-capsule',
    index: '02',
    group: 'classic',
    name: 'Kapsul Toko & CTA',
    subtitle: 'Kartu Promo + Tombol Aksi',
    description: 'Format promosi etalase game lengkap dengan bingkai sudut tipis, subjudul, dan tombol ajakan bertindak.',
    defaultAlign: 'center',
  },
  {
    id: 'minimal-vignette',
    index: '03',
    group: 'classic',
    name: 'Vignette Minimalis',
    subtitle: 'Fokus Visual Karakter',
    description: 'Vignette radial lembut yang memberi ruang luas bagi ilustrasi scene game dengan teks ringkas di atas.',
    defaultAlign: 'center',
  },
  {
    id: 'framed-showcase',
    index: '04',
    group: 'classic',
    name: 'Showcase Berbingkai',
    subtitle: 'Garis Bingkai Arsitektural',
    description: 'Bingkai dalam presisi dengan tajuk bertumpuk, aksen warna terukur, dan tanda studio di sudut.',
    defaultAlign: 'left',
  },
  {
    id: 'monumental-waypoint',
    index: '05',
    group: 'reference',
    name: 'Header Monumental & Pin Peta',
    subtitle: 'Referensi · Judul Atas + Koordinat',
    description: 'Tipografi monumental di atas karakter dengan ringkasan misi dan penanda titik peta taktis di kiri bawah.',
    defaultAlign: 'center',
  },
  {
    id: 'tactical-split-panel',
    index: '06',
    group: 'reference',
    name: 'Judul Bertingkat',
    subtitle: 'Referensi · Tipografi Berundak',
    description: 'Judul display bertangga dengan huruf awal membesar, garis ornamen, dan tinta bertekstur di atas cahaya lembut — ala key art game indie.',
    defaultAlign: 'center',
  },
];

export const SIZE_PRESETS: SizePreset[] = [
  {
    id: '16-9',
    label: 'Banner Lanskap',
    ratioLabel: '16:9',
    width: 1920,
    height: 1080,
    usage: 'Header Game · YouTube · Hero',
  },
  {
    id: '1-1',
    label: 'Persegi Sosial',
    ratioLabel: '1:1',
    width: 1080,
    height: 1080,
    usage: 'Feed Sosial · Ikon · Sampul',
  },
  {
    id: '4-5',
    label: 'Potret Feed',
    ratioLabel: '4:5',
    width: 1080,
    height: 1350,
    usage: 'Poster Vertikal · Instagram',
  },
  {
    id: '9-16',
    label: 'Story Vertikal',
    ratioLabel: '9:16',
    width: 1080,
    height: 1920,
    usage: 'Reels · TikTok · Splash Layar',
  },
  {
    id: '21-9',
    label: 'Kapsul Lebar',
    ratioLabel: '21:9',
    width: 2560,
    height: 1080,
    cornerRadiusRatio: 0,
    usage: 'Banner Toko · Cover Lebar',
  },
  {
    id: 'credit-card',
    label: 'Kartu Kredit',
    ratioLabel: 'ID-1',
    width: 1712,
    height: 1080,
    cornerRadiusRatio: 3.18 / 53.98,
    usage: '85.6 × 53.98 mm · Sudut Rounded 3.18 mm',
  },
];

export const FONT_PRESETS: FontPreset[] = [
  {
    id: 'cinzel',
    label: 'Cinzel (Fantasi Epik)',
    family: '"Cinzel", Georgia, serif',
    category: 'Serif Klasik',
  },
  {
    id: 'cormorant',
    label: 'Cormorant (Editorial)',
    family: '"Cormorant Garamond", Georgia, serif',
    category: 'Serif Halus',
  },
  {
    id: 'oswald',
    label: 'Oswald (Aksi Tegas)',
    family: '"Oswald", sans-serif',
    category: 'Sans Condensed',
  },
  {
    id: 'jakarta',
    label: 'Jakarta Sans (Modern)',
    family: '"Plus Jakarta Sans", sans-serif',
    category: 'Sans Geometris',
  },
  {
    id: 'dm-sans',
    label: 'DM Sans (Bersih)',
    family: '"DM Sans", sans-serif',
    category: 'Sans Netral',
  },
];

export const DEFAULT_TEXT_CONFIG: MockupTextConfig = {
  title: 'SCARLET VEIL',
  subtitle: 'BABAK BARU DI HUTAN KABUT',
  badge: 'EDISI PERDANA',
  ctaText: 'MAINKAN SEKARANG',
  footerMeta: 'CHRONICLE STUDIO · AKSI PETUALANGAN · 2026',
  fontId: 'cinzel',
  textColor: '#F8FAFC',
  accentColor: '#E11D48',
  titleScale: 1.0,
  letterSpacing: 0.16,
  scrimOpacity: 0.72,
  shadowStrength: 0.85,
  showEmblem: false,
  emblemStyle: 'diamond',
  align: 'auto',
  titleY: null,
  focusX: 50,
  focusY: 35,
  edgeEffect: 'none',
  edgeEffectIntensity: 0.75,
};

export interface CoverCropRect {
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
}

/**
 * Computes source crop rectangle so an image covers destination dimensions cleanly
 * while respecting normalized focus coordinates (0..100).
 */
export function computeCoverCrop(
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
  focusXPercent = 50,
  focusYPercent = 50
): CoverCropRect {
  if (srcWidth <= 0 || srcHeight <= 0 || dstWidth <= 0 || dstHeight <= 0) {
    return { sx: 0, sy: 0, sWidth: Math.max(1, srcWidth), sHeight: Math.max(1, srcHeight) };
  }

  const srcAspect = srcWidth / srcHeight;
  const dstAspect = dstWidth / dstHeight;
  const clampedFocusX = Math.max(0, Math.min(100, focusXPercent)) / 100;
  const clampedFocusY = Math.max(0, Math.min(100, focusYPercent)) / 100;

  if (srcAspect > dstAspect) {
    const sHeight = srcHeight;
    const sWidth = srcHeight * dstAspect;
    const maxOffsetX = srcWidth - sWidth;
    return {
      sx: maxOffsetX * clampedFocusX,
      sy: 0,
      sWidth,
      sHeight,
    };
  }

  const sWidth = srcWidth;
  const sHeight = srcWidth / dstAspect;
  const maxOffsetY = srcHeight - sHeight;
  return {
    sx: 0,
    sy: maxOffsetY * clampedFocusY,
    sWidth,
    sHeight,
  };
}

/**
 * Clamps and rounds custom width/height dimensions into safe export boundaries.
 */
export function normalizeDimensions(
  width: number,
  height: number,
  min = 120,
  max = 4096
): { width: number; height: number } {
  const safeW = Number.isFinite(width) && width > 0 ? Math.round(width) : 1920;
  const safeH = Number.isFinite(height) && height > 0 ? Math.round(height) : 1080;
  return {
    width: Math.max(min, Math.min(max, safeW)),
    height: Math.max(min, Math.min(max, safeH)),
  };
}

/**
 * Computes proportional base typography sizing across wide, square, and tall canvases.
 */
export function computeTypographyScale(
  width: number,
  height: number,
  userScale = 1.0
): {
  titlePx: number;
  subtitlePx: number;
  metaPx: number;
  paddingPx: number;
  emblemPx: number;
} {
  const minEdge = Math.min(width, height);
  const ratio = width / Math.max(1, height);
  const clampedScale = Math.max(0.5, Math.min(2.0, userScale));

  const aspectFactor = ratio > 2 ? 0.85 : ratio < 0.7 ? 0.92 : 1.0;
  const titlePx = Math.round(minEdge * 0.088 * clampedScale * aspectFactor);
  const subtitlePx = Math.max(14, Math.round(titlePx * 0.27));
  const metaPx = Math.max(12, Math.round(minEdge * 0.019));
  const paddingPx = Math.max(28, Math.round(minEdge * 0.068));
  const emblemPx = Math.round(titlePx * 0.96);

  return { titlePx, subtitlePx, metaPx, paddingPx, emblemPx };
}

/**
 * Removes a scene from the gallery and resolves the next active scene ID cleanly.
 */
export function deleteSceneFromGallery(
  scenes: SceneAsset[],
  activeSceneId: string,
  deleteId: string
): { nextScenes: SceneAsset[]; nextActiveId: string } {
  const deleteIdx = scenes.findIndex((s) => s.id === deleteId);
  if (deleteIdx === -1) {
    return { nextScenes: scenes, nextActiveId: activeSceneId };
  }

  const nextScenes = scenes.filter((s) => s.id !== deleteId);
  if (nextScenes.length === 0) {
    return { nextScenes: [], nextActiveId: '' };
  }

  if (activeSceneId !== deleteId) {
    return { nextScenes, nextActiveId: activeSceneId };
  }

  const fallbackIdx = Math.min(deleteIdx, nextScenes.length - 1);
  return {
    nextScenes,
    nextActiveId: nextScenes[fallbackIdx].id,
  };
}

/**
 * Computes pixel corner radius from a ratio relative to the short edge (e.g. ISO ID-1 3.18/53.98).
 */
export function computeCornerRadiusPx(
  width: number,
  height: number,
  cornerRadiusRatio = 0
): number {
  if (!Number.isFinite(cornerRadiusRatio) || cornerRadiusRatio <= 0) return 0;
  const clampedRatio = Math.max(0, Math.min(0.5, cornerRadiusRatio));
  return Math.round(Math.min(width, height) * clampedRatio);
}

/**
 * Interpolates a vertical coordinate cleanly between [minY, maxY] from 0% (top) to 100% (bottom).
 */
export function computeVerticalPositionY(
  minY: number,
  maxY: number,
  percent: number
): number {
  if (maxY <= minY) return Math.round(minY);
  const clamped = Math.max(0, Math.min(100, percent)) / 100;
  return Math.round(minY + (maxY - minY) * clamped);
}

/**
 * Returns each mockup template's default vertical title percentage (0 = top, 100 = bottom).
 */
export function getDefaultTitleYPercent(optionId: MockupOptionId): number {
  if (optionId === 'monumental-waypoint') return 0;
  if (optionId === 'tactical-split-panel') return 8;
  return 100;
}
