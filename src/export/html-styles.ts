export const STANDALONE_HTML_STYLES = `
:root {
  color-scheme: light dark;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body {
  background: #f7f8fa;
  color: #20242a;
  line-height: 1.55;
}
button {
  border: 1px solid #b9c0ca;
  border-radius: 6px;
  padding: 7px 12px;
  background: #fff;
  color: #20242a;
  font: inherit;
  cursor: pointer;
}
button:hover { background: #edf0f4; }
button:focus-visible { outline: 2px solid #3978d4; outline-offset: 2px; }
.maploom-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 14px 20px;
  border-bottom: 1px solid #d9dee6;
  background: #fff;
}
.maploom-heading h1 { margin: 0; font-size: 1.25rem; }
.maploom-heading p { margin: 2px 0 0; color: #687282; font-size: .85rem; }
.maploom-toolbar { display: flex; gap: 7px; flex-wrap: wrap; }
.maploom-status { margin: 0; padding: 0 20px; color: #9a5b00; font-size: .88rem; }
.maploom-status:empty { display: none; }
.maploom-map-panel {
  width: 100%;
  height: 68vh;
  min-height: 420px;
  max-height: 900px;
  overflow: hidden;
  background: #fff;
  border-bottom: 1px solid #d9dee6;
}
#maploom-map { display: block; width: 100%; height: 100%; }
.markmap { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
.markmap-node text { fill: var(--mm-text, #30343b); }
.maploom-source-panel { padding: 24px clamp(16px, 5vw, 64px) 48px; }
.maploom-source-panel h2 { margin: 0 0 18px; font-size: 1.25rem; }
.maploom-export-source {
  max-width: 100%;
  overflow-wrap: anywhere;
  line-height: 1.6;
}
.maploom-export-source > :first-child { margin-top: 0; }
.maploom-export-source > :last-child { margin-bottom: 0; }
.maploom-export-source img,
.maploom-export-source video {
  max-width: 100%;
  height: auto;
}
.maploom-export-source audio { max-width: 100%; }
.maploom-export-source table {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
}
.maploom-export-source th,
.maploom-export-source td { white-space: normal; }
.maploom-export-source pre { max-width: 100%; overflow: auto; }
.maploom-export-source iframe,
.maploom-export-source object,
.maploom-export-source embed { max-width: 100%; }
.maploom-footer {
  padding: 12px 20px;
  border-top: 1px solid #d9dee6;
  color: #687282;
  font-size: .8rem;
  text-align: right;
}
.maploom-callout--note { --maploom-callout-rgb: 8,109,221; }
.maploom-callout--abstract { --maploom-callout-rgb: 160,120,210; }
.maploom-callout--info { --maploom-callout-rgb: 0,150,190; }
.maploom-callout--tip { --maploom-callout-rgb: 0,190,180; }
.maploom-callout--success { --maploom-callout-rgb: 30,160,100; }
.maploom-callout--question { --maploom-callout-rgb: 160,115,230; }
.maploom-callout--warning { --maploom-callout-rgb: 230,145,45; }
.maploom-callout--danger { --maploom-callout-rgb: 225,75,75; }
.maploom-callout--example { --maploom-callout-rgb: 165,120,255; }
.maploom-callout--quote { --maploom-callout-rgb: 140,145,155; }
.maploom-callout__surface {
  fill: rgba(var(--maploom-callout-rgb), .13);
  stroke: rgba(var(--maploom-callout-rgb), .28);
  stroke-width: 1;
}
.maploom-callout__accent { fill: rgb(var(--maploom-callout-rgb)); }
.maploom-callout__icon { color: rgb(var(--maploom-callout-rgb)); }
.maploom-callout__icon path {
  fill: none;
  stroke: rgb(var(--maploom-callout-rgb));
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.maploom-callout__icon circle {
  fill: rgb(var(--maploom-callout-rgb));
  stroke: none;
}
.maploom-callout__title {
  fill: rgb(var(--maploom-callout-rgb));
  font-weight: 650;
}
.maploom-callout__body { fill: var(--mm-text, #dedede); }
@media (prefers-color-scheme: dark) {
  body { background: #1e2228; color: #e6e9ee; }
  .maploom-header, .maploom-map-panel { background: #242932; }
  .maploom-header, .maploom-map-panel, .maploom-footer {
    border-color: #424956;
  }
  button {
    background: #303743;
    border-color: #596273;
    color: #e6e9ee;
  }
  button:hover { background: #3b4553; }
  .maploom-heading p, .maploom-footer { color: #aab3c1; }
}
@media (max-width: 640px) {
  .maploom-header { align-items: flex-start; flex-direction: column; }
  .maploom-map-panel { height: 60vh; min-height: 340px; }
  .maploom-source-panel { padding: 18px 14px 36px; }
}
@media print {
  .maploom-toolbar, .maploom-status { display: none !important; }
  .maploom-map-panel { height: 65vh; break-inside: avoid; }
  .maploom-source-panel { break-before: page; }
  body { background: white; color: black; }
}
/* Portable Markdown source-note presentation. */
.maploom-export-source {
  line-height: 1.65;
  overflow-wrap: anywhere;
  user-select: text;
  pointer-events: auto;
}

/* Theme variables are defined on this child, so consume them here. */
.maploom-export-source > .maploom-source-content {
  color: var(--maploom-source-text, #20242a);
  background: var(--maploom-source-background, transparent);
}

.maploom-export-source * {
  box-sizing: border-box;
  user-select: text;
  pointer-events: auto;
}

.maploom-export-source h1,
.maploom-export-source h2,
.maploom-export-source h3,
.maploom-export-source h4,
.maploom-export-source h5,
.maploom-export-source h6 {
  color: var(--maploom-source-text, inherit);
  line-height: 1.3;
  font-weight: 650;
  margin: 1.5em 0 .65em;
}

.maploom-export-source h1 { font-size: 2em; }
.maploom-export-source h2 { font-size: 1.6em; }
.maploom-export-source h3 { font-size: 1.35em; }
.maploom-export-source h4 { font-size: 1.15em; }
.maploom-export-source h5 { font-size: 1em; }
.maploom-export-source h6 { font-size: .9em; }

.maploom-export-source p {
  margin: .7em 0;
}

.maploom-export-source ul,
.maploom-export-source ol {
  padding-left: 1.7rem;
  margin: .7em 0;
}

.maploom-export-source li {
  margin: .25em 0;
}

.maploom-export-source a {
  color: var(--maploom-source-link, var(--maploom-source-accent, #3978d4));
  text-decoration: underline;
  text-underline-offset: .15em;
  overflow-wrap: anywhere;
}

.maploom-export-source a:hover {
  color: var(--maploom-source-link-hover, var(--maploom-source-accent, #245da8));
}

.maploom-export-source hr {
  border: 0;
  border-top: 1px solid var(--maploom-source-border, #d9dee6);
  margin: 1.5em 0;
}

.maploom-export-source blockquote {
  margin: 1em 0;
  padding: .4em 1em;
  border-left: 3px solid var(--maploom-source-blockquote-border, var(--maploom-source-accent, #3978d4));
  background: var(--maploom-source-blockquote-background, transparent);
  color: var(--maploom-source-muted, inherit);
}

.maploom-export-source table {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  border-spacing: 0;
  margin: 1em 0;
}

.maploom-export-source th,
.maploom-export-source td {
  padding: .5em .7em;
  border: 1px solid var(--maploom-source-border, #d9dee6);
  text-align: left;
  white-space: normal;
  vertical-align: top;
}

.maploom-export-source th {
  font-weight: 650;
  background: color-mix(in srgb, var(--maploom-source-background, #fff) 90%, var(--maploom-source-text, #222) 10%);
}

.maploom-export-source pre {
  max-width: 100%;
  overflow: auto;
  padding: .9em 1em;
  border: 1px solid var(--maploom-source-border, #d9dee6);
  border-radius: 7px;
  background: var(--maploom-source-code-background, #f1f2f4);
  color: var(--maploom-source-code-text, inherit);
  line-height: 1.5;
  white-space: pre;
}

.maploom-export-source code {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: .9em;
}

.maploom-export-source :not(pre) > code {
  padding: .12em .35em;
  border-radius: 4px;
  background: var(--maploom-source-code-background, #f1f2f4);
}

.maploom-export-source pre.frontmatter,
.maploom-export-source button.copy-code-button {
  display: none !important;
}

.maploom-export-source img,
.maploom-export-source video,
.maploom-export-source svg {
  max-width: 100%;
  height: auto;
}

.maploom-export-source audio {
  max-width: 100%;
}

.maploom-export-source mjx-container {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}

.maploom-export-source mark {
  background: var(--maploom-source-highlight, #fff2a8);
  color: inherit;
}

.maploom-embed-block {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 1.2em 0;
}

.maploom-export-embed {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 1em 0;
  padding: 1rem;
  border: 1px solid var(--maploom-source-border, #d9dee6);
  border-radius: 8px;
  background: var(--maploom-source-background, transparent);
}

.maploom-export-embed .markdown-embed-title,
.maploom-export-embed .file-embed-title {
  display: flex;
  align-items: center;
  gap: .5em;
  margin: 0 0 .8em;
  padding-bottom: .55em;
  border-bottom: 1px solid var(--maploom-source-border, #d9dee6);
  color: var(--maploom-source-muted, inherit);
  font-size: .92em;
  font-weight: 650;
}

.maploom-export-embed .markdown-embed-content,
.maploom-export-embed .markdown-preview-view {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  max-height: none;
  min-height: 0;
  overflow: visible;
  padding: 0;
  border: 0;
}

.maploom-export-embed .markdown-preview-view > :first-child {
  margin-top: 0;
}

.maploom-export-embed .markdown-preview-view > :last-child {
  margin-bottom: 0;
}

.maploom-export-file-embed {
  padding: .75rem 1rem;
}

.maploom-export-source .callout {
  margin: 1em 0;
  padding: .8em 1em;
  border: 1px solid var(--maploom-source-border, #d9dee6);
  border-left: 3px solid var(--callout-color, var(--maploom-source-accent, #3978d4));
  border-radius: 8px;
  background: rgba(var(--callout-color, 57, 120, 212), .08);
}

.maploom-export-source .callout-title {
  display: flex;
  align-items: center;
  gap: .55em;
  font-weight: 650;
}

.maploom-export-source .callout-content {
  margin-top: .55em;
}

.maploom-export-source .callout-content > :first-child {
  margin-top: 0;
}

.maploom-export-source .callout-content > :last-child {
  margin-bottom: 0;
}

.maploom-export-source .internal-embed {
  max-width: 100%;
}

.maploom-export-source .file-embed-title {
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .maploom-export-embed {
    padding: .75rem;
  }

  .maploom-export-source table {
    font-size: .9em;
  }
}
`;
