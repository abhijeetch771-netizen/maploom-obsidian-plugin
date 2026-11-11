# Maploom

**Grow your ideas into maps.**

Maploom is an open-source Obsidian plugin that turns Markdown notes into interactive mind maps using the Markmap engine.

> Early prototype — not yet feature-complete or ready for public release.

## Current prototype

- Interactive Markmap view for the active Markdown note.
- Ribbon icon and command palette commands.
- Fit, expand-all and fold-all controls.
- Automatic light/dark colour-scheme selection.
- Persistent Obsidian-rendered source-note panel beside the map.
- Source panel uses Obsidian's Markdown renderer for vault-native links, embeds, attachments, tables and other Obsidian Markdown features.
- No grey-dot note markers or click-to-open note popovers. The full source note remains visible by default; the panel can be hidden when more map space is needed.

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

The new persistent source-note panel and Obsidian-native wikilink/embed fixture still require manual validation in a disposable Obsidian vault. Export functionality is planned but not implemented. Do not treat this prototype as an installable public release.

## Privacy and source integrity

Maploom reads the active note through Obsidian's Vault API and renders it locally. It does not rewrite source Markdown or upload vault content to a remote service.
