import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { App, TFile } from 'obsidian';
import {
  embedVaultImagesInSvg,
  getSvgExportPath,
  injectCalloutStyles,
  rasterizeSvgImagesForCompatibility,
} from '../src/export/svg-export';

test('adds standalone callout styles inside the SVG stylesheet', () => {
  const input = '<svg><style>.markmap{--mm-text:#222}</style></svg>';
  const output = injectCalloutStyles(input);

  assert.ok(output.includes('.maploom-callout--warning'));
  assert.ok(output.includes('.maploom-callout__surface'));
  assert.ok(output.indexOf('.maploom-callout--warning') < output.indexOf('</style>'));
  assert.ok(output.includes('--mm-text:#222'));
});

test('generates an SVG path beside the source note', () => {
  const output = getSvgExportPath(
    'Research/Constitutional Law.md',
    () => false,
  );

  assert.equal(output, 'Research/Constitutional Law-map.svg');
});

test('does not overwrite an existing SVG export', () => {
  const existing = new Set([
    'Research/Note-map.svg',
    'Research/Note-map (2).svg',
  ]);

  const output = getSvgExportPath(
    'Research/Note.md',
    (path) => existing.has(path),
  );

  assert.equal(output, 'Research/Note-map (3).svg');
});

test('rasterizes nested SVG images to PNG in both SVG image references', async () => {
  const source = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
  const png = 'data:image/png;base64,UE5H';
  let received = '';

  const input = '<svg><image width="150" height="56.25" href="' +
    source + '"/></svg>';

  const result = await rasterizeSvgImagesForCompatibility(
    input,
    async (value) => {
      received = value;
      return png;
    },
  );

  assert.equal(received, source);
  assert.equal(result.failed, 0);
  assert.ok(result.svg.includes('href="' + png + '"'));
  assert.ok(result.svg.includes('xlink:href="' + png + '"'));
  assert.ok(result.svg.includes('xmlns:xlink="http://www.w3.org/1999/xlink"'));
});
test('embeds local vault images and preserves external image URLs', async () => {
  const imageFile = {
    path: 'Assets/chart.png',
    extension: 'png',
  } as TFile;

  const app = {
    vault: {
      getFiles: () => [imageFile],
      getResourcePath: () => 'app://local/Assets/chart.png',
      readBinary: async () => new Uint8Array([1, 2, 3]).buffer,
    },
  } as unknown as App;

  const input =
    '<svg><image href="app://local/Assets/chart.png"/>' +
    '<image href="https://example.com/photo.png"/></svg>';

  const result = await embedVaultImagesInSvg(input, app);

  assert.equal(result.unresolvedLocalImages, 0);
  assert.ok(result.svg.includes('href="data:image/png;base64,AQID"'));
  assert.ok(result.svg.includes('xmlns:xlink="http://www.w3.org/1999/xlink"'));
  assert.ok(result.svg.includes('xlink:href="data:image/png;base64,AQID"'));
  assert.ok(result.svg.includes('href="https://example.com/photo.png"'));
  assert.ok(!result.svg.includes('app://local/Assets/chart.png'));
});