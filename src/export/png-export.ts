export type PngScale = 1 | 2 | 3 | 4;
export type PngBackground = 'transparent' | 'white' | 'theme';

export interface PngExportOptions {
  scale: PngScale;
  background: PngBackground;
}

export interface SvgDimensions {
  width: number;
  height: number;
}

export interface PngDimensions {
  width: number;
  height: number;
}

const MAX_PNG_EDGE = 16_384;
const MAX_PNG_PIXELS = 50_000_000;

function readNumericLength(value: string | undefined): number | null {
  if (!value) return null;

  const normalized = value.trim().replace(/px$/i, '');

  if (!/^\+?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    return null;
  }

  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function getSvgDimensions(svg: string): SvgDimensions {
  const root = svg.match(/<svg\b[^>]*>/i)?.[0];

  if (!root) {
    throw new Error('The exported SVG does not have a valid root element.');
  }

  const readAttribute = (name: string): string | undefined => {
    const attributePattern = /([^\s=]+)\s*=\s*"([^"]*)"/g;
    let match: RegExpExecArray | null;

    while ((match = attributePattern.exec(root)) !== null) {
      if (match[1].toLowerCase() === name.toLowerCase()) {
        return match[2];
      }
    }

    return undefined;
  };
  const width = readNumericLength(readAttribute('width'));
  const height = readNumericLength(readAttribute('height'));

  if (width && height) return { width, height };

  const rawViewBox = readAttribute('viewBox');
  const viewBox = rawViewBox
    ? rawViewBox.trim().split(/[\s,]+/).map(Number)
    : [];

  if (
    viewBox.length === 4 &&
    viewBox.every(Number.isFinite) &&
    viewBox[2] > 0 &&
    viewBox[3] > 0
  ) {
    return {
      width: width ?? viewBox[2],
      height: height ?? viewBox[3],
    };
  }

  throw new Error(
    'The exported SVG has no usable width and height or viewBox dimensions.',
  );
}

export function calculatePngDimensions(
  sourceWidth: number,
  sourceHeight: number,
  scale: PngScale,
): PngDimensions {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    throw new Error('The map has invalid dimensions and cannot be exported.');
  }

  if (![1, 2, 3, 4].includes(scale)) {
    throw new Error('PNG scale must be 1x, 2x, 3x or 4x.');
  }

  const width = Math.ceil(sourceWidth * scale);
  const height = Math.ceil(sourceHeight * scale);

  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width > MAX_PNG_EDGE ||
    height > MAX_PNG_EDGE
  ) {
    throw new Error(
      'This map is too large for a PNG at the selected scale. Choose a lower scale.',
    );
  }

  if (width * height > MAX_PNG_PIXELS) {
    throw new Error(
      'This PNG would require too much memory. Choose a lower scale.',
    );
  }

  return { width, height };
}

export function getPngExportPath(
  sourcePath: string,
  pathExists: (path: string) => boolean,
): string {
  const slash = sourcePath.lastIndexOf('/');
  const folder = slash < 0 ? '' : sourcePath.slice(0, slash + 1);
  const filename = sourcePath.slice(slash + 1);
  const basename = filename.replace(/\.[^.]+$/, '');
  const stem = basename + '-map';

  let candidate = folder + stem + '.png';
  if (!pathExists(candidate)) return candidate;

  let suffix = 2;
  do {
    candidate = folder + stem + ' (' + suffix + ').png';
    suffix++;
  } while (pathExists(candidate));

  return candidate;
}

const WHITE_PNG_ROOT_TOKENS =
  '--mm-text:#222222;' +
  '--mm-bg:#ffffff;' +
  '--mm-code-bg:#f3f4f6;' +
  '--mm-code-text:#24292f;' +
  '--mm-card-bg:#ffffff';

/**
 * Explicitly applies readable light-theme foreground and surface tokens
 * to the standalone SVG root for white-background PNG exports.
 */
export function applyWhitePngTheme(svg: string): string {
  const root = svg.match(/<svg\b[^>]*>/i)?.[0];

  if (!root) {
    throw new Error('Cannot apply PNG colours: the SVG root element is missing.');
  }

  const existingStyle = root.match(/\sstyle="([^"]*)"/i);
  const existingDeclarations = existingStyle?.[1]
    .trim()
    .replace(/;+\s*$/, '');

  const declarations = [
    existingDeclarations,
    WHITE_PNG_ROOT_TOKENS,
  ].filter(Boolean).join(';');

  const updatedRoot = existingStyle
    ? root.replace(
        existingStyle[0],
        ' style="' + declarations + '"',
      )
    : root.replace(
        />$/,
        ' style="' + declarations + '">',
      );

  return svg.replace(root, updatedRoot);
}
export async function rasterizeSvgToPng(
  svg: string,
  options: PngExportOptions,
): Promise<Blob> {
  const sourceDimensions = getSvgDimensions(svg);
  const dimensions = calculatePngDimensions(
    sourceDimensions.width,
    sourceDimensions.height,
    options.scale,
  );

  if (
    typeof Image === 'undefined' ||
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    throw new Error('PNG export requires a browser environment.');
  }

  const image = new Image();
  const svgBlob = new Blob([svg], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const objectUrl = URL.createObjectURL(svgBlob);
  let canvas: HTMLCanvasElement | null = null;

  try {
    if (typeof image.decode === 'function') {
      image.src = objectUrl;
      await image.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(
          new Error('The exported SVG could not be decoded for PNG conversion.'),
        );
        image.src = objectUrl;
      });
    }
    canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not create a canvas for PNG export.');
    }

    if (options.background === 'white') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, dimensions.width, dimensions.height);
    }

    context.drawImage(
      image,
      0,
      0,
      dimensions.width,
      dimensions.height,
    );

    return await new Promise<Blob>((resolve, reject) => {
      try {
        canvas!.toBlob((blob) => {
          if (!blob) {
            reject(
              new Error(
                'PNG encoding failed. The map may contain external images that prevent canvas export.',
              ),
            );
            return;
          }

          resolve(blob);
        }, 'image/png');
      } catch {
        reject(
          new Error(
            'PNG encoding was blocked. The map may contain external images; download them into the vault and try again.',
          ),
        );
      }
    });
  } finally {
    image.removeAttribute('src');
    URL.revokeObjectURL(objectUrl);

    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
