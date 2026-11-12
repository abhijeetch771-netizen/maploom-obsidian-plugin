import type { NoteBlock, NoteTreeNode } from '../src/core/note-nodes';

export function textNode(value: string): NoteBlock {
  return { type: 'text', value };
}

export function paragraph(value: string, start = 0): NoteBlock {
  return {
    type: 'paragraph',
    children: [textNode(value)],
    data: { maploomSourcePosition: { start, end: start + value.length } },
  };
}

export function treeNode(
  id: string,
  type = 'root',
  label = '',
): NoteTreeNode {
  return {
    id,
    type,
    content: label ? [{ type: 'text', value: label }] : [],
    notes: [],
    data: {},
    children: [],
  };
}

export function noteParagraphNode(id: string, value: string): NoteTreeNode {
  return {
    id,
    type: 'noteParagraph',
    content: [{ type: 'text', value }],
    notes: [],
    data: { maploomNote: true, maploomNoteKind: 'paragraph' },
    children: [],
  };
}

export function labelOf(node: NoteTreeNode): string {
  return node.content.map((part) => {
    if (!part || typeof part !== 'object') return String(part ?? '');
    const candidate = part as { value?: unknown };
    return typeof candidate.value === 'string' ? candidate.value : '';
  }).join('');
}
