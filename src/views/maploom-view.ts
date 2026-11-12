import {
  App,
  Component,
  ItemView,
  Keymap,
  MarkdownRenderer,
  MarkdownView,
  Modal,
  Notice,
  TFile,
  WorkspaceLeaf,
} from 'obsidian';
import { parse } from '@markmap/parse';
import { mathContent, remarkMath } from '@markmap/plugin-math';
import { basicContent } from '@markmap/render';
import { Markmap, resolveViewOptions } from '@markmap/view';
import { materializeNoteBlocks, type NoteTreeNode } from '../core/note-nodes';
import { createVaultImageContent } from '../core/image-content';
import { tableContent } from '../core/table-content';
import { expandEmbeddedNotes } from '../core/embedded-notes';

interface RemarkNode {
  type?: string;
  value?: string;
  url?: string;
  alt?: string;
  position?: {
    start?: { offset?: number };
    end?: { offset?: number };
  };
  data?: Record<string, unknown>;
  children?: RemarkNode[];
}

/**
 * Convert Obsidian wikilinks in Markdown labels to Markmap link nodes.
 * The special fragment URL is intercepted by the SVG click handler below
 * and routed through Obsidian's own link resolver.
 */
function createRemarkObsidianWikilinks(app: App, sourcePath: string) {
  return function remarkObsidianWikilinks() {
    return function transform(tree: RemarkNode): void {
      const visit = (parent: RemarkNode): void => {
        if (!Array.isArray(parent.children)) return;
        if (parent.type === 'link' || parent.type === 'linkReference') return;

        parent.children = parent.children.flatMap((child) => {
          if (child.type === 'text' && typeof child.value === 'string') {
            return splitWikilinks(child.value, app, sourcePath);
          }
          visit(child);
          return [child];
        });
      };

      visit(tree);
    };
  };
}

function splitWikilinks(value: string, app: App, sourcePath: string): RemarkNode[] {
  const pattern = /\[\[([^\]]+)\]\]/g;
  const result: RemarkNode[] = [];
  let from = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value))) {
    const start = match.index;
    const end = pattern.lastIndex;

    // Do not turn an Obsidian embed (![[...]]), which has its own renderer,
    // into a map-label hyperlink.
    if (start > 0 && value[start - 1] === '!') continue;

    if (start > from) result.push({ type: 'text', value: value.slice(from, start) });

    const raw = match[1].trim();
    const separator = raw.indexOf('|');
    const target = (separator < 0 ? raw : raw.slice(0, separator)).trim();
    const alias = separator < 0 ? '' : raw.slice(separator + 1).trim();

    if (!target) {
      result.push({ type: 'text', value: match[0] });
    } else {
      const pathPart = target.split('#')[0].split('^')[0].trim();
      const resolved = app.metadataCache.getFirstLinkpathDest(pathPart || sourcePath, sourcePath);
      const fallback = pathPart.split('/').filter(Boolean).pop()?.replace(/\\.md$/i, '');
      const headingOnly = target.startsWith('#') ? target.slice(1) : '';
      const label = alias || resolved?.basename || fallback || headingOnly || target;

      result.push({
        type: 'link',
        url: `#maploom-wikilink:${encodeURIComponent(JSON.stringify({ target, sourcePath }))}`,
        children: [{ type: 'text', value: label }],
      });
    }

    from = end;
  }

  if (from < value.length) result.push({ type: 'text', value: value.slice(from) });
  return result.length ? result : [{ type: 'text', value }];
}


const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico',
]);

function resolveVaultImageSource(app: App, rawPath: string, sourcePath: string): string | null {
  const value = rawPath.trim();
  if (!value) return null;
  if (/^(https?:|data:|app:|obsidian:)/i.test(value) || value.startsWith('//')) return value;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Keep the path as written when it contains malformed escapes.
  }

  const target = decoded.split('|')[0].split('#')[0].trim();
  const file = app.metadataCache.getFirstLinkpathDest(target, sourcePath);
  if (!(file instanceof TFile) || !IMAGE_EXTENSIONS.has(file.extension.toLowerCase())) return null;
  return app.vault.getResourcePath(file);
}

