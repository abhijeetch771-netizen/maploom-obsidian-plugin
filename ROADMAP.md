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
- [x] Verify a basic GFM table renders as a formatted table in a node-note popover (manual Obsidian test, 2026-11-11).
- [ ] Verify inline formatting, links, local images and task-list popovers using the expanded regression fixture.
- [x] Verify `@markmap/plugin-math` renders an inline LaTeX equation in an Obsidian node-note popover (manual test, 2026-11-11).
- [ ] Build regression fixtures.
- [ ] Resolve Obsidian wikilinks, embeds and asset paths safely.

## Phase 2 — Obsidian integration
- [ ] Live updates while editing the source note.
- [ ] Source navigation and stable note association.
- [ ] Frontmatter options and settings tab.
- [ ] Theme compatibility and accessibility checks.

## Phase 3 — Presentation and exports
- [ ] Classic, Cards and Minimal themes.
- [ ] Tree, Two-sided and Org chart layouts.
- [ ] Light/dark/automatic colour scheme.
- [ ] HTML, SVG and PNG exports.
- [ ] PDF print workflow including note contents and tables.

## Phase 4 — Visual editing
- [ ] Source-location mapping and edit model.
- [ ] Bidirectional Markdown synchronisation.
- [ ] Conflict detection, undo and data-integrity tests.

## Phase 5 — Public release
- [ ] Documentation, contribution guide and issue templates.
- [ ] CI build and test workflow.
- [ ] Dependency licence audit.
- [ ] Community-plugin submission review.
