# Maploom

**Grow your ideas into maps.**

Maploom is an open-source Obsidian plugin that turns Markdown notes into interactive mind maps using the Markmap engine.

> Early prototype — not yet feature-complete or ready for public release.

## Development

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/maploom/`, then enable Maploom under **Settings → Community plugins**.

## Current prototype
- Open the active Markdown note as an interactive Markmap.
- Ribbon icon and command palette entry.
- Fit, expand-all and fold-all controls.
- Markmap parser and interactive SVG view.

See [ROADMAP.md](ROADMAP.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Verification status

The source scaffold has been created, but dependency installation and compilation have not yet been verified. Do not treat this prototype as an installable release until the CI build passes and the plugin has been tested in a disposable Obsidian vault.
