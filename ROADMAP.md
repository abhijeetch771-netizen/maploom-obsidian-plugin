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
- [ ] Verify task-list checked state and content in the source-note panel.
- [ ] Build automated regression tests for Markdown/GFM rendering.
- [ ] Resolve Obsidian wikilinks, aliases, heading links, note embeds, image embeds, and attachments in a disposable vault.
- [ ] Verify that Obsidian-specific callouts, properties/frontmatter, block references, and relative attachment paths render correctly.

## Phase 2 — Obsidian integration and note presentation
- [x] Adopt a no-grey-dot interaction model: omit Markmap note markers and popovers.
- [x] Implement a persistent source-note panel rendered through Obsidian's MarkdownRenderer; panel is visible by default and can be hidden.
- [ ] Manually verify wikilinks, aliased links, heading links, note embeds and image embeds in the source panel.
- [ ] Add map-to-source navigation: selecting/focusing a map heading scrolls the source panel to the corresponding section.
- [ ] Live updates while editing the source note.
- [ ] Persist panel visibility and layout preferences.
- [ ] Settings tab for map, source panel and rendering options.
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
