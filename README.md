# Maploom

**Grow your ideas into maps.**

Maploom is an open-source Obsidian plugin that turns Markdown notes into interactive mind maps using the Markmap engine.

> Early prototype — not yet feature-complete or ready for public release.

## Current prototype

- Interactive Markmap view for the active Markdown note.
- Ribbon icon and command palette commands.
- Fit, expand-all and fold-all controls.
- Automatic light/dark colour-scheme selection.
- No grey-dot note markers or click-to-open note popovers.
- Attached paragraphs, code blocks and blockquotes are materialized as visible child branches; Markdown tables are rendered as grid-shaped SVG table blocks with headers, cell borders and column alignment. A Show notes / Hide notes control lets readers reduce map density.
- Obsidian wikilinks in map labels are converted to readable link labels and routed through Obsidian navigation, including relative links from embedded notes.
- Obsidian callouts are rendered as type-coloured SVG cards with an icon, title, fold indicator and visible body text. Inline bold/italic/strikethrough/code formatting and separate body paragraphs are retained. The renderer has passed GitHub Actions build verification; manual Obsidian verification is pending.
- Standalone whole-note embeds (`![[Note]]`) expand into nested graph branches, including the embedded note's headings, paragraphs, formatted tables and blockquotes. Alias handling and recursive whole-note embeds have also been manually verified. Relative wikilink rendering/navigation, relative image resolution from an embedded note, and circular whole-note embed protection have all been manually verified. Section/block and mixed inline embeds are not yet supported.
- Clicking a source-linked map node opens the Source note modal at the matching Markdown block, scrolls it into view and briefly highlights it.
- The map occupies the full Maploom workspace.
- A **Source note** toolbar button opens the complete original note in an on-demand Obsidian modal. The modal uses Obsidian's Markdown renderer for vault-native links, embeds, attachments, tables and other Obsidian Markdown features. Opening it does not reduce the map viewport.

## Development

Requires Node.js 26+ and npm.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/maploom/`, then enable Maploom under **Settings → Community plugins**.

## Tests

- `tests/fixtures/markdown-comprehensive.md`: standard Markdown/GFM, code, tables, math, images and formatting.
- `tests/fixtures/Obsidian-Native-Test.md`: wikilinks, aliases, heading links, note embeds and image embeds.
- `tests/fixtures/obsidian-callouts.md`: standard, custom-title, collapsed and formatted callouts.
- `tests/fixtures/Maploom-Linked-Note.md`: target note for internal-link and embed tests.

## Roadmap

See [ROADMAP.md](ROADMAP.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Verification status

The early prototype has passed a local Windows build, GitHub Actions build, and manual rendering checks for tables, code, blockquotes, math, inline formatting, external links, relative local Markdown images and Obsidian `![[image]]` embeds.

Task-list checked/unchecked states and labels have been verified in both the graph and Source note modal. Paragraph ownership, separation and source order have also been manually verified across a larger note. YAML frontmatter `title` is also used as the map root label. The on-demand Source note modal, including internal-link click navigation, has been manually tested. The no-dot note branches and table grid renderer have been manually verified. Both ordinary Markdown image previews and Obsidian `![[image]]` previews in the graph have also been verified. Map-to-source navigation has been manually verified for headings, paragraphs, list items, tables and code blocks; closing the modal returns to the unchanged map. Whole-note graph embeds have been manually verified, including aliases and recursive nested embeds. The embedded note's headings, paragraphs, formatted tables and blockquotes appear as nested graph content. The embedded-note edge cases listed above and the whole-note embed implementation have passed manual Obsidian testing and GitHub Actions CI. Export functionality is planned but not implemented. Do not treat this prototype as an installable public release.

## Privacy and source integrity

Maploom reads the active note through Obsidian's Vault API and renders it locally. It does not rewrite source Markdown or upload vault content to a remote service.
