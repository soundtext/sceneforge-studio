import {
  ExportFormat,
  FONT_PRESETS,
  MockupOptionId,
  MockupTextConfig,
  computeCornerRadiusPx,
  computeCoverCrop,
  computeTypographyScale,
  computeVerticalPositionY,
} from './mockupPresets';
import { applyEdgeEffect } from './edgeEffects';

function getFontFamily(fontId: string): string {
  return FONT_PRESETS.find((f) => f.id === fontId)?.family ?? '"Cinzel", Georgia, serif';
}

function measureSpacedTextWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacingPx: number
): number {
  const chars = Array.from(text);
  if (chars.length === 0) return 0;
  const raw = chars.reduce((acc, ch) => acc + ctx.measureText(ch).width, 0);
  return raw + letterSpacingPx * Math.max(0, chars.length - 1);
}

function drawSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacingPx: number,
  align: CanvasTextAlign
): void {
  const chars = Array.from(text);
  if (chars.length === 0) return;

  if (Math.abs(letterSpacingPx) < 0.5) {
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
    return;
  }

  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const totalWidth =
    widths.reduce((acc, w) => acc + w, 0) + letterSpacingPx * Math.max(0, chars.length - 1);

  let cursorX = x;
  if (align === 'center') {
    cursorX = x - totalWidth / 2;
  } else if (align === 'right') {
    cursorX = x - totalWidth;
  }

  ctx.textAlign = 'left';
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cursorX, y);
    cursorX += widths[i] + letterSpacingPx;
  }
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 4
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length >= maxLines - 1) {
        const rest = [current, ...words.slice(i + 1)].join(' ');
        lines.push(rest);
        return lines.slice(0, maxLines);
      }
    }
  }
  lines.push(current);
  return lines.slice(0, maxLines);
}

/**
 * Ensures text + letter-spacing always fits comfortably inside maxWidth
 * by scaling down font size if needed.
 */
function fitSpacedFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: string,
  fontFamily: string,
  desiredPx: number,
  letterSpacingRatio: number,
  maxWidth: number,
  minPx = 12
): { fontPx: number; spacingPx: number; textWidth: number } {
  let fontPx = desiredPx;
  while (fontPx > minPx) {
    ctx.font = `${weight} ${fontPx}px ${fontFamily}`;
    const spacingPx = fontPx * letterSpacingRatio;
    const textWidth = measureSpacedTextWidth(ctx, text, spacingPx);
    if (textWidth <= maxWidth) {
      return { fontPx, spacingPx, textWidth };
    }
    fontPx = Math.max(minPx, Math.floor(fontPx * 0.92));
  }
  ctx.font = `${weight} ${minPx}px ${fontFamily}`;
  const spacingPx = minPx * letterSpacingRatio;
  return {
    fontPx: minPx,
    spacingPx,
    textWidth: measureSpacedTextWidth(ctx, text, spacingPx),
  };
}

function drawEmblem(
  ctx: CanvasRenderingContext2D,
  style: MockupTextConfig['emblemStyle'],
  cx: number,
  cy: number,
  size: number,
  color: string,
  accentColor: string
): void {
  ctx.save();
  ctx.translate(cx, cy);
  const r = size * 0.48;

  if (style === 'diamond') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.78, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.78, 0);
    ctx.closePath();

    // Inner diamond cutout via evenodd winding rule (preserves background intact)
    ctx.moveTo(0, -r * 0.52);
    ctx.lineTo(-r * 0.4, 0.08 * r);
    ctx.lineTo(0, r * 0.56);
    ctx.lineTo(r * 0.4, 0.08 * r);
    ctx.closePath();
    ctx.fill('evenodd');

    ctx.beginPath();
    ctx.moveTo(0, -r * 0.22);
    ctx.lineTo(r * 0.17, r * 0.14);
    ctx.lineTo(0, r * 0.3);
    ctx.lineTo(-r * 0.17, r * 0.14);
    ctx.closePath();
    ctx.fill();
  } else if (style === 'crest') {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, size * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.85, -r * 0.45);
    ctx.lineTo(r * 0.65, r * 0.45);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.65, r * 0.45);
    ctx.lineTo(-r * 0.85, -r * 0.45);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.45);
    ctx.lineTo(r * 0.26, 0);
    ctx.lineTo(0, r * 0.45);
    ctx.lineTo(-r * 0.26, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, size * 0.085);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = Math.max(1.5, size * 0.045);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.52, -Math.PI * 0.35, Math.PI * 1.15);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPlaceholderBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  accentColor: string
): void {
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.5, '#1e293b');
  grad.addColorStop(1, '#090d16');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.38,
    10,
    width * 0.5,
    height * 0.38,
    Math.max(width, height) * 0.55
  );
  glow.addColorStop(0, `${accentColor}44`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length !== 6) return `rgba(225, 29, 72, ${alpha})`;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(225, 29, 72, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawBaseBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: MockupTextConfig,
  bgImage: HTMLImageElement | null
): void {
  if (bgImage && bgImage.naturalWidth > 0 && bgImage.naturalHeight > 0) {
    const crop = computeCoverCrop(
      bgImage.naturalWidth,
      bgImage.naturalHeight,
      width,
      height,
      config.focusX,
      config.focusY
    );
    ctx.drawImage(
      bgImage,
      crop.sx,
      crop.sy,
      crop.sWidth,
      crop.sHeight,
      0,
      0,
      width,
      height
    );
  } else {
    drawPlaceholderBackground(ctx, width, height, config.accentColor);
  }
}

