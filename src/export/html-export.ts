import type { App, TFile } from 'obsidian';

const RESOURCE_MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  ogv: 'video/ogg',
  pdf: 'application/pdf',
  vtt: 'text/vtt',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

function binaryToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    const chunk = bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length));
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

function safeJsonForHtml(value: unknown): string {
  const json = JSON.stringify(value);

  if (json === undefined) {
    throw new Error('The HTML export payload is not JSON-serializable.');
  }

  // Prevent user content from terminating the application/json script element.
  return json.replace(/[<>&\u2028\u2029]/g, (character) => ({
    '<': '\\u003c',
    '>': '\\u003e',
    '&': '\\u0026',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
  })[character]!);
}

export function getHtmlExportPath(
  sourcePath: string,
  pathExists: (path: string) => boolean,
): string {
  const slash = sourcePath.lastIndexOf('/');
  const folder = slash < 0 ? '' : sourcePath.slice(0, slash + 1);
  const filename = sourcePath.slice(slash + 1);
  const basename = filename.replace(/\.[^.]+$/, '');
  const stem = basename + '-map';

  let candidate = folder + stem + '.html';
  if (!pathExists(candidate)) return candidate;

  let suffix = 2;
  do {
    candidate = folder + stem + ' (' + suffix + ').html';
    suffix++;
  } while (pathExists(candidate));

  return candidate;
}


