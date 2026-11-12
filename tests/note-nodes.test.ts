import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { materializeNoteBlocks, type NoteBlock } from '../src/core/note-nodes';
import { labelOf, noteParagraphNode, paragraph, textNode, treeNode } from './test-helpers';

test('materializes paragraphs in source order under their owning headings', () => {
  const root = treeNode('root');
  const chapterOne = treeNode('h1', 'heading', 'Chapter One');
  const section = treeNode('h2', 'heading', 'Section 1.1');
  const list = treeNode('list', 'list', 'List');
  const chapterTwo = treeNode('h3', 'heading', 'Chapter Two');

  root.notes = [
    { block: paragraph('Introduction one'), after: 0 },
    { block: paragraph('Introduction two'), after: 0 },
  ];
  section.notes = [
    { block: paragraph('Before the list'), after: 0 },
    { block: paragraph('After the list'), after: 1 },
  ];
  section.children = [list];
  chapterOne.children = [section];
  chapterOne.notes = [{ block: paragraph('Chapter paragraph'), after: 0 }];
  chapterTwo.notes = [{ block: paragraph('Second chapter paragraph'), after: 0 }];
  root.children = [chapterOne, chapterTwo];

  materializeNoteBlocks(root);

  assert.deepEqual(root.children.map((node) => labelOf(node)), [
    'Introduction one',
    'Introduction two',
    'Chapter One',
    'Chapter Two',
  ]);
  assert.deepEqual(chapterOne.children.map((node) => labelOf(node)), [
    'Chapter paragraph',
    'Section 1.1',
  ]);
  assert.deepEqual(section.children.map((node) => labelOf(node)), [
    'Before the list',
    'List',
    'After the list',
  ]);
  assert.equal(root.notes.length, 0);
  assert.equal(chapterOne.notes.length, 0);
  assert.equal(section.notes.length, 0);
});

test('preserves checked and unchecked task-list state on existing nodes', () => {
  const root = treeNode('root');
  const list = treeNode('list', 'list', 'Tasks');
  const checked = treeNode('task-checked', 'listItem', 'Completed task');
  const unchecked = treeNode('task-unchecked', 'listItem', 'Incomplete task');
  checked.data.checked = true;
  unchecked.data.checked = false;
  list.children = [checked, unchecked];
  root.children = [list];

  materializeNoteBlocks(root);

  assert.equal(root.children[0].children[0].data.checked, true);
  assert.equal(root.children[0].children[1].data.checked, false);
  assert.deepEqual(root.children[0].children.map((node) => labelOf(node)), [
    'Completed task',
    'Incomplete task',
  ]);
});

test('converts Markdown tables into a grid atom with alignment and cell text', () => {
  const root = treeNode('root');
  const table = {
    type: 'table',
    children: [
      { type: 'tableRow', children: [
        { type: 'tableCell', children: [textNode('Provision')] },
        { type: 'tableCell', children: [textNode('Subject')] },
        { type: 'tableCell', children: [textNode('Status')] },
      ] },
      { type: 'tableRow', children: [
        { type: 'tableCell', children: [textNode('Article 14')] },
        { type: 'tableCell', children: [textNode('Equality')] },
        { type: 'tableCell', children: [textNode('Core')] },
      ] },
    ],
    align: ['left', 'center', 'right'],
  };
  root.notes = [{ block: table, after: 0 }];

  materializeNoteBlocks(root);

  assert.equal(root.children.length, 1);
  assert.equal(root.children[0].type, 'noteTable');
  const atom = root.children[0].content[0] as {
    type: string;
    headers: string[];
    rows: string[][];
    align: Array<string | null>;
  };
  assert.equal(atom.type, 'maploomTable');
  assert.deepEqual(atom.headers, ['Provision', 'Subject', 'Status']);
  assert.deepEqual(atom.rows, [['Article 14', 'Equality', 'Core']]);
  assert.deepEqual(atom.align, ['left', 'center', 'right']);
});