/**
 * Resolve normal Markdown images and Obsidian ![[image]] embeds to vault
 * resource URLs before Markmap lays out the tree.
 */
function createRemarkObsidianImages(app: App, sourcePath: string) {
  return function remarkObsidianImages() {
    return function transform(tree: RemarkNode): void {
      const visit = (parent: RemarkNode): void => {
        if (!Array.isArray(parent.children)) return;
        if (parent.type === 'link' || parent.type === 'linkReference') return;

        parent.children = parent.children.flatMap((child) => {
          if (child.type === 'image' && typeof child.url === 'string') {
            const resolved = resolveVaultImageSource(app, child.url, sourcePath);
            if (resolved) child.url = resolved;
            return [child];
          }

          if (child.type === 'text' && typeof child.value === 'string') {
            return splitObsidianImageEmbeds(child.value, app, sourcePath);
          }

          visit(child);
          return [child];
        });
      };
      visit(tree);
    };
  };
}

function splitObsidianImageEmbeds(value: string, app: App, sourcePath: string): RemarkNode[] {
  const pattern = /!\[\[([^\]]+)\]\]/g;
  const result: RemarkNode[] = [];
  let from = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value))) {
    const start = match.index;
    const end = pattern.lastIndex;
    const rawTarget = match[1].trim();
    const target = rawTarget.split('|')[0].trim();
    const resolved = resolveVaultImageSource(app, target, sourcePath);

    if (!resolved) continue;

    if (start > from) result.push({ type: 'text', value: value.slice(from, start) });
    const filename = target.split('/').filter(Boolean).pop() ?? target;
    const alt = filename.replace(/\.[^.]+$/, '');
    result.push({ type: 'image', url: resolved, alt });
    from = end;
  }

  if (from < value.length) result.push({ type: 'text', value: value.slice(from) });
  return result.length ? result : [{ type: 'text', value }];
}

interface SourceLocation {
  start: number;
  end: number;
  type: string;
}

