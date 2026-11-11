import {
  ItemView,
  MarkdownRenderer,
  MarkdownView,
  Notice,
  TFile,
  WorkspaceLeaf,
} from 'obsidian';
import { parse } from '@markmap/parse';
import { mathContent, remarkMath } from '@markmap/plugin-math';
import { basicContent, imageContent } from '@markmap/render';
import { Markmap, resolveViewOptions } from '@markmap/view';

export const VIEW_TYPE_MAPLOOM = 'maploom-view';

export class MaploomView extends ItemView {
  private svg: SVGSVGElement | null = null;
  private map: Markmap | null = null;
  private sourcePath: string | null = null;
  private sourceContent: HTMLElement | null = null;
  private sourcePanel: HTMLElement | null = null;
  private showSource = true;

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

    const sourceToggle = toolbar.createEl('button', { text: 'Hide source note' });
    sourceToggle.setAttribute('aria-pressed', 'true');
    sourceToggle.addEventListener('click', () => {
      this.showSource = !this.showSource;
      this.sourcePanel?.toggleClass('is-hidden', !this.showSource);
      sourceToggle.setText(this.showSource ? 'Hide source note' : 'Show source note');
      sourceToggle.setAttribute('aria-pressed', String(this.showSource));
    });

    const workspace = this.contentEl.createDiv({ cls: 'maploom-workspace' });
    const mapPanel = workspace.createDiv({ cls: 'maploom-map-panel' });
    this.svg = mapPanel.createSvg('svg', { cls: 'maploom-canvas' });
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');

    this.sourcePanel = workspace.createDiv({ cls: 'maploom-source-panel' });
    this.sourcePanel.createEl('div', { cls: 'maploom-source-heading', text: 'Source note' });
    this.sourceContent = this.sourcePanel.createDiv({ cls: 'maploom-source-content markdown-rendered' });

    await this.refreshFromActiveFile();
  }

  async onClose(): Promise<void> {
    this.map?.destroy();
    this.map = null;
    this.svg = null;
    this.sourceContent = null;
    this.sourcePanel = null;
  }

  async setSourceFile(file: TFile): Promise<void> {
    this.sourcePath = file.path;
    await this.renderMarkdown(await this.app.vault.cachedRead(file));
  }

  async refreshFromActiveFile(): Promise<void> {
    // Follow the active Markdown note when the user switches files.
    const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file
      ?? (this.sourcePath ? this.app.vault.getAbstractFileByPath(this.sourcePath) : null);

    if (!(file instanceof TFile) || file.extension !== 'md') return;

    this.sourcePath = file.path;
    await this.renderMarkdown(await this.app.vault.cachedRead(file));
  }

  private async renderSourceNote(markdown: string): Promise<void> {
    if (!this.sourceContent || !this.sourcePath) return;
    this.sourceContent.empty();

    try {
      // Obsidian's renderer resolves wikilinks, embeds, attachments, callouts,
      // and vault-specific Markdown using the source note's actual path.
      await MarkdownRenderer.render(
        this.app,
        markdown,
        this.sourceContent,
        this.sourcePath,
        this,
      );
    } catch (error) {
      console.error('Maploom source-note rendering failed', error);
      this.sourceContent.createEl('p', {
        text: 'Maploom could not render the source note. See the developer console.',
      });
    }
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

      // Deliberately omit Markmap's noteContent plugin: Maploom does not use
      // grey-dot popovers. All original note content is continuously visible
      // in the adjacent Obsidian-rendered source panel instead.
      const viewOptions = {
        ...options,
        plugins: [basicContent, imageContent, mathContent],
      };

      if (this.map) this.map.setTree(root, viewOptions);
      else this.map = Markmap.create(this.svg, root, viewOptions);

      await this.renderSourceNote(markdown);
      window.requestAnimationFrame(() => this.map?.fit());
    } catch (error) {
      console.error('Maploom rendering failed', error);
      new Notice('Maploom could not render this note. See the developer console.');
    }
  }
}
