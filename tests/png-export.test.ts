import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calculatePngDimensions,
  getPngExportPath,
  getSvgDimensions,
} from '../src/export/png-export';

test('reads the full map dimensions from the Markmap SVG root', () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" ' +
    'viewBox="-20 -20 1200 800"></svg>';

  assert.deepEqual(getSvgDimensions(svg), {
    width: 1200,
    height: 800,
  });
});

test('reads decimal numeric width and height attributes directly', () => {
  const svg =
    '<svg width="3075.31" height="1003.13" viewBox="0 0 1 1"></svg>';

  assert.deepEqual(getSvgDimensions(svg), {
    width: 3075.31,
    height: 1003.13,
  });
});
test('uses viewBox dimensions when SVG width and height are percentages', () => {
  const svg =
    '<svg width="100%" height="100%" viewBox="-10 -20 900.5 600.25"></svg>';

  assert.deepEqual(getSvgDimensions(svg), {
    width: 900.5,
    height: 600.25,
  });
});

test('rejects an SVG without usable dimensions', () => {
  assert.throws(
    () => getSvgDimensions('<svg width="100%" height="100%"></svg>'),
    /no usable width and height or viewBox/,
  );
});

test('calculates scaled PNG dimensions using ceiling rounding', () => {
  assert.deepEqual(calculatePngDimensions(100.2, 50.1, 2), {
    width: 201,
    height: 101,
  });
});

test('rejects invalid source dimensions', () => {
  assert.throws(
    () => calculatePngDimensions(0, 100, 1),
    /invalid dimensions/,
  );

  assert.throws(
    () => calculatePngDimensions(Number.POSITIVE_INFINITY, 100, 1),
    /invalid dimensions/,
  );
});

test('rejects unsupported PNG scales', () => {
  assert.throws(
    () => calculatePngDimensions(100, 100, 5 as 1),
    /scale must be 1x, 2x, 3x or 4x/,
  );
});

test('rejects a PNG exceeding the maximum canvas edge', () => {
  assert.throws(
    () => calculatePngDimensions(5000, 1000, 4),
    /too large for a PNG/,
  );
});

test('allows 3x and 4x exports within the 50-million-pixel budget', () => {
  assert.deepEqual(calculatePngDimensions(3075.31, 1003.13, 3), {
    width: 9226,
    height: 3010,
  });

  assert.deepEqual(calculatePngDimensions(3075.31, 1003.13, 4), {
    width: 12302,
    height: 4013,
  });
});
test('rejects a PNG exceeding the pixel memory limit', () => {
  assert.throws(
    () => calculatePngDimensions(7200, 7200, 1),
    /too much memory/,
  );
});

test('generates a PNG path beside the source note', () => {
  assert.equal(
    getPngExportPath('Research/Constitutional Law.md', () => false),
    'Research/Constitutional Law-map.png',
  );
});

test('does not overwrite an existing PNG export', () => {
  const existing = new Set([
    'Research/Note-map.png',
    'Research/Note-map (2).png',
  ]);

  assert.equal(
    getPngExportPath('Research/Note.md', (path) => existing.has(path)),
    'Research/Note-map (3).png',
  );
});
test('overrides dark theme tokens for white PNG exports', async () => {
  const { applyWhitePngTheme } = await import('../src/export/png-export');

  const input =
    '<svg xmlns="http://www.w3.org/2000/svg" class="markmap" ' +
    'width="1200" height="800"></svg>';

  const output = applyWhitePngTheme(input);
  const root = output.match(/<svg\b[^>]*>/i)?.[0] ?? '';

  assert.ok(root.includes('--mm-text:#222222'));
  assert.ok(root.includes('--mm-bg:#ffffff'));
  assert.ok(root.includes('--mm-code-bg:#f3f4f6'));
  assert.ok(root.includes('--mm-code-text:#24292f'));
  assert.ok(root.includes('--mm-card-bg:#ffffff'));
});

test('preserves existing SVG root styles when applying white PNG tokens', async () => {
  const { applyWhitePngTheme } = await import('../src/export/png-export');

  const input =
    '<svg class="markmap" style="font-family:Arial;opacity:1" ' +
    'width="1200" height="800"></svg>';

  const output = applyWhitePngTheme(input);
  const root = output.match(/<svg\b[^>]*>/i)?.[0] ?? '';

  assert.ok(root.includes('font-family:Arial'));
  assert.ok(root.includes('opacity:1'));
  assert.ok(root.includes('--mm-text:#222222'));
});
