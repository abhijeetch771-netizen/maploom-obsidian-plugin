import { App, ItemView, MarkdownView, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import { parse } from '@markmap/parse';
import { mathContent, remarkMath } from '@markmap/plugin-math';
import { defaultContentPlugins } from '@markmap/render';
import { Markmap, resolveViewOptions, type ViewOptions } from '@markmap/view';

export const VIEW_TYPE_MAPLOOM = 'maploom-view';

/**
 * Resolve local Markdown images in a note popover.
 *
 * Markmap sanitizes Markdown-derived HTML before calling ContentPlugin.popover hooks.
 * Resolving to Obsidian's app:// resource URL during parsing is therefore too early:
 * the sanitizer removes that non-web protocol. This hook runs after sanitization and
 * only rewrites an image when Obsidian can resolve it to a file in this vault.
 */
function createObsidianImagePopoverPlugin(
  app: App,
  sourcePath: string,
): NonNullable<ViewOptions['plugins']>[number] {
  return {
    name: 'obsidian-vault-images',
    popover(tree) {
      const visit = (node: unknown): void => {
        if (!node || typeof node !== 'object') return;

        const item = node as {
          type?: unknown;
          tagName?: unknown;
          properties?: Record<string, unknown>;
          children?: unknown;
        };

        if (item.type === 'element' && item.tagName === 'img') {
          const src = item.properties?.src;
          if (typeof src === 'string' && src.trim()) {
            const value = src.trim();
            const isExternal =
              /^(https?:|data:|blob:|file:|app:|obsidian:)/i.test(value) ||
              value.startsWith('//');

            if (!isExternal) {
              let linkPath = value;
              try {
                linkPath = decodeURIComponent(value);
              } catch {
                // Keep the original link when URI decoding fails.
              }

              const file = app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
              if (file) item.properties!.src = app.vault.getResourcePath(file);
              else {
                console.warn('Maploom: local image could not be resolved', {
                  sourcePath,
                  linkPath,
                });
              }
            }
          }
        }

        if (Array.isArray(item.children)) item.children.forEach(visit);
      };

      visit(tree);
    },
  };
}

export class MaploomView extends ItemView {
  private svg: SVGSVGElement | null = null;
  private map: Markmap | null = null;
  private sourcePath: string | null = null;

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

    this.svg = this.contentEl.createSvg('svg', { cls: 'maploom-canvas' });
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');

    await this.refreshFromActiveFile();
  }

  async onClose(): Promise<void> {
    this.map?.destroy();
    this.map = null;
    this.svg = null;
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

  private async renderMarkdown(markdown: string): Promise<void> {
    if (!this.svg) return;

    try {
      const sourcePath = this.sourcePath;
      const { root, frontmatter } = parse(markdown, { plugins: [remarkMath] });
      const { options, warnings } = resolveViewOptions(
        { colorScheme: 'auto' },
        frontmatter?.markmap,
      );

      if (warnings.length > 0) {
        console.warn('Maploom: ignored unsupported Markmap frontmatter options', warnings);
      }

      const viewOptions = {
        ...options,
        plugins: [
          ...defaultContentPlugins,
          mathContent,
          ...(sourcePath ? [createObsidianImagePopoverPlugin(this.app, sourcePath)] : []),
        ],
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
