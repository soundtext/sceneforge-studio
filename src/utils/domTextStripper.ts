const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'META',
  'LINK',
  'HEAD',
  'TITLE',
]);

const CONTROL_TAGS = new Set([
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'OPTION',
  'OPTGROUP',
  'BUTTON',
  'LABEL',
  'FIELDSET',
  'LEGEND',
  'DATALIST',
  'OUTPUT',
  'PROGRESS',
  'METER',
  'DIALOG',
  'FORM',
]);

const TEXT_TAGS = new Set([
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'P',
  'A',
  'SPAN',
  'STRONG',
  'EM',
  'B',
  'I',
  'U',
  'S',
  'MARK',
  'SMALL',
  'SUB',
  'SUP',
  'CODE',
  'PRE',
  'KBD',
  'SAMP',
  'VAR',
  'BLOCKQUOTE',
  'Q',
  'CITE',
  'ABBR',
  'TIME',
  'LI',
  'UL',
  'OL',
  'DL',
  'DT',
  'DD',
  'TABLE',
  'THEAD',
  'TBODY',
  'TFOOT',
  'TR',
  'TH',
  'TD',
  'CAPTION',
  'FIGCAPTION',
  'SUMMARY',
]);

const UI_ROLES = new Set([
  'button',
  'textbox',
  'searchbox',
  'combobox',
  'listbox',
  'option',
  'checkbox',
  'radio',
  'switch',
  'dialog',
  'alertdialog',
  'tooltip',
  'menu',
  'menubar',
  'menuitem',
  'tab',
  'tablist',
  'status',
  'alert',
]);

const SVG_GEOMETRY_SELECTOR =
  'path, rect, circle, ellipse, polygon, polyline, line, image, use';

const SVG_TEXT_TAGS = new Set([
  'text',
  'tspan',
  'textPath',
  'textpath',
  'title',
  'desc',
  'foreignObject',
  'foreignobject',
]);

export interface StylePaintSample {
  display?: string;
  visibility?: string;
  opacity?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  borderTopWidth?: string;
  borderTopStyle?: string;
  borderTopColor?: string;
  borderRightWidth?: string;
  borderRightStyle?: string;
  borderRightColor?: string;
  borderBottomWidth?: string;
  borderBottomStyle?: string;
  borderBottomColor?: string;
  borderLeftWidth?: string;
  borderLeftStyle?: string;
  borderLeftColor?: string;
  boxShadow?: string;
}

export function isTransparentCssColor(color?: string | null): boolean {
  if (!color) return true;
  const normalized = color.trim().toLowerCase();
  if (!normalized || normalized === 'transparent' || normalized === 'none') {
    return true;
  }
  const rgbaMatch = normalized.match(/^rgba?\(([^)]+)\)$/);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(/[,\s/]+/).filter(Boolean);
    if (parts.length >= 4) {
      const alpha = parseFloat(parts[3]);
      if (!Number.isNaN(alpha) && alpha <= 0.005) return true;
    }
  }
  return false;
}

export function hasVisibleBorderSide(
  width?: string | null,
  style?: string | null,
  color?: string | null
): boolean {
  if (!style || style === 'none' || style === 'hidden') return false;
  const px = parseFloat(width || '0');
  if (Number.isNaN(px) || px <= 0) return false;
  return !isTransparentCssColor(color);
}

export function hasVisibleCssPaint(style: StylePaintSample | null | undefined): boolean {
  if (!style) return false;
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (style.opacity !== undefined && parseFloat(style.opacity || '1') <= 0) return false;

  if (!isTransparentCssColor(style.backgroundColor)) return true;
  if (style.backgroundImage && style.backgroundImage !== 'none') return true;
  if (style.boxShadow && style.boxShadow !== 'none') return true;

  if (
    hasVisibleBorderSide(style.borderTopWidth, style.borderTopStyle, style.borderTopColor) ||
    hasVisibleBorderSide(style.borderRightWidth, style.borderRightStyle, style.borderRightColor) ||
    hasVisibleBorderSide(style.borderBottomWidth, style.borderBottomStyle, style.borderBottomColor) ||
    hasVisibleBorderSide(style.borderLeftWidth, style.borderLeftStyle, style.borderLeftColor)
  ) {
    return true;
  }

  return false;
}

export function isUiControlElement(tagName: string, role?: string | null): boolean {
  if (CONTROL_TAGS.has(tagName.toUpperCase())) return true;
  if (role && UI_ROLES.has(role.trim().toLowerCase())) return true;
  return false;
}

export function isTextSemanticTag(tagName: string): boolean {
  return TEXT_TAGS.has(tagName.toUpperCase());
}

function getDirectNonEmptyText(el: Element): boolean {
  for (let node = el.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 3 && node.nodeValue && node.nodeValue.trim().length > 0) {
      return true;
    }
  }
  return false;
}

function svgHasNonTextGeometry(svgEl: Element): boolean {
  try {
    return Boolean(svgEl.querySelector(SVG_GEOMETRY_SELECTOR));
  } catch {
    return false;
  }
}