export function renderMockupToCanvas(
  canvas: HTMLCanvasElement,
  optionId: MockupOptionId,
  width: number,
  height: number,
  config: MockupTextConfig,
  bgImage: HTMLImageElement | null,
  cornerRadiusRatio = 0
): void {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  const cornerRadiusPx = computeCornerRadiusPx(width, height, cornerRadiusRatio);
  ctx.save();
  if (cornerRadiusPx > 0) {
    drawRoundedRectPath(ctx, 0, 0, width, height, cornerRadiusPx);
    ctx.clip();
  }

  drawBaseBackground(ctx, width, height, config, bgImage);
  applyEdgeEffect(ctx, width, height, config);

  const { titlePx, subtitlePx, metaPx, paddingPx } = computeTypographyScale(
    width,
    height,
    config.titleScale
  );
  const titleFont = getFontFamily(config.fontId);
  const uiFont = '"Plus Jakarta Sans", sans-serif';
  const scrimAlpha = Math.max(0.05, Math.min(0.95, config.scrimOpacity));
  const titleText = config.title.trim() || 'JUDUL GAME';
  const subtitleText = config.subtitle.trim();
  const badgeText = config.badge.trim();
  const ctaText = config.ctaText.trim();
  const footerText = config.footerMeta.trim();
  const safeContentWidth = Math.max(120, width - paddingPx * 2);

  const applyShadow = (fontPx: number) => {
    if (config.shadowStrength <= 0.02) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      return;
    }
    ctx.shadowColor = `rgba(0, 0, 0, ${0.88 * config.shadowStrength})`;
    ctx.shadowBlur = Math.max(6, fontPx * 0.24 * config.shadowStrength);
    ctx.shadowOffsetY = Math.max(2, fontPx * 0.06 * config.shadowStrength);
  };

  const clearShadow = () => {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  };

  if (optionId === 'key-art') {
    const scrim = ctx.createLinearGradient(0, height * 0.4, 0, height);
    scrim.addColorStop(0, 'rgba(5, 7, 11, 0)');
    scrim.addColorStop(0.55, `rgba(5, 7, 11, ${scrimAlpha * 0.55})`);
    scrim.addColorStop(1, `rgba(5, 7, 11, ${Math.min(0.96, scrimAlpha * 1.1)})`);
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, width, height);

    const emblemReserve = config.showEmblem ? titlePx * 1.25 : 0;
    const fittedTitle = fitSpacedFontSize(
      ctx,
      titleText,
      '700',
      titleFont,
      titlePx,
      config.letterSpacing,
      Math.max(100, safeContentWidth - emblemReserve)
    );
    const activeEmblemPx = Math.round(fittedTitle.fontPx * 0.96);
    const gap = config.showEmblem ? Math.round(fittedTitle.fontPx * 0.34) : 0;
    const totalLockupWidth =
      (config.showEmblem ? activeEmblemPx : 0) + gap + fittedTitle.textWidth;

    const align = config.align === 'auto' ? 'center' : config.align;
    let startX = width / 2 - totalLockupWidth / 2;
    if (align === 'left') startX = paddingPx;
    if (align === 'right') startX = width - paddingPx - totalLockupWidth;

    const fittedSub = subtitleText
      ? fitSpacedFontSize(
          ctx,
          subtitleText,
          '600',
          uiFont,
          subtitlePx,
          0.22,
          safeContentWidth,
          10
        )
      : null;

    // Jarak antar judul (tengah) dan subjudul (tengah): setengah tinggi judul + spasi + setengah subjudul.
    const subOffset = fittedSub
      ? fittedTitle.fontPx * 0.5 + fittedTitle.fontPx * 0.3 + fittedSub.fontPx * 0.5
      : 0;
    const minBaselineY =
      paddingPx + Math.max(fittedTitle.fontPx, config.showEmblem ? activeEmblemPx : 0) * 0.55;
    const maxBaselineY =
      height -
      paddingPx -
      (fittedSub ? subOffset + fittedSub.fontPx * 0.55 : fittedTitle.fontPx * 0.45);
    const baselineY =
      config.titleY === null
        ? maxBaselineY
        : computeVerticalPositionY(minBaselineY, maxBaselineY, config.titleY);

    if (config.titleY !== null && config.titleY < 60) {
      const bandTop = Math.max(0, baselineY - fittedTitle.fontPx * 1.9);
      const bandBot = Math.min(height, baselineY + fittedTitle.fontPx * 2.1);
      const bandScrim = ctx.createLinearGradient(0, bandTop, 0, bandBot);
      bandScrim.addColorStop(0, 'rgba(5, 7, 11, 0)');
      bandScrim.addColorStop(0.5, `rgba(5, 7, 11, ${Math.min(0.85, scrimAlpha * 0.72)})`);
      bandScrim.addColorStop(1, 'rgba(5, 7, 11, 0)');
      ctx.fillStyle = bandScrim;
      ctx.fillRect(0, bandTop, width, bandBot - bandTop);
    }

    if (config.showEmblem) {
      applyShadow(fittedTitle.fontPx);
      drawEmblem(
        ctx,
        config.emblemStyle,
        startX + activeEmblemPx / 2,
        baselineY,
        activeEmblemPx,
        config.textColor,
        config.accentColor
      );
    }

    ctx.font = `700 ${fittedTitle.fontPx}px ${titleFont}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = config.textColor;
    applyShadow(fittedTitle.fontPx);
    const textX = startX + (config.showEmblem ? activeEmblemPx + gap : 0);
    drawSpacedText(ctx, titleText, textX, baselineY, fittedTitle.spacingPx, 'left');

    if (fittedSub && subtitleText) {
      clearShadow();
      ctx.font = `600 ${fittedSub.fontPx}px ${uiFont}`;
      ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
      const subY = baselineY + subOffset;
      const subX =
        align === 'center' ? width / 2 : align === 'right' ? width - paddingPx : paddingPx;
      drawSpacedText(ctx, subtitleText, subX, subY, fittedSub.spacingPx, align);
    }
  } else if (optionId === 'store-capsule') {
    const scrim = ctx.createLinearGradient(0, height * 0.2, 0, height);
    scrim.addColorStop(0, `rgba(7, 9, 14, ${scrimAlpha * 0.25})`);
    scrim.addColorStop(0.6, `rgba(7, 9, 14, ${scrimAlpha * 0.7})`);
    scrim.addColorStop(1, `rgba(7, 9, 14, ${Math.min(0.96, scrimAlpha * 1.15)})`);
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, width, height);

    const inset = Math.round(paddingPx * 0.65);
    const arm = Math.max(16, Math.round(Math.min(width, height) * 0.05));
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.35)';
    ctx.lineWidth = Math.max(1.5, Math.round(Math.min(width, height) * 0.0025));
    const corners = [
      [inset, inset + arm, inset, inset, inset + arm, inset],
      [width - inset - arm, inset, width - inset, inset, width - inset, inset + arm],
      [inset, height - inset - arm, inset, height - inset, inset + arm, height - inset],
      [width - inset - arm, height - inset, width - inset, height - inset, width - inset, height - inset - arm],
    ];
    corners.forEach(([x1, y1, x2, y2, x3, y3]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.stroke();
    });

    const align = config.align === 'auto' ? 'center' : config.align;
    const anchorX =
      align === 'center' ? width / 2 : align === 'right' ? width - paddingPx : paddingPx;

    const fittedTitle = fitSpacedFontSize(
      ctx,
      titleText,
      '700',
      titleFont,
      titlePx,
      config.letterSpacing,
      safeContentWidth
    );
    const fittedSub = subtitleText
      ? fitSpacedFontSize(
          ctx,
          subtitleText,
          '500',
          uiFont,
          subtitlePx,
          0.18,
          safeContentWidth,
          10
        )
      : null;

    const ctaHeight = Math.max(26, Math.round(subtitlePx * 2.1));
    const ctaY = height - paddingPx - ctaHeight;
    const minTitleY =
      paddingPx + fittedTitle.fontPx + (config.showEmblem ? fittedTitle.fontPx * 1.15 : 0);
    const maxTitleY = ctaY - (fittedSub ? fittedSub.fontPx * 2.1 : subtitlePx * 1.1);
    const titleY =
      config.titleY === null
        ? maxTitleY
        : computeVerticalPositionY(minTitleY, maxTitleY, config.titleY);

    if (config.showEmblem) {
      applyShadow(fittedTitle.fontPx);
      drawEmblem(
        ctx,
        config.emblemStyle,
        anchorX,
        titleY - fittedTitle.fontPx * 1.48,
        Math.round(fittedTitle.fontPx * 0.72),
        config.textColor,
        config.accentColor
      );
    }

    ctx.font = `700 ${fittedTitle.fontPx}px ${titleFont}`;
    ctx.fillStyle = config.textColor;
    ctx.textBaseline = 'bottom';
    applyShadow(fittedTitle.fontPx);
    drawSpacedText(ctx, titleText, anchorX, titleY, fittedTitle.spacingPx, align);
    clearShadow();

    if (fittedSub && subtitleText) {
      ctx.font = `500 ${fittedSub.fontPx}px ${uiFont}`;
      ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
      ctx.textBaseline = 'bottom';
      drawSpacedText(
        ctx,
        subtitleText,
        anchorX,
        titleY + fittedSub.fontPx * 1.45,
        fittedSub.spacingPx,
        align
      );
    }

    if (ctaText) {
      const fittedCta = fitSpacedFontSize(
        ctx,
        ctaText.toUpperCase(),
        '700',
        uiFont,
        Math.round(subtitlePx * 0.88),
        0.16,
        safeContentWidth * 0.85,
        9
      );
      ctx.font = `700 ${fittedCta.fontPx}px ${uiFont}`;
      const ctaW = Math.min(safeContentWidth, fittedCta.textWidth + ctaHeight * 1.35);
      const ctaX =
        align === 'center'
          ? anchorX - ctaW / 2
          : align === 'right'
            ? anchorX - ctaW
            : anchorX;

      ctx.fillStyle = config.accentColor;
      drawRoundedRectPath(ctx, ctaX, ctaY, ctaW, ctaHeight, 8);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'middle';
      drawSpacedText(
        ctx,
        ctaText.toUpperCase(),
        ctaX + ctaW / 2,
        ctaY + ctaHeight / 2 + 1,
        fittedCta.spacingPx,
        'center'
      );
    }
  } else if (optionId === 'minimal-vignette') {
    const rad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.45,
      Math.min(width, height) * 0.18,
      width * 0.5,
      height * 0.48,
      Math.max(width, height) * 0.72
    );
    rad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    rad.addColorStop(1, `rgba(4, 6, 10, ${Math.min(0.95, scrimAlpha * 1.15)})`);
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, width, height);

    const align = config.align === 'auto' ? 'center' : config.align;
    const anchorX =
      align === 'center' ? width / 2 : align === 'right' ? width - paddingPx : paddingPx;

    if (badgeText) {
      const fittedBadge = fitSpacedFontSize(
        ctx,
        badgeText.toUpperCase(),
        '600',
        uiFont,
        metaPx,
        0.34,
        safeContentWidth,
        9
      );
      ctx.font = `600 ${fittedBadge.fontPx}px ${uiFont}`;
      ctx.fillStyle = 'rgba(248, 250, 252, 0.78)';
      ctx.textBaseline = 'top';
      drawSpacedText(
        ctx,
        badgeText.toUpperCase(),
        anchorX,
        paddingPx,
        fittedBadge.spacingPx,
        align
      );
    }

    const fittedTitle = fitSpacedFontSize(
      ctx,
      titleText,
      '700',
      titleFont,
      Math.round(titlePx * 0.96),
      config.letterSpacing * 1.1,
      safeContentWidth
    );
    const minTitleY =
      paddingPx +
      (badgeText ? metaPx * 2.2 : 0) +
      (subtitleText ? subtitlePx * 1.5 + fittedTitle.fontPx * 0.3 : 0) +
      fittedTitle.fontPx;
    const maxTitleY = height - paddingPx;
    const titleY =
      config.titleY === null
        ? maxTitleY
        : computeVerticalPositionY(minTitleY, maxTitleY, config.titleY);

    ctx.font = `700 ${fittedTitle.fontPx}px ${titleFont}`;
    ctx.fillStyle = config.textColor;
    ctx.textBaseline = 'bottom';
    applyShadow(fittedTitle.fontPx);
    drawSpacedText(ctx, titleText, anchorX, titleY, fittedTitle.spacingPx, align);
    clearShadow();

    if (subtitleText) {
      const fittedSub = fitSpacedFontSize(
        ctx,
        subtitleText,
        '500',
        uiFont,
        subtitlePx,
        0.22,
        safeContentWidth,
        10
      );
      ctx.font = `500 ${fittedSub.fontPx}px ${uiFont}`;
      ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
      ctx.textBaseline = 'bottom';
      drawSpacedText(
        ctx,
        subtitleText,
        anchorX,
        titleY - fittedTitle.fontPx * 1.45,
        fittedSub.spacingPx,
        align
      );
    }
  } else if (optionId === 'framed-showcase') {
    const scrim = ctx.createLinearGradient(0, 0, 0, height);
    scrim.addColorStop(0, `rgba(8, 10, 15, ${scrimAlpha * 0.55})`);
    scrim.addColorStop(0.45, `rgba(8, 10, 15, ${scrimAlpha * 0.15})`);
    scrim.addColorStop(1, `rgba(8, 10, 15, ${Math.min(0.95, scrimAlpha * 1.1)})`);
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, width, height);

    const frameInset = Math.round(paddingPx * 0.58);
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.28)';
    ctx.lineWidth = Math.max(1.5, Math.round(Math.min(width, height) * 0.0022));
    ctx.strokeRect(
      frameInset,
      frameInset,
      width - frameInset * 2,
      height - frameInset * 2
    );

    const innerPad = frameInset + Math.round(paddingPx * 0.55);
    const innerContentWidth = Math.max(100, width - innerPad * 2);
    const align = config.align === 'auto' ? 'left' : config.align;
    const anchorX =
      align === 'center' ? width / 2 : align === 'right' ? width - innerPad : innerPad;

    if (badgeText) {
      const fittedBadge = fitSpacedFontSize(
        ctx,
        badgeText.toUpperCase(),
        '700',
        uiFont,
        metaPx,
        0.22,
        innerContentWidth * 0.8,
        9
      );
      ctx.font = `700 ${fittedBadge.fontPx}px ${uiFont}`;
      ctx.fillStyle = config.textColor;
      ctx.textBaseline = 'top';
      drawSpacedText(
        ctx,
        badgeText.toUpperCase(),
        innerPad,
        innerPad,
        fittedBadge.spacingPx,
        'left'
      );
    }

    if (config.showEmblem) {
      const topEmblemSize = Math.round(titlePx * 0.68);
      drawEmblem(
        ctx,
        config.emblemStyle,
        width - innerPad - topEmblemSize * 0.35,
        innerPad + topEmblemSize * 0.35,
        topEmblemSize,
        config.textColor,
        config.accentColor
      );
    }

    const fittedFooter = footerText
      ? fitSpacedFontSize(
          ctx,
          footerText,
          '500',
          uiFont,
          metaPx,
          0.12,
          innerContentWidth,
          9
        )
      : null;
    const fittedTitle = fitSpacedFontSize(
      ctx,
      titleText,
      '700',
      titleFont,
      titlePx,
      config.letterSpacing * 0.85,
      innerContentWidth
    );

    const minTitleY =
      innerPad +
      (badgeText || config.showEmblem ? Math.max(metaPx * 2.2, titlePx * 0.72) : 0) +
      (subtitleText ? subtitlePx * 1.45 + fittedTitle.fontPx * 0.3 : 0) +
      fittedTitle.fontPx;
    const maxTitleY = height - innerPad - (fittedFooter ? fittedFooter.fontPx * 1.9 : 0);
    const titleY =
      config.titleY === null
        ? maxTitleY
        : computeVerticalPositionY(minTitleY, maxTitleY, config.titleY);

    ctx.font = `700 ${fittedTitle.fontPx}px ${titleFont}`;
    ctx.fillStyle = config.textColor;
    ctx.textBaseline = 'bottom';
    applyShadow(fittedTitle.fontPx);
    drawSpacedText(ctx, titleText, anchorX, titleY, fittedTitle.spacingPx, align);
    clearShadow();

    if (subtitleText) {
      const fittedSub = fitSpacedFontSize(
        ctx,
        subtitleText,
        '600',
        uiFont,
        subtitlePx,
        0.18,
        innerContentWidth,
        10
      );
      ctx.font = `600 ${fittedSub.fontPx}px ${uiFont}`;
      ctx.fillStyle = config.accentColor;
      ctx.textBaseline = 'bottom';
      drawSpacedText(
        ctx,
        subtitleText,
        anchorX,
        titleY - fittedTitle.fontPx * 1.38,
        fittedSub.spacingPx,
        align
      );
    }

    if (fittedFooter && footerText) {
      ctx.font = `500 ${fittedFooter.fontPx}px ${uiFont}`;
      ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
      ctx.textBaseline = 'bottom';
      drawSpacedText(
        ctx,
        footerText,
        anchorX,
        height - innerPad,
        fittedFooter.spacingPx,
        align
      );
    }
  } else if (optionId === 'monumental-waypoint') {
    // Reference 2 inspired: Monumental top header + dark left vignette + tactical map waypoint pin
    const topScrim = ctx.createLinearGradient(0, 0, 0, height);
    topScrim.addColorStop(0, `rgba(5, 7, 11, ${Math.min(0.92, scrimAlpha)})`);
    topScrim.addColorStop(0.38, 'rgba(5, 7, 11, 0.12)');
    topScrim.addColorStop(1, `rgba(5, 7, 11, ${Math.min(0.92, scrimAlpha * 0.95)})`);
    ctx.fillStyle = topScrim;
    ctx.fillRect(0, 0, width, height);

    const fittedTitle = fitSpacedFontSize(
      ctx,
      titleText.toUpperCase(),
      '800',
      titleFont,
      Math.round(titlePx * 1.15),
      Math.max(0.12, config.letterSpacing),
      safeContentWidth
    );
    const minTitleY = Math.round(paddingPx * 0.72);
    const maxTitleY = Math.max(minTitleY, height - paddingPx - fittedTitle.fontPx);
    const titlePosY =
      config.titleY === null
        ? minTitleY
        : computeVerticalPositionY(minTitleY, maxTitleY, config.titleY);

    ctx.font = `800 ${fittedTitle.fontPx}px ${titleFont}`;
    ctx.fillStyle = config.textColor;
    ctx.textBaseline = 'top';
    applyShadow(fittedTitle.fontPx);
    drawSpacedText(
      ctx,
      titleText.toUpperCase(),
      width / 2,
      titlePosY,
      fittedTitle.spacingPx,
      'center'
    );
    clearShadow();

    // Subtle map contour lines in bottom-left corner
    const pinX = paddingPx + Math.round(Math.min(width, height) * 0.08);
    const pinY = height - paddingPx - Math.round(Math.min(width, height) * 0.06);

    ctx.save();
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.16)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    [1, 1.8, 2.6].forEach((mult) => {
      ctx.beginPath();
      ctx.arc(pinX, pinY, Math.round(metaPx * 2.2 * mult), 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.restore();

    // Glowing waypoint pin
    ctx.fillStyle = hexToRgba(config.accentColor, 0.28);
    ctx.beginPath();
    ctx.arc(pinX, pinY, metaPx * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = config.accentColor;
    ctx.beginPath();
    ctx.arc(pinX, pinY, metaPx * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Connector line up to waypoint text
    const infoX = pinX + metaPx * 2.4;
    const infoY = pinY - metaPx * 2.8;
    ctx.strokeStyle = hexToRgba(config.accentColor, 0.65);
    ctx.lineWidth = Math.max(1.2, Math.round(width * 0.0014));
    ctx.beginPath();
    ctx.moveTo(pinX, pinY - metaPx * 0.6);
    ctx.lineTo(pinX, infoY + metaPx * 0.6);
    ctx.lineTo(infoX - metaPx * 0.5, infoY + metaPx * 0.6);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `700 ${metaPx}px ${uiFont}`;
    ctx.fillStyle = config.textColor;
    ctx.fillText(
      badgeText ? badgeText.toUpperCase() : 'TITIK KOORDINAT',
      infoX,
      infoY,
      safeContentWidth * 0.65
    );

    if (subtitleText) {
      ctx.font = `500 ${Math.round(subtitlePx * 0.92)}px ${uiFont}`;
      ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
      ctx.fillText(
        subtitleText,
        infoX,
        infoY + metaPx * 1.45,
        safeContentWidth * 0.65
      );
    }

    if (footerText) {
      ctx.font = `500 ${Math.round(metaPx * 0.9)}px ${uiFont}`;
      ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
      ctx.fillText(
        footerText,
        infoX,
        infoY + metaPx * 1.45 + subtitlePx * 1.35,
        safeContentWidth * 0.65
      );
    }
  } else {
    // Opsi 06 — Judul Bertingkat: tipografi display berundak ala key art indie
    // (baris judul bertangga, huruf awal kata membesar, garis ornamen, tinta bertekstur).
    const isPortrait = height > width;
    const words = titleText.toUpperCase().split(/\s+/).filter(Boolean);
    const lineCount = Math.max(1, Math.min(3, words.length));

    // Bagi kata ke maksimal 3 baris dengan panjang seimbang.
    const titleLines: string[][] = [];
    {
      const totalChars = words.reduce((a, w) => a + w.length, 0) + words.length - 1;
      const target = totalChars / lineCount;
      let current: string[] = [];
      let len = 0;
      words.forEach((word, idx) => {
        const remainingWords = words.length - idx;
        const linesAfterCurrent = lineCount - titleLines.length - 1;
        const mustBreak = current.length > 0 && remainingWords <= linesAfterCurrent;
        const wantBreak =
          current.length > 0 && linesAfterCurrent > 0 && len + 1 + word.length > target + 1;
        if (mustBreak || wantBreak) {
          titleLines.push(current);
          current = [word];
          len = word.length;
        } else {
          current.push(word);
          len += (current.length > 1 ? 1 : 0) + word.length;
        }
      });
      if (current.length > 0) titleLines.push(current);
    }

    const capRatio = 1.3;
    const measureTitleLine = (lineWords: string[], px: number, spacing: number) => {
      let total = 0;
      lineWords.forEach((word, wi) => {
        const chars = Array.from(word);
        ctx.font = `700 ${Math.round(px * capRatio)}px ${titleFont}`;
        total += ctx.measureText(chars[0]).width;
        ctx.font = `700 ${px}px ${titleFont}`;
        chars.slice(1).forEach((ch) => {
          total += ctx.measureText(ch).width;
        });
        total += spacing * (chars.length - 1);
        if (wi < lineWords.length - 1) total += ctx.measureText(' ').width + spacing * 2;
      });
      return total;
    };
    const drawTitleLine = (
      target: CanvasRenderingContext2D,
      lineWords: string[],
      x: number,
      baseline: number,
      px: number,
      spacing: number
    ) => {
      let cx = x;
      target.textAlign = 'left';
      target.textBaseline = 'alphabetic';
      lineWords.forEach((word, wi) => {
        const chars = Array.from(word);
        target.font = `700 ${Math.round(px * capRatio)}px ${titleFont}`;
        target.fillText(chars[0], cx, baseline);
        cx += target.measureText(chars[0]).width + spacing;
        target.font = `700 ${px}px ${titleFont}`;
        chars.slice(1).forEach((ch) => {
          target.fillText(ch, cx, baseline);
          cx += target.measureText(ch).width + spacing;
        });
        if (wi < lineWords.length - 1) cx += target.measureText(' ').width + spacing;
      });
    };

    // Ukuran judul: sebesar mungkin selama blok bertangga muat.
    const maxBlockW = safeContentWidth * (isPortrait ? 0.94 : 0.64);
    const spacingRatio = config.letterSpacing * 0.35;
    let fontPx = Math.round(titlePx * (lineCount > 1 ? 1.3 : 1.1));
    let lineWidths: number[] = [];
    let blockW = 0;
    for (let guard = 0; guard < 40; guard++) {
      const sp = fontPx * spacingRatio;
      lineWidths = titleLines.map((l) => measureTitleLine(l, fontPx, sp));
      const staggerPad = lineCount > 1 ? fontPx * 0.9 : 0;
      blockW = Math.max(...lineWidths) + staggerPad;
      if (blockW <= maxBlockW || fontPx <= 14) break;
      fontPx = Math.max(14, Math.floor(fontPx * 0.93));
    }
    const spacingPx = fontPx * spacingRatio;

    // Metrik vertikal — lineAdvance memberi sedikit margin antar baris judul.
    const lineAdvance = fontPx * 1.26;
    const capTop = fontPx * capRatio * 0.74;
    const ruleThick = Math.max(1.5, fontPx * 0.035);
    const ruleGap = fontPx * 0.34;
    const badgeH = badgeText ? metaPx * 2.0 : 0;
    const subGap = fontPx * 0.5;
    const subH = subtitleText ? subtitlePx * 1.2 + subGap : 0;
    const linesH = capTop + (lineCount - 1) * lineAdvance + fontPx * 0.06;
    const blockH = badgeH + ruleThick + ruleGap + linesH + subH;

    const ctaH = ctaText ? Math.max(28, Math.round(subtitlePx * 2)) : 0;
    const bottomReserve = (ctaText ? ctaH + metaPx * 0.9 : 0) + (footerText ? metaPx * 1.8 : 0);
    const minY = paddingPx * 0.9;
    const maxY = Math.max(minY, height - paddingPx - bottomReserve - blockH);
    const blockTop = computeVerticalPositionY(minY, maxY, config.titleY ?? 8);

    const alignMode = config.align === 'auto' ? 'center' : config.align;
    const blockX =
      alignMode === 'left'
        ? paddingPx
        : alignMode === 'right'
          ? width - paddingPx - blockW
          : (width - blockW) / 2;
    const textAlignMode: CanvasTextAlign =
      alignMode === 'left' ? 'left' : alignMode === 'right' ? 'right' : 'center';
    const anchorX =
      alignMode === 'left' ? paddingPx : alignMode === 'right' ? width - paddingPx : width / 2;

    // Cahaya / asap di balik judul agar tinta selalu terbaca.
    const inkRgb = hexToRgba(config.textColor, 1).match(/\d+/g)?.map(Number) ?? [248, 250, 252];
    const inkLum = (0.2126 * inkRgb[0] + 0.7152 * inkRgb[1] + 0.0722 * inkRgb[2]) / 255;
    const inkIsDark = inkLum < 0.45;
    ctx.save();
    ctx.translate(blockX + blockW / 2, blockTop + blockH / 2);
    ctx.scale(blockW * 0.78, blockH * 0.95);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    if (inkIsDark) {
      glow.addColorStop(0, `rgba(255, 244, 222, ${(0.85 * scrimAlpha).toFixed(3)})`);
      glow.addColorStop(0.55, `rgba(255, 236, 205, ${(0.45 * scrimAlpha).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(255, 236, 205, 0)');
    } else {
      glow.addColorStop(0, `rgba(5, 7, 11, ${(0.7 * scrimAlpha).toFixed(3)})`);
      glow.addColorStop(0.6, `rgba(5, 7, 11, ${(0.38 * scrimAlpha).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(5, 7, 11, 0)');
    }
    ctx.fillStyle = glow;
    ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
    ctx.restore();

    if (ctaText || footerText) {
      const bottomScrim = ctx.createLinearGradient(0, height * 0.72, 0, height);
      bottomScrim.addColorStop(0, 'rgba(5, 7, 11, 0)');
      bottomScrim.addColorStop(1, `rgba(5, 7, 11, ${(0.65 * scrimAlpha).toFixed(3)})`);
      ctx.fillStyle = bottomScrim;
      ctx.fillRect(0, height * 0.72, width, height * 0.28);
    }

    const ruleTop = blockTop + badgeH;
    const ruleY = ruleTop + ruleThick / 2;
    const ruleX0 = blockX - fontPx * 0.12;
    const ruleX1 =
      blockX + (lineCount > 1 ? Math.max(lineWidths[0], blockW * 0.7) + fontPx * 0.1 : blockW);
    let lastBaseline = ruleTop + ruleThick + ruleGap + capTop;

    // Gambar tinta (badge, garis ornamen, judul, subjudul) ke buffer agar bisa diberi tekstur usang.
    const inkBuf = document.createElement('canvas');
    inkBuf.width = width;
    inkBuf.height = height;
    const ictx = inkBuf.getContext('2d');
    if (ictx) {
      if (badgeText) {
        ictx.font = `700 ${metaPx}px ${uiFont}`;
        ictx.textBaseline = 'top';
        ictx.fillStyle = config.accentColor;
        drawSpacedText(ictx, badgeText.toUpperCase(), anchorX, blockTop, metaPx * 0.3, textAlignMode);
      }

      ictx.fillStyle = config.textColor;
      ictx.fillRect(ruleX0, ruleTop, ruleX1 - ruleX0, ruleThick);
      const d = fontPx * 0.1;
      ictx.beginPath();
      ictx.moveTo(ruleX0 - d * 1.7, ruleY);
      ictx.lineTo(ruleX0, ruleY - d * 0.6);
      ictx.lineTo(ruleX0 + d * 1.7, ruleY);
      ictx.lineTo(ruleX0, ruleY + d * 0.6);
      ictx.closePath();
      ictx.fill();
      ictx.beginPath();
      ictx.arc(ruleX1, ruleY, ruleThick * 1.3, 0, Math.PI * 2);
      ictx.fill();

      let baseline = lastBaseline;
      titleLines.forEach((lw, i) => {
        const xOff =
          lineCount > 1
            ? (blockW - lineWidths[i]) * (i / (lineCount - 1))
            : (blockW - lineWidths[i]) / 2;
        drawTitleLine(ictx, lw, blockX + xOff, baseline, fontPx, spacingPx);
        if (i < lineCount - 1) baseline += lineAdvance;
      });
      lastBaseline = baseline;

      // Tekstur tinta usang: bintik & goresan kecil dihapus dari huruf (acak deterministik).
      ictx.globalCompositeOperation = 'destination-out';
      let seed = 0x9e3779b9;
      const rnd = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const areaTop = ruleTop - fontPx * 0.1;
      const areaH = lastBaseline - areaTop + fontPx * 0.15;
      const areaX = blockX - fontPx * 0.3;
      const areaW = blockW + fontPx * 0.6;
      const specks = Math.round(((areaW * areaH) / (fontPx * fontPx)) * 70);
      for (let i = 0; i < specks; i++) {
        const r = fontPx * (0.004 + rnd() * rnd() * 0.03);
        ictx.globalAlpha = 0.45 + rnd() * 0.55;
        ictx.beginPath();
        ictx.arc(areaX + rnd() * areaW, areaTop + rnd() * areaH, r, 0, Math.PI * 2);
        ictx.fill();
      }
      for (let i = 0; i < Math.round(lineCount * 6); i++) {
        ictx.globalAlpha = 0.35 + rnd() * 0.4;
        ictx.fillRect(
          areaX + rnd() * areaW,
          areaTop + rnd() * areaH,
          fontPx * (0.1 + rnd() * 0.45),
          Math.max(0.6, fontPx * 0.008)
        );
      }
      ictx.globalAlpha = 1;
      ictx.globalCompositeOperation = 'source-over';

      if (subtitleText) {
        const subPx = Math.round(subtitlePx * 0.9);
        ictx.font = `600 ${subPx}px ${uiFont}`;
        ictx.textBaseline = 'top';
        ictx.globalAlpha = 0.9;
        ictx.fillStyle = config.textColor;
        const subX =
          alignMode === 'left' ? blockX : alignMode === 'right' ? blockX + blockW : blockX + blockW / 2;
        drawSpacedText(
          ictx,
          subtitleText.toUpperCase(),
          subX,
          lastBaseline + subGap,
          subPx * 0.28,
          textAlignMode
        );
        ictx.globalAlpha = 1;
      }

      ctx.save();
      if (inkIsDark) {
        if (config.shadowStrength > 0.02) {
          ctx.shadowColor = `rgba(255, 244, 225, ${(0.55 * config.shadowStrength).toFixed(3)})`;
          ctx.shadowBlur = fontPx * 0.3 * config.shadowStrength;
        }
      } else {
        applyShadow(fontPx);
      }
      ctx.drawImage(inkBuf, 0, 0);
      ctx.restore();
      clearShadow();
    }

    if (config.showEmblem) {
      drawEmblem(
        ctx,
        config.emblemStyle,
        ruleX1 + metaPx * 1.3,
        ruleY,
        metaPx * 1.3,
        config.textColor,
        config.accentColor
      );
    }

    // CTA & footer di bawah.
    let bottomY = height - paddingPx;
    if (footerText) {
      ctx.font = `500 ${Math.round(metaPx * 0.9)}px ${uiFont}`;
      ctx.fillStyle = 'rgba(226, 232, 240, 0.82)';
      ctx.textBaseline = 'bottom';
      ctx.textAlign = textAlignMode;
      ctx.fillText(footerText, anchorX, bottomY, safeContentWidth);
      bottomY -= metaPx * 1.8;
    }

    if (ctaText) {
      const fittedCta = fitSpacedFontSize(
        ctx,
        ctaText.toUpperCase(),
        '700',
        uiFont,
        Math.round(metaPx * 0.95),
        0.16,
        safeContentWidth * 0.6,
        9
      );
      const ctaW = fittedCta.textWidth + ctaH * 1.4;
      const ctaX =
        alignMode === 'left' ? anchorX : alignMode === 'right' ? anchorX - ctaW : anchorX - ctaW / 2;
      const ctaY = bottomY - ctaH;

      ctx.fillStyle = config.accentColor;
      drawRoundedRectPath(ctx, ctaX, ctaY, ctaW, ctaH, ctaH / 2);
      ctx.fill();

      ctx.font = `700 ${fittedCta.fontPx}px ${uiFont}`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'middle';
      drawSpacedText(
        ctx,
        ctaText.toUpperCase(),
        ctaX + ctaW / 2,
        ctaY + ctaH / 2 + 1,
        fittedCta.spacingPx,
        'center'
      );
    }
  }

  // Subtle tactile rim highlight for rounded credit-card mockups
  if (cornerRadiusPx > 0) {
    const strokeInset = Math.max(1, Math.round(Math.min(width, height) * 0.0014));
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = strokeInset * 2;
    drawRoundedRectPath(
      ctx,
      strokeInset,
      strokeInset,
      width - strokeInset * 2,
      height - strokeInset * 2,
      Math.max(0, cornerRadiusPx - strokeInset)
    );
    ctx.stroke();
  }
  ctx.restore();
}

export function exportCanvasAsImage(
  canvas: HTMLCanvasElement,
  filename: string,
  format: ExportFormat = 'png',
  jpgQuality = 0.92
): void {
  let dataUrl: string;
  if (format === 'jpg') {
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const octx = offscreen.getContext('2d');
    if (octx) {
      octx.fillStyle = '#0B0D11';
      octx.fillRect(0, 0, offscreen.width, offscreen.height);
      octx.drawImage(canvas, 0, 0);
      dataUrl = offscreen.toDataURL('image/jpeg', jpgQuality);
    } else {
      dataUrl = canvas.toDataURL('image/jpeg', jpgQuality);
    }
  } else {
    dataUrl = canvas.toDataURL('image/png');
  }

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
  exportCanvasAsImage(canvas, filename, 'png');
}