function decodeMarkupEntities(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

function addLocalResourceUrls(value: string, urls: Set<string>): void {
  const decoded = decodeMarkupEntities(value);
  const pattern = /(?:app|obsidian):\/\/[^\s"'<>),;]+/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(decoded))) {
    urls.add(match[0]);
  }
}

function collectMarkupResourceUrls(markup: string, urls: Set<string>): void {
  // Resource attributes only: ordinary anchor hrefs are not attachments.
  const attributePattern = /\b(?:src|poster|data|srcset)\s*=\s*(["'])(.*?)\1/gi;
  let attribute: RegExpExecArray | null;

  while ((attribute = attributePattern.exec(markup))) {
    const value = decodeMarkupEntities(attribute[2]);

    if (/\bsrcset\s*=/i.test(attribute[0])) {
      for (const candidate of value.split(',')) {
        const url = candidate.trim().split(/\s+/)[0];
        if (url) addLocalResourceUrls(url, urls);
      }
    } else {
      addLocalResourceUrls(value, urls);
    }
  }

  // Include local resources referenced by inline CSS and style blocks.
  const cssSources: string[] = [];
  const inlineStylePattern = /\bstyle\s*=\s*(["'])(.*?)\1/gi;

  while ((attribute = inlineStylePattern.exec(markup))) {
    cssSources.push(decodeMarkupEntities(attribute[2]));
  }

  const styleBlockPattern = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let styleBlock: RegExpExecArray | null;

  while ((styleBlock = styleBlockPattern.exec(markup))) {
    cssSources.push(styleBlock[1]);
  }

  const cssUrlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi;

  for (const css of cssSources) {
    let cssUrl: RegExpExecArray | null;

    while ((cssUrl = cssUrlPattern.exec(css))) {
      const url = (cssUrl[1] ?? cssUrl[2] ?? cssUrl[3] ?? '').trim();
      if (url) addLocalResourceUrls(url, urls);
    }
  }
}
function collectTreeImageUrls(value: unknown, urls: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectTreeImageUrls(item, urls);
    return;
  }

  if (!value || typeof value !== 'object') return;

  const node = value as Record<string, unknown>;

  if (
    node.type === 'image' &&
    typeof node.url === 'string' &&
    /^(?:app|obsidian):\/\//i.test(node.url)
  ) {
    urls.add(node.url);
  }

  for (const child of Object.values(node)) {
    collectTreeImageUrls(child, urls);
  }
}

function replaceTreeImageUrls(
  value: unknown,
  replacements: ReadonlyMap<string, string>,
): unknown {
  const clone = JSON.parse(JSON.stringify(value)) as unknown;

  const visit = (item: unknown): void => {
    if (Array.isArray(item)) {
      for (const child of item) visit(child);
      return;
    }

    if (!item || typeof item !== 'object') return;

    const node = item as Record<string, unknown>;

    if (node.type === 'image' && typeof node.url === 'string') {
      node.url = replacements.get(node.url) ?? node.url;
    }

    for (const child of Object.values(node)) visit(child);
  };

  visit(clone);
  return clone;
}

export interface EmbeddedHtmlAssetsResult {
  html: string;
  tree: unknown;
  unresolvedLocalResources: string[];
}

/**
 * Embed local resources referenced by rendered Markdown HTML and Markmap
 * image nodes. External HTTP(S) URLs and existing data URLs are preserved.
 */
export async function embedVaultResourcesInHtml(
  html: string,
  tree: unknown,
  app: App,
): Promise<EmbeddedHtmlAssetsResult> {
  const localReferences = new Set<string>();

  collectMarkupResourceUrls(html, localReferences);
  collectTreeImageUrls(tree, localReferences);

  if (localReferences.size === 0) {
    return {
      html,
      tree: JSON.parse(JSON.stringify(tree)) as unknown,
      unresolvedLocalResources: [],
    };
  }

  const filesByResource = new Map<string, TFile>();

  for (const file of app.vault.getFiles()) {
    const extension = file.extension.toLowerCase();
    if (!RESOURCE_MIME_TYPES[extension]) continue;

    const resourcePath = app.vault.getResourcePath(file);

    if (localReferences.has(resourcePath)) {
      filesByResource.set(resourcePath, file);
    }
  }

  const replacements = new Map<string, string>();
  const unresolvedLocalResources: string[] = [];

  for (const resourcePath of localReferences) {
    if (resourcePath === 'app://obsidian.md/public/external-link.svg') {
      try {
        const response = await fetch(resourcePath);
        const mime = response.headers
          .get('content-type')
          ?.split(';')[0]
          ?.trim()
          .toLowerCase();

        if (!response.ok || mime !== 'image/svg+xml') {
          throw new Error(
            'Unexpected response: HTTP ' +
              response.status +
              ', content type ' +
              (mime || 'unknown'),
          );
        }

        const binary = await response.arrayBuffer();

        replacements.set(
          resourcePath,
          'data:image/svg+xml;base64,' + binaryToBase64(binary),
        );
      } catch (error) {
        console.warn(
          'Maploom: could not embed Obsidian application asset',
          resourcePath,
          error,
        );
        unresolvedLocalResources.push(resourcePath);
      }

      continue;
    }

    const file = filesByResource.get(resourcePath);

    if (!file) {
      unresolvedLocalResources.push(resourcePath);
      continue;
    }

    try {
      const mime = RESOURCE_MIME_TYPES[file.extension.toLowerCase()];
      const binary = await app.vault.readBinary(file);

      replacements.set(
        resourcePath,
        'data:' + mime + ';base64,' + binaryToBase64(binary),
      );
    } catch (error) {
      console.warn('Maploom: could not embed HTML resource', file.path, error);
      unresolvedLocalResources.push(resourcePath);
    }
  }

  let outputHtml = html;

  for (const [resourcePath, dataUrl] of replacements) {
    outputHtml = outputHtml
      .split(resourcePath)
      .join(dataUrl)
      .split(resourcePath.replace(/&/g, '&amp;'))
      .join(dataUrl);
  }

  return {
    html: outputHtml,
    tree: replaceTreeImageUrls(tree, replacements),
    unresolvedLocalResources,
  };
}

export interface StandaloneHtmlDocumentInput {
  title: string;
  payload: unknown;
  styles: string;
  clientScript: string;
}

/**
 * Assemble a self-contained HTML document. The client script and styles are
 * supplied by the build/runtime layer; the payload is escaped as JSON.
 */
export function createStandaloneHtmlDocument(
  input: StandaloneHtmlDocumentInput,
): string {
  const title = escapeHtml(input.title);
  const payload = safeJsonForHtml(input.payload);
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const scriptNonce = Array.from(
    nonceBytes,
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
  const clientScript = input.clientScript.replace(/<\/script/gi, '<\\/script');

  return '<!doctype html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<meta http-equiv="Content-Security-Policy" content="' +
    "default-src 'none'; script-src 'nonce-" + scriptNonce + "'; style-src 'unsafe-inline'; " +
    "img-src data: blob: https: http:; media-src data: blob: https: http:; " +
    "font-src data: https: http:; object-src data: https: http:; " +
    "frame-src data: https: http:; connect-src 'none'; " +
    "base-uri 'none'; form-action 'none'" +
    '">\n' +
    '<title>' + title + '</title>\n' +
    '<style>\n' + input.styles + '\n</style>\n' +
    '</head>\n' +
    '<body>\n' +
    '<div id="maploom-app"></div>\n' +
    '<script type="application/json" id="maploom-data">' + payload + '</script>\n' +
    '<script nonce="' + scriptNonce + '">\n' + clientScript + '\n</script>\n' +
    '</body>\n' +
    '</html>';
}
