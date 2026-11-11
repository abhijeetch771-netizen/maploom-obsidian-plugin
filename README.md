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
- Obsidian wikilinks in map labels are converted to readable link labels and routed through Obsidian navigation.
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
- `tests/fixtures/Maploom-Linked-Note.md`: target note for internal-link and embed tests.

## Roadmap

See [ROADMAP.md](ROADMAP.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Verification status

The early prototype has passed a local Windows build, GitHub Actions build, and manual rendering checks for tables, code, blockquotes, math, inline formatting, external links and a relative local SVG image.

The on-demand Source note modal, including internal-link click navigation, has been manually tested. The newly added wikilink conversion and navigation in map labels still require manual validation in a disposable Obsidian vault. Export functionality is planned but not implemented. Do not treat this prototype as an installable public release.

## Privacy and source integrity

Maploom reads the active note through Obsidian's Vault API and renders it locally. It does not rewrite source Markdown or upload vault content to a remote service.
