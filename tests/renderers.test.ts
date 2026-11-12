import test from 'node:test';
import assert from 'node:assert/strict';
import { calloutContent } from '../src/core/callout-content';
import { tableContent } from '../src/core/table-content';
import { createVaultImageContent } from '../src/core/image-content';

interface TestPrimitive {
  kind: string;
  svg?: () => string;
  src?: string;
}

interface TestAtom {
  measure(inline: unknown, style: unknown, context: unknown): { width: number; height: number; baseline?: number };
  render(inline: unknown, box: unknown, style: unknown, context: unknown): TestPrimitive[];
}

const style = {
  font: { size: 16, lineHeight: 21 },
  fill: '#eeeeee',
} as const;

const context = {
  measurer: {
    measure(value: string): number {
      return Array.from(value).length * 7;
    },
  },
};

function atomFor(plugin: unknown, name: string): TestAtom {
  const atoms = (plugin as { atoms: Record<string, unknown> }).atoms;
  const atom = atoms[name] as TestAtom | undefined;
  assert.ok(atom, 'renderer atom should be registered: ' + name);
  return atom;
}

test('callout SVG renderer measures a card and renders theme, icon, title and body', () => {
  const atom = atomFor(calloutContent, 'maploomCallout');
  const inline = {
    type: 'maploomCallout',
    calloutType: 'warning',
    title: 'Important Warning',
    paragraphs: [{ runs: [{ text: 'Warning body text.' }] }],
  };
  const measured = atom.measure(inline, style, context);
  assert.ok(measured.width >= 260);
  assert.ok(measured.height > 0);

  const primitive = atom.render(
    inline,
    { x: 10, y: 20, width: measured.width, height: measured.height },
    style,
    context,
  )[0];
  assert.equal(primitive.kind, 'custom');
  const svg = primitive.svg?.() ?? '';
  assert.match(svg, /maploom-callout--warning/);
  assert.match(svg, /maploom-callout__icon/);
  assert.match(svg, /Important Warning/);
  assert.match(svg, /Warning body text\./);
});

test('callout SVG renderer preserves emphasis, line breaks and safe links', () => {
  const atom = atomFor(calloutContent, 'maploomCallout');
  const inline = {
    type: 'maploomCallout',
    calloutType: 'example',
    title: 'Example',
    paragraphs: [
      { runs: [
        { text: 'Bold', strong: true },
        { text: ' and ' },
        { text: 'italic', emphasis: true },
        { text: ' plus ' },
        { text: 'code', code: true },
        { text: ' and ' },
        { text: 'strike', strike: true },
        { text: ' link', href: 'https://example.com' },
      ] },
      { runs: [{ text: 'Second paragraph.' }] },
    ],
  };
  const primitive = atom.render(inline, { x: 0, y: 0, width: 400, height: 200 }, style, context)[0];
  const svg = primitive.svg?.() ?? '';
  assert.match(svg, /font-weight="700"/);
  assert.match(svg, /font-style="italic"/);
  assert.match(svg, /font-family="monospace"/);
  assert.match(svg, /text-decoration="line-through"/);
  assert.match(svg, /<a href="https:\/\/example\.com">/);
  assert.match(svg, /Second paragraph\./);

  const untrusted = {
    ...inline,
    paragraphs: [{ runs: [{ text: 'unsafe', href: 'javascript:alert(1)' }] }],
  };
  const unsafeSvg = atom.render(untrusted, { x: 0, y: 0, width: 400, height: 200 }, style, context)[0].svg?.() ?? '';
  assert.doesNotMatch(unsafeSvg, /href="javascript:/);
});

test('callout SVG renderer escapes text before embedding it in SVG markup', () => {
  const atom = atomFor(calloutContent, 'maploomCallout');
  const inline = {
    type: 'maploomCallout',
    calloutType: 'custom-unlisted',
    title: 'A < B & C',
    paragraphs: [{ runs: [{ text: '<script>alert("x")</script>' }] }],
  };
  const svg = atom.render(inline, { x: 0, y: 0, width: 400, height: 200 }, style, context)[0].svg?.() ?? '';
  assert.match(svg, /A &lt; B &amp; C/);
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /maploom-callout--note/);
});

test('table SVG renderer outputs a real grid and escapes cell content', () => {
  const atom = atomFor(tableContent, 'maploomTable');
  const inline = {
    type: 'maploomTable',
    headers: ['Provision', 'Subject'],
    rows: [['Article 14', 'Equality & <liberty>']],
    align: ['left', 'right'],
  };
  const measured = atom.measure(inline, style, context);
  assert.ok(measured.width > 0 && measured.height > 0);

  const svg = atom.render(
    inline,
    { x: 3, y: 4, width: measured.width, height: measured.height },
    style,
    context,
  )[0].svg?.() ?? '';
  assert.equal((svg.match(/<rect/g) ?? []).length, 2);
  assert.match(svg, /Provision/);
  assert.match(svg, /Article 14/);
  assert.match(svg, /Equality &amp; &lt;liberty&gt;/);
  assert.match(svg, /text-anchor="end"/);
});

test('vault image renderer accepts Obsidian resource URLs and rejects unsafe schemes', () => {
  const plugin = createVaultImageContent();
  const atom = atomFor(plugin, 'image');
  const allowed = atom.render(
    { type: 'image', url: 'app://obsidian.md/fixture.svg', alt: 'fixture' },
    { x: 1, y: 2, width: 90, height: 60 },
    style,
    context,
  )[0];
  assert.equal(allowed.kind, 'image');
  assert.equal(allowed.src, 'app://obsidian.md/fixture.svg');

  const rejected = atom.render(
    { type: 'image', url: 'javascript:alert(1)', alt: 'unsafe image' },
    { x: 1, y: 2, width: 90, height: 60 },
    style,
    context,
  )[0];
  assert.equal(rejected.kind, 'text');
});
