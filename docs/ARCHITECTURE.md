# Maploom technical architecture

## Principle

Markdown in the vault remains the source of truth. Maploom parses it into a Markmap tree and renders that tree in an Obsidian workspace view. Viewing a map must never rewrite the source note.

## Current view model

The Maploom workspace has two coordinated regions:

1. **Map canvas:** Markmap renders the structural outline, hierarchy and foldable branches.
2. **Source-note panel:** Obsidian's `MarkdownRenderer.render` renders the complete original note beside the map, using the actual vault source path.

The source-note panel is visible by default and can be hidden to give the map more space. It replaces Markmap's grey-dot note markers and click-to-open note popovers. The map must not depend on popovers for access to content.

Using Obsidian's own renderer in the source panel is intentional: it gives the panel the native handling for wikilinks, aliases, embeds, attachments, callouts and other Obsidian-specific Markdown. Markmap remains responsible for the map structure, not for reimplementing every Obsidian rendering feature.

## Initial pipeline

1. Obsidian identifies the active Markdown file.
2. Maploom reads it through the Vault API.
3. `@markmap/parse` converts Markdown into a Markmap tree, with the math parser plugin enabled.
4. `@markmap/view` renders the structural tree into interactive SVG. The `noteContent` plugin is deliberately omitted, so no grey-dot markers or note popovers are generated.
5. Obsidian's `MarkdownRenderer.render` renders the unchanged source Markdown in the persistent companion panel, with the source file path supplied for resolving internal links and embeds.
6. Maploom manages the view lifecycle, controls and refresh when the active file changes.

## Module boundaries

- `views/`: workspace view, map canvas, source-note panel and UI controls.
- `core/`: parsing, tree transformations and map controller.
- `content/`: Obsidian-specific links, embeds, attachment handling and content fidelity.
- `settings/`: persisted settings and settings UI.
- `export/`: HTML, SVG, PNG and PDF workflows.
- `editing/`: future source-aware visual editing and synchronisation.

## Constraints

- Never mutate Markdown merely to render it.
- The original source note remains visible and accessible without opening per-node popovers.
- Do not add grey-dot note markers or rely on interactive popovers for essential content.
- The source-note panel must use Obsidian's rendering pipeline for Obsidian syntax.
- Formatted tables are a release-blocking requirement.
- PDF export must include the map and full source-note content, including tables; it must not rely on grey dots or popovers.
- Offline HTML export must bundle its required styles and assets locally.
- Do not use remote CDNs or send vault content to external services.
- Do not assume Markmap resolves Obsidian wikilinks or embeds.
- Defer visual editing until source mapping and conflict handling are designed.
- SVG is the default map renderer; Canvas has accessibility trade-offs.

## Export design

Planned export scopes:

- Map only.
- Source note only.
- Map plus source note.

Planned formats:

- Offline HTML, preserving the map and rendered source content.
- SVG and PNG for static map graphics.
- PDF using a dedicated print layout containing the map and full note content. Wide tables, long code blocks, images and page breaks require explicit testing.

## API basis

The current implementation uses `parse(markdown)`, `Markmap.create(svg, root, options)`, `setTree`, `fit`, `expandAll`, `foldAll`, and Obsidian's `MarkdownRenderer.render(app, markdown, element, sourcePath, component)`.
