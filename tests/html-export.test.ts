import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { App, TFile } from 'obsidian';
import { STANDALONE_HTML_STYLES } from '../src/export/html-styles';
import {
  createStandaloneHtmlDocument,
  embedVaultResourcesInHtml,
  getHtmlExportPath,
} from '../src/export/html-export';

test('includes portable Markdown and embedded-note export styles', () => {
  assert.ok(STANDALONE_HTML_STYLES.includes('.maploom-export-source'));
  assert.ok(STANDALONE_HTML_STYLES.includes('.maploom-export-source > .maploom-source-content'));
  assert.ok(STANDALONE_HTML_STYLES.includes('.maploom-export-embed'));
  assert.ok(STANDALONE_HTML_STYLES.includes('.maploom-export-source .callout'));
  assert.ok(STANDALONE_HTML_STYLES.includes('user-select: text'));
  assert.ok(STANDALONE_HTML_STYLES.includes('overflow: visible'));
});
test('generates an HTML export path beside the source note', () => {
  assert.equal(
    getHtmlExportPath('Research/Constitutional Law.md', () => false),
    'Research/Constitutional Law-map.html',
  );
});

test('does not overwrite an existing HTML export', () => {
  const existing = new Set([
    'Research/Note-map.html',
    'Research/Note-map (2).html',
  ]);

  assert.equal(
    getHtmlExportPath('Research/Note.md', (path) => existing.has(path)),
    'Research/Note-map (3).html',
  );
});

test('embeds local resources in source HTML and map image nodes', async () => {
  const resourcePath = 'app://local/Assets/chart.png';
  const imageFile = {
    path: 'Assets/chart.png',
    extension: 'png',
  } as TFile;

  const app = {
    vault: {
      getFiles: () => [imageFile],
      getResourcePath: () => resourcePath,
      readBinary: async () => new Uint8Array([1, 2, 3]).buffer,
    },
  } as unknown as App;

  const tree = {
    content: [{ type: 'image', url: resourcePath, alt: 'Chart' }],
    children: [],
  };

  const result = await embedVaultResourcesInHtml(
    '<img src="' + resourcePath + '">' +
      '<img src="https://example.com/external.png">',
    tree,
    app,
  );

  const dataUrl = 'data:image/png;base64,AQID';

  assert.equal(result.unresolvedLocalResources.length, 0);
  assert.ok(result.html.includes('src="' + dataUrl + '"'));
  assert.ok(result.html.includes('https://example.com/external.png'));
  assert.equal(
    (result.tree as typeof tree).content[0].url,
    dataUrl,
  );
});

test('embeds the Obsidian external-link SVG application asset', async () => {
  const resourcePath = 'app://obsidian.md/public/external-link.svg';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
  const originalFetch = globalThis.fetch;
  let fetchedUrl = '';

  globalThis.fetch = (async (input: unknown) => {
    fetchedUrl = String(input);

    return {
      ok: true,
      status: 200,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null,
      },
      arrayBuffer: async () =>
        new TextEncoder().encode(svg).buffer as ArrayBuffer,
    } as unknown as Response;
  }) as typeof fetch;

  try {
    const app = {
      vault: {
        getFiles: () => [],
        getResourcePath: () => '',
        readBinary: async () => new ArrayBuffer(0),
      },
    } as unknown as App;

    const result = await embedVaultResourcesInHtml(
      '<img src="' + resourcePath + '">',
      { children: [] },
      app,
    );

    const dataUrl = 'data:image/svg+xml;base64,' + btoa(svg);

    assert.equal(fetchedUrl, resourcePath);
    assert.deepEqual(result.unresolvedLocalResources, []);
    assert.ok(result.html.includes('src="' + dataUrl + '"'));
    assert.ok(!result.html.includes(resourcePath));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reports unresolved local resources rather than silently discarding them', async () => {
  const app = {
    vault: {
      getFiles: () => [],
      getResourcePath: () => '',
      readBinary: async () => new ArrayBuffer(0),
    },
  } as unknown as App;

  const result = await embedVaultResourcesInHtml(
    '<img src="app://local/Assets/missing.png">',
    { children: [] },
    app,
  );

  assert.deepEqual(
    result.unresolvedLocalResources,
    ['app://local/Assets/missing.png'],
  );
});

test('escapes source content before placing it in the JSON data element', () => {
  const html = createStandaloneHtmlDocument({
    title: 'A <Note>',
    payload: { sourceHtml: '</script><script>alert(1)</script>' },
    styles: 'body{margin:0}',
    clientScript: 'window.maploomStarted = true;',
  });

  assert.ok(html.includes('<title>A &lt;Note&gt;</title>'));
  assert.ok(!html.includes('</script><script>alert(1)</script>'));
  assert.ok(html.includes('\\u003c/script\\u003e'));
  assert.ok(html.includes('window.maploomStarted = true;'));
  assert.ok(html.includes("connect-src 'none'"));
  const nonceMatch = html.match(/script-src 'nonce-([a-f0-9]+)'/);
  assert.ok(nonceMatch, 'script-src nonce is required');
  assert.ok(html.includes('<script nonce="' + nonceMatch[1] + '">'));
  assert.ok(!html.includes("script-src 'unsafe-inline'"));
});


test('embeds local CSS background images and font resources', async () => {
  const backgroundPath = 'app://local/Assets/background.png';
  const fontPath = 'app://local/Assets/reading.woff2';

  const backgroundFile = {
    path: 'Assets/background.png',
    extension: 'png',
  } as TFile;

  const fontFile = {
    path: 'Assets/reading.woff2',
    extension: 'woff2',
  } as TFile;

  const files = [backgroundFile, fontFile];

  const app = {
    vault: {
      getFiles: () => files,
      getResourcePath: (file: TFile) =>
        file.path.endsWith('.png') ? backgroundPath : fontPath,
      readBinary: async (file: TFile) =>
        file.path.endsWith('.png')
          ? new Uint8Array([1, 2, 3]).buffer
          : new Uint8Array([4, 5, 6]).buffer,
    },
  } as unknown as App;

  const sourceHtml =
    '<div style="background-image:url(&quot;' + backgroundPath + '&quot;)"></div>' +
    '<style>@font-face{src:url("' + fontPath + '")}</style>';

  const result = await embedVaultResourcesInHtml(
    sourceHtml,
    { children: [] },
    app,
  );

  assert.equal(result.unresolvedLocalResources.length, 0);
  assert.ok(result.html.includes('data:image/png;base64,AQID'));
  assert.ok(result.html.includes('data:font/woff2;base64,BAUG'));
  assert.ok(!result.html.includes(backgroundPath));
  assert.ok(!result.html.includes(fontPath));
});
