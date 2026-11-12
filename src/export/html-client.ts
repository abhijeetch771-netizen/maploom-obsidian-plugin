import type { MarkmapNode } from '@markmap/core';
import { mathContent } from '@markmap/plugin-math';
import { basicContent } from '@markmap/render';
import { Markmap, resolveViewOptions } from '@markmap/view';
import { calloutContent } from '../core/callout-content';
import { createVaultImageContent } from '../core/image-content';
import { tableContent } from '../core/table-content';

interface OfflineMapPayload {
  title: string;
  tree: MarkmapNode;
  markmapOptions?: unknown;
  sourceHtml: string;
}

function showError(message: string): void {
  const status = document.getElementById('maploom-status');
  if (status) status.textContent = message;
  console.error('Maploom offline export:', message);
}

function start(): void {
  try {
    const dataElement = document.getElementById('maploom-data');
    if (!dataElement?.textContent) {
      throw new Error('The exported map data is missing.');
    }

    const payload = JSON.parse(dataElement.textContent) as OfflineMapPayload;
    const app = document.getElementById('maploom-app');

    if (!app || !payload.tree || typeof payload.sourceHtml !== 'string') {
      throw new Error('The exported map or source note is incomplete.');
    }

    document.title = payload.title;

    app.innerHTML = `
      <header class="maploom-header">
        <div class="maploom-heading">
          <h1>${escapeText(payload.title)}</h1>
          <p>Exported by Maploom</p>
        </div>
        <nav class="maploom-toolbar" aria-label="Map controls">
          <button type="button" id="maploom-fit">Fit</button>
          <button type="button" id="maploom-expand">Expand all</button>
          <button type="button" id="maploom-fold">Fold all</button>
          <button type="button" id="maploom-source-toggle" aria-expanded="true">
            Hide source note
          </button>
        </nav>
      </header>
      <p id="maploom-status" class="maploom-status" role="status"></p>
      <main>
        <section id="maploom-map-panel" class="maploom-map-panel"
          aria-label="Interactive mind map">
          <svg id="maploom-map" class="markmap" role="img"
            aria-label="Interactive mind map"></svg>
        </section>
        <section id="maploom-source-panel" class="maploom-source-panel">
          <h2>Source note</h2>
          <article class="maploom-export-source markdown-rendered">
            ${payload.sourceHtml}
          </article>
        </section>
      </main>
      <footer class="maploom-footer">Created with Maploom</footer>
    `;

    const svg = document.getElementById('maploom-map') as SVGSVGElement | null;
    const fitButton = document.getElementById('maploom-fit');
    const expandButton = document.getElementById('maploom-expand');
    const foldButton = document.getElementById('maploom-fold');
    const sourceToggle = document.getElementById('maploom-source-toggle');
    const sourcePanel = document.getElementById('maploom-source-panel');
    const mapPanel = document.getElementById('maploom-map-panel');

    if (!svg || !fitButton || !expandButton || !foldButton ||
        !sourceToggle || !sourcePanel || !mapPanel) {
      throw new Error('The offline map interface could not be initialized.');
    }

    const { options, warnings } = resolveViewOptions(
      { colorScheme: 'auto' },
      payload.markmapOptions,
    );

    const map = Markmap.create(svg, payload.tree, {
      ...options,
      plugins: [
        basicContent,
        mathContent,
        tableContent,
        calloutContent,
        createVaultImageContent(),
      ],
    });

    fitButton.addEventListener('click', () => map.fit());
    expandButton.addEventListener('click', () => map.expandAll());
    foldButton.addEventListener('click', () => map.foldAll());

    sourceToggle.addEventListener('click', () => {
      const visible = sourcePanel.hidden;
      sourcePanel.hidden = !visible;
      sourceToggle.textContent = visible ? 'Hide source note' : 'Show source note';
      sourceToggle.setAttribute('aria-expanded', String(visible));
    });

    const explainInternalLink = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest(
        'a[href^="#maploom-wikilink:"], a[data-maploom-internal-link]',
      );

      if (!anchor) return;

      event.preventDefault();
      const status = document.getElementById('maploom-status');
      if (status) {
        status.textContent =
          'This is an Obsidian internal link. Open the original note in Obsidian to follow it.';
      }
    };

    mapPanel.addEventListener('click', explainInternalLink);
    sourcePanel.addEventListener('click', explainInternalLink);

    if (warnings.length > 0) {
      showError('Some unsupported map options were ignored: ' + warnings.join('; '));
    }

    window.requestAnimationFrame(() => map.fit());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showError(message);
  }
}

function escapeText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
