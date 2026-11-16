export interface ExtractedHtmlAsset {
  id: string;
  name: string;
  kind: 'data-uri' | 'inline-svg';
  dataUrl: string;
}

export interface HtmlValidationResult {
  valid: boolean;
  error?: string;
}

const MAX_HTML_BYTES = 15 * 1024 * 1024; // 15 MB

export function validateHtmlFile(
  fileName: string,
  sizeBytes: number,
  content: string
): HtmlValidationResult {
  const lower = fileName.trim().toLowerCase();
  if (!lower.endsWith('.html') && !lower.endsWith('.htm')) {
    return {
      valid: false,
      error: 'Format file harus berupa .html atau .htm.',
    };
  }
  if (sizeBytes <= 0 || !content.trim()) {
    return {
      valid: false,
      error: 'File HTML kosong dan tidak memiliki konten scene.',
    };
  }
  if (sizeBytes > MAX_HTML_BYTES) {
    return {
      valid: false,
      error: 'Ukuran file HTML melebihi batas 15 MB.',
    };
  }
  return { valid: true };
}

export function extractHtmlTitle(htmlContent: string): string {
  const match = htmlContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return 'Scene Game HTML';
  const cleaned = match[1].replace(/\s+/g, ' ').trim();
  return cleaned || 'Scene Game HTML';
}

/**
 * Extracts embedded data:image/* URIs and standalone <svg> blocks directly from HTML source.
 */
export function extractStaticAssetsFromHtml(htmlContent: string): ExtractedHtmlAsset[] {
  const assets: ExtractedHtmlAsset[] = [];
  const seen = new Set<string>();

  // 1. Embedded raster data URIs (png, jpeg, webp, gif)
  const dataUriRegex = /data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+/gi;
  const dataMatches = htmlContent.match(dataUriRegex) ?? [];
  for (let i = 0; i < dataMatches.length; i++) {
    const uri = dataMatches[i];
    // Skip tiny 1x1 tracking pixels
    if (uri.length < 180 || seen.has(uri)) continue;
    seen.add(uri);
    assets.push({
      id: `embedded-img-${assets.length + 1}`,
      name: `Aset Gambar ${assets.length + 1}`,
      kind: 'data-uri',
      dataUrl: uri,
    });
    if (assets.length >= 16) break;
  }

  // 2. Large inline SVGs (>= 120 chars, likely scene/illustration graphics rather than tiny icons)
  const svgRegex = /<svg\b[^>]*>[\s\S]*?<\/svg>/gi;
  let svgMatch: RegExpExecArray | null;
  let svgIndex = 1;
  while ((svgMatch = svgRegex.exec(htmlContent)) !== null) {
    const rawSvg = svgMatch[0];
    if (rawSvg.length < 220) continue;
    const withXmlns = rawSvg.includes('xmlns=')
      ? rawSvg
      : rawSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withXmlns)}`;
    if (seen.has(encoded)) continue;
    seen.add(encoded);
    assets.push({
      id: `embedded-svg-${svgIndex}`,
      name: `Grafis SVG ${svgIndex}`,
      kind: 'inline-svg',
      dataUrl: encoded,
    });
    svgIndex += 1;
    if (assets.length >= 20) break;
  }

  return assets;
}

/**
 * Injects a non-intrusive bridge script into uploaded HTML so the parent studio
 * can detect canvases, force WebGL preserveDrawingBuffer, and capture live frames
 * via window.postMessage without cross-origin tainting.
 */
export function injectCaptureBridge(htmlContent: string): string {
  const bridgeScript = `
