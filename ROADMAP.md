# Maploom roadmap

## Phase 0 — Prototype
- [x] TypeScript/Obsidian project structure.
- [x] Integrate `@markmap/parse` and `@markmap/view`.
- [x] Workspace view, ribbon icon and commands.
- [x] Install dependencies and verify production build (local Windows build and Node.js 26 CI, 2026-11-11).
- [x] Open prototype in a disposable Obsidian vault (manual test, 2026-11-11).

## Phase 1 — Rendering and content fidelity
- [x] Verify heading hierarchy, nested lists, task-list markers, blockquotes and code blocks in Obsidian (manual test, 2026-11-11).
- [x] Verify paragraph ownership and rendering across a larger note: introductory paragraphs remain at root; paragraphs stay separate and in source order under their correct headings; paragraphs before/after lists remain with the owning section; no missing or duplicated paragraphs were visible (manual Obsidian test, user screenshot confirmation, 2026-11-12).
- [x] Verify a basic GFM table renders as a formatted table (manual Obsidian test, 2026-11-11).
- [x] Verify inline bold, italic, strikethrough and inline code (manual Obsidian test, 2026-11-11).
- [x] Verify external Markdown hyperlinks render as clickable links (manual Obsidian test, 2026-11-11).
- [x] Verify a relative local SVG image renders (manual Obsidian test, 2026-11-11).
- [x] Verify `@markmap/plugin-math` renders an inline LaTeX equation (manual Obsidian test, 2026-11-11).
- [x] Verify task-list checked state and labels in the graph and Source note modal: checked and unchecked tasks retain the correct state and text (manual Obsidian test, user confirmed, 2026-11-12).
- [ ] Build automated regression tests for Markdown/GFM rendering.
- [x] Manually verify map-label wikilinks: readable labels for standard, aliased and heading links, with navigation through `Workspace.openLinkText` (user confirmed, 2026-11-11).
- [x] Verify a standalone whole-note embed (`![[Note]]`) expands into a nested graph branch; the embedded note's heading, paragraphs, formatted table and blockquote appear in the graph (manual Obsidian test, user screenshot confirmation, 2026-11-12).
- [x] Verify Show notes / Hide notes toggling with an embedded note: embedded content disappears when notes are hidden and returns when shown (user screenshots confirmed, 2026-11-12).
- [x] Verify embed aliases (`![[Note|Alias]]`) are used as the embedded graph branch label (manual Obsidian test, user screenshot confirmation, 2026-11-12).
- [x] Verify recursive whole-note embeds: `Maploom-Linked-Note` expands `Maploom-Nested-Note`, including the nested heading and paragraph; verified under both normal and aliased embed branches (manual Obsidian test, user screenshot confirmation, 2026-11-12).
- [x] Verify relative wikilink rendering and navigation inside an embedded note: the link label renders and opens the sibling target note relative to the embedded file, not the host note (manual Obsidian test, user confirmed, 2026-11-12).
- [x] Verify relative Obsidian image embeds inside an embedded note: `![[maploom-fixture.svg]]` resolves from the embedded note's folder and renders as an image in the graph (manual Obsidian test, user screenshot confirmation, 2026-11-12).
- [x] Verify circular whole-note embed protection: repeated `Maploom-Linked-Note` is stopped with an explanatory branch and the graph remains responsive (manual Obsidian test, user screenshot confirmation, 2026-11-12).
- [ ] Extend graph expansion to section/block embeds (`![[Note#Heading]]`, `![[Note#^block]]`) and mixed inline embeds; these are intentionally not included in the first implementation.
- [x] Manually verify no-dot note materialization: paragraph text, table row branches, code lines, blockquotes and maths appear under their owning nodes (Obsidian test, 2026-11-12).
- [x] Verify the interim hierarchical table representation before replacing it with a proper grid (manual Obsidian test, 2026-11-12; superseded).
- [x] Implement and manually verify a grid-shaped SVG table atom with distinct header cells, cell borders, wrapped text, and preserved Markdown column alignment (user confirmed, 2026-11-12).
- [x] Manually verify table grid rendering in the Maploom graph (headers, cell grid and row/column preservation; user confirmed, 2026-11-12).
- [x] Verify a relative Markdown image appears as an actual image preview in the graph (Obsidian test, 2026-11-12).
- [x] Verify Obsidian `![[image]]` embeds appear as actual image previews in the graph; ordinary Markdown image previews also remain functional (manual Obsidian test, user screenshot confirmation, 2026-11-12).
- [x] Verify Show notes / Hide notes toggling; both states work without restoring grey dots (manual Obsidian test, 2026-11-12).
- [x] Verify YAML frontmatter `title` is used as the map root label (manual Obsidian test, `Maploom-Large-Paragraph-Test.md`, user screenshot confirmation, 2026-11-12).
- [x] Implement callout-aware note-block conversion: recognize the Obsidian callout type, custom title and fold marker from the original source line; preserve remaining inline body AST and subsequent body blocks as children (code committed; CI and manual verification pending).
- [ ] Manually verify callout type/title labels, body paragraphs, inline formatting and collapsed-callout content in the graph; Obsidian colour/panel styling is a separate presentation task.
- [ ] Verify additional Obsidian properties/frontmatter, block references and relative attachment paths.

## Phase 2 — Obsidian integration and note access
- [x] Adopt a no-grey-dot interaction model: omit Markmap note markers and popovers.
- [x] Implement and manually verify attached note blocks as ordinary child branches, with a working Show notes / Hide notes toolbar control (user confirmed, 2026-11-12).
- [x] Make the map canvas use the full available workspace by default.
- [x] Add an on-demand Source note modal using Obsidian's MarkdownRenderer; opening it does not resize the map canvas.
- [x] Verify standard wikilinks, aliased wikilinks and heading links render as Obsidian links in the Source note modal (manual test, 2026-11-11).
- [x] Verify embedded notes render their headings, paragraphs, tables and blockquotes in the Source note modal (manual test, 2026-11-11).
- [x] Verify Obsidian image embeds and ordinary Markdown local images render in the Source note modal (manual test, 2026-11-11).
- [x] Verify internal-link click navigation for standard, aliased and heading links from the Source note modal through `Workspace.openLinkText` (manual test, 2026-11-11).
- [x] Implement map-to-source navigation for the active note: Markmap hit-testing identifies the clicked node; preserved mdast offsets locate the exact source block; the Source note modal opens at that block, scrolls it into view and temporarily highlights it. Original Markdown is not modified (local production build, full manual Obsidian verification and GitHub Actions build, user confirmed 2026-11-12).
- [x] Manually verify map-to-source navigation for headings, paragraphs, list items, tables and code blocks in Obsidian; confirm closing the modal returns to the unchanged map view (user confirmed all cases, 2026-11-12).
- [x] Specifically verify code-block navigation highlights the rendered `<pre>` element itself, not the blank anchor paragraph immediately before the fenced block (manual Obsidian test; user confirmed, 2026-11-12).
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
