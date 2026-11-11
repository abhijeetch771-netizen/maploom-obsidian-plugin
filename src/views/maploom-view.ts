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
import { basicContent, imageContent } from '@markmap/render';
import { Markmap, resolveViewOptions } from '@markmap/view';

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
      const { root, frontmatter } = parse(markdown, { plugins: [remarkMath] });
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
        plugins: [basicContent, imageContent, mathContent],
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
