import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractHtmlTitle,
  extractStaticAssetsFromHtml,
  injectCaptureBridge,
  validateHtmlFile,
} from './htmlSceneParser';

test('validateHtmlFile accepts valid html/htm and rejects invalid extensions or empty files', () => {
  assert.equal(validateHtmlFile('game.html', 2048, '<html><body></body></html>').valid, true);
  assert.equal(validateHtmlFile('scene.HTM', 120, '<canvas></canvas>').valid, true);

  const wrongExt = validateHtmlFile('image.png', 2048, 'binary');
  assert.equal(wrongExt.valid, false);
  assert.ok(wrongExt.error?.includes('.html'));

  const emptyFile = validateHtmlFile('empty.html', 0, '   ');
  assert.equal(emptyFile.valid, false);
});

test('extractHtmlTitle reads title cleanly with fallback', () => {
  assert.equal(extractHtmlTitle('<html><head><title>  Scarlet   Veil </title></head></html>'), 'Scarlet Veil');
  assert.equal(extractHtmlTitle('<html><body>No title</body></html>'), 'Scene Game HTML');
});

test('extractStaticAssetsFromHtml extracts embedded data URI images and large inline SVGs', () => {
  const fakeBase64 = 'A'.repeat(240);
  const html = `
    <html>
      <body>
        <img src="data:image/png;base64,${fakeBase64}" />
        <svg viewBox="0 0 800 600">
          <rect width="800" height="600" fill="#111827" />
          <circle cx="400" cy="300" r="140" fill="#e11d48" />
          <path d="M0 500 L300 280 L600 450 L800 220 L800 600 Z" fill="#0f172a" />
        </svg>
      </body>
    </html>
  `;
  const assets = extractStaticAssetsFromHtml(html);
  assert.equal(assets.length, 2);
  assert.equal(assets[0].kind, 'data-uri');
  assert.equal(assets[1].kind, 'inline-svg');
  assert.ok(assets[1].dataUrl.startsWith('data:image/svg+xml;charset=utf-8,'));
});

test('injectCaptureBridge injects bridge script into head or wraps fragments', () => {
  const fullDoc = '<!doctype html><html><head><title>G</title></head><body><canvas></canvas></body></html>';
  const injected = injectCaptureBridge(fullDoc);
  assert.ok(injected.includes('data-sceneforge-bridge="1"'));
  assert.ok(injected.includes('preserveDrawingBuffer: true'));
  assert.ok(injected.includes('SCENEFORGE_WAIT_AND_CAPTURE'));
  assert.ok(injected.includes('isCanvasRendered'));
  assert.ok(injected.includes('captureCanvasesToDataUrl'));

  const noHeadWithScript = '<html><body><canvas id="game"></canvas><script>console.log("boot");</script></body></html>';
  const injectedEarly = injectCaptureBridge(noHeadWithScript);
  assert.ok(
    injectedEarly.indexOf('data-sceneforge-bridge="1"') <
      injectedEarly.indexOf('<script>console.log("boot")')
  );

  const fragment = '<canvas id="c"></canvas>';
  const wrapped = injectCaptureBridge(fragment);
  assert.ok(wrapped.includes('<!doctype html>'));
  assert.ok(wrapped.includes('SCENEFORGE_CAPTURE'));
  assert.ok(wrapped.includes('SCENEFORGE_PREPARE_CLEAN_FRAME'));
  assert.ok(wrapped.includes('SCENEFORGE_CLEAN_FRAME_READY'));
  assert.ok(wrapped.includes('SCENEFORGE_RESTORE_FRAME'));
  assert.ok(wrapped.includes('origFillText'));
  assert.ok(wrapped.includes('origStrokeText'));
});

