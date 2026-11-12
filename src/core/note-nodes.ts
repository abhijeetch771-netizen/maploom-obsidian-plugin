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
  data?: Record<string, unknown>;
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
  position?: { start: number; end: number };
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

function tableToNode(block: NoteBlock, id: string): NoteTreeNode {
  const rows = block.children ?? [];
  const headerCells = rows[0]?.children ?? [];
  const headers = headerCells.map((cell, index) =>
    plainText(cell.children ?? []) || 'Column ' + (index + 1),
  );
  const dataRows = rows.slice(1).map((row) =>
    (row.children ?? []).map((cell) => plainText(cell.children ?? [])),
  );

  // A single custom inline atom is rendered as an aligned SVG table grid.
  // It remains one visual table rather than being flattened into hierarchy.
  const tableInline = {
    type: 'maploomTable',
    headers,
    rows: dataRows,
    align: (block as NoteBlock & { align?: Array<'left' | 'right' | 'center' | null> }).align ?? [],
  };

  return withSourcePosition(makeNode(
    id,
    'noteTable',
    [tableInline],
    [],
    'table',
  ), block);
}



interface CalloutInlineNode {
  type?: string;
  value?: string;
  url?: string;
  alt?: string;
  children?: CalloutInlineNode[];
}

interface CalloutTextRun {
  text: string;
  strong?: boolean;
  emphasis?: boolean;
  strike?: boolean;
  code?: boolean;
  href?: string;
}

