# Maploom technical architecture

## Principle

Markdown in the vault remains the source of truth. Maploom parses it into a Markmap tree and renders that tree in an Obsidian workspace view. Viewing a map must never rewrite the source note.

## Current view model

The Maploom workspace has one primary region:

1. **Map canvas:** Markmap renders the structural outline, hierarchy and foldable branches across the full available workspace.

A **Source note** toolbar command opens the complete original note in a native Obsidian modal, on demand. The modal uses Obsidian's `MarkdownRenderer.render` with the note's actual source path, so wikilinks, aliases, embeds, attachments, callouts, tables and other Obsidian-specific Markdown use Obsidian's own rendering pipeline.

The source note is not kept in a permanent side-by-side panel. Opening or closing its modal does not resize the map canvas. The user can close the modal and return to the full-size map. Since `MarkdownRenderer.render` does not attach Reading View's delegated internal-link click handlers in a standalone modal, Maploom registers a lifecycle-managed click handler on the modal content and routes internal links through `Workspace.openLinkText(linkText, sourcePath, Keymap.isModEvent(event))`.

Markmap's grey-dot note markers and click-to-open note popovers are deliberately disabled. Attached block notes are materialized into ordinary child branches beneath their owning node. A Show notes / Hide notes control toggles these branches; notes are shown by default. Essential note content is therefore visible in the graph without per-node markers, while the Source note modal remains available for full Obsidian formatting.

## Initial pipeline

1. Obsidian identifies the active Markdown file.
2. Maploom reads it through the Vault API.
3. `@markmap/parse` converts Markdown into a Markmap tree, with the math parser plugin enabled.
4. `@markmap/view` renders the structural tree into interactive SVG. The `noteContent` plugin is deliberately omitted.
6. When requested, the Source note modal uses Obsidian's `MarkdownRenderer.render` with the normalized source path and a managed `Component` lifecycle.
7. Maploom manages the view lifecycle, controls and refresh when the active file changes.

## Module boundaries

- `views/`: workspace view, map canvas, source-note modal and UI controls.
- `core/`: parsing, tree transformations and map controller.
- `content/`: Obsidian-specific links, embeds, attachment handling and content fidelity.
- `settings/`: persisted settings and settings UI.
- `export/`: HTML, SVG, PNG and PDF workflows.
- `editing/`: future source-aware visual editing and synchronisation.

## Constraints

- Never mutate Markdown merely to render it.
- The map canvas gets the full available workspace by default.
- Do not add grey-dot note markers or rely on per-node popovers for essential content.
- Attached Markdown blocks must be represented as visible child branches by default; readers may hide these branches to reduce map density.
- Source content is available on demand through the Source note modal.
- The modal must not permanently reduce the map's viewport or zoom/pan area.
- The source-note modal must use Obsidian's rendering pipeline for Obsidian syntax.
- Formatted tables are a release-blocking requirement.
- PDF export must include the map and full source-note content, including tables; it must not rely on interactive UI.
- Offline HTML export must bundle required styles and assets locally.
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

The current implementation uses `parse(markdown)`, `Markmap.create(svg, root, options)`, `setTree`, `fit`, `expandAll`, `foldAll`, and Obsidian's `MarkdownRenderer.render(app, markdown, element, sourcePath, component)` inside a native `Modal`.