interface SubtreeAnalysis {
  hasVisualGraphic: boolean;
  hasTextOrControl: boolean;
}

/**
 * Marks pure text-bearing boxes/controls in the live DOM with `data-sf-hide="1"`
 * before cloning so layout geometry stays intact while all dialogue boxes, HUD cards,
 * buttons, and labels disappear completely in the captured screenshot.
 * Returns the marked elements so callers can remove the attribute in a `finally` block.
 */
export function markTextBoxesInLiveDom(
  rootEl: Element,
  viewportWidth: number,
  viewportHeight: number
): Element[] {
  const marked: Element[] = [];
  const doc = rootEl.ownerDocument;
  const win = doc?.defaultView;
  if (!doc || !win) return marked;

  function analyze(el: Element, isRoot: boolean): SubtreeAnalysis {
    const tag = (el.tagName || '').toUpperCase();
    if (SKIP_TAGS.has(tag)) {
      return { hasVisualGraphic: false, hasTextOrControl: false };
    }

    let computed: CSSStyleDeclaration | null = null;
    try {
      computed = win!.getComputedStyle(el);
    } catch {
      computed = null;
    }

    if (
      computed &&
      (computed.display === 'none' ||
        computed.visibility === 'hidden' ||
        parseFloat(computed.opacity || '1') <= 0)
    ) {
      return { hasVisualGraphic: false, hasTextOrControl: false };
    }

    const rect = el.getBoundingClientRect();
    const role = el.getAttribute('role');
    const isControl = isUiControlElement(tag, role);

    // Media primitives
    if (tag === 'CANVAS' || tag === 'IMG' || tag === 'VIDEO' || tag === 'PICTURE') {
      const visibleSize = rect.width > 0 && rect.height > 0;
      return {
        hasVisualGraphic: visibleSize,
        hasTextOrControl: isControl,
      };
    }

    if (tag === 'SVG') {
      const hasGeom = rect.width > 0 && rect.height > 0 && svgHasNonTextGeometry(el);
      return {
        hasVisualGraphic: hasGeom,
        hasTextOrControl: false,
      };
    }

    let childHasVisual = false;
    let childHasTextOrControl = false;

    const children = el.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childRes = analyze(child, false);
      if (childRes.hasVisualGraphic) childHasVisual = true;
      if (childRes.hasTextOrControl) childHasTextOrControl = true;
    }

    const hasDirectText = getDirectNonEmptyText(el);
    const hasBgUrl = Boolean(
      computed?.backgroundImage &&
        computed.backgroundImage !== 'none' &&
        /url\(/i.test(computed.backgroundImage)
    );

    const hasOwnPaint =
      rect.width > 0 &&
      rect.height > 0 &&
      hasVisibleCssPaint({
        display: computed?.display,
        visibility: computed?.visibility,
        opacity: computed?.opacity,
        backgroundColor: computed?.backgroundColor,
        backgroundImage: computed?.backgroundImage,
        borderTopWidth: computed?.borderTopWidth,
        borderTopStyle: computed?.borderTopStyle,
        borderTopColor: computed?.borderTopColor,
        borderRightWidth: computed?.borderRightWidth,
        borderRightStyle: computed?.borderRightStyle,
        borderRightColor: computed?.borderRightColor,
        borderBottomWidth: computed?.borderBottomWidth,
        borderBottomStyle: computed?.borderBottomStyle,
        borderBottomColor: computed?.borderBottomColor,
        borderLeftWidth: computed?.borderLeftWidth,
        borderLeftStyle: computed?.borderLeftStyle,
        borderLeftColor: computed?.borderLeftColor,
        boxShadow: computed?.boxShadow,
      });

    const coversStage =
      !isRoot &&
      rect.width >= viewportWidth * 0.65 &&
      rect.height >= viewportHeight * 0.65;

    const hasTextOrControl = isControl || hasDirectText || childHasTextOrControl;

    // A pure CSS shape with paint and NO text/controls counts as visual game art
    const isPureCssArt = !isControl && !hasTextOrControl && hasOwnPaint;
    const hasVisualGraphic = !isControl && (childHasVisual || hasBgUrl || isPureCssArt);

    const shouldHideBox =
      !isRoot &&
      tag !== 'BODY' &&
      tag !== 'HTML' &&
      !coversStage &&
      (isControl || (!hasVisualGraphic && (hasTextOrControl || isTextSemanticTag(tag))));

    if (shouldHideBox) {
      el.setAttribute('data-sf-hide', '1');
      marked.push(el);
      return {
        hasVisualGraphic: false,
        hasTextOrControl: true,
      };
    }

    return {
      hasVisualGraphic: hasVisualGraphic || coversStage,
      hasTextOrControl,
    };
  }

  analyze(rootEl, true);
  return marked;
}