test('recognises callout type, custom title, fold marker and removes the declaration from body', () => {
  const markdown = '> [!WARNING] Important Warning\n> The warning body.';
  const root = treeNode('root');
  const block: NoteBlock = {
    type: 'blockquote',
    data: { maploomSourcePosition: { start: 0, end: markdown.length } },
    children: [{
      type: 'paragraph',
      children: [textNode('[!WARNING] Important Warning The warning body.')],
    }],
  };
  root.notes = [{ block, after: 0 }];

  materializeNoteBlocks(root, markdown);

  const callout = root.children[0];
  assert.equal(callout.type, 'noteCallout');
  assert.equal(callout.data.maploomCalloutType, 'warning');
  assert.equal(callout.data.maploomCalloutTitle, 'Important Warning');
  const atom = callout.content[0] as {
    type: string;
    calloutType: string;
    title: string;
    paragraphs: Array<{ runs: Array<{ text: string }> }>;
  };
  assert.equal(atom.type, 'maploomCallout');
  assert.equal(atom.calloutType, 'warning');
  assert.equal(atom.title, 'Important Warning');
  assert.equal(atom.paragraphs.length, 1);
  assert.equal(atom.paragraphs[0].runs.map((run) => run.text).join(''), 'The warning body.');
});

test('preserves callout paragraphs and inline strong/emphasis formatting', () => {
  const markdown = '> [!EXAMPLE]\n> Example content with **bold text** and *italic text*.\n>\n> A separate paragraph.';
  const root = treeNode('root');
  const block: NoteBlock = {
    type: 'blockquote',
    data: { maploomSourcePosition: { start: 0, end: markdown.length } },
    children: [
      {
        type: 'paragraph',
        children: [
          textNode('[!EXAMPLE] Example content with '),
          { type: 'strong', children: [textNode('bold text')] },
          textNode(' and '),
          { type: 'emphasis', children: [textNode('italic text.')] },
        ],
      },
      { type: 'paragraph', children: [textNode('A separate paragraph.')] },
    ],
  };
  root.notes = [{ block, after: 0 }];

  materializeNoteBlocks(root, markdown);

  const atom = root.children[0].content[0] as {
    paragraphs: Array<{ runs: Array<{ text: string; strong?: boolean; emphasis?: boolean }> }>;
  };
  assert.equal(atom.paragraphs.length, 2);
  const firstRuns = atom.paragraphs[0].runs;
  assert.ok(firstRuns.some((run) => run.text === 'bold text' && run.strong === true));
  assert.ok(firstRuns.some((run) => run.text === 'italic text.' && run.emphasis === true));
  assert.equal(atom.paragraphs[1].runs.map((run) => run.text).join(''), 'A separate paragraph.');
});

test('preserves a collapsed callout marker without hiding its body', () => {
  const markdown = '> [!TIP]- Collapsed Tip\n> Tip body remains visible.';
  const root = treeNode('root');
  const block: NoteBlock = {
    type: 'blockquote',
    data: { maploomSourcePosition: { start: 0, end: markdown.length } },
    children: [{
      type: 'paragraph',
      children: [textNode('[!TIP]- Collapsed Tip Tip body remains visible.')],
    }],
  };
  root.notes = [{ block, after: 0 }];

  materializeNoteBlocks(root, markdown);

  const callout = root.children[0];
  const atom = callout.content[0] as { title: string; fold?: string; paragraphs: Array<{ runs: Array<{ text: string }> }> };
  assert.equal(atom.title, 'Collapsed Tip');
  assert.equal(atom.fold, '-');
  assert.equal(callout.data.maploomCalloutFold, '-');
  assert.equal(atom.paragraphs[0].runs.map((run) => run.text).join(''), 'Tip body remains visible.');
});

test('ordinary blockquotes remain ordinary blockquotes', () => {
  const markdown = '> This is an ordinary quote.';
  const root = treeNode('root');
  const block: NoteBlock = {
    type: 'blockquote',
    data: { maploomSourcePosition: { start: 0, end: markdown.length } },
    children: [{ type: 'paragraph', children: [textNode('This is an ordinary quote.')] }],
  };
  root.notes = [{ block, after: 0 }];

  materializeNoteBlocks(root, markdown);

  assert.equal(root.children[0].type, 'noteBlockquote');
  assert.equal(labelOf(root.children[0]), 'Blockquote');
  assert.equal(root.children[0].children[0].type, 'noteParagraph');
});

test('callout fixture covers the documented callout types and variants', () => {
  const markdown = readFileSync(join(process.cwd(), 'tests/fixtures/obsidian-callouts.md'), 'utf8');
  for (const marker of ['[!NOTE]', '[!WARNING] Important Warning', '[!TIP]- Collapsed Tip', '[!EXAMPLE]']) {
    assert.ok(markdown.includes(marker), 'fixture should contain ' + marker);
  }
  assert.match(markdown, /\*\*bold text\*\*/);
  assert.match(markdown, /\*italic text\*/);
});