<script data-sceneforge-bridge="1">
(function() {
  try {
    var origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, attrs) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
        var nextAttrs = Object.assign({}, attrs || {}, { preserveDrawingBuffer: true });
        return origGetContext.call(this, type, nextAttrs);
      }
      return origGetContext.apply(this, arguments);
    };
  } catch (e) {}

  var activeWaitToken = 0;
  var suppressCanvasText = false;
  var hasCanvasTextDraw = false;
  var canvasRedrawCount = 0;

  try {
    var c2dProto = window.CanvasRenderingContext2D && window.CanvasRenderingContext2D.prototype;
    if (c2dProto) {
      var origFillText = c2dProto.fillText;
      var origStrokeText = c2dProto.strokeText;
      var origClearRect = c2dProto.clearRect;
      var origFillRect = c2dProto.fillRect;
      var origDrawImage = c2dProto.drawImage;
      var origPutImageData = c2dProto.putImageData;

      if (typeof origFillText === 'function') {
        c2dProto.fillText = function() {
          hasCanvasTextDraw = true;
          if (suppressCanvasText) return;
          return origFillText.apply(this, arguments);
        };
      }
      if (typeof origStrokeText === 'function') {
        c2dProto.strokeText = function() {
          hasCanvasTextDraw = true;
          if (suppressCanvasText) return;
          return origStrokeText.apply(this, arguments);
        };
      }
      if (typeof origClearRect === 'function') {
        c2dProto.clearRect = function() {
          canvasRedrawCount += 1;
          return origClearRect.apply(this, arguments);
        };
      }
      if (typeof origFillRect === 'function') {
        c2dProto.fillRect = function() {
          canvasRedrawCount += 1;
          return origFillRect.apply(this, arguments);
        };
      }
      if (typeof origDrawImage === 'function') {
        c2dProto.drawImage = function() {
          canvasRedrawCount += 1;
          return origDrawImage.apply(this, arguments);
        };
      }
      if (typeof origPutImageData === 'function') {
        c2dProto.putImageData = function() {
          canvasRedrawCount += 1;
          return origPutImageData.apply(this, arguments);
        };
      }
    }
  } catch (e) {}

  function isElementVisible(el) {
    if (!el || !el.isConnected) return false;
    try {
      var style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') <= 0) {
        return false;
      }
    } catch (e) {}
    return true;
  }

  function findVisibleCanvases() {
    var canvases = Array.prototype.slice.call(document.querySelectorAll('canvas'));
    var valid = canvases.filter(function(c) {
      return c.width > 0 && c.height > 0 && isElementVisible(c);
    });
    if (!valid.length) {
      valid = canvases.filter(function(c) {
        return c.width > 0 && c.height > 0;
      });
    }
    valid.sort(function(a, b) {
      var ra = a.getBoundingClientRect();
      var rb = b.getBoundingClientRect();
      var areaA = (ra.width > 0 && ra.height > 0) ? (ra.width * ra.height) : (a.width * a.height);
      var areaB = (rb.width > 0 && rb.height > 0) ? (rb.width * rb.height) : (b.width * b.height);
      return areaB - areaA;
    });
    return valid;
  }

  function hasDomVisualContent() {
    if (!document.body) return false;
    if (document.querySelectorAll('svg path, svg rect, svg circle, svg ellipse, svg polygon, svg image').length > 0) {
      return true;
    }
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].complete && imgs[i].naturalWidth > 0 && isElementVisible(imgs[i])) {
        return true;
      }
    }
    var bodyStyle = window.getComputedStyle(document.body);
    if (bodyStyle && bodyStyle.backgroundImage && bodyStyle.backgroundImage !== 'none') {
      return true;
    }
    var divs = document.body.querySelectorAll('div, section, main, article');
    for (var j = 0; j < divs.length; j++) {
      var d = divs[j];
      var r = d.getBoundingClientRect();
      if (r.width >= 32 && r.height >= 32 && isElementVisible(d)) {
        var ds = window.getComputedStyle(d);
        if ((ds.backgroundImage && ds.backgroundImage !== 'none') ||
            (ds.backgroundColor && ds.backgroundColor !== 'rgba(0, 0, 0, 0)' && ds.backgroundColor !== 'transparent')) {
          return true;
        }
      }
    }
    return false;
  }

  function prepareCleanFrame(requestId, isAuto) {
    suppressCanvasText = true;
    var startRedraw = canvasRedrawCount;
    var startTs = Date.now();

    function notifyReady() {
      window.parent.postMessage({
        type: 'SCENEFORGE_CLEAN_FRAME_READY',
        requestId: requestId || null,
        auto: Boolean(isAuto)
      }, '*');
    }

    if (!hasCanvasTextDraw) {
      requestAnimationFrame(notifyReady);
      return;
    }

    function waitRedraw() {
      if (canvasRedrawCount > startRedraw) {
        requestAnimationFrame(notifyReady);
        return;
      }
      if (Date.now() - startTs >= 180) {
        notifyReady();
        return;
      }
      requestAnimationFrame(waitRedraw);
    }

    requestAnimationFrame(waitRedraw);
  }

  function isCanvasRendered(canvas) {
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
      return { ready: false, tainted: false };
    }
    try {
      var sample = document.createElement('canvas');
      sample.width = 24;
      sample.height = 24;
      var sctx = sample.getContext('2d');
      if (!sctx) return { ready: true, tainted: false };
      sctx.drawImage(canvas, 0, 0, 24, 24);
      var data = sctx.getImageData(0, 0, 24, 24).data;

      var nonTransparentCount = 0;
      var firstSig = null;
      var hasVariation = false;
      var hasColoredPixel = false;

      for (var i = 0; i < data.length; i += 4) {
        var r = data[i];
        var g = data[i + 1];
        var b = data[i + 2];
        var a = data[i + 3];
        if (a > 10) {
          nonTransparentCount++;
          var sig = (r >> 3) + ':' + (g >> 3) + ':' + (b >> 3) + ':' + (a >> 4);
          if (firstSig === null) {
            firstSig = sig;
          } else if (sig !== firstSig) {
            hasVariation = true;
            break;
          }
          if (!((r <= 8 && g <= 8 && b <= 8) || (r >= 247 && g >= 247 && b >= 247))) {
            hasColoredPixel = true;
          }
        }
      }

      return {
        ready: nonTransparentCount > 0 && (hasVariation || hasColoredPixel),
        tainted: false
      };
    } catch (err) {
      var msg = err && err.message ? err.message : '';
      var isTainted = (err && err.name === 'SecurityError') || /tainted|cross-origin/i.test(msg);
      return { ready: false, tainted: isTainted, error: msg };
    }
  }

  function captureCanvasesToDataUrl(canvases) {
    var primary = canvases[0];
    if (!primary) return null;

    if (canvases.length === 1) {
      return {
        dataUrl: primary.toDataURL('image/png'),
        width: primary.width,
        height: primary.height
      };
    }

    var primaryRect = primary.getBoundingClientRect();
    var overlapping = canvases.filter(function(c) {
      if (c === primary) return true;
      var r = c.getBoundingClientRect();
      if (primaryRect.width <= 0 || primaryRect.height <= 0 || r.width <= 0 || r.height <= 0) {
        return false;
      }
      var overlapX = Math.max(0, Math.min(primaryRect.right, r.right) - Math.max(primaryRect.left, r.left));
      var overlapY = Math.max(0, Math.min(primaryRect.bottom, r.bottom) - Math.max(primaryRect.top, r.top));
      return (overlapX * overlapY) >= (primaryRect.width * primaryRect.height * 0.25);
    });

    if (overlapping.length <= 1) {
      return {
        dataUrl: primary.toDataURL('image/png'),
        width: primary.width,
        height: primary.height
      };
    }

    var allCanvases = Array.prototype.slice.call(document.querySelectorAll('canvas'));
    overlapping.sort(function(a, b) {
      return allCanvases.indexOf(a) - allCanvases.indexOf(b);
    });

    var comp = document.createElement('canvas');
    comp.width = primary.width;
    comp.height = primary.height;
    var ctx = comp.getContext('2d');
    if (!ctx) {
      return {
        dataUrl: primary.toDataURL('image/png'),
        width: primary.width,
        height: primary.height
      };
    }

    var scaleX = primaryRect.width > 0 ? (primary.width / primaryRect.width) : 1;
    var scaleY = primaryRect.height > 0 ? (primary.height / primaryRect.height) : 1;

    for (var i = 0; i < overlapping.length; i++) {
      var layer = overlapping[i];
      if (layer === primary || primaryRect.width <= 0 || primaryRect.height <= 0) {
        ctx.drawImage(layer, 0, 0, comp.width, comp.height);
      } else {
        var r = layer.getBoundingClientRect();
        var dx = (r.left - primaryRect.left) * scaleX;
        var dy = (r.top - primaryRect.top) * scaleY;
        var dw = r.width * scaleX;
        var dh = r.height * scaleY;
        ctx.drawImage(layer, dx, dy, dw, dh);
      }
    }

    return {
      dataUrl: comp.toDataURL('image/png'),
      width: comp.width,
      height: comp.height
    };
  }

  function findLargestImage() {
    var imgs = Array.prototype.slice.call(document.querySelectorAll('img'));
    imgs = imgs.filter(function(img) {
      return img.complete && img.naturalWidth >= 120 && img.naturalHeight >= 80 && isElementVisible(img);
    });
    if (!imgs.length) return null;
    imgs.sort(function(a, b) {
      return (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight);
    });
    return imgs[0];
  }

  function svgToDataUrl(svgEl) {
    try {
      var clone = svgEl.cloneNode(true);
      if (!clone.getAttribute('xmlns')) {
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }
      var rect = svgEl.getBoundingClientRect();
      if (!clone.getAttribute('width') && rect.width > 0) clone.setAttribute('width', String(Math.round(rect.width)));
      if (!clone.getAttribute('height') && rect.height > 0) clone.setAttribute('height', String(Math.round(rect.height)));
      var serialized = new XMLSerializer().serializeToString(clone);
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized);
    } catch (e) {
      return null;
    }
  }

  function reportSceneStats() {
    var canvasCount = document.querySelectorAll('canvas').length;
    var imgCount = document.querySelectorAll('img').length;
    var svgCount = document.querySelectorAll('svg').length;
    var sceneButtons = Array.prototype.slice.call(document.querySelectorAll('[data-scene]')).map(function(el) {
      return el.getAttribute('data-scene') || el.textContent || 'Scene';
    });
    window.parent.postMessage({
      type: 'SCENEFORGE_READY',
      canvasCount: canvasCount,
      imgCount: imgCount,
      svgCount: svgCount,
      scenes: sceneButtons
    }, '*');
  }

  function executeCapture(requestId, isAuto) {
    try {
      var canvases = findVisibleCanvases();
      if (canvases.length > 0) {
        var result = captureCanvasesToDataUrl(canvases);
        if (result) {
          window.parent.postMessage({
            type: 'SCENEFORGE_CAPTURED',
            ok: true,
            auto: Boolean(isAuto),
            requestId: requestId || null,
            dataUrl: result.dataUrl,
            width: result.width,
            height: result.height,
            sourceKind: 'canvas'
          }, '*');
          return;
        }
      }

      var img = findLargestImage();
      if (img) {
        var off = document.createElement('canvas');
        off.width = img.naturalWidth;
        off.height = img.naturalHeight;
        var ctx = off.getContext('2d');
        ctx.drawImage(img, 0, 0);
        window.parent.postMessage({
          type: 'SCENEFORGE_CAPTURED',
          ok: true,
          auto: Boolean(isAuto),
          requestId: requestId || null,
          dataUrl: off.toDataURL('image/png'),
          width: img.naturalWidth,
          height: img.naturalHeight,
          sourceKind: 'img'
        }, '*');
        return;
      }

      var svgs = Array.prototype.slice.call(document.querySelectorAll('svg'));
      if (svgs.length) {
        svgs.sort(function(a, b) {
          var ra = a.getBoundingClientRect();
          var rb = b.getBoundingClientRect();
          return (rb.width * rb.height) - (ra.width * ra.height);
        });
        var svgUrl = svgToDataUrl(svgs[0]);
        if (svgUrl) {
          var rect = svgs[0].getBoundingClientRect();
          window.parent.postMessage({
            type: 'SCENEFORGE_CAPTURED',
            ok: true,
            auto: Boolean(isAuto),
            requestId: requestId || null,
            dataUrl: svgUrl,
            width: Math.max(800, Math.round(rect.width || 1280)),
            height: Math.max(450, Math.round(rect.height || 720)),
            sourceKind: 'svg'
          }, '*');
          return;
        }
      }

      window.parent.postMessage({
        type: 'SCENEFORGE_CAPTURED',
        ok: false,
        auto: Boolean(isAuto),
        requestId: requestId || null,
        error: 'Tidak ditemukan elemen visual yang dapat ditangkap di scene HTML ini.'
      }, '*');
    } catch (err) {
      window.parent.postMessage({
        type: 'SCENEFORGE_CAPTURED',
        ok: false,
        auto: Boolean(isAuto),
        requestId: requestId || null,
        error: 'Gagal menangkap frame (kemungkinan aset eksternal terhalang CORS): ' + (err && err.message ? err.message : 'Unknown error')
      }, '*');
    }
  }

  function waitForRenderAndCapture(requestId, timeoutMs) {
    activeWaitToken += 1;
    var myToken = activeWaitToken;
    var startTs = Date.now();
    var deadline = startTs + (typeof timeoutMs === 'number' ? timeoutMs : 3500);

    function poll() {
      if (myToken !== activeWaitToken) return;

      reportSceneStats();
      var canvases = findVisibleCanvases();

      if (canvases.length > 0) {
        var check = isCanvasRendered(canvases[0]);
        if (check.tainted) {
          window.parent.postMessage({
            type: 'SCENEFORGE_CAPTURED',
            ok: false,
            auto: true,
            requestId: requestId || null,
            error: 'Gagal menangkap otomatis karena aset gambar eksternal di kanvas terhalang CORS: ' + (check.error || 'SecurityError')
          }, '*');
          return;
        }
        if (check.ready) {
          requestAnimationFrame(function() {
            if (myToken !== activeWaitToken) return;
            prepareCleanFrame(requestId, true);
          });
          return;
        }
      } else if (Date.now() - startTs >= 240 && hasDomVisualContent()) {
        requestAnimationFrame(function() {
          if (myToken !== activeWaitToken) return;
          prepareCleanFrame(requestId, true);
        });
        return;
      }

      if (Date.now() >= deadline) {
        if (canvases.length > 0 || hasDomVisualContent()) {
          prepareCleanFrame(requestId, true);
        } else {
          window.parent.postMessage({
            type: 'SCENEFORGE_CAPTURED',
            ok: false,
            auto: true,
            requestId: requestId || null,
            error: 'Scene HTML belum siap atau masih kosong saat dimuat. Jika game butuh klik Start/Play, jalankan di pratinjau lalu tekan "Ambil Scene Saat Ini".'
          }, '*');
        }
        return;
      }

      setTimeout(poll, 140);
    }

    requestAnimationFrame(poll);
  }

  window.addEventListener('message', function(event) {
    if (!event.data || typeof event.data !== 'object') return;

    if (event.data.type === 'SCENEFORGE_PING') {
      reportSceneStats();
      return;
    }

    if (event.data.type === 'SCENEFORGE_SELECT_SCENE' && event.data.sceneName) {
      var target = document.querySelector('[data-scene="' + event.data.sceneName.replace(/"/g, '') + '"]');
      if (target && typeof target.click === 'function') {
        target.click();
      }
      setTimeout(function() {
        window.parent.postMessage({ type: 'SCENEFORGE_SCENE_CHANGED', sceneName: event.data.sceneName }, '*');
      }, 120);
      return;
    }

    if (event.data.type === 'SCENEFORGE_WAIT_AND_CAPTURE') {
      waitForRenderAndCapture(event.data.requestId, event.data.timeoutMs);
      return;
    }

    if (event.data.type === 'SCENEFORGE_PREPARE_CLEAN_FRAME') {
      activeWaitToken += 1;
      prepareCleanFrame(event.data.requestId, Boolean(event.data.auto));
      return;
    }

    if (event.data.type === 'SCENEFORGE_RESTORE_FRAME') {
      suppressCanvasText = false;
      return;
    }

    if (event.data.type === 'SCENEFORGE_CAPTURE') {
      activeWaitToken += 1;
      executeCapture(event.data.requestId, Boolean(event.data.auto));
    }
  });

  if (document.readyState === 'complete') {
    setTimeout(reportSceneStats, 80);
  } else {
    window.addEventListener('load', function() { setTimeout(reportSceneStats, 80); });
  }
})();
</script>
`;

  if (/<head[^>]*>/i.test(htmlContent)) {
    return htmlContent.replace(/<head[^>]*>/i, (match) => `${match}\n${bridgeScript}`);
  }
  if (/<script\b/i.test(htmlContent)) {
    return htmlContent.replace(/<script\b/i, `${bridgeScript}\n<script`);
  }
  if (/<body[^>]*>/i.test(htmlContent)) {
    return htmlContent.replace(/<body[^>]*>/i, (match) => `${match}\n${bridgeScript}`);
  }
  return `<!doctype html><html><head>${bridgeScript}</head><body>${htmlContent}</body></html>`;
}
