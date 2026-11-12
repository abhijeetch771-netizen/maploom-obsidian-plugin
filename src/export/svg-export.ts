import type { App, TFile } from 'obsidian';

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico',
]);

const IMAGE_MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
};

const CALLOUT_STYLES = `
.maploom-callout--note{--maploom-callout-rgb:8,109,221}
.maploom-callout--abstract{--maploom-callout-rgb:160,120,210}
.maploom-callout--info{--maploom-callout-rgb:0,150,190}
.maploom-callout--tip{--maploom-callout-rgb:0,190,180}
.maploom-callout--success{--maploom-callout-rgb:30,160,100}
.maploom-callout--question{--maploom-callout-rgb:160,115,230}
.maploom-callout--warning{--maploom-callout-rgb:230,145,45}
.maploom-callout--danger{--maploom-callout-rgb:225,75,75}
.maploom-callout--example{--maploom-callout-rgb:165,120,255}
.maploom-callout--quote{--maploom-callout-rgb:140,145,155}
.maploom-callout__surface{fill:rgba(var(--maploom-callout-rgb),.13);stroke:rgba(var(--maploom-callout-rgb),.28);stroke-width:1}
.maploom-callout__accent{fill:rgb(var(--maploom-callout-rgb))}
.maploom-callout__icon{color:rgb(var(--maploom-callout-rgb))}
.maploom-callout__icon path{fill:none;stroke:rgb(var(--maploom-callout-rgb));stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.maploom-callout__icon circle{fill:rgb(var(--maploom-callout-rgb));stroke:none}
.maploom-callout__title{fill:rgb(var(--maploom-callout-rgb));font-weight:650}
.maploom-callout__body{fill:var(--mm-text,#dedede)}
`;

export function injectCalloutStyles(svg: string): string {
  const styleEnd = svg.indexOf('</style>');
  if (styleEnd < 0) {
    throw new Error('The exported SVG does not contain its expected stylesheet.');
  }

  return svg.slice(0, styleEnd) + CALLOUT_STYLES + svg.slice(styleEnd);
}

export function getSvgExportPath(
  sourcePath: string,
  pathExists: (path: string) => boolean,
): string {
  const slash = sourcePath.lastIndexOf('/');
  const folder = slash < 0 ? '' : sourcePath.slice(0, slash + 1);
  const filename = sourcePath.slice(slash + 1);
  const basename = filename.replace(/\.[^.]+$/, '');
  const stem = basename + '-map';

  let candidate = folder + stem + '.svg';
  if (!pathExists(candidate)) return candidate;

  let suffix = 2;
  do {
    candidate = folder + stem + ' (' + suffix + ').svg';
    suffix++;
  } while (pathExists(candidate));

  return candidate;
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

async function rasterizeSvgDataUrl(source: string): Promise<string> {
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    throw new Error('SVG image rasterization requires a browser environment.');
  }

  const image = new Image();

  if (typeof image.decode === 'function') {
    image.src = source;
    await image.decode();
  } else {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not decode embedded SVG image.'));
      image.src = source;
    });
  }

  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;

  if (!naturalWidth || !naturalHeight) {
    throw new Error('Embedded SVG image has invalid dimensions.');
  }

  const maxDimension = 4096;
  const maxPixels = 16_777_216;
  const scale = Math.min(
    1,
    maxDimension / naturalWidth,
    maxDimension / naturalHeight,
    Math.sqrt(maxPixels / (naturalWidth * naturalHeight)),
  );

  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not create canvas for SVG image export.');
  }

  context.drawImage(image, 0, 0, width, height);

  const png = canvas.toDataURL('image/png');
  if (!png.startsWith('data:image/png;base64,')) {
    throw new Error('Could not encode SVG image as PNG.');
  }

  return png;
}

