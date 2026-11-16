import type { MockupTextConfig } from './mockupPresets';

/**
 * Efek pinggir sinematik untuk mockup scene game.
 *
 * Prinsip:
 * - Semua efek bekerja dari snapshot latar yang sudah tergambar di kanvas utama.
 * - Pusat frame selalu tetap tajam (dimask), efek hidup di tepi.
 * - Blur memakai rata-rata berjalan (alpha 1/(i+1)) dua lintasan agar mulus tanpa ghosting.
 * - Pemisahan kanal memakai tint murni (#ff0000/#00ff00/#0000ff) sehingga tidak over-bright.
 * - Setiap efek diakhiri "cinematic finish": bloom highlight, vignette elips, dan film grain.
 * - Acak deterministik (seeded) agar pratinjau dan hasil ekspor identik.
 */

type RGB = [number, number, number];

interface Buf {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

function parseHex(hex: string): RGB {
  const c = (hex || '').replace('#', '').trim();
  const full = c.length === 3 ? c.split('').map((ch) => ch + ch).join('') : c;
  const n = full.length === 6 ? parseInt(full, 16) : NaN;
  if (Number.isNaN(n)) return [225, 29, 72];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgba = (rgb: RGB, a: number) =>
  `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clamp(a, 0, 1).toFixed(3)})`;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createBuffer(w: number, h: number): Buf | null {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

function fitSize(w: number, h: number, cap: number): [number, number] {
  const s = Math.min(1, cap / Math.max(w, h));
  return [Math.max(48, Math.round(w * s)), Math.max(48, Math.round(h * s))];
}

function snapshot(source: HTMLCanvasElement, w: number, h: number): Buf | null {
  const buf = createBuffer(w, h);
  if (!buf) return null;
  buf.ctx.drawImage(source, 0, 0, buf.canvas.width, buf.canvas.height);
  return buf;
}

let filterSupport: boolean | null = null;
function supportsCanvasFilter(): boolean {
  if (filterSupport !== null) return filterSupport;
  try {
    const c = document.createElement('canvas').getContext('2d');
    if (!c || !('filter' in c)) {
      filterSupport = false;
    } else {
      c.filter = 'blur(2px)';
      filterSupport = c.filter === 'blur(2px)';
    }
  } catch {
    filterSupport = false;
  }
  return filterSupport;
}

/** Gambar sumber dengan offset, lalu tutup celah tepi dengan meregangkan baris/kolom terluar. */
function drawClamped(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, dx: number, dy: number) {
  const w = src.width;
  const h = src.height;
  ctx.drawImage(src, dx, dy);
  if (dx > 0.5) ctx.drawImage(src, 0, 0, 1, h, 0, dy, dx, h);
  if (dx < -0.5) ctx.drawImage(src, w - 1, 0, 1, h, w + dx, dy, -dx, h);
  if (dy > 0.5) ctx.drawImage(src, 0, 0, w, 1, dx, 0, w, dy);
  if (dy < -0.5) ctx.drawImage(src, 0, h - 1, w, 1, dx, h + dy, w, -dy);
}

/** Gaussian blur dengan tepi di-clamp (tanpa halo gelap). Fallback: downsample progresif. */
function blurredCopy(src: HTMLCanvasElement, radiusPx: number): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  if (radiusPx < 0.6) return src;

  if (supportsCanvasFilter()) {
    const pad = Math.ceil(radiusPx * 2.5);
    const padded = createBuffer(w + pad * 2, h + pad * 2);
    const out = createBuffer(w, h);
    if (!padded || !out) return src;
    const p = padded.ctx;
    p.drawImage(src, pad, pad);
    p.drawImage(src, 0, 0, w, 1, pad, 0, w, pad);
    p.drawImage(src, 0, h - 1, w, 1, pad, h + pad, w, pad);
    p.drawImage(src, 0, 0, 1, h, 0, pad, pad, h);
    p.drawImage(src, w - 1, 0, 1, h, w + pad, pad, pad, h);
    p.drawImage(src, 0, 0, 1, 1, 0, 0, pad, pad);
    p.drawImage(src, w - 1, 0, 1, 1, w + pad, 0, pad, pad);
    p.drawImage(src, 0, h - 1, 1, 1, 0, h + pad, pad, pad);
    p.drawImage(src, w - 1, h - 1, 1, 1, w + pad, h + pad, pad, pad);
    out.ctx.filter = `blur(${radiusPx.toFixed(2)}px)`;
    out.ctx.drawImage(padded.canvas, -pad, -pad);
    out.ctx.filter = 'none';
    return out.canvas;
  }

  // Fallback universal: turunkan resolusi bertahap lalu naikkan kembali (smoothing tinggi).
  let current: HTMLCanvasElement = src;
  let cw = w;
  let ch = h;
  const target = Math.max(1, radiusPx / 1.5);
  let factor = 1;
  while (factor * 2 <= target && cw > 8 && ch > 8) {
    factor *= 2;
    const next = createBuffer(Math.max(1, Math.round(cw / 2)), Math.max(1, Math.round(ch / 2)));
    if (!next) break;
    next.ctx.drawImage(current, 0, 0, next.canvas.width, next.canvas.height);
    current = next.canvas;
    cw = next.canvas.width;
    ch = next.canvas.height;
  }
  const out = createBuffer(w, h);
  if (!out) return src;
  out.ctx.drawImage(current, 0, 0, w, h);
  return out.canvas;
}

/** Rata-rata berjalan: tiap sampel ke-i digambar dengan alpha 1/(i+1) → rata-rata eksak. */
function averagePass(
  src: HTMLCanvasElement,
  samples: number,
  drawSample: (ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, t: number) => void
): HTMLCanvasElement {
  const out = createBuffer(src.width, src.height);
  if (!out) return src;
  for (let i = 0; i < samples; i++) {
    const t = samples === 1 ? 0 : i / (samples - 1) - 0.5;
    out.ctx.globalAlpha = 1 / (i + 1);
    drawSample(out.ctx, src, t);
  }
  out.ctx.globalAlpha = 1;
  return out.canvas;
}

function channelOf(
  src: HTMLCanvasElement,
  color: string,
  draw: (ctx: CanvasRenderingContext2D, src: HTMLCanvasElement) => void
): HTMLCanvasElement {
  const buf = createBuffer(src.width, src.height);
  if (!buf) return src;
  draw(buf.ctx, src);
  buf.ctx.globalCompositeOperation = 'multiply';
  buf.ctx.fillStyle = color;
  buf.ctx.fillRect(0, 0, buf.canvas.width, buf.canvas.height);
  buf.ctx.globalCompositeOperation = 'source-over';
  return buf.canvas;
}

function combineLighter(w: number, h: number, layers: HTMLCanvasElement[]): Buf | null {
  const out = createBuffer(w, h);
  if (!out) return null;
  out.ctx.fillStyle = '#000';
  out.ctx.fillRect(0, 0, w, h);
  out.ctx.globalCompositeOperation = 'lighter';
  layers.forEach((l) => out.ctx.drawImage(l, 0, 0, w, h));
  out.ctx.globalCompositeOperation = 'source-over';
  return out;
}

/** Mask elips (mengikuti rasio frame): pusat transparan, tepi = edge alpha. */
function maskEllipse(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  inner: number,
  outer: number,
  edge = 1
) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.translate(w / 2, h / 2);
  ctx.scale(w / 2, h / 2);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, outer);
  const start = clamp(inner / outer, 0, 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(start, 'rgba(0,0,0,0)');
  for (let k = 1; k <= 6; k++) {
    const t = k / 6;
    g.addColorStop(start + (1 - start) * t, `rgba(0,0,0,${(edge * smoothstep(0, 1, t)).toFixed(3)})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

/** Mask linear sepanjang garis (x0,y0)→(x1,y1) dengan stop [posisi, alpha]. */
function maskLinear(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: Array<[number, number]>
) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([p, a]) => g.addColorStop(p, `rgba(0,0,0,${clamp(a, 0, 1).toFixed(3)})`));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function sampleGrid(src: HTMLCanvasElement, gw: number): { data: Uint8ClampedArray; gw: number; gh: number } | null {
  const gh = Math.max(4, Math.round((gw * src.height) / src.width));
  const buf = createBuffer(gw, gh);
  if (!buf) return null;
  buf.ctx.drawImage(src, 0, 0, gw, gh);
  try {
    return { data: buf.ctx.getImageData(0, 0, gw, gh).data, gw, gh };
  } catch {
    return null;
  }
}

/* ───────────────────────── Cinematic finish ───────────────────────── */

function applyBloom(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  if (amount <= 0.01 || !supportsCanvasFilter()) return;
  const [bw, bh] = fitSize(w, h, 480);
  const hi = createBuffer(bw, bh);
  if (!hi) return;
  // Ambang highlight: hanya area terang yang tersisa.
  hi.ctx.filter = 'brightness(0.8) contrast(3.4) saturate(1.4)';
  hi.ctx.drawImage(ctx.canvas, 0, 0, bw, bh);
  hi.ctx.filter = 'none';
  const tight = blurredCopy(hi.canvas, Math.min(bw, bh) * 0.03);
  const wide = blurredCopy(hi.canvas, Math.min(bw, bh) * 0.09);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = clamp(amount, 0, 1);
  ctx.drawImage(tight, 0, 0, w, h);
  ctx.globalAlpha = clamp(amount * 0.65, 0, 1);
  ctx.drawImage(wide, 0, 0, w, h);
  ctx.restore();
}

function applyVignette(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  if (amount <= 0.01) return;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(w / 2, h / 2);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.42);
  g.addColorStop(0, 'rgba(4, 6, 12, 0)');
  g.addColorStop(0.5, 'rgba(4, 6, 12, 0)');
  g.addColorStop(0.78, `rgba(4, 6, 12, ${(amount * 0.42).toFixed(3)})`);
  g.addColorStop(1, `rgba(3, 4, 9, ${clamp(amount, 0, 0.92).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

let grainTile: HTMLCanvasElement | null = null;
function getGrainTile(): HTMLCanvasElement | null {
  if (grainTile) return grainTile;
  const size = 256;
  const buf = createBuffer(size, size);
  if (!buf) return null;
  const img = buf.ctx.createImageData(size, size);
  const rand = mulberry32(1337);
  for (let i = 0; i < img.data.length; i += 4) {
    // Distribusi mendekati gaussian agar grain terasa organik, bukan "noise digital".
    const v = 128 + (rand() + rand() + rand() - 1.5) * 92;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  buf.ctx.putImageData(img, 0, 0);
  grainTile = buf.canvas;
  return grainTile;
}

function applyGrain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  if (amount <= 0.005) return;
  const tile = getGrainTile();
  if (!tile) return;
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = clamp(amount, 0, 0.3);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function applyLightLeak(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: RGB,
  amount: number,
  corners: Array<[number, number]>
) {
  if (amount <= 0.01) return;
  const r = Math.max(w, h) * 0.55;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  corners.forEach(([cx, cy]) => {
    const g = ctx.createRadialGradient(cx * w, cy * h, 0, cx * w, cy * h, r);
    g.addColorStop(0, rgba(color, amount));
    g.addColorStop(0.45, rgba(color, amount * 0.35));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  ctx.restore();
}

function cinematicFinish(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: number,
  opts: { bloom?: number; vignette?: number; grain?: number }
) {
  applyBloom(ctx, w, h, (opts.bloom ?? 0) * s);
  applyVignette(ctx, w, h, (opts.vignette ?? 0) * s);
  applyGrain(ctx, w, h, (opts.grain ?? 0) * (0.6 + 0.4 * s));
}

/* ───────────────────────── Efek ───────────────────────── */

interface EffectArgs {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  s: number;
  accent: RGB;
}

/** 1. Motion Blur — zoom blur radial + speed lines ala key art game aksi. */
function effectRadialZoom({ ctx, w, h, s, accent }: EffectArgs) {
  const [bw, bh] = fitSize(w, h, 900);
  const base = snapshot(ctx.canvas, bw, bh);
  if (!base) return;

  const total = 0.06 + 0.12 * s;
  const zoomDraw = (amount: number) => (c: CanvasRenderingContext2D, src: HTMLCanvasElement, t: number) => {
    const z = 1 + amount * (t + 0.5);
    const zw = bw * z;
    const zh = bh * z;
    c.drawImage(src, (bw - zw) / 2, (bh - zh) / 2, zw, zh);
  };
  let blurred = averagePass(base.canvas, 10, zoomDraw(total));
  blurred = averagePass(blurred, 8, zoomDraw(total / 9));

  const layer = createBuffer(bw, bh);
  if (!layer) return;
  layer.ctx.drawImage(blurred, 0, 0);
  maskEllipse(layer.ctx, bw, bh, 0.3, 1.25, 0.6 + 0.4 * s);
  ctx.drawImage(layer.canvas, 0, 0, w, h);

  // Speed lines radial (wedge tipis yang melebar ke tepi).
  const rand = mulberry32(7);
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.hypot(w, h) / 2;
  const minEdge = Math.min(w, h);
  const count = Math.round(28 + 70 * s);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < count; i++) {
    const ang = rand() * Math.PI * 2;
    const r0 = R * (0.5 + rand() * 0.32);
    const r1 = R * 1.02;
    const half = minEdge * (0.0006 + rand() * 0.0026);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const x0 = cx + cos * r0;
    const y0 = cy + sin * r0;
    const x1 = cx + cos * r1;
    const y1 = cy + sin * r1;
    const a = (0.06 + rand() * 0.2) * s;
    const col: RGB = rand() < 0.25 ? accent : [235, 240, 248];
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, rgba(col, 0));
    g.addColorStop(0.6, rgba(col, a));
    g.addColorStop(1, rgba(col, a * 0.5));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1 - sin * half, y1 + cos * half);
    ctx.lineTo(x1 + sin * half, y1 - cos * half);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  applyLightLeak(ctx, w, h, accent, 0.1 * s, [[0, 1], [1, 0]]);
  cinematicFinish(ctx, w, h, s, { bloom: 0.22, vignette: 0.42, grain: 0.07 });
}

/** 2. Chromatic Aberration Vignette — aberasi lensa radial yang realistis (0 di pusat, maksimal di tepi). */
function effectChromaticVignette({ ctx, w, h, s }: EffectArgs) {
  const [bw, bh] = fitSize(w, h, 1600);
  const base = snapshot(ctx.canvas, bw, bh);
  if (!base) return;

  const k = 0.008 + 0.02 * s;
  const scaled = (z: number) => (c: CanvasRenderingContext2D, src: HTMLCanvasElement) => {
    const zw = bw * z;
    const zh = bh * z;
    c.drawImage(src, (bw - zw) / 2, (bh - zh) / 2, zw, zh);
  };
  const r = channelOf(base.canvas, '#ff0000', scaled(1 + k));
  const g = channelOf(base.canvas, '#00ff00', scaled(1 + k * 0.45));
  const b = channelOf(base.canvas, '#0000ff', scaled(1));
  const comp = combineLighter(bw, bh, [r, g, b]);
  if (!comp) return;

  // Kelembutan lensa di tepi (edge softness).
  const soft = createBuffer(bw, bh);
  if (soft) {
    soft.ctx.drawImage(blurredCopy(comp.canvas, Math.min(bw, bh) * (0.002 + 0.006 * s)), 0, 0);
    maskEllipse(soft.ctx, bw, bh, 0.55, 1.3, 0.85);
    comp.ctx.drawImage(soft.canvas, 0, 0);
  }

  maskEllipse(comp.ctx, bw, bh, 0.22, 1.0, 1);
  ctx.drawImage(comp.canvas, 0, 0, w, h);

  cinematicFinish(ctx, w, h, s, { bloom: 0.16, vignette: 0.78, grain: 0.06 });
}

/** 3. RGB Separation — split kanal gaya broadcast/esports dengan band yang diperkuat. */
function effectRgbSeparation({ ctx, w, h, s, accent }: EffectArgs) {
  const [bw, bh] = fitSize(w, h, 1600);
  const base = snapshot(ctx.canvas, bw, bh);
  if (!base) return;

  const shift = bw * (0.004 + 0.012 * s);
  const compose = (mul: number) => {
    const d = shift * mul;
    const r = channelOf(base.canvas, '#ff0000', (c, src) => drawClamped(c, src, -d, -d * 0.12));
    const g = channelOf(base.canvas, '#00ff00', (c, src) => drawClamped(c, src, 0, d * 0.1));
    const b = channelOf(base.canvas, '#0000ff', (c, src) => drawClamped(c, src, d, 0));
    return combineLighter(bw, bh, [r, g, b]);
  };
  const comp = compose(1);
  const amplified = compose(2.8);
  if (!comp || !amplified) return;

  // Band horizontal dengan split ekstra kuat, bias ke atas/bawah frame.
  const rand = mulberry32(42);
  const bands = Math.round(3 + 5 * s);
  for (let i = 0; i < bands; i++) {
    const edgeBias = rand() < 0.5 ? rand() * 0.28 : 0.72 + rand() * 0.28;
    const y = Math.round(edgeBias * bh);
    const bandH = Math.max(2, Math.round(bh * (0.006 + rand() * 0.028)));
    comp.ctx.drawImage(amplified.canvas, 0, y, bw, bandH, 0, y, bw, bandH);
  }

  // Scanline halus.
  const step = Math.max(2, Math.round(bh / 300));
  comp.ctx.fillStyle = `rgba(0, 0, 0, ${(0.1 + 0.12 * s).toFixed(3)})`;
  for (let y = 0; y < bh; y += step * 2) comp.ctx.fillRect(0, y, bw, step);

  maskEllipse(comp.ctx, bw, bh, 0.26, 1.1, 1);
  ctx.drawImage(comp.canvas, 0, 0, w, h);

  applyLightLeak(ctx, w, h, accent, 0.08 * s, [[0, 0.5]]);
  applyLightLeak(ctx, w, h, [0, 200, 255], 0.07 * s, [[1, 0.5]]);
  cinematicFinish(ctx, w, h, s, { bloom: 0.14, vignette: 0.4, grain: 0.08 });
}

/** 4. Prism Distortion — pecahan kaca prisma dengan refraksi, dispersi, dan highlight tepi. */
function effectPrism({ ctx, w, h, s, accent }: EffectArgs) {
  const [bw, bh] = fitSize(w, h, 1600);
  const base = snapshot(ctx.canvas, bw, bh);
  if (!base) return;

  // Isi kaca: gambar dengan dispersi kecil (split kanal) agar terasa seperti refraksi nyata.
  const d = bw * 0.006 * s;
  const prismFill = combineLighter(bw, bh, [
    channelOf(base.canvas, '#ff0000', (c, src) => drawClamped(c, src, -d, 0)),
    channelOf(base.canvas, '#00ff00', (c, src) => c.drawImage(src, 0, 0)),
    channelOf(base.canvas, '#0000ff', (c, src) => drawClamped(c, src, d, 0)),
  ]);
  if (!prismFill) return;

  type Facet = { pts: Array<[number, number]>; dx: number; dy: number; z: number; hue: number };
  const facets: Facet[] = [
    { pts: [[0, 0], [0.22, 0], [0.08, 0.3], [0, 0.36]], dx: -0.022, dy: -0.016, z: 1.04, hue: 195 },
    { pts: [[0.22, 0], [0.31, 0], [0.08, 0.3]], dx: 0.012, dy: -0.02, z: 1.06, hue: 280 },
    { pts: [[0, 0.36], [0.08, 0.3], [0.11, 0.66], [0, 0.74]], dx: -0.026, dy: 0.006, z: 1.05, hue: 330 },
    { pts: [[0, 0.74], [0.11, 0.66], [0.26, 1], [0, 1]], dx: -0.02, dy: 0.022, z: 1.045, hue: 20 },
    { pts: [[0.42, 1], [0.5, 0.955], [0.58, 1]], dx: 0, dy: 0.024, z: 1.03, hue: 50 },
    { pts: [[0.78, 0], [1, 0], [1, 0.3], [0.92, 0.26]], dx: 0.022, dy: -0.018, z: 1.045, hue: 170 },
    { pts: [[0.92, 0.26], [1, 0.3], [1, 0.68], [0.9, 0.6]], dx: 0.028, dy: 0, z: 1.06, hue: 260 },
    { pts: [[0.9, 0.6], [1, 0.68], [1, 1], [0.74, 1]], dx: 0.02, dy: 0.022, z: 1.04, hue: 300 },
    { pts: [[0.58, 0], [0.68, 0], [0.63, 0.045]], dx: 0, dy: -0.02, z: 1.05, hue: 210 },
  ];

  const minEdge = Math.min(w, h);
  const line = Math.max(1, minEdge * 0.0018);

  facets.forEach((f) => {
    const pts = f.pts.map(([px, py]) => [px * w, py * h] as [number, number]);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const path = () => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
    };

    ctx.save();
    path();
    ctx.clip();

    // Refraksi: isi digeser + diperbesar.
    const z = 1 + (f.z - 1) * (0.5 + 0.5 * s);
    const zw = w * z;
    const zh = h * z;
    ctx.drawImage(
      prismFill.canvas,
      0,
      0,
      bw,
      bh,
      (w - zw) / 2 + f.dx * w * s,
      (h - zh) / 2 + f.dy * h * s,
      zw,
      zh
    );

    // Tint spektral + kilau kaca.
    ctx.globalCompositeOperation = 'screen';
    const spec = ctx.createLinearGradient(minX, minY, maxX, maxY);
    spec.addColorStop(0, `hsla(${f.hue}, 95%, 60%, ${(0.16 * s).toFixed(3)})`);
    spec.addColorStop(0.5, `hsla(${(f.hue + 60) % 360}, 95%, 60%, ${(0.05 * s).toFixed(3)})`);
    spec.addColorStop(1, `hsla(${(f.hue + 120) % 360}, 95%, 60%, ${(0.14 * s).toFixed(3)})`);
    ctx.fillStyle = spec;
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

    const sheen = ctx.createLinearGradient(minX, minY, minX + (maxX - minX) * 0.6, maxY);
    sheen.addColorStop(0, `rgba(255, 255, 255, ${(0.2 * s).toFixed(3)})`);
    sheen.addColorStop(0.35, 'rgba(255, 255, 255, 0)');
    sheen.addColorStop(1, `rgba(255, 255, 255, ${(0.05 * s).toFixed(3)})`);
    ctx.fillStyle = sheen;
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

    // Ketebalan kaca: bayangan dalam di sepanjang tepi facet.
    ctx.globalCompositeOperation = 'source-over';
    path();
    ctx.strokeStyle = `rgba(0, 0, 0, ${(0.35 * s).toFixed(3)})`;
    ctx.lineWidth = line * 6;
    ctx.stroke();
    ctx.restore();

    // Garis tepi: highlight putih bercahaya + fringe dispersi cyan/magenta.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineJoin = 'round';
    const fringe = line * 1.4;
    ctx.translate(fringe, 0);
    path();
    ctx.strokeStyle = `rgba(0, 220, 255, ${(0.35 * s).toFixed(3)})`;
    ctx.lineWidth = line;
    ctx.stroke();
    ctx.translate(-fringe * 2, 0);
    path();
    ctx.strokeStyle = `rgba(255, 40, 160, ${(0.35 * s).toFixed(3)})`;
    ctx.stroke();
    ctx.translate(fringe, 0);
    path();
    ctx.shadowColor = `rgba(220, 240, 255, ${(0.8 * s).toFixed(3)})`;
    ctx.shadowBlur = line * 6;
    ctx.strokeStyle = `rgba(240, 248, 255, ${(0.6 * s).toFixed(3)})`;
    ctx.lineWidth = line;
    ctx.stroke();
    ctx.restore();
  });

  applyLightLeak(ctx, w, h, accent, 0.12 * s, [[0, 0]]);
  applyLightLeak(ctx, w, h, [120, 180, 255], 0.1 * s, [[1, 1]]);
  cinematicFinish(ctx, w, h, s, { bloom: 0.28, vignette: 0.32, grain: 0.06 });
}

/** 5. Directional Motion Blur — kecepatan horizontal ala game balap, dengan streak berwarna scene. */
function effectDirectionalMotion({ ctx, w, h, s, accent }: EffectArgs) {
  const [bw, bh] = fitSize(w, h, 900);
  const base = snapshot(ctx.canvas, bw, bh);
  if (!base) return;

  const angle = (-5 * Math.PI) / 180;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const span = bw * (0.05 + 0.11 * s);
  const smear = (amount: number) => (c: CanvasRenderingContext2D, src: HTMLCanvasElement, t: number) =>
    drawClamped(c, src, ca * t * amount, sa * t * amount);
  let blurred = averagePass(base.canvas, 10, smear(span));
  blurred = averagePass(blurred, 8, smear(span / 9));

  const layer = createBuffer(bw, bh);
  if (!layer) return;
  layer.ctx.drawImage(blurred, 0, 0);
  const e = 0.7 + 0.3 * s;
  maskLinear(layer.ctx, bw, bh, 0, 0, bw, 0, [
    [0, e],
    [0.18, e * 0.85],
    [0.36, 0],
    [0.64, 0],
    [0.82, e * 0.85],
    [1, e],
  ]);
  ctx.drawImage(layer.canvas, 0, 0, w, h);

  // Streak kecepatan: warna diambil dari scene agar menyatu.
  const grid = sampleGrid(base.canvas, 48);
  const rand = mulberry32(11);
  const minEdge = Math.min(w, h);
  const count = Math.round(30 + 90 * s);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < count; i++) {
    const fromLeft = rand() < 0.5;
    const y = rand() * h;
    const len = w * (0.08 + rand() * 0.3);
    const thick = Math.max(0.6, minEdge * (0.0006 + rand() * 0.0024));
    let col: RGB = rand() < 0.3 ? accent : [240, 244, 250];
    if (grid && rand() < 0.6) {
      const gx = fromLeft ? 1 : grid.gw - 2;
      const gy = clamp(Math.floor((y / h) * grid.gh), 0, grid.gh - 1);
      const idx = (gy * grid.gw + gx) * 4;
      const lift = 1.6;
      col = [
        Math.min(255, grid.data[idx] * lift + 40),
        Math.min(255, grid.data[idx + 1] * lift + 40),
        Math.min(255, grid.data[idx + 2] * lift + 40),
      ];
    }
    const a = (0.08 + rand() * 0.28) * s;
    const x0 = fromLeft ? 0 : w;
    const x1 = fromLeft ? len : w - len;
    const y1 = y + (x1 - x0) * Math.tan(angle);
    const g = ctx.createLinearGradient(x0, y, x1, y1);
    g.addColorStop(0, rgba(col, a));
    g.addColorStop(0.7, rgba(col, a * 0.4));
    g.addColorStop(1, rgba(col, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = thick;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.restore();

  applyLightLeak(ctx, w, h, accent, 0.1 * s, [[0, 0.5], [1, 0.5]]);
  cinematicFinish(ctx, w, h, s, { bloom: 0.2, vignette: 0.36, grain: 0.07 });
}

/** 6. Directional Blur — depth-of-field diagonal (tilt-shift) dengan bokeh dari titik terang scene. */
function effectDiagonalDof({ ctx, w, h, s }: EffectArgs) {
  const [bw, bh] = fitSize(w, h, 720);
  const base = snapshot(ctx.canvas, bw, bh);
  if (!base) return;

  const diag = Math.min(bw, bh) * 0.018 * s;
  const smeared = averagePass(base.canvas, 7, (c, src, t) => drawClamped(c, src, t * diag, t * diag));
  const blurred = blurredCopy(smeared, Math.min(bw, bh) * (0.008 + 0.02 * s));

  const layer = createBuffer(bw, bh);
  if (!layer) return;
  layer.ctx.drawImage(blurred, 0, 0);
  // Pita fokus diagonal (kiri-bawah → kanan-atas), blur makin kuat ke sudut.
  const e = 0.75 + 0.25 * s;
  maskLinear(layer.ctx, bw, bh, 0, 0, bw, bh, [
    [0, e],
    [0.26, e * 0.7],
    [0.4, 0],
    [0.6, 0],
    [0.74, e * 0.7],
    [1, e],
  ]);
  ctx.drawImage(layer.canvas, 0, 0, w, h);

  // Bokeh: ambil titik terang dari scene di zona blur.
  const grid = sampleGrid(blurred, 56);
  if (grid) {
    type Spot = { x: number; y: number; lum: number; col: RGB; weight: number };
    const spots: Spot[] = [];
    for (let gy = 0; gy < grid.gh; gy++) {
      for (let gx = 0; gx < grid.gw; gx++) {
        const idx = (gy * grid.gw + gx) * 4;
        const r = grid.data[idx];
        const g = grid.data[idx + 1];
        const b = grid.data[idx + 2];
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        const nx = (gx + 0.5) / grid.gw;
        const ny = (gy + 0.5) / grid.gh;
        const band = Math.abs(nx + ny - 1) / 2; // jarak ke pita fokus (0..0.5)
        const weight = smoothstep(0.1, 0.3, band);
        if (lum > 0.5 && weight > 0.2) spots.push({ x: nx, y: ny, lum, col: [r, g, b], weight });
      }
    }
    spots.sort((a, b) => b.lum * b.weight - a.lum * a.weight);
    const rand = mulberry32(5);
    const minEdge = Math.min(w, h);
    const take = spots.slice(0, Math.round(10 + 26 * s));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    take.forEach((sp) => {
      const x = (sp.x + (rand() - 0.5) / grid.gw) * w;
      const y = (sp.y + (rand() - 0.5) / grid.gh) * h;
      const rad = minEdge * (0.012 + rand() * 0.022) * (0.7 + 0.3 * s);
      const a = clamp((sp.lum - 0.35) * 0.5 * sp.weight * s, 0, 0.45);
      const col: RGB = [
        Math.min(255, sp.col[0] + 30),
        Math.min(255, sp.col[1] + 30),
        Math.min(255, sp.col[2] + 30),
      ];
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, rgba(col, a * 0.45));
      g.addColorStop(0.78, rgba(col, a * 0.6));
      g.addColorStop(0.9, rgba(col, a));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  cinematicFinish(ctx, w, h, s, { bloom: 0.22, vignette: 0.45, grain: 0.06 });
}

/** 7. Glitch Displacement — slice tergeser, macroblock korup, split RGB lokal, dan garis data. */
function effectGlitch({ ctx, w, h, s, accent }: EffectArgs) {
  const [bw, bh] = fitSize(w, h, 1600);
  const base = snapshot(ctx.canvas, bw, bh);
  const glitch = snapshot(ctx.canvas, bw, bh);
  if (!base || !glitch) return;
  const g = glitch.ctx;
  g.imageSmoothingEnabled = false;

  const red = channelOf(base.canvas, '#ff0000', (c, src) => c.drawImage(src, 0, 0));
  const cyan = channelOf(base.canvas, '#00ffff', (c, src) => c.drawImage(src, 0, 0));
  const rand = mulberry32(2024);

  const edgeY = () => {
    let y = rand();
    if (y > 0.3 && y < 0.7 && rand() < 0.75) y = y < 0.5 ? y - 0.3 : y + 0.3;
    return y;
  };

  // Slice horizontal tergeser (wrap-around).
  const slices = Math.round(10 + 14 * s);
  for (let i = 0; i < slices; i++) {
    const y = Math.round(edgeY() * bh);
    const sh = Math.max(2, Math.round(bh * (0.004 + rand() * 0.035)));
    const shift = Math.round((rand() - 0.5) * 2 * bw * (0.015 + 0.06 * s));
    const draw = (src: HTMLCanvasElement, dx: number) => {
      g.drawImage(src, 0, y, bw, sh, dx, y, bw, sh);
      g.drawImage(src, 0, y, bw, sh, dx - Math.sign(dx || 1) * bw, y, bw, sh);
    };
    if (rand() < 0.4) {
      const o = Math.max(2, Math.round(bw * 0.006 * s));
      g.fillStyle = '#000';
      g.fillRect(0, y, bw, sh);
      g.globalCompositeOperation = 'lighter';
      draw(red, shift + o);
      draw(cyan, shift - o);
      g.globalCompositeOperation = 'source-over';
    } else {
      draw(base.canvas, shift);
    }
  }

  // Macroblock korup di area tepi.
  const blocks = Math.round(4 + 10 * s);
  for (let i = 0; i < blocks; i++) {
    const bwid = Math.round(bw * (0.03 + rand() * 0.1));
    const bhei = Math.round(bh * (0.02 + rand() * 0.05));
    const left = rand() < 0.5;
    const x = Math.round(left ? rand() * bw * 0.25 : bw * 0.75 + rand() * bw * 0.25 - bwid);
    const y = Math.round(edgeY() * (bh - bhei));
    const srcX = clamp(Math.round(x + (rand() - 0.5) * bw * 0.2), 0, bw - bwid);
    const srcY = clamp(Math.round(y + (rand() - 0.5) * bh * 0.1), 0, bh - bhei);
    g.drawImage(base.canvas, srcX, srcY, bwid, bhei, x, y, bwid, bhei);
    if (rand() < 0.45) {
      g.globalCompositeOperation = 'screen';
      g.fillStyle = rand() < 0.5 ? rgba(accent, 0.3 * s) : `rgba(0, 230, 255, ${(0.24 * s).toFixed(3)})`;
      g.fillRect(x, y, bwid, bhei);
      g.globalCompositeOperation = 'source-over';
    }
  }

  // Garis data tipis.
  const lines = Math.round(4 + 8 * s);
  for (let i = 0; i < lines; i++) {
    const y = Math.round(edgeY() * bh);
    const len = bw * (0.15 + rand() * 0.6);
    const x = rand() < 0.5 ? 0 : bw - len;
    const pick = rand();
    g.fillStyle =
      pick < 0.4
        ? rgba(accent, 0.65 * s)
        : pick < 0.75
          ? `rgba(0, 235, 255, ${(0.55 * s).toFixed(3)})`
          : `rgba(255, 255, 255, ${(0.5 * s).toFixed(3)})`;
    g.fillRect(x, y, len, Math.max(1, Math.round(bh * 0.0015)));
  }

  // Scanline.
  const step = Math.max(2, Math.round(bh / 320));
  g.fillStyle = `rgba(0, 0, 0, ${(0.12 + 0.14 * s).toFixed(3)})`;
  for (let y = 0; y < bh; y += step * 2) g.fillRect(0, y, bw, step);

  maskEllipse(g, bw, bh, 0.4, 0.95, 1);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(glitch.canvas, 0, 0, w, h);
  ctx.restore();

  cinematicFinish(ctx, w, h, s, { bloom: 0.12, vignette: 0.38, grain: 0.09 });
}

export function applyEdgeEffect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: MockupTextConfig
): void {
  if (!config.edgeEffect || config.edgeEffect === 'none') return;
  if (typeof document === 'undefined') return;

  const args: EffectArgs = {
    ctx,
    w: width,
    h: height,
    s: clamp(config.edgeEffectIntensity ?? 0.75, 0.15, 1),
    accent: parseHex(config.accentColor),
  };

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  switch (config.edgeEffect) {
    case 'motion-blur':
      effectRadialZoom(args);
      break;
    case 'chromatic-vignette':
      effectChromaticVignette(args);
      break;
    case 'rgb-separation':
      effectRgbSeparation(args);
      break;
    case 'prism-distortion':
      effectPrism(args);
      break;
    case 'directional-motion-blur':
      effectDirectionalMotion(args);
      break;
    case 'directional-blur':
      effectDiagonalDof(args);
      break;
    case 'glitch-displacement':
      effectGlitch(args);
      break;
  }
  ctx.restore();
}
