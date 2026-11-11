# Maploom technical architecture

## Principle
Markdown in the vault remains the source of truth. Maploom parses it into a Markmap tree and renders it in an Obsidian workspace view. Viewing a map must never rewrite the source note.

## Initial pipeline
1. Obsidian identifies the active Markdown file.
2. Maploom reads it through the Vault API.
3. `@markmap/parse` converts Markdown into a structured tree.
4. `@markmap/view` renders the tree into interactive SVG.
5. Maploom manages the view lifecycle and Obsidian commands.

## Module boundaries
- `views/`: workspace view and UI controls.
- `core/`: parsing, tree transformations and map controller.
- `content/`: notes, tables and Obsidian-specific rendering.
- `settings/`: persisted settings and settings UI.
- `export/`: HTML, SVG, PNG and PDF workflows.
- `editing/`: future source-aware visual editing and synchronisation.

## Constraints
- Never mutate Markdown merely to render it.
- Preserve content that does not become a branch.
- Formatted table rendering is a release-blocking requirement.
- Do not use remote CDNs or send vault content to external services.
- Do not assume Markmap resolves Obsidian wikilinks or embeds.
- Defer visual editing until source mapping and conflict handling are designed.
- SVG is the default renderer; Canvas has accessibility trade-offs.

## API basis
The current Markmap API documents `parse(markdown)`, `Markmap.create(svg, root)`, `setTree`, `fit`, `expandAll`, `foldAll`, and `destroy`.
