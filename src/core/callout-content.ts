import type {
  AtomRenderer,
  ContentPlugin,
  Inline,
  InlineContext,
  Primitive,
  Rect,
  Size,
  TextStyle,
} from '@markmap/core';

interface CalloutRun {
  text: string;
  strong?: boolean;
  emphasis?: boolean;
  strike?: boolean;
  code?: boolean;
  href?: string;
}

interface CalloutParagraph {
  runs: CalloutRun[];
}

interface CalloutInline {
  type: 'maploomCallout';
  calloutType: string;
  title: string;
  fold?: '+' | '-';
  paragraphs: CalloutParagraph[];
}

interface CalloutLine {
  runs: CalloutRun[];
  text: string;
}

interface CalloutLayout {
  width: number;
  height: number;
  titleLines: string[];
  paragraphs: CalloutLine[][];
  titleLineHeight: number;
  bodyLineHeight: number;
  headerHeight: number;
}

const MIN_WIDTH = 260;
const MAX_WIDTH = 560;
const PAD_X = 18;
const PAD_Y = 15;
const ICON_SIZE = 20;
const ICON_GAP = 11;
const TITLE_SCALE = 1.08;
const BODY_SCALE = 0.92;
const PARAGRAPH_GAP = 8;

const THEMES: Record<string, string> = {
  note: 'note',
  abstract: 'abstract',
  summary: 'abstract',
  tldr: 'abstract',
  info: 'info',
  todo: 'info',
  tip: 'tip',
  hint: 'tip',
  important: 'tip',
  success: 'success',
  check: 'success',
  done: 'success',
  question: 'question',
  help: 'question',
  faq: 'question',
  warning: 'warning',
  caution: 'warning',
  attention: 'warning',
  failure: 'danger',
  fail: 'danger',
  missing: 'danger',
  danger: 'danger',
  error: 'danger',
  bug: 'danger',
  example: 'example',
  quote: 'quote',
  cite: 'quote',
};

function themeFor(type: string): string {
  return THEMES[type.toLowerCase()] ?? 'note';
}

