# Maploom technical architecture

## Principle

Markdown in the vault remains the source of truth. Maploom parses it into a Markmap tree and renders that tree in an Obsidian workspace view. Viewing a map must never rewrite the source note.

## Current view model

The Maploom workspace has one primary region:

1. **Map canvas:** Markmap renders the structural outline, hierarchy and foldable branches across the full available workspace.

A **Source note** toolbar command opens the complete original note in a native Obsidian modal, on demand. The modal uses Obsidian's `MarkdownRenderer.render` with the note's actual source path, so wikilinks, aliases, embeds, attachments, callouts, tables and other Obsidian-specific Markdown use Obsidian's own rendering pipeline.

The source note is not kept in a permanent side-by-side panel. Opening or closing its modal does not resize the map canvas. The user can close the modal and return to the full-size map. Since `MarkdownRenderer.render` does not attach Reading View's delegated internal-link click handlers in a standalone modal, Maploom registers a lifecycle-managed click handler on the modal content and routes internal links through `Workspace.openLinkText(linkText, sourcePath, Keymap.isModEvent(event))`.

Markmap's grey-dot note markers and click-to-open note popovers are deliberately disabled. Attached paragraphs, code blocks, blockquotes and lists are materialized into ordinary child branches beneath their owning node. Markdown tables are represented by a custom inline atom that draws a true grid-shaped SVG table inside one map node, preserving header cells, column boundaries, wrapped text and left/center/right alignment. A Show notes / Hide notes control toggles these materialized notes; notes are shown by default. The Source note modal remains available for full Obsidian formatting and semantic HTML tables.

## Map-to-source navigation

Each Markdown AST node receives a temporary `data.maploomSourcePosition` value before Markmap converts the AST to its smaller tree. Markmap heading/list nodes retain their own `position`; materialized note nodes copy the preserved offset into their synthetic node. This avoids guessing by heading text and handles duplicate titles.

On map clicks, Maploom uses Markmap's `hitAt` API to distinguish ordinary nodes from fold toggles and links. For a source-linked node, it decorates a rendering-only copy of the Markdown with an invisible anchor at the recorded source offset. The Source note modal renders that copy, scrolls to the marker's containing block and briefly highlights it. The original vault file is neither rewritten nor saved. Wikilink clicks continue to navigate to the wikilink target; fold controls continue to fold/unfold instead of opening the source modal.

## Obsidian callouts

When a blockquote note block begins with an Obsidian callout declaration, Maploom reads the declaration from the original Markdown source line using the preserved source offset. The marker is separated from the parsed inline AST, and the resulting graph node carries the normalized callout type, optional custom title and fold marker in its data. Its label presents the type/title (and whether Obsidian marks it collapsed or expanded); body paragraphs and nested blocks remain child nodes, with their existing inline formatting preserved.

The graph intentionally keeps callout body content visible even for a source callout marked collapsed. Maploom does not use popovers, and the fold marker is retained as metadata/label information rather than treated as an interactive disclosure control. Obsidian's original colored callout panel styling is not yet reproduced in the SVG graph; styling is a separate presentation enhancement. The Source note modal continues to use Obsidian's native Markdown renderer for full callout appearance. Manual verification of the graph conversion is pending.

## Obsidian note embeds

A standalone whole-note block embed such as `![[Another Note]]` is expanded into a nested graph branch. Maploom resolves the target from the containing note's path through Obsidian's metadata cache, reads the target through the Vault API, and parses it with the same math, wikilink and image transformations as the active note. The original embed paragraph becomes a labelled container, and the imported Markmap tree is nested beneath it.

Aliases in the embed syntax are used for the container label. Wikilinks inside the embedded note carry that note's source path in their internal Maploom link payload, so relative links resolve from the embedded file rather than the active host note. Local image embeds are resolved while parsing against the embedded file's path.

The host embed paragraph retains its source offset, so clicking that container opens the host note at the embed syntax. Imported child nodes are deliberately marked as belonging to an embedded file and do not reuse their offsets as if they belonged to the host note. Their own source-navigation behaviour is not implemented yet.

Expansion has cycle detection and limits on nesting depth and total embedded notes. The first implementation intentionally supports standalone whole-note block embeds only. Section/block embeds (for example `![[Note#Heading]]` or `![[Note#^block]]`) produce an explanatory map node. Mixed inline text-plus-embed paragraphs remain in their original text form and are not expanded. Whole-note expansion has been manually verified in Obsidian, including an alias and recursive nested whole-note embed. Embedded note headings, paragraphs, formatted tables and blockquotes render as nested graph content. Show notes / Hide notes behaviour has also been verified with embedded content. A relative wikilink inside an embedded note has been verified to navigate relative to that embedded note's path. A relative Obsidian image embed inside an embedded note has also been verified to resolve and render from that note's folder. Circular whole-note embed handling has been manually verified: Maploom displays an explanatory branch when a previously visited note is encountered and the graph remains responsive. The implementation has passed GitHub Actions CI, including `npm install` and `npm run build` on Node.js 26 (run 107, 2026-11-12). Full Obsidian embed fidelity remains available in the Source note modal.

## Initial pipeline

1. Obsidian identifies the active Markdown file.
2. Maploom reads it through the Vault API.
3. `@markmap/parse` converts Markdown into a Markmap tree, with the math parser plugin enabled.
4. Markdown table blocks are transformed into custom table atoms, while local Markdown images and Obsidian image embeds are resolved to vault resource URLs.
5. `@markmap/view` renders the structural tree, note branches, SVG table grids and image primitives into interactive SVG. The `noteContent` plugin is deliberately omitted.
6. When requested, the Source note modal uses Obsidian's `MarkdownRenderer.render` with the normalized source path and a managed `Component` lifecycle. This is the full-fidelity view for Obsidian syntax and semantic HTML tables.
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