/** Preserve mdast offsets through Markmap's note-block position stripping. */
function remarkCaptureSourcePositions() {
  return function transform(tree: RemarkNode): void {
    const visit = (node: RemarkNode): void => {
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

function injectSourceAnchor(
  markdown: string,
  location: SourceLocation,
  anchorId: string,
): string {
  const offset = Math.max(0, Math.min(markdown.length, location.start));
  const lineStart = markdown.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
  const lineEndIndex = markdown.indexOf('\n', offset);
  const lineEnd = lineEndIndex < 0 ? markdown.length : lineEndIndex;
  const line = markdown.slice(lineStart, lineEnd);
  const marker = '<span id="' + anchorId + '" class="maploom-source-anchor"></span>';

  // Preserve Markdown block syntax by inserting inline HTML after structural
  // prefixes (heading marks, list markers or blockquote marks).
  const heading = line.match(/^(\s{0,3}#{1,6}\s+)/);
  const quote = line.match(/^(\s*(?:>\s*)+)/);
  const list = line.match(/^(\s*(?:[-+*]|\d+[.)])\s+)/);
  const isFence = line.trimStart().startsWith('```') || line.trimStart().startsWith('~~~');

  if (isFence || location.type === 'noteCode') {
    return markdown.slice(0, lineStart) + marker + '\n\n' + markdown.slice(lineStart);
  }

  let insertAt = offset;
  if (heading) insertAt = lineStart + heading[1].length;
  else if (quote) insertAt = lineStart + quote[1].length;
  else if (list) insertAt = lineStart + list[1].length;
  else if (location.type === 'noteTable' || line.trimStart().startsWith('|')) {
    const firstPipe = line.indexOf('|');
    if (firstPipe >= 0) insertAt = lineStart + firstPipe + 1;
  }

  return markdown.slice(0, insertAt) + marker + markdown.slice(insertAt);
}

export const VIEW_TYPE_MAPLOOM = 'maploom-view';

/**
 * On-demand, native Obsidian rendering of the complete source note.
 * The modal is separate from the map canvas, so opening/closing it never
 * changes the map's viewport or its available zoom/pan area.
 */
class SourceNoteModal extends Modal {
  private readonly rendererComponent = new Component();
  private highlightTimeout: number | null = null;

  constructor(
    app: App,
    private readonly markdown: string,
    private readonly sourcePath: string,
    private readonly targetAnchorId?: string,
    private readonly targetNodeType?: string,
  ) {
    super(app);
    this.modalEl.addClass('maploom-source-modal');
  }

  async onOpen(): Promise<void> {
    this.setTitle('Source note');
    this.contentEl.addClass('maploom-source-content');
    this.rendererComponent.load();

    // MarkdownRenderer.render() creates Obsidian-styled internal-link anchors,
    // but a standalone Modal does not receive Reading View's delegated link
    // handlers. Route clicks through Workspace.openLinkText() using this
    // source note's path so relative wikilinks and heading links resolve.
    this.rendererComponent.registerDomEvent(this.contentEl, 'click', (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a.internal-link') as HTMLAnchorElement | null;
      const linkText = anchor?.getAttribute('href');
      if (!linkText) return;

      event.preventDefault();
      event.stopPropagation();
      void this.app.workspace.openLinkText(
        linkText,
        this.sourcePath,
        Keymap.isModEvent(event),
      );
    });

    try {
      await MarkdownRenderer.render(
        this.app,
        this.markdown,
        this.contentEl,
        this.sourcePath,
        this.rendererComponent,
      );

      if (this.targetAnchorId) {
        const marker = this.contentEl.querySelector(
          '#' + this.targetAnchorId,
        ) as HTMLElement | null;
        if (marker) {
          let target = marker.closest(
            'h1,h2,h3,h4,h5,h6,p,li,blockquote,td,th,pre',
          ) as HTMLElement | null ?? marker;

          if (this.targetNodeType === 'noteCode' || this.targetNodeType === 'noteCodeLine') {
            // MarkdownRenderer can wrap an isolated anchor in its own empty
            // paragraph before a fenced code block. Sibling lookup is therefore
            // unreliable. Find the first <pre> that follows the marker in DOM
            // document order and highlight that actual rendered code block.
            const followingCodeBlock = Array.from(
              this.contentEl.querySelectorAll('pre'),
            ).find((pre) =>
              Boolean(marker.compareDocumentPosition(pre) & Node.DOCUMENT_POSITION_FOLLOWING),
            );
            if (followingCodeBlock) target = followingCodeBlock;
          }

          target.classList.add('maploom-source-highlight');
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          this.highlightTimeout = window.setTimeout(() => {
            target.classList.remove('maploom-source-highlight');
            this.highlightTimeout = null;
          }, 2400);
        } else {
          console.warn('Maploom: source marker was not rendered', this.targetAnchorId);
        }
      }
    } catch (error) {
      console.error('Maploom source-note rendering failed', error);
      this.contentEl.createEl('p', {
        text: 'Maploom could not render the source note. See the developer console.',
      });
    }
  }

  onClose(): void {
    if (this.highlightTimeout !== null) window.clearTimeout(this.highlightTimeout);
    this.rendererComponent.unload();
    this.contentEl.empty();
  }
}

export class MaploomView extends ItemView {
  private svg: SVGSVGElement | null = null;
  private map: Markmap | null = null;
  private sourcePath: string | null = null;
  private sourceMarkdown: string | null = null;
  private showNoteContent = true;
  private readonly vaultImageContent = createVaultImageContent();
  private readonly sourceLocations = new Map<string, SourceLocation>();
  private sourceAnchorSequence = 0;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_MAPLOOM;
  }

  getDisplayText(): string {
    return 'Maploom';
  }

  getIcon(): string {
    return 'git-branch';
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass('maploom-view');

    const toolbar = this.contentEl.createDiv({ cls: 'maploom-toolbar' });
    toolbar.createEl('button', { text: 'Fit' }).addEventListener('click', () => this.map?.fit());
    toolbar.createEl('button', { text: 'Expand all' }).addEventListener('click', () => this.map?.expandAll());
    toolbar.createEl('button', { text: 'Fold all' }).addEventListener('click', () => this.map?.foldAll());
    const notesToggle = toolbar.createEl('button', { text: 'Hide notes' });
    notesToggle.setAttribute('aria-pressed', 'true');
    notesToggle.addEventListener('click', () => {
      this.showNoteContent = !this.showNoteContent;
      notesToggle.setText(this.showNoteContent ? 'Hide notes' : 'Show notes');
      notesToggle.setAttribute('aria-pressed', String(this.showNoteContent));
      if (this.sourceMarkdown) void this.renderMarkdown(this.sourceMarkdown);
    });
    toolbar.createEl('button', { text: 'Source note' }).addEventListener('click', () => this.openSourceNote());

    const mapPanel = this.contentEl.createDiv({ cls: 'maploom-map-panel' });
    mapPanel.setAttribute(
      'aria-label',
      'Mind map. Click a heading or content node to open and highlight its source section.',
    );
    Object.assign(mapPanel.style, {
      position: 'relative',
      display: 'flex',
      flex: '1 1 0',
      minWidth: '0',
      minHeight: '0',
      width: '100%',
      overflow: 'hidden',
    });

    this.svg = mapPanel.createSvg('svg', { cls: 'maploom-canvas' });
    Object.assign(this.svg.style, {
      display: 'block',
      flex: '1 1 0',
      width: '100%',
      height: '100%',
      minWidth: '0',
      minHeight: '0',
    });
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');

    // Markmap emits SVG anchors for linked label text. Route our special
    // wikilink fragments through Obsidian instead of opening them in a browser.
    this.registerDomEvent(this.contentEl, 'pointermove', (event: PointerEvent) => {
      if (!this.map || !this.svg) return;
      const hit = this.map.hitAt(...this.map.layoutPoint(event.clientX, event.clientY));
      if (hit?.kind === 'node') {
        this.svg.style.cursor = this.sourceLocations.has(hit.nodeId) ? 'pointer' : '';
      }
    });

    this.registerDomEvent(this.contentEl, 'click', (event: MouseEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return;

      const anchor = event.target.closest('a[href]');
      const href = anchor?.getAttribute('href') ?? '';
      const prefix = '#maploom-wikilink:';

      // Wikilinks inside labels navigate to their target; do not open the
      // source note for those clicks.
      if (href.startsWith(prefix) && this.sourcePath) {
        event.preventDefault();
        event.stopPropagation();
        try {
          const decoded = decodeURIComponent(href.slice(prefix.length));
          let linkText = decoded;
          let linkSourcePath = this.sourcePath;
          try {
            const payload = JSON.parse(decoded) as {
              target?: unknown;
              sourcePath?: unknown;
            };
            if (typeof payload.target === 'string') linkText = payload.target;
            if (typeof payload.sourcePath === 'string') linkSourcePath = payload.sourcePath;
          } catch {
            // Accept link fragments created by older Maploom builds.
          }
          void this.app.workspace.openLinkText(
            linkText,
            linkSourcePath,
            Keymap.isModEvent(event),
          );
        } catch (error) {
          console.error('Maploom wikilink navigation failed', error);
          new Notice('Maploom could not open that internal link.');
        }
        return;
      }

      // Ordinary Markdown links keep their native behaviour.
      if (anchor || !this.map || !this.sourceMarkdown || !this.sourcePath) return;

      const hit = this.map.hitAt(...this.map.layoutPoint(event.clientX, event.clientY));
      if (!hit || hit.kind !== 'node') return;

      const location = this.sourceLocations.get(hit.nodeId);
      if (!location) return;

      event.preventDefault();
      event.stopPropagation();
      this.openSourceNoteAt(location);
    }, true);

    await this.refreshFromActiveFile();
  }

  async onClose(): Promise<void> {
    this.map?.destroy();
    this.map = null;
    this.svg = null;
    this.sourceMarkdown = null;
    this.sourcePath = null;
    this.sourceLocations.clear();
  }

  async setSourceFile(file: TFile): Promise<void> {
    this.sourcePath = file.path;
    this.sourceMarkdown = await this.app.vault.cachedRead(file);
    await this.renderMarkdown(this.sourceMarkdown);
  }

  async refreshFromActiveFile(): Promise<void> {
    const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file
      ?? (this.sourcePath ? this.app.vault.getAbstractFileByPath(this.sourcePath) : null);

    if (!(file instanceof TFile) || file.extension !== 'md') return;

    this.sourcePath = file.path;
    this.sourceMarkdown = await this.app.vault.cachedRead(file);
    await this.renderMarkdown(this.sourceMarkdown);
  }

  private openSourceNote(): void {
    if (!this.sourceMarkdown || !this.sourcePath) {
      new Notice('Maploom: no source note is available.');
      return;
    }

    new SourceNoteModal(this.app, this.sourceMarkdown, this.sourcePath).open();
  }

  private openSourceNoteAt(location: SourceLocation): void {
    if (!this.sourceMarkdown || !this.sourcePath) return;
    const anchorId = 'maploom-source-target-' + (++this.sourceAnchorSequence);
    const decorated = injectSourceAnchor(this.sourceMarkdown, location, anchorId);
    new SourceNoteModal(this.app, decorated, this.sourcePath, anchorId, location.type).open();
  }

  private async renderMarkdown(markdown: string): Promise<void> {
    if (!this.svg) return;

    try {
      const parsePlugins = this.sourcePath
        ? [
            remarkMath,
            createRemarkObsidianWikilinks(this.app, this.sourcePath),
            createRemarkObsidianImages(this.app, this.sourcePath),
          ]
        : [remarkMath];
      const { root, frontmatter } = parse(markdown, {
        plugins: [...parsePlugins, remarkCaptureSourcePositions],
      });
      const treeRoot = root as unknown as NoteTreeNode;

      // Materialize attached block notes as visible child branches. This keeps
      // their content in the map and in future static exports without markers.
      if (this.showNoteContent) {
        materializeNoteBlocks(treeRoot, markdown);

        if (this.sourcePath) {
          await expandEmbeddedNotes(treeRoot, {
            app: this.app,
            sourcePath: this.sourcePath,
            parseMarkdown: (embeddedMarkdown, embeddedPath) => {
              const embedded = parse(embeddedMarkdown, {
                plugins: [
                  remarkMath,
                  createRemarkObsidianWikilinks(this.app, embeddedPath),
                  createRemarkObsidianImages(this.app, embeddedPath),
                  remarkCaptureSourcePositions,
                ],
              });
              return embedded.root as unknown as NoteTreeNode;
            },
          });
        }
      }

      this.sourceLocations.clear();
      const collectSourceLocations = (node: NoteTreeNode): void => {
        // Imported nodes belong to an embedded file, not the active source
        // note. The embed container itself retains the host-note location.
        if (node.data?.maploomEmbedded === true) return;

        const position = node.position ?? (
          node.data?.maploomSourcePosition as { start?: number; end?: number } | undefined
        );
        if (typeof position?.start === 'number' && typeof position.end === 'number') {
          this.sourceLocations.set(node.id, {
            start: position.start,
            end: position.end,
            type: node.type,
          });
        }
        node.children.forEach(collectSourceLocations);
      };
      collectSourceLocations(treeRoot);

      const { options, warnings } = resolveViewOptions(
        { colorScheme: 'auto' },
        frontmatter?.markmap,
      );

      if (warnings.length > 0) {
        console.warn('Maploom: ignored unsupported Markmap frontmatter options', warnings);
      }

      // Omit Markmap's noteContent plugin entirely: Maploom has no grey dots
      // or note popovers. The full source note is available on demand through
      // the Source note modal and will be included directly in exports.
      const viewOptions = {
        ...options,
        plugins: [basicContent, mathContent, tableContent, this.vaultImageContent],
      };

      if (this.map) this.map.setTree(root, viewOptions);
      else this.map = Markmap.create(this.svg, root, viewOptions);

      window.requestAnimationFrame(() => this.map?.fit());
    } catch (error) {
      console.error('Maploom rendering failed', error);
      new Notice('Maploom could not render this note. See the developer console.');
    }
  }
}
