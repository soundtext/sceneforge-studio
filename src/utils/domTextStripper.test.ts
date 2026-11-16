import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasVisibleCssPaint,
  isTextSemanticTag,
  isTransparentCssColor,
  isUiControlElement,
  stripTextAndTextBoxesFromClone,
} from './domTextStripper';

test('isTransparentCssColor identifies transparent colors accurately', () => {
  assert.equal(isTransparentCssColor('transparent'), true);
  assert.equal(isTransparentCssColor('rgba(0, 0, 0, 0)'), true);
  assert.equal(isTransparentCssColor('rgba(15, 23, 42, 0.001)'), true);
  assert.equal(isTransparentCssColor('rgba(15, 23, 42, 0.85)'), false);
  assert.equal(isTransparentCssColor('rgb(225, 29, 72)'), false);
});

test('hasVisibleCssPaint distinguishes painted CSS art from empty transparent containers', () => {
  assert.equal(
    hasVisibleCssPaint({
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
      borderTopStyle: 'none',
      boxShadow: 'none',
    }),
    false
  );

  assert.equal(
    hasVisibleCssPaint({
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      backgroundColor: 'rgb(190, 18, 60)',
      backgroundImage: 'none',
    }),
    true
  );

  assert.equal(
    hasVisibleCssPaint({
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      backgroundColor: 'transparent',
      backgroundImage: 'linear-gradient(#090b10, #1e293b)',
    }),
    true
  );
});

test('isUiControlElement and isTextSemanticTag classify controls and text blocks', () => {
  assert.equal(isUiControlElement('button'), true);
  assert.equal(isUiControlElement('input'), true);
  assert.equal(isUiControlElement('div', 'dialog'), true);
  assert.equal(isUiControlElement('div', 'button'), true);
  assert.equal(isUiControlElement('canvas'), false);
  assert.equal(isUiControlElement('div'), false);

  assert.equal(isTextSemanticTag('p'), true);
  assert.equal(isTextSemanticTag('h1'), true);
  assert.equal(isTextSemanticTag('span'), true);
  assert.equal(isTextSemanticTag('div'), false);
});

test('stripTextAndTextBoxesFromClone hides marked boxes, removes SVG text, clears text nodes, and appends CSS failsafe', () => {
  const appended: Array<{ tagName: string; textContent: string; attrs: Record<string, string> }> = [];

  function makeNode(opts: {
    nodeType: number;
    tagName?: string;
    namespaceURI?: string;
    nodeValue?: string;
    attrs?: Record<string, string>;
    children?: any[];
  }) {
    const node: any = {
      nodeType: opts.nodeType,
      tagName: opts.tagName || '',
      namespaceURI: opts.namespaceURI || 'http://www.w3.org/1999/xhtml',
      nodeValue: opts.nodeValue ?? null,
      attrs: { ...(opts.attrs || {}) },
      children: opts.children || [],
      style: {
        props: {} as Record<string, string>,
        setProperty(k: string, v: string) {
          this.props[k] = v;
        },
      },
      get firstChild() {
        return this.children[0] || null;
      },
      getAttribute(name: string) {
        return name in this.attrs ? this.attrs[name] : null;
      },
      setAttribute(name: string, val: string) {
        this.attrs[name] = val;
      },
      removeAttribute(name: string) {
        delete this.attrs[name];
      },
      removeChild(child: any) {
        this.children = this.children.filter((c: any) => c !== child);
        child.parentNode = null;
      },
      appendChild(child: any) {
        this.children.push(child);
        child.parentNode = this;
        appended.push(child);
        return child;
      },
      querySelectorAll(selector: string) {
        const res: any[] = [];
        const walk = (n: any) => {
          if (selector === '[data-sf-hide="1"]' && n.attrs?.['data-sf-hide'] === '1') {
            res.push(n);
          }
          for (const c of n.children || []) walk(c);
        };
        walk(this);
        return res;
      },
    };
    for (let i = 0; i < node.children.length; i++) {
      node.children[i].parentNode = node;
      Object.defineProperty(node.children[i], 'nextSibling', {
        get() {
          return node.children[i + 1] || null;
        },
        configurable: true,
      });
    }
    return node;
  }

  const fakeDoc: any = {
    createElement(tag: string) {
      return makeNode({ nodeType: 1, tagName: tag.toUpperCase() });
    },
  };

  const dialogueText = makeNode({ nodeType: 3, nodeValue: 'Hero: Enter the dungeon!' });
  const dialogueBox = makeNode({
    nodeType: 1,
    tagName: 'DIV',
    attrs: { 'data-sf-hide': '1' },
    children: [dialogueText],
  });

  const svgRect = makeNode({
    nodeType: 1,
    tagName: 'rect',
    namespaceURI: 'http://www.w3.org/2000/svg',
  });
  const svgLabel = makeNode({
    nodeType: 1,
    tagName: 'text',
    namespaceURI: 'http://www.w3.org/2000/svg',
    children: [makeNode({ nodeType: 3, nodeValue: 'STAGE 1' })],
  });
  const svgScene = makeNode({
    nodeType: 1,
    tagName: 'svg',
    namespaceURI: 'http://www.w3.org/2000/svg',
    children: [svgRect, svgLabel],
  });

  const inputEl = makeNode({
    nodeType: 1,
    tagName: 'INPUT',
    attrs: { 'data-sf-hide': '1', placeholder: 'Name' },
  });

  const body = makeNode({
    nodeType: 1,
    tagName: 'BODY',
    children: [svgScene, dialogueBox, inputEl],
  });
  const assignOwner = (n: any) => {
    n.ownerDocument = fakeDoc;
    for (const c of n.children || []) assignOwner(c);
  };
  assignOwner(body);

  stripTextAndTextBoxesFromClone(body);

  assert.equal(dialogueBox.style.props.visibility, 'hidden');
  assert.equal(dialogueBox.style.props.opacity, '0');
  assert.equal(dialogueText.nodeValue, '');
  assert.equal(inputEl.attrs.placeholder, undefined);
  assert.equal(svgScene.children.length, 1);
  assert.equal(svgScene.children[0].tagName, 'rect');
  assert.equal(appended.length, 1);
  assert.equal(appended[0].tagName, 'STYLE');
  assert.ok(appended[0].textContent.includes('color: transparent !important'));
});
