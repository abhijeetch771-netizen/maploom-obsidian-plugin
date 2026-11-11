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

interface RemarkNode {
  type?: string;
  value?: string;
  url?: string;
  alt?: string;
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
        url: `#maploom-wikilink:${encodeURIComponent(target)}`,
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

export const VIEW_TYPE_MAPLOOM = 'maploom-view';

/**
 * On-demand, native Obsidian rendering of the complete source note.
 * The modal is separate from the map canvas, so opening/closing it never
 * changes the map's viewport or its available zoom/pan area.
 */
class SourceNoteModal extends Modal {
  private readonly rendererComponent = new Component();

  constructor(
    app: App,
    private readonly markdown: string,
    private readonly sourcePath: string,
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
    } catch (error) {
      console.error('Maploom source-note rendering failed', error);
      this.contentEl.createEl('p', {
        text: 'Maploom could not render the source note. See the developer console.',
      });
    }
  }

  onClose(): void {
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
    this.registerDomEvent(this.contentEl, 'click', (event: MouseEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return;
      const anchor = event.target.closest('a[href]');
      const href = anchor?.getAttribute('href') ?? '';
      const prefix = '#maploom-wikilink:';
      if (!href.startsWith(prefix) || !this.sourcePath) return;

      event.preventDefault();
      event.stopPropagation();
      try {
        const linkText = decodeURIComponent(href.slice(prefix.length));
        void this.app.workspace.openLinkText(
          linkText,
          this.sourcePath,
          Keymap.isModEvent(event),
        );
      } catch (error) {
        console.error('Maploom wikilink navigation failed', error);
        new Notice('Maploom could not open that internal link.');
      }
    }, true);

    await this.refreshFromActiveFile();
  }

  async onClose(): Promise<void> {
    this.map?.destroy();
    this.map = null;
    this.svg = null;
    this.sourceMarkdown = null;
    this.sourcePath = null;
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
      const { root, frontmatter } = parse(markdown, { plugins: parsePlugins });
      // Materialize attached block notes as visible child branches. This keeps
      // their content in the map and in future static exports without markers.
      if (this.showNoteContent) materializeNoteBlocks(root as unknown as NoteTreeNode);
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
