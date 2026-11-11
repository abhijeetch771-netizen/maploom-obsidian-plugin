/**
 * Convert Markmap note blocks into ordinary map child nodes.
 *
 * This is the no-dot presentation: block content becomes part of the visible
 * graph hierarchy, so rendering and export do not depend on interactive
 * note markers or popovers. The original Markdown string is never changed.
 */
export interface NoteBlock {
  type?: string;
  value?: string;
  lang?: string | null;
  alt?: string | null;
  children?: NoteBlock[];
}

export interface NoteEntry {
  block: NoteBlock;
  after: number;
}

export interface NoteTreeNode {
  id: string;
  type: string;
  content: unknown[];
  notes: NoteEntry[];
  data: Record<string, unknown>;
  children: NoteTreeNode[];
}

function textNode(value: string): unknown {
  return { type: 'text', value };
}

function makeNode(
  id: string,
  type: string,
  content: unknown[],
  children: NoteTreeNode[] = [],
  noteKind?: string,
): NoteTreeNode {
  return {
    id,
    type,
    content,
    notes: [],
    data: noteKind ? { maploomNote: true, maploomNoteKind: noteKind } : { maploomNote: true },
    children,
  };
}

/** Preserve inline formatting by reusing the parsed Markdown phrasing nodes. */
function inlineContent(block: NoteBlock): unknown[] {
  return Array.isArray(block.children) ? block.children : [];
}

function plainText(nodes: NoteBlock[] = []): string {
  return nodes.map((node) => {
    if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'code') {
      return node.value ?? '';
    }
    if (node.type === 'image') return node.alt ?? '[image]';
    if (node.type === 'link' || node.type === 'linkReference') {
      return plainText(node.children ?? []);
    }
    return plainText(node.children ?? []);
  }).join('');
}

function rowContent(row: NoteBlock): unknown[] {
  const cells = row.children ?? [];
  const result: unknown[] = [];
  cells.forEach((cell, index) => {
    if (index) result.push(textNode('  |  '));
    result.push(...inlineContent(cell));
  });
  return result.length ? result : [textNode(plainText(cells))];
}

function blockToNode(block: NoteBlock, id: string): NoteTreeNode {
  switch (block.type) {
    case 'paragraph':
      return makeNode(id, 'noteParagraph', inlineContent(block), [], 'paragraph');

    case 'table': {
      const rows = block.children ?? [];
      const table = makeNode(
        id,
        'noteTable',
        [textNode('Table · ' + Math.max(0, rows.length - 1) + ' data rows')],
        [],
        'table',
      );
      table.children = rows.map((row, rowIndex) =>
        makeNode(
          id + '-row-' + (rowIndex + 1),
          'noteTableRow',
          rowContent(row),
          [],
          rowIndex === 0 ? 'tableHeader' : 'tableRow',
        ),
      );
      return table;
    }

    case 'code': {
      const language = block.lang ? ' · ' + block.lang : '';
      const code = makeNode(
        id,
        'noteCode',
        [textNode('Code block' + language)],
        [],
        'code',
      );
      const lines = (block.value ?? '').replace(/\r\n/g, '\n').split('\n');
      code.children = lines.map((line, lineIndex) =>
        makeNode(
          id + '-line-' + (lineIndex + 1),
          'noteCodeLine',
          [{ type: 'inlineCode', value: line || ' ' }],
          [],
          'codeLine',
        ),
      );
      return code;
    }

    case 'blockquote': {
      const quote = makeNode(
        id,
        'noteBlockquote',
        [textNode('Blockquote')],
        [],
        'blockquote',
      );
      quote.children = (block.children ?? []).map((child, childIndex) =>
        blockToNode(child, id + '-quote-' + (childIndex + 1)),
      );
      return quote;
    }

    case 'list': {
      const list = makeNode(id, 'noteList', [textNode('List')], [], 'list');
      list.children = (block.children ?? []).map((item, itemIndex) => {
        const first = item.children?.[0];
        const label = first?.type === 'paragraph' ? inlineContent(first) : [textNode(plainText(item.children ?? []))];
        const child = makeNode(
          id + '-item-' + (itemIndex + 1),
          'noteListItem',
          label,
          [],
          'listItem',
        );
        child.children = (item.children ?? []).slice(1).map((nested, nestedIndex) =>
          blockToNode(nested, child.id + '-nested-' + (nestedIndex + 1)),
        );
        return child;
      });
      return list;
    }

    case 'thematicBreak':
      return makeNode(id, 'noteRule', [textNode('Horizontal rule')], [], 'rule');

    default: {
      const label = plainText(block.children ?? []) || block.value || block.type || 'Content';
      return makeNode(id, 'noteContent', [textNode(label)], [], block.type ?? 'content');
    }
  }
}

/**
 * Recursively insert each note block as a child of the node that owns it.
 * The after index keeps note blocks in source order relative to existing children.
 */
export function materializeNoteBlocks(root: NoteTreeNode): void {
  const visit = (node: NoteTreeNode): void => {
    const existingChildren = [...node.children];
    const grouped = new Map<number, NoteEntry[]>();

    node.notes.forEach((note) => {
      const index = Math.max(0, Math.min(existingChildren.length, note.after));
      const entries = grouped.get(index) ?? [];
      entries.push(note);
      grouped.set(index, entries);
    });

    const nextChildren: NoteTreeNode[] = [];
    let noteIndex = 0;

    for (let index = 0; index <= existingChildren.length; index += 1) {
      for (const note of grouped.get(index) ?? []) {
        nextChildren.push(
          blockToNode(note.block, node.id + '-maploom-note-' + (noteIndex + 1)),
        );
        noteIndex += 1;
      }

      const child = existingChildren[index];
      if (child) {
        visit(child);
        nextChildren.push(child);
      }
    }

    node.children = nextChildren;
    node.notes = [];
  };
  visit(root);
}
