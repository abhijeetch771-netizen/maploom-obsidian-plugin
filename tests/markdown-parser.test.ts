import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '@markmap/parse';
import { materializeNoteBlocks, type NoteTreeNode } from '../src/core/note-nodes';

interface PositionedNode {
  position?: {
    start?: { offset?: number };
    end?: { offset?: number };
  };
  data?: Record<string, unknown>;
  children?: PositionedNode[];
}

function captureSourcePositions() {
  return function transform(tree: PositionedNode): void {
    const visit = (node: PositionedNode): void => {
      const start = node.position?.start?.offset;
      const end = node.position?.end?.offset;
      if (typeof start === 'number' && typeof end === 'number') {
        node.data = {
          ...(node.data ?? {}),
          maploomSourcePosition: { start, end },
        };
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

function walk(node: NoteTreeNode, visit: (node: NoteTreeNode) => void): void {
  visit(node);
  node.children.forEach((child) => walk(child, visit));
}

function nodeText(node: NoteTreeNode): string {
  return node.content.map((part) => {
    if (!part || typeof part !== 'object') return '';
    const value = (part as { value?: unknown }).value;
    return typeof value === 'string' ? value : '';
  }).join('');
}

test('real GFM fixture parses frontmatter, task states, nested headings and table grid data', () => {
  const markdown = readFileSync(join(process.cwd(), 'tests/fixtures/markdown-comprehensive.md'), 'utf8');
  const parsed = parse(markdown);
  assert.equal(parsed.gfm, true);
  assert.equal(parsed.frontmatter.title, 'Maploom rendering acceptance fixture');

  const root = parsed.root as unknown as NoteTreeNode;
  materializeNoteBlocks(root, markdown);

  const nodes: NoteTreeNode[] = [];
  walk(root, (node) => nodes.push(node));

  const taskItems = nodes.filter((node) => node.data.checked !== undefined);
  assert.equal(taskItems.length, 2);
  assert.ok(taskItems.some((node) => node.data.checked === true));
  assert.ok(taskItems.some((node) => node.data.checked === false));

  const table = nodes.find((node) => node.type === 'noteTable');
  assert.ok(table, 'GFM table should materialize as a table node');
  const tableAtom = table.content[0] as {
    type: string;
    headers: string[];
    rows: string[][];
    align: Array<string | null>;
  };
  assert.equal(tableAtom.type, 'maploomTable');
  assert.deepEqual(tableAtom.headers, ['Provision', 'Subject', 'Status']);
  assert.equal(tableAtom.rows.length, 3);
  assert.deepEqual(tableAtom.align, ['left', 'center', 'right']);

  assert.ok(nodes.some((node) => node.type === 'noteCode'));
  assert.ok(nodes.some((node) => node.type === 'noteBlockquote'));
  assert.ok(nodes.some((node) => node.type === 'heading' && nodeText(node) === 'Branches and lists'));
});

test('real Obsidian callout fixture becomes typed callout atoms with source-aware titles and body runs', () => {
  const markdown = readFileSync(join(process.cwd(), 'tests/fixtures/obsidian-callouts.md'), 'utf8');
  const parsed = parse(markdown, {
    plugins: [captureSourcePositions as never],
  });
  const root = parsed.root as unknown as NoteTreeNode;
  materializeNoteBlocks(root, markdown);

  const nodes: NoteTreeNode[] = [];
  walk(root, (node) => nodes.push(node));
  const callouts = nodes.filter((node) => node.type === 'noteCallout');
  assert.equal(callouts.length, 4);

  const note = callouts.find((node) => node.data.maploomCalloutType === 'note');
  const warning = callouts.find((node) => node.data.maploomCalloutType === 'warning');
  const tip = callouts.find((node) => node.data.maploomCalloutType === 'tip');
  const example = callouts.find((node) => node.data.maploomCalloutType === 'example');
  assert.ok(note && warning && tip && example);

  const warningAtom = warning.content[0] as { title: string; paragraphs: Array<{ runs: Array<{ text: string }> }> };
  assert.equal(warningAtom.title, 'Important Warning');
  assert.match(warningAtom.paragraphs[0].runs.map((run) => run.text).join(''), /warning callout body/);

  const tipAtom = tip.content[0] as { title: string; fold?: string; paragraphs: Array<{ runs: Array<{ text: string }> }> };
  assert.equal(tipAtom.title, 'Collapsed Tip');
  assert.equal(tipAtom.fold, '-');
  assert.match(tipAtom.paragraphs[0].runs.map((run) => run.text).join(''), /remain available in the graph/);

  const exampleAtom = example.content[0] as { paragraphs: Array<{ runs: Array<{ text: string; strong?: boolean; emphasis?: boolean }> }> };
  assert.ok(exampleAtom.paragraphs[0].runs.some((run) => run.strong));
  assert.ok(exampleAtom.paragraphs[0].runs.some((run) => run.emphasis));
  assert.equal(note.data.maploomCalloutType, 'note');
});