function titleCase(value: string): string {
  return value.replace(/[-_]+/g, ' ').replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

/** Flatten phrasing AST into SVG-ready runs while retaining inline emphasis. */
function toCalloutRuns(nodes: CalloutInlineNode[]): CalloutTextRun[] {
  const runs: CalloutTextRun[] = [];

  const append = (
    text: string,
    style: Omit<CalloutTextRun, 'text'>,
  ): void => {
    if (!text) return;
    const last = runs[runs.length - 1];
    if (last && last.strong === style.strong && last.emphasis === style.emphasis
      && last.strike === style.strike && last.code === style.code && last.href === style.href) {
      last.text += text;
    } else {
      runs.push({ text, ...style });
    }
  };

  const visit = (
    node: CalloutInlineNode,
    inherited: Omit<CalloutTextRun, 'text'> = {},
  ): void => {
    switch (node.type) {
      case 'text':
        append(node.value ?? '', inherited);
        return;
      case 'inlineCode':
        append(node.value ?? '', { ...inherited, code: true });
        return;
      case 'break':
        append('\n', inherited);
        return;
      case 'strong':
        node.children?.forEach((child) => visit(child, { ...inherited, strong: true }));
        return;
      case 'emphasis':
        node.children?.forEach((child) => visit(child, { ...inherited, emphasis: true }));
        return;
      case 'delete':
        node.children?.forEach((child) => visit(child, { ...inherited, strike: true }));
        return;
      case 'link':
      case 'linkReference':
        node.children?.forEach((child) => visit(child, { ...inherited, href: node.url }));
        return;
      case 'image':
        append(node.alt ? '[' + node.alt + ']' : '[image]', inherited);
        return;
      default:
        node.children?.forEach((child) => visit(child, inherited));
    }
  };

  nodes.forEach((node) => visit(node));
  return runs;
}

interface CalloutDefinition {
  type: string;
  fold?: '+' | '-';
  title?: string;
  markerText: string;
}

/** Read the Obsidian callout declaration from its original first source line. */
function getCalloutDefinition(block: NoteBlock, markdown?: string): CalloutDefinition | null {
  if (!markdown) return null;
  const position = block.data?.maploomSourcePosition as
    | { start?: unknown }
    | undefined;
  if (typeof position?.start !== 'number') return null;

  const lineStart = markdown.lastIndexOf('\n', Math.max(0, position.start - 1)) + 1;
  const lineEndIndex = markdown.indexOf('\n', lineStart);
  const lineEnd = lineEndIndex < 0 ? markdown.length : lineEndIndex;
  const sourceLine = markdown.slice(lineStart, lineEnd);
  const calloutLine = sourceLine.replace(/^\s*(?:>\s*)+/, '').trim();
  const match = calloutLine.match(/^\[!([A-Za-z0-9_-]+)\]([+-])?(?:[ \t]+(.*))?$/);
  if (!match) return null;

  const type = match[1].toUpperCase();
  const fold = match[2] as '+' | '-' | undefined;
  const title = match[3]?.trim() || undefined;
  const markerText = '[!' + match[1] + ']' + (fold ?? '') + (title ? ' ' + title : '');
  return { type, fold, title, markerText };
}

/** Remove the callout declaration while retaining the original inline AST. */
function stripCalloutMarker(nodes: unknown[], markerText: string): unknown[] {
  let remaining = markerText;
  let consumed = false;
  const result: unknown[] = [];

  for (const item of nodes) {
    if (!remaining) {
      result.push(item);
      continue;
    }

    if (!item || typeof item !== 'object') {
      if (consumed) result.push(item);
      continue;
    }

    const node = item as { type?: string; value?: unknown };
    if (node.type !== 'text' || typeof node.value !== 'string') {
      if (consumed) result.push(item);
      else return nodes;
      continue;
    }

    const value = node.value;
    if (remaining.startsWith(value)) {
      remaining = remaining.slice(value.length);
      consumed = true;
      continue;
    }

    if (value.startsWith(remaining)) {
      const body = value.slice(remaining.length).replace(/^\s+/, '');
      if (body) result.push({ ...node, value: body });
      remaining = '';
      consumed = true;
      continue;
    }

    if (consumed) result.push(item);
    else return nodes;
  }

  if (!consumed || remaining) return nodes;

  // Whitespace can be a separate text node after the marker.
  for (let index = 0; index < result.length; index += 1) {
    const item = result[index];
    if (item && typeof item === 'object') {
      const node = item as { type?: string; value?: unknown };
      if (node.type === 'text' && typeof node.value === 'string') {
        const value = node.value.replace(/^\s+/, '');
        if (!value) result.splice(index, 1);
        else result[index] = { ...node, value };
        break;
      }
    }
  }
  return result;
}

function blockquoteToNode(
  block: NoteBlock,
  id: string,
  markdown?: string,
): NoteTreeNode {
  const definition = getCalloutDefinition(block, markdown);
  if (!definition) {
    const quote = makeNode(
      id,
      'noteBlockquote',
      [textNode('Blockquote')],
      [],
      'blockquote',
    );
    quote.children = (block.children ?? []).map((child, childIndex) =>
      blockToNode(child, id + '-quote-' + (childIndex + 1), markdown),
    );
    return withSourcePosition(quote, block);
  }

  const foldLabel = definition.fold === '-'
    ? ' (collapsed)'
    : definition.fold === '+'
      ? ' (expanded)'
      : '';
  const label = definition.type + foldLabel + (definition.title ? ' — ' + definition.title : '');
  const callout = makeNode(
    id,
    'noteCallout',
    [textNode(label)],
    [],
    'callout',
  );
  callout.data.maploomCalloutType = definition.type.toLowerCase();
  if (definition.title) callout.data.maploomCalloutTitle = definition.title;
  if (definition.fold) callout.data.maploomCalloutFold = definition.fold;

  const blocks = [...(block.children ?? [])];
  const paragraphs: Array<{ runs: CalloutTextRun[] }> = [];

  blocks.forEach((child, childIndex) => {
    if (child.type === 'paragraph') {
      const inline = childIndex === 0
        ? stripCalloutMarker(inlineContent(child), definition.markerText)
        : inlineContent(child);
      const runs = toCalloutRuns(inline as CalloutInlineNode[]);
      if (runs.length > 0) paragraphs.push({ runs });
      return;
    }

    callout.children.push(
      blockToNode(child, id + '-callout-' + (childIndex + 1), markdown),
    );
  });

  callout.content = [{
    type: 'maploomCallout',
    calloutType: definition.type.toLowerCase(),
    title: definition.title || titleCase(definition.type.toLowerCase()),
    fold: definition.fold,
    paragraphs,
  }];
  return withSourcePosition(callout, block);
}

function withSourcePosition(node: NoteTreeNode, block: NoteBlock): NoteTreeNode {
  const position = block.data?.maploomSourcePosition as
    | { start?: unknown; end?: unknown }
    | undefined;
  if (typeof position?.start === 'number' && typeof position.end === 'number') {
    node.position = { start: position.start, end: position.end };
  }
  return node;
}

function blockToNode(block: NoteBlock, id: string, markdown?: string): NoteTreeNode {
  switch (block.type) {
    case 'paragraph':
      return withSourcePosition(
        makeNode(id, 'noteParagraph', inlineContent(block), [], 'paragraph'),
        block,
      );

    case 'table':
      return tableToNode(block, id);

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
        withSourcePosition(makeNode(
          id + '-line-' + (lineIndex + 1),
          'noteCodeLine',
          [{ type: 'inlineCode', value: line || ' ' }],
          [],
          'codeLine',
        ), block),
      );
      return withSourcePosition(code, block);
    }

    case 'blockquote':
      return blockquoteToNode(block, id, markdown);

    case 'list': {
      const list = makeNode(id, 'noteList', [textNode('List')], [], 'list');
      list.children = (block.children ?? []).map((item, itemIndex) => {
        const first = item.children?.[0];
        const label = first?.type === 'paragraph' ? inlineContent(first) : [textNode(plainText(item.children ?? []))];
        const child = withSourcePosition(makeNode(
          id + '-item-' + (itemIndex + 1),
          'noteListItem',
          label,
          [],
          'listItem',
        ), item);
        child.children = (item.children ?? []).slice(1).map((nested, nestedIndex) =>
          blockToNode(nested, child.id + '-nested-' + (nestedIndex + 1), markdown),
        );
        return child;
      });
      return withSourcePosition(list, block);
    }

    case 'thematicBreak':
      return withSourcePosition(
        makeNode(id, 'noteRule', [textNode('Horizontal rule')], [], 'rule'),
        block,
      );

    default: {
      const label = plainText(block.children ?? []) || block.value || block.type || 'Content';
      return withSourcePosition(
        makeNode(id, 'noteContent', [textNode(label)], [], block.type ?? 'content'),
        block,
      );
    }
  }
}

/**
 * Recursively insert each note block as a child of the node that owns it.
 * The after index keeps note blocks in source order relative to existing children.
 */
export function materializeNoteBlocks(root: NoteTreeNode, markdown?: string): void {
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
          blockToNode(note.block, node.id + '-maploom-note-' + (noteIndex + 1), markdown),
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
