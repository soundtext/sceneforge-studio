import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TEXT_CONFIG,
  EDGE_EFFECT_PRESETS,
  MOCKUP_OPTIONS,
  SIZE_PRESETS,
  SceneAsset,
  computeCornerRadiusPx,
  computeCoverCrop,
  computeTypographyScale,
  computeVerticalPositionY,
  deleteSceneFromGallery,
  getDefaultTitleYPercent,
  normalizeDimensions,
} from './mockupPresets';

test('provides 6 distinct mockup options (excluding removed 02, 05, 06, 08) and 6 size presets including credit card', () => {
  assert.equal(MOCKUP_OPTIONS.length, 6);
  assert.equal(MOCKUP_OPTIONS.filter((o) => o.group === 'classic').length, 4);
  assert.equal(MOCKUP_OPTIONS.filter((o) => o.group === 'reference').length, 2);
  assert.equal(SIZE_PRESETS.length, 6);
  const ids = new Set(MOCKUP_OPTIONS.map((o) => o.id));
  assert.equal(ids.size, 6);
  assert.equal(ids.has('editorial-poster' as never), false);
  assert.equal(ids.has('vertical-stripe-split' as never), false);
  assert.equal(ids.has('backdrop-type-spotlight' as never), false);
  assert.equal(ids.has('top-title-lore-card' as never), false);

  assert.equal(DEFAULT_TEXT_CONFIG.showEmblem, false);
  assert.equal(DEFAULT_TEXT_CONFIG.titleY, null);
  assert.equal(computeVerticalPositionY(100, 900, 0), 100);
  assert.equal(computeVerticalPositionY(100, 900, 50), 500);
  assert.equal(computeVerticalPositionY(100, 900, 100), 900);
  assert.equal(computeVerticalPositionY(100, 900, 150), 900);
  assert.equal(getDefaultTitleYPercent('key-art'), 100);
  assert.equal(getDefaultTitleYPercent('monumental-waypoint'), 0);

  const effectIds = new Set(EDGE_EFFECT_PRESETS.map((e) => e.id));
  assert.equal(effectIds.has('lens-flare' as never), false);
  assert.equal(effectIds.has('teal-orange' as never), false);
  assert.equal(effectIds.has('bokeh' as never), false);
  assert.equal(effectIds.has('light-trails' as never), false);
  assert.equal(effectIds.has('motion-echo' as never), false);
  assert.equal(EDGE_EFFECT_PRESETS.length, 8);
  assert.ok(effectIds.has('none'));
  assert.ok(effectIds.has('motion-blur'));
  assert.ok(effectIds.has('chromatic-vignette'));
  assert.ok(effectIds.has('rgb-separation'));
  assert.ok(effectIds.has('prism-distortion'));
  assert.ok(effectIds.has('directional-motion-blur'));
  assert.ok(effectIds.has('directional-blur'));
  assert.ok(effectIds.has('glitch-displacement'));

  const cardPreset = SIZE_PRESETS.find((s) => s.id === 'credit-card');
  assert.ok(cardPreset);
  const aspect = cardPreset.width / cardPreset.height;
  assert.ok(Math.abs(aspect - 85.6 / 53.98) < 0.002);
  assert.equal(
    computeCornerRadiusPx(cardPreset.width, cardPreset.height, cardPreset.cornerRadiusRatio),
    64
  );
  assert.equal(computeCornerRadiusPx(1920, 1080, 0), 0);
});

test('computeCoverCrop crops horizontally when source is wider than destination', () => {
  const centerCrop = computeCoverCrop(1920, 1080, 1080, 1080, 50, 50);
  assert.equal(centerCrop.sWidth, 1080);
  assert.equal(centerCrop.sHeight, 1080);
  assert.equal(centerCrop.sx, 420);
  assert.equal(centerCrop.sy, 0);

  const leftCrop = computeCoverCrop(1920, 1080, 1080, 1080, 0, 50);
  assert.equal(leftCrop.sx, 0);
});

test('computeCoverCrop crops vertically when source is taller than destination', () => {
  const crop = computeCoverCrop(1000, 1000, 1920, 1080, 50, 50);
  assert.equal(crop.sWidth, 1000);
  assert.equal(Math.round(crop.sHeight), 563);
  assert.equal(crop.sx, 0);
  assert.ok(crop.sy > 200 && crop.sy < 230);
});

test('normalizeDimensions clamps within safe custom range and handles invalid inputs', () => {
  assert.deepEqual(normalizeDimensions(1920.4, 1080.6), { width: 1920, height: 1081 });
  assert.deepEqual(normalizeDimensions(50, 9000), { width: 120, height: 4096 });
  assert.deepEqual(normalizeDimensions(Number.NaN, 720), { width: 1920, height: 720 });
});

test('computeTypographyScale scales proportionally across canvas dimensions', () => {
  const hd = computeTypographyScale(1920, 1080, 1.0);
  const square = computeTypographyScale(1080, 1080, 1.0);
  const scaledUp = computeTypographyScale(1080, 1080, 1.5);
  assert.equal(hd.titlePx, square.titlePx);
  assert.ok(scaledUp.titlePx > square.titlePx);
  assert.ok(hd.paddingPx >= 28);
});

test('deleteSceneFromGallery removes target and selects fallback active scene safely', () => {
  const sample: SceneAsset[] = [
    { id: 'a', name: 'A', source: 'preset', dataUrl: 'x', width: 100, height: 100, createdAt: '1' },
    { id: 'b', name: 'B', source: 'preset', dataUrl: 'y', width: 100, height: 100, createdAt: '2' },
    { id: 'c', name: 'C', source: 'preset', dataUrl: 'z', width: 100, height: 100, createdAt: '3' },
  ];

  // Deleting inactive keeps current active
  const r1 = deleteSceneFromGallery(sample, 'a', 'c');
  assert.equal(r1.nextScenes.length, 2);
  assert.equal(r1.nextActiveId, 'a');

  // Deleting active falls back to neighbor
  const r2 = deleteSceneFromGallery(sample, 'b', 'b');
  assert.equal(r2.nextScenes.length, 2);
  assert.equal(r2.nextActiveId, 'c');

  // Deleting last remaining leaves empty string active ID
  const r3 = deleteSceneFromGallery([sample[0]], 'a', 'a');
  assert.equal(r3.nextScenes.length, 0);
  assert.equal(r3.nextActiveId, '');
});
