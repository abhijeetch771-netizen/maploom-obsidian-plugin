import { TFile, type App } from 'obsidian';
import type { NoteTreeNode } from './note-nodes';
import { materializeNoteBlocks } from './note-nodes';

interface EmbeddedNoteOptions {
  app: App;
  sourcePath: string;
  parseMarkdown: (markdown: string, sourcePath: string) => NoteTreeNode;
}

interface EmbedReference {
  linkpath: string;
  alias?: string;
}

const MAX_EMBED_DEPTH = 5;
const MAX_EMBED_COUNT = 40;

function inlineText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const node = value as { type?: string; value?: unknown; children?: unknown[] };
  if ((node.type === 'text' || node.type === 'inlineCode') && typeof node.value === 'string') {
    return node.value;
  }
  return Array.isArray(node.children) ? node.children.map(inlineText).join('') : '';
}

/**
 * Only expand a standalone whole-note embed paragraph. Section/block embeds
 * and inline mixed-content embeds remain in their original text form rather
 * than being silently expanded as the wrong content.
 */
function getEmbedReference(node: NoteTreeNode): EmbedReference | null {
  if (node.type !== 'noteParagraph') return null;
  const value = node.content.map(inlineText).join('').trim();
  const match = value.match(/^!\[\[([^\]]+)\]\]$/);
  if (!match) return null;

  const parts = match[1].split('|');
  const linkpath = (parts[0] ?? '').trim();
  const alias = parts.slice(1).join('|').trim();
  if (!linkpath) return null;
  return { linkpath, alias: alias || undefined };
}

function setEmbedMessage(node: NoteTreeNode, message: string): void {
  node.type = 'noteEmbedNotice';
  node.content = [{ type: 'text', value: message }];
  node.children = [];
  node.data = { ...node.data, maploomNote: true, maploomNoteKind: 'embedNotice' };
}

function markEmbeddedSubtree(node: NoteTreeNode, prefix: string): void {
  node.id = prefix + node.id;
  node.data = { ...node.data, maploomEmbedded: true };
  // Embedded note offsets belong to another file. They must never be treated
  // as offsets into the active note by Maploom's source-navigation handler.
  node.position = undefined;
  node.children.forEach((child) => markEmbeddedSubtree(child, prefix));
  node.notes = [];
}

/**
 * Expand whole-note Obsidian embeds into nested map branches.
 *
 * The original source paragraph remains the source-linked container. Nodes
 * imported from the embedded file are marked as external to that source so
 * clicking them cannot accidentally navigate to an unrelated offset in the
 * host note. Nested embeds are supported with a depth/count limit and cycle
 * detection.
 */
export async function expandEmbeddedNotes(
  root: NoteTreeNode,
  options: EmbeddedNoteOptions,
): Promise<void> {
  const visited = new Set<string>([options.sourcePath.toLowerCase()]);
  let expandedCount = 0;

  const visit = async (
    node: NoteTreeNode,
    currentPath: string,
    depth: number,
  ): Promise<void> => {
    const reference = getEmbedReference(node);

    if (reference) {
      if (reference.linkpath.includes('#') || reference.linkpath.includes('^')) {
        setEmbedMessage(
          node,
          'Section and block embeds are not yet supported: ' + reference.linkpath,
        );
        return;
      }

      const file = options.app.metadataCache.getFirstLinkpathDest(
        reference.linkpath,
        currentPath,
      );

      if (!(file instanceof TFile) || file.extension.toLowerCase() !== 'md') {
        setEmbedMessage(node, 'Unresolved note embed: ' + reference.linkpath);
        return;
      }

      const canonicalPath = file.path.toLowerCase();
      if (visited.has(canonicalPath)) {
        setEmbedMessage(node, 'Circular note embed skipped: ' + file.basename);
        return;
      }
      if (depth >= MAX_EMBED_DEPTH || expandedCount >= MAX_EMBED_COUNT) {
        setEmbedMessage(node, 'Embed limit reached: ' + file.basename);
        return;
      }

      try {
        const markdown = await options.app.vault.cachedRead(file);
        const embeddedRoot = options.parseMarkdown(markdown, file.path);
        materializeNoteBlocks(embeddedRoot, markdown);

        expandedCount += 1;
        visited.add(canonicalPath);
        try {
          await visit(embeddedRoot, file.path, depth + 1);
        } finally {
          visited.delete(canonicalPath);
        }

        const prefix = node.id + '-embedded-';
        markEmbeddedSubtree(embeddedRoot, prefix);

        node.type = 'noteEmbed';
        node.content = [{
          type: 'text',
          value: 'Embedded note: ' + (reference.alias || file.basename),
        }];
        node.children = [...node.children, embeddedRoot];
        node.data = {
          ...node.data,
          maploomNote: true,
          maploomNoteKind: 'embeddedNote',
        };
      } catch (error) {
        console.warn('Maploom: failed to expand embedded note', file.path, error);
        setEmbedMessage(node, 'Could not load embedded note: ' + file.basename);
      }
      return;
    }

    for (const child of [...node.children]) {
      await visit(child, currentPath, depth);
    }
  };

  await visit(root, options.sourcePath, 0);
}
