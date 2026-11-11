import type {
  ContentPlugin,
  Inline,
  InlineContext,
  Primitive,
  Rect,
  Size,
  TextStyle,
} from '@markmap/core';

type ImageInline = Extract<Inline, { type: 'image' }>;

const MAX_WIDTH = 150;
const MAX_HEIGHT = 96;
const PLACEHOLDER: Size = { width: 96, height: 64 };

function safeImageSource(src: string): boolean {
  return (
    /^(https?:|app:|obsidian:)/i.test(src) ||
    /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/i.test(src)
  );
}

function fit(size: Size): Size {
  if (!size.width || !size.height) return PLACEHOLDER;
  const scale = Math.min(1, MAX_WIDTH / size.width, MAX_HEIGHT / size.height);
  return { width: size.width * scale, height: size.height * scale };
}

function fallbackText(alt: string, box: Rect, style: TextStyle): Primitive[] {
  if (!alt) return [];
  const baseline = (style.font.lineHeight + style.font.size * 0.7) / 2;
  return [{
    kind: 'text',
    x: box.x,
    y: box.y,
    runs: [{
      text: alt,
      x: 0,
      y: baseline,
      font: style.font,
      fill: style.fill,
    }],
  }];
}

/**
 * Image atom for Obsidian resource URLs.
 *
 * Markmap's default image plugin rejects app:// URLs. This plugin accepts
 * Obsidian resource URLs and safe web/data image URLs, measures them in the
 * browser, and draws SVG image primitives directly in map labels.
 */
export function createVaultImageContent(): ContentPlugin {
  const sizes = new Map<string, Size | null>();
  const loading = new Map<string, Promise<void>>();

  const load = (src: string, ctx: InlineContext): void => {
    if (sizes.has(src) || loading.has(src) || typeof Image === 'undefined') return;

    const task = new Promise<void>((resolve) => {
      const image = new Image();
      image.onload = () => {
        sizes.set(src, {
          width: image.naturalWidth || PLACEHOLDER.width,
          height: image.naturalHeight || PLACEHOLDER.height,
        });
        resolve();
      };
      image.onerror = () => {
        sizes.set(src, null);
        resolve();
      };
      image.src = src;
    }).finally(() => loading.delete(src));

    loading.set(src, task);
    ctx.defer?.(task);
  };

  return {
    name: 'maploom-vault-images',
    atoms: {
      image: {
        measure(inline: ImageInline, style, ctx) {
          const src = inline.url.trim();
          if (!safeImageSource(src)) {
            return {
              width: ctx.measurer.measure(inline.alt ?? '', style.font),
              height: style.font.lineHeight,
              baseline: (style.font.lineHeight + style.font.size * 0.7) / 2,
            };
          }

          if (!sizes.has(src)) load(src, ctx);
          const natural = sizes.get(src);
          const size = natural ? fit(natural) : PLACEHOLDER;
          return { ...size, baseline: size.height };
        },

        render(inline: ImageInline, box: Rect, style): Primitive[] {
          const src = inline.url.trim();
          if (!safeImageSource(src) || sizes.get(src) === null) {
            return fallbackText(inline.alt ?? '[image]', box, style);
          }

          return [{
            kind: 'image',
            x: box.x,
            y: box.y,
            w: box.width,
            h: box.height,
            src,
          }];
        },
      },
    },
  };
}
