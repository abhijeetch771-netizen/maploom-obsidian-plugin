import test from 'node:test';
import assert from 'node:assert/strict';
import type { App, TFile } from 'obsidian';
import { expandEmbeddedNotes } from '../src/core/embedded-notes';
import type { NoteBlock, NoteTreeNode } from '../src/core/note-nodes';
import { noteParagraphNode, textNode, treeNode, labelOf } from './test-helpers';

interface MockFile {
  path: string;
  basename: string;
  extension: string;
  content: string;
}

function mockFile(path: string, content: string): MockFile {
  const filename = path.split('/').pop() ?? path;
  return {
    path,
    basename: filename.replace(/\.[^.]+$/, ''),
    extension: filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '',
    content,
  };
}

function createMockApp(files: MockFile[], resolutions: Array<{ linkpath: string; sourcePath: string }> = []): App {
  const byPath = new Map(files.map((file) => [file.path.toLowerCase(), file]));

  const metadataCache = {
    getFirstLinkpathDest(linkpath: string, sourcePath: string): MockFile | null {
      resolutions.push({ linkpath, sourcePath });
      const sourceDirectory = sourcePath.includes('/')
        ? sourcePath.slice(0, sourcePath.lastIndexOf('/'))
        : '';
      const normalized = linkpath.replace(/\\/g, '/').replace(/^\.\//, '');
      const withExtension = /\.[a-z0-9]+$/i.test(normalized) ? normalized : normalized + '.md';
      const relative = sourceDirectory ? sourceDirectory + '/' + withExtension : withExtension;
      return byPath.get(relative.toLowerCase()) ?? byPath.get(withExtension.toLowerCase()) ?? null;
    },
  };

  const vault = {
    async cachedRead(file: TFile): Promise<string> {
      const found = byPath.get((file as unknown as MockFile).path.toLowerCase());
      if (!found) throw new Error('Unknown fake file');
      return found.content;
    },
  };

  return { metadataCache, vault } as unknown as App;
}

function fakeParser(markdown: string, sourcePath: string): NoteTreeNode {
  const root = treeNode('parsed-' + sourcePath);
  const lines = markdown.split(/\r?\n/);
  let headingIndex = 0;
  let noteIndex = 0;

  lines.forEach((line, index) => {
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      root.children.push(treeNode(
        'heading-' + (++headingIndex),
        'heading',
        heading[1],
      ));
      return;
    }

    const trimmed = line.trim();
    if (!trimmed) return;
    const block: NoteBlock = {
      type: 'paragraph',
      children: [textNode(trimmed)],
      data: { maploomSourcePosition: { start: 0, end: line.length } },
    };
    root.notes.push({ block, after: root.children.length });
    noteIndex += 1;
  });

  return root;
}

function hostRoot(embedSyntax: string): NoteTreeNode {
  const root = treeNode('host-root');
  root.children = [noteParagraphNode('host-embed', embedSyntax)];
  return root;
}

test('expands a whole-note embed and applies the alias to its container label', async () => {
  const files = [mockFile('Host.md', '# Host'), mockFile('Notes/Linked.md', '# Linked note\nA paragraph.')];
  const app = createMockApp(files);
  const root = hostRoot('![[Notes/Linked|Readable alias]]');

  await expandEmbeddedNotes(root, {
    app,
    sourcePath: 'Host.md',
    parseMarkdown: fakeParser,
  });

  const embed = root.children[0];
  assert.equal(embed.type, 'noteEmbed');
  assert.equal(labelOf(embed), 'Embedded note: Readable alias');
  assert.equal(embed.children.length, 1);
  assert.ok(embed.children[0].data.maploomEmbedded);
  assert.equal(embed.children[0].position, undefined);
  assert.ok(embed.children[0].children.some((node) => labelOf(node) === 'Linked note'));
});

test('expands nested note embeds recursively and resolves each from its parent path', async () => {
  const resolutions: Array<{ linkpath: string; sourcePath: string }> = [];
  const files = [
    mockFile('Host.md', '![[Area/Source]]'),
    mockFile('Area/Source.md', '# Source\n![[Nested]]'),
    mockFile('Area/Nested.md', '# Nested Target\nNested note paragraph.'),
  ];
  const app = createMockApp(files, resolutions);
  const root = hostRoot('![[Area/Source]]');

  await expandEmbeddedNotes(root, {
    app,
    sourcePath: 'Host.md',
    parseMarkdown: fakeParser,
  });

  const sourceEmbed = root.children[0];
  assert.equal(sourceEmbed.type, 'noteEmbed');
  const sourceRoot = sourceEmbed.children[0];
  const nestedEmbed = sourceRoot.children.find((node) => node.type === 'noteEmbed');
  assert.ok(nestedEmbed, 'nested note should be represented by an embed node');
  assert.equal(labelOf(nestedEmbed), 'Embedded note: Nested');
  assert.ok(nestedEmbed.children[0].children.some((node) => labelOf(node) === 'Nested Target'));
  assert.ok(resolutions.some((call) =>
    call.linkpath === 'Nested' && call.sourcePath === 'Area/Source.md',
  ), 'nested target resolution must use the embedded note path');
});

test('stops circular embeds with a visible explanatory notice', async () => {
  const files = [
    mockFile('Host.md', '# Host'),
    mockFile('A.md', '# A\n![[Host]]'),
  ];
  const app = createMockApp(files);
  const root = hostRoot('![[A]]');

  await expandEmbeddedNotes(root, {
    app,
    sourcePath: 'Host.md',
    parseMarkdown: fakeParser,
  });

  const embedA = root.children[0];
  const embeddedRoot = embedA.children[0];
  const cycleNotice = embeddedRoot.children.find((node) => node.type === 'noteEmbedNotice');
  assert.ok(cycleNotice);
  assert.match(labelOf(cycleNotice), /Circular note embed skipped: Host/);
});

test('turns unresolved targets into an explanatory notice instead of throwing', async () => {
  const root = hostRoot('![[Missing Note]]');
  await expandEmbeddedNotes(root, {
    app: createMockApp([]),
    sourcePath: 'Host.md',
    parseMarkdown: fakeParser,
  });

  assert.equal(root.children[0].type, 'noteEmbedNotice');
  assert.match(labelOf(root.children[0]), /Unresolved note embed: Missing Note/);
});

test('does not silently expand section or block references as whole notes', async () => {
  for (const target of ['![[Linked#Heading]]', '![[Linked#^block-id]]']) {
    const root = hostRoot(target);
    await expandEmbeddedNotes(root, {
      app: createMockApp([mockFile('Linked.md', '# Linked')]),
      sourcePath: 'Host.md',
      parseMarkdown: fakeParser,
    });
    assert.equal(root.children[0].type, 'noteEmbedNotice');
    assert.match(labelOf(root.children[0]), /Section and block embeds are not yet supported/);
  }
});

test('rejects non-Markdown embed targets', async () => {
  const root = hostRoot('![[image.svg]]');
  await expandEmbeddedNotes(root, {
    app: createMockApp([mockFile('image.svg', '<svg/>')]),
    sourcePath: 'Host.md',
    parseMarkdown: fakeParser,
  });
  assert.equal(root.children[0].type, 'noteEmbedNotice');
  assert.match(labelOf(root.children[0]), /Unresolved note embed/);
});
