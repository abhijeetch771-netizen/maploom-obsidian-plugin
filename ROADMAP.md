# Maploom roadmap

## Phase 0 — Prototype
- [x] TypeScript/Obsidian project structure.
- [x] Integrate `@markmap/parse` and `@markmap/view`.
- [x] Workspace view, ribbon icon and commands.
- [x] Install dependencies and verify production build (local Windows build and Node.js 26 CI, 2026-11-11).
- [x] Open prototype in a disposable Obsidian vault (manual test, 2026-11-11).

## Phase 1 — Rendering and content fidelity
- [x] Verify heading hierarchy, nested lists, task-list markers, blockquotes and code blocks in Obsidian (manual test, 2026-11-11).
- [ ] Verify paragraph ownership and rendering across larger notes.
- [x] Verify a basic GFM table renders as a formatted table (manual Obsidian test, 2026-11-11).
- [x] Verify inline bold, italic, strikethrough and inline code (manual Obsidian test, 2026-11-11).
- [x] Verify external Markdown hyperlinks render as clickable links (manual Obsidian test, 2026-11-11).
- [x] Verify a relative local SVG image renders (manual Obsidian test, 2026-11-11).
- [x] Verify `@markmap/plugin-math` renders an inline LaTeX equation (manual Obsidian test, 2026-11-11).
- [ ] Verify task-list checked state and content in source-note modal.
- [ ] Build automated regression tests for Markdown/GFM rendering.
- [ ] Convert Obsidian wikilinks in map-node labels into readable labels and actionable internal navigation; avoid showing raw `[[...]]` syntax in the graph.
- [ ] Define how embedded notes and images are represented in map-node labels/notes without duplicating or losing source content.
- [ ] Verify Obsidian-specific callouts, properties/frontmatter, block references and relative attachment paths.

## Phase 2 — Obsidian integration and note access
- [x] Adopt a no-grey-dot interaction model: omit Markmap note markers and popovers.
- [x] Make the map canvas use the full available workspace by default.
- [x] Add an on-demand Source note modal using Obsidian's MarkdownRenderer; opening it does not resize the map canvas.
- [x] Verify standard wikilinks, aliased wikilinks and heading links render as Obsidian links in the Source note modal (manual test, 2026-11-11; click navigation still to be tested).
- [x] Verify embedded notes render their headings, paragraphs, tables and blockquotes in the Source note modal (manual test, 2026-11-11).
- [x] Verify Obsidian image embeds and ordinary Markdown local images render in the Source note modal (manual test, 2026-11-11).
- [ ] Verify internal-link click navigation for standard, aliased and heading links.
- [ ] Add map-to-source navigation: selecting/focusing a map heading opens the source note and scrolls to the corresponding section.
- [ ] Live updates while editing the source note.
- [ ] Persist map display preferences.
- [ ] Settings tab for map and rendering options.
- [ ] Theme compatibility, keyboard navigation and accessibility checks.

## Phase 3 — Export
- [ ] Add an Export control with explicit format choices.
- [ ] Offline HTML export with map, source-note content, styles, images and required assets bundled locally.
- [ ] SVG export for the map, with a clear explanation of what static SVG can and cannot preserve.
- [ ] PNG export with configurable scale/background and sensible large-map handling.
- [ ] PDF export with print layout that includes the map **and the full source-note content**, including formatted tables, images, links and code; do not rely on grey dots, popovers or interactive controls.
- [ ] Export scope options: map only, source note only, or map plus source note.
- [ ] Verify exports with large notes, wide tables, page breaks, long code blocks and embedded files.

## Phase 4 — Presentation and advanced interaction
- [ ] Classic, Cards and Minimal themes.
- [ ] Tree, Two-sided and Org chart layouts.
- [ ] Light/dark/automatic colour scheme controls.
- [ ] Zoom, pan, focus, search and keyboard navigation refinements.
- [ ] Magic comments such as fold/foldAll.
- [ ] Large-map performance and accessibility evaluation.

## Phase 5 — Visual editing
- [ ] Source-location mapping and edit model.
- [ ] Bidirectional Markdown synchronisation.
- [ ] Conflict detection, undo and data-integrity tests.

## Phase 6 — Public release
- [ ] Documentation, contribution guide and issue templates.
- [ ] CI build, automated test suite and release workflow.
- [ ] Dependency licence and security audit.
- [ ] Obsidian community-plugin submission review.
- [ ] Versioned GitHub release with built `main.js`, `manifest.json` and optional `styles.css`.