function plainLines(value: string, maxWidth: number, font: TextStyle['font'], ctx: InlineContext): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (ctx.measurer.measure(candidate, font) <= maxWidth || !line) {
      line = candidate;
      if (ctx.measurer.measure(line, font) > maxWidth && Array.from(line).length > 1) {
        let part = '';
        for (const char of Array.from(line)) {
          if (part && ctx.measurer.measure(part + char, font) > maxWidth) {
            lines.push(part);
            part = char;
          } else {
            part += char;
          }
        }
        line = part;
      }
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function wrapRuns(runs: CalloutRun[], maxWidth: number, font: TextStyle['font'], ctx: InlineContext): CalloutLine[] {
  const lines: CalloutLine[] = [];
  let current: CalloutRun[] = [];
  let currentText = '';

  const pushLine = (): void => {
    lines.push({ runs: current, text: currentText });
    current = [];
    currentText = '';
  };

  const append = (text: string, source: CalloutRun): void => {
    if (!text) return;
    const last = current[current.length - 1];
    if (last && last.strong === source.strong && last.emphasis === source.emphasis
      && last.strike === source.strike && last.code === source.code && last.href === source.href) {
      last.text += text;
    } else {
      current.push({ ...source, text });
    }
    currentText += text;
  };

  for (const run of runs) {
    const tokens = run.text.match(/\n|[^\S\n]+|[^\s]+/g) ?? [];
    for (const token of tokens) {
      if (token === '\n') {
        pushLine();
        continue;
      }

      if (/^[^\S\n]+$/.test(token)) {
        if (currentText && ctx.measurer.measure(currentText + token, font) <= maxWidth) append(token, run);
        continue;
      }

      const candidate = currentText + token;
      if (!currentText || ctx.measurer.measure(candidate, font) <= maxWidth) {
        append(token, run);
        continue;
      }

      pushLine();
      if (ctx.measurer.measure(token, font) <= maxWidth) {
        append(token, run);
      } else {
        let segment = '';
        for (const character of Array.from(token)) {
          if (segment && ctx.measurer.measure(segment + character, font) > maxWidth) {
            append(segment, run);
            pushLine();
            segment = character;
          } else {
            segment += character;
          }
        }
        if (segment) append(segment, run);
      }
    }
  }

  if (current.length || !lines.length) pushLine();
  return lines;
}

function computeLayout(callout: CalloutInline, style: TextStyle, ctx: InlineContext): CalloutLayout {
  const titleFont = { ...style.font, size: style.font.size * TITLE_SCALE };
  const bodyFont = { ...style.font, size: style.font.size * BODY_SCALE };
  const titleLineHeight = Math.max(21, titleFont.size * 1.35);
  const bodyLineHeight = Math.max(18, bodyFont.size * 1.48);
  const iconAndTitleWidth = ICON_SIZE + ICON_GAP + ctx.measurer.measure(callout.title, titleFont);
  const bodyNaturalWidth = Math.max(0, ...callout.paragraphs.map((paragraph) =>
    ctx.measurer.measure(paragraph.runs.map((run) => run.text).join(''), bodyFont),
  ));
  const width = Math.min(
    MAX_WIDTH,
    Math.max(MIN_WIDTH, iconAndTitleWidth + PAD_X * 2, bodyNaturalWidth + PAD_X * 2),
  );
  const contentWidth = width - PAD_X * 2;
  const titleLines = plainLines(callout.title, contentWidth - ICON_SIZE - ICON_GAP, titleFont, ctx);
  const paragraphs = callout.paragraphs.map((paragraph) => wrapRuns(paragraph.runs, contentWidth, bodyFont, ctx));
  const headerHeight = PAD_Y + titleLines.length * titleLineHeight + 10;
  const bodyHeight = paragraphs.reduce((height, lines) =>
    height + lines.length * bodyLineHeight,
  0) + Math.max(0, paragraphs.length - 1) * PARAGRAPH_GAP;
  const height = headerHeight + bodyHeight + PAD_Y;

  return { width, height, titleLines, paragraphs, titleLineHeight, bodyLineHeight, headerHeight };
}

function xml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

function safeHref(value: string): boolean {
  return /^(?:https?:|mailto:|#maploom-wikilink:)/i.test(value);
}

function renderIcon(type: string): string {
  const theme = themeFor(type);
  switch (theme) {
    case 'warning':
    case 'danger':
      return '<path d="M12 3.5 22 20.5H2L12 3.5Z"/><path d="M12 9v5.5"/><circle cx="12" cy="17.5" r=".8" fill="currentColor" stroke="none"/>';
    case 'tip':
      return '<path d="M9 18h6M10 21h4M8.2 14.8C6.8 13.6 6 11.9 6 10a6 6 0 1 1 12 0c0 1.9-.8 3.6-2.2 4.8-.8.7-1.3 1.5-1.5 2.2h-4.6c-.2-.7-.7-1.5-1.5-2.2Z"/><path d="M12 7.5c-1 1-1.5 2-1.5 3.1 0 .7.4 1.2 1 1.4.1-.9.6-1.6 1.5-2.3"/>';
    case 'example':
      return '<path d="M4 6h2M9 6h11M4 12h2M9 12h11M4 18h2M9 18h11"/>';
    case 'success':
      return '<circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/>';
    case 'question':
      return '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4.5 1.8c-1.2 1-2 1.4-2 3"/><circle cx="12" cy="17.5" r=".8" fill="currentColor" stroke="none"/>';
    case 'abstract':
      return '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>';
    case 'info':
      return '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.5" r=".8" fill="currentColor" stroke="none"/>';
    case 'quote':
      return '<path d="M5 6h14M5 12h14M5 18h9"/>';
    case 'note':
    default:
      return '<path d="M4 17.5V20h2.5L19 7.5 16.5 5 4 17.5Z"/><path d="m15.5 6 2.5 2.5M4 4h8"/>';
  }
}

const calloutAtom: AtomRenderer = {
  measure(inline: Inline, style: TextStyle, ctx: InlineContext): Size & { baseline: number } {
    const layout = computeLayout(inline as unknown as CalloutInline, style, ctx);
    return { width: layout.width, height: layout.height, baseline: layout.height };
  },

  render(inline: Inline, box: Rect, style: TextStyle, ctx: InlineContext): Primitive[] {
    const callout = inline as unknown as CalloutInline;
    const layout = computeLayout(callout, style, ctx);
    const theme = themeFor(callout.calloutType);
    const bodyFontSize = (style.font.size * BODY_SCALE).toFixed(2);
    const titleFontSize = (style.font.size * TITLE_SCALE).toFixed(2);
    const titleX = PAD_X + ICON_SIZE + ICON_GAP;
    const chunks: string[] = [];

    chunks.push(
      '<g class="maploom-callout maploom-callout--' + theme + '" transform="translate(' +
      box.x.toFixed(2) + ' ' + box.y.toFixed(2) + ')">',
      '<rect class="maploom-callout__surface" x="0" y="0" width="' +
      layout.width.toFixed(2) + '" height="' + layout.height.toFixed(2) + '" rx="9"/>',
      '<rect class="maploom-callout__accent" x="0" y="0" width="4" height="' +
      layout.height.toFixed(2) + '" rx="2"/>',
      '<g class="maploom-callout__icon" transform="translate(' +
      PAD_X + ' ' + (PAD_Y + 1) + ')"><svg x="0" y="0" width="' + ICON_SIZE +
      '" height="' + ICON_SIZE + '" viewBox="0 0 24 24" overflow="visible">' +
      renderIcon(callout.calloutType) + '</svg></g>',
    );

    let titleY = PAD_Y + layout.titleLineHeight * 0.76;
    layout.titleLines.forEach((line, index) => {
      const suffix = index === layout.titleLines.length - 1
        ? callout.fold === '-' ? '  ›' : callout.fold === '+' ? '  ⌄' : ''
        : '';
      chunks.push(
        '<text class="maploom-callout__title" x="' + titleX +
        '" y="' + (titleY + index * layout.titleLineHeight).toFixed(2) +
        '" font-family="inherit" font-size="' + titleFontSize +
        '" font-weight="650">' + xml(line + suffix) + '</text>',
      );
    });

    let y = layout.headerHeight + layout.bodyLineHeight * 0.76;
    const fontSize = bodyFontSize;
    layout.paragraphs.forEach((lines, paragraphIndex) => {
      lines.forEach((line, lineIndex) => {
        const spans = line.runs.map((run) => {
          const attrs = [
            run.strong ? 'font-weight="700"' : '',
            run.emphasis ? 'font-style="italic"' : '',
            run.strike ? 'text-decoration="line-through"' : '',
            run.code ? 'font-family="monospace"' : '',
          ].filter(Boolean).join(' ');
          const span = '<tspan ' + attrs + '>' + xml(run.text) + '</tspan>';
          return run.href && safeHref(run.href)
            ? '<a href="' + xml(run.href) + '">' + span + '</a>'
            : span;
        }).join('');
        chunks.push(
          '<text class="maploom-callout__body" x="' + PAD_X +
          '" y="' + (y + lineIndex * layout.bodyLineHeight).toFixed(2) +
          '" font-family="inherit" font-size="' + fontSize + '">' + spans + '</text>',
        );
      });
      y += lines.length * layout.bodyLineHeight;
      if (paragraphIndex < layout.paragraphs.length - 1) y += PARAGRAPH_GAP;
    });

    chunks.push('</g>');
    return [{ kind: 'custom', svg: () => chunks.join('') }];
  },
};

export const calloutContent: ContentPlugin = {
  name: 'maploom-callouts',
  atoms: {
    maploomCallout: calloutAtom,
  } as unknown as ContentPlugin['atoms'],
};