export function unmarkTextBoxesInLiveDom(marked: Element[]): void {
  for (let i = 0; i < marked.length; i++) {
    marked[i].removeAttribute('data-sf-hide');
  }
}

/**
 * Strips all remaining text nodes, SVG <text>/<tspan>/<textPath>, placeholders,
 * pseudo-element text strings, and forces visibility:hidden on elements marked `data-sf-hide="1"`
 * inside the cloned DOM produced by modern-screenshot (so the live game never flickers).
 */
export function stripTextAndTextBoxesFromClone(clonedRoot: Node): void {
  const doc = clonedRoot.ownerDocument;
  if (!doc) return;

  if (clonedRoot.nodeType === 1) {
    const rootEl = clonedRoot as Element;
    const hiddenEls = rootEl.querySelectorAll('[data-sf-hide="1"]');
    for (let i = 0; i < hiddenEls.length; i++) {
      const el = hiddenEls[i] as HTMLElement;
      el.removeAttribute('data-sf-hide');
      if (el.style && typeof el.style.setProperty === 'function') {
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('box-shadow', 'none', 'important');
        el.style.setProperty('text-shadow', 'none', 'important');
      }
    }

    if (rootEl.getAttribute('data-sf-hide') === '1') {
      rootEl.removeAttribute('data-sf-hide');
    }
  }

  // Remove SVG text elements & clear HTML text nodes
  const toRemove: Element[] = [];
  const walk = (node: Node, insideStyleOrScript: boolean) => {
    if (node.nodeType === 3) {
      if (!insideStyleOrScript && node.nodeValue) {
        node.nodeValue = '';
      }
      return;
    }

    if (node.nodeType !== 1) return;
    const el = node as Element;
    const tag = (el.tagName || '').toUpperCase();

    if (tag === 'STYLE' || tag === 'SCRIPT') {
      return;
    }

    if (el.namespaceURI?.includes('svg') && SVG_TEXT_TAGS.has(el.tagName)) {
      toRemove.push(el);
      return;
    }

    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      el.removeAttribute('placeholder');
      el.removeAttribute('value');
    }

    for (let child = node.firstChild; child; child = child.nextSibling) {
      walk(child, false);
    }
  };

  walk(clonedRoot, false);

  for (let i = 0; i < toRemove.length; i++) {
    const el = toRemove[i];
    el.parentNode?.removeChild(el);
  }

  // Inject hard CSS failsafe inside the cloned root so pseudo-element strings & text glyphs
  // cannot render under any circumstance while pure CSS ::before/::after shapes remain intact.
  if (clonedRoot.nodeType === 1) {
    const styleEl = doc.createElement('style');
    styleEl.setAttribute('data-sceneforge-strip', '1');
    styleEl.textContent = `
      *, *::before, *::after {
        color: transparent !important;
        -webkit-text-fill-color: transparent !important;
        text-shadow: none !important;
        text-decoration-color: transparent !important;
      }
      *::before, *::after {
        content: '' !important;
      }
      input, textarea, select, option, button, dialog {
        visibility: hidden !important;
        opacity: 0 !important;
        box-shadow: none !important;
      }
    `;
    clonedRoot.appendChild(styleEl);
  }
}

export interface ResolvedDocumentBackground {
  backgroundColor: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
}

export function resolveIframeViewportBackground(iframeDoc: Document): ResolvedDocumentBackground {
  const win = iframeDoc.defaultView;
  if (!win) {
    return { backgroundColor: '#090b10' };
  }

  const bodyStyle = iframeDoc.body ? win.getComputedStyle(iframeDoc.body) : null;
  const htmlStyle = iframeDoc.documentElement
    ? win.getComputedStyle(iframeDoc.documentElement)
    : null;

  const bodyHasBgImage = Boolean(bodyStyle?.backgroundImage && bodyStyle.backgroundImage !== 'none');
  const bodyHasBgColor = Boolean(
    bodyStyle?.backgroundColor && !isTransparentCssColor(bodyStyle.backgroundColor)
  );

  if (bodyHasBgImage || bodyHasBgColor) {
    return {
      backgroundColor: bodyHasBgColor ? bodyStyle!.backgroundColor : '#090b10',
    };
  }

  const htmlHasBgImage = Boolean(htmlStyle?.backgroundImage && htmlStyle.backgroundImage !== 'none');
  const htmlHasBgColor = Boolean(
    htmlStyle?.backgroundColor && !isTransparentCssColor(htmlStyle.backgroundColor)
  );

  return {
    backgroundColor: htmlHasBgColor ? htmlStyle!.backgroundColor : '#090b10',
    backgroundImage: htmlHasBgImage ? htmlStyle!.backgroundImage : undefined,
    backgroundSize: htmlHasBgImage ? htmlStyle!.backgroundSize : undefined,
    backgroundPosition: htmlHasBgImage ? htmlStyle!.backgroundPosition : undefined,
    backgroundRepeat: htmlHasBgImage ? htmlStyle!.backgroundRepeat : undefined,
  };
}