export async function rasterizeSvgImagesForCompatibility(
  svg: string,
  rasterize: (source: string) => Promise<string> = rasterizeSvgDataUrl,
): Promise<{ svg: string; failed: number }> {
  const tags = Array.from(svg.matchAll(/<image\b[^>]*>/g));
  let output = svg;
  let failed = 0;

  for (const match of tags) {
    const tag = match[0];
    const href = tag.match(/(?:^|\s)href="([^"]+)"/)
      ?? tag.match(/\sxlink:href="([^"]+)"/);

    if (!href) continue;

    const source = decodeXml(href[1]);
    if (!/^data:image\/svg\+xml(?:;[^,]*)?,/i.test(source)) continue;

    try {
      const png = await rasterize(source);

      if (!/^data:image\/png;base64,/i.test(png)) {
        throw new Error('SVG rasterizer did not return a PNG data URL.');
      }

      const withoutImageReferences = tag.replace(
        /\s(?:xlink:)?href="[^"]*"/g,
        '',
      );

      const replacement = withoutImageReferences.replace(
        /\/?>$/,
        (closing) => ' href="' + png + '" xlink:href="' + png + '"' + closing,
      );

      output = output.replace(tag, replacement);
    } catch (error) {
      failed++;
      console.warn('Maploom: could not rasterize embedded SVG image', error);
    }
  }

  if (/\bxlink:href=/.test(output) && !/\bxmlns:xlink=/.test(output)) {
    output = output.replace(
      /<svg\b/,
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"',
    );
  }

  return { svg: output, failed };
}
function addXlinkImageReferences(svg: string): string {
  let output = svg.replace(/<image\b[^>]*>/g, (tag) => {
    const href = tag.match(/\bhref="(data:image\/[^"]+)"/);

    if (!href || /\bxlink:href=/.test(tag)) return tag;

    return tag.replace(
      href[0],
      href[0] + ' xlink:href="' + href[1] + '"',
    );
  });

  if (/\bxlink:href=/.test(output) && !/\bxmlns:xlink=/.test(output)) {
    output = output.replace(
      /<svg\b/,
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"',
    );
  }

  return output;
}
function binaryToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    const chunk = bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length));
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export interface EmbedImagesResult {
  svg: string;
  unresolvedLocalImages: number;
}

/**
 * Replace Obsidian-local image resource URLs with data URLs.
 * External HTTP(S) and existing data URLs are deliberately left unchanged.
 */
async function finalizeSvg(
  svg: string,
  unresolvedLocalImages: number,
): Promise<EmbedImagesResult> {
  const rasterized = await rasterizeSvgImagesForCompatibility(svg);

  return {
    svg: addXlinkImageReferences(rasterized.svg),
    unresolvedLocalImages: unresolvedLocalImages + rasterized.failed,
  };
}
export async function embedVaultImagesInSvg(
  svg: string,
  app: App,
): Promise<EmbedImagesResult> {
  const matches = Array.from(
    svg.matchAll(/<image\b[^>]*?\b(?:xlink:)?href="([^"]+)"/g),
  );

  if (matches.length === 0) {
    return await finalizeSvg(svg, 0);
  }

  const localReferences = new Set<string>();

  for (const match of matches) {
    const resourcePath = decodeXml(match[1]);
    if (/^(?:app:|obsidian:)/i.test(resourcePath)) {
      localReferences.add(resourcePath);
    }
  }

  if (localReferences.size === 0) {
    return await finalizeSvg(svg, 0);
  }

  const filesByResource = new Map<string, TFile>();

  for (const file of app.vault.getFiles()) {
    if (!IMAGE_EXTENSIONS.has(file.extension.toLowerCase())) continue;

    const resourcePath = app.vault.getResourcePath(file);
    if (localReferences.has(resourcePath)) {
      filesByResource.set(resourcePath, file);
    }
  }

  const dataByResource = new Map<string, string>();
  let unresolvedLocalImages = 0;

  for (const resourcePath of localReferences) {
    const file = filesByResource.get(resourcePath);

    if (!file) {
      unresolvedLocalImages++;
      continue;
    }

    try {
      const extension = file.extension.toLowerCase();
      const mime = IMAGE_MIME_TYPES[extension] ?? 'application/octet-stream';
      const binary = await app.vault.readBinary(file);
      dataByResource.set(
        resourcePath,
        'data:' + mime + ';base64,' + binaryToBase64(binary),
      );
    } catch (error) {
      console.warn('Maploom: could not embed exported image', file.path, error);
      unresolvedLocalImages++;
    }
  }

  let output = svg;

  for (const [resourcePath, dataUrl] of dataByResource) {
    const escapedPath = resourcePath
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;');

    output = output
      .split('href="' + escapedPath + '"')
      .join('href="' + dataUrl + '"');
  }

  return await finalizeSvg(output, unresolvedLocalImages);
}