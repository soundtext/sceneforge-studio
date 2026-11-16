import { useEffect, useMemo, useRef } from 'react';
import { MockupOptionId, MockupTextConfig } from '../utils/mockupPresets';
import { renderMockupToCanvas } from '../utils/mockupRenderer';

interface MockupCanvasProps {
  optionId: MockupOptionId;
  width: number;
  height: number;
  cornerRadiusRatio?: number;
  config: MockupTextConfig;
  bgImage: HTMLImageElement | null;
  previewMaxEdge?: number;
  className?: string;
  testId?: string;
}

export function MockupCanvas({
  optionId,
  width,
  height,
  cornerRadiusRatio = 0,
  config,
  bgImage,
  previewMaxEdge = 820,
  className = '',
  testId,
}: MockupCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const renderDims = useMemo(() => {
    const maxDim = Math.max(width, height);
    if (maxDim <= previewMaxEdge) {
      return { w: width, h: height };
    }
    const scale = previewMaxEdge / maxDim;
    return {
      w: Math.max(160, Math.round(width * scale)),
      h: Math.max(160, Math.round(height * scale)),
    };
  }, [width, height, previewMaxEdge]);

  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      if (cancelled || !canvasRef.current) return;
      renderMockupToCanvas(
        canvasRef.current,
        optionId,
        renderDims.w,
        renderDims.h,
        config,
        bgImage,
        cornerRadiusRatio
      );
    };

    draw();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) draw();
      });
    }

    return () => {
      cancelled = true;
    };
  }, [optionId, renderDims.w, renderDims.h, cornerRadiusRatio, config, bgImage]);

  return (
    <canvas
      ref={canvasRef}
      width={renderDims.w}
      height={renderDims.h}
      data-testid={testId}
      aria-label={`Pratinjau mockup ${optionId} ukuran ${width} kali ${height}`}
      className={className}
    />
  );
}
