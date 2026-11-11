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

interface TableInline {
  type: 'maploomTable';
  headers: string[];
  rows: string[][];
  align?: Array<'left' | 'right' | 'center' | null>;
}

interface GridLayout {
  widths: number[];
  lines: string[][][];
  rowHeights: number[];
  width: number;
  height: number;
}

const CELL_PADDING_X = 9;
const CELL_PADDING_Y = 7;
const MIN_COLUMN_WIDTH = 76;
const MAX_COLUMN_WIDTH = 210;
const MAX_TABLE_WIDTH = 680;
const CELL_FONT_SCALE = 0.78;
const CELL_LINE_HEIGHT = 15;
const HEADER_MIN_HEIGHT = 30;
const ROW_MIN_HEIGHT = 28;

function xml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]!);
}

function wrapCell(
  value: string,
  maxWidth: number,
  measure: (text: string) => number,
): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines: string[] = [];
  let line = '';

  const pushLongWord = (word: string): void => {
    let segment = '';
    for (const char of Array.from(word)) {
      if (segment && measure(segment + char) > maxWidth) {
        lines.push(segment);
        segment = char;
      } else {
        segment += char;
      }
    }
    line = segment;
  };

  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
    } else if (!line) {
      pushLongWord(word);
    } else {
      lines.push(line);
      line = '';
      if (measure(word) > maxWidth) pushLongWord(word);
      else line = word;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function computeGrid(
  table: TableInline,
  style: TextStyle,
  ctx: InlineContext,
): GridLayout {
  const columnCount = Math.max(1, table.headers.length, ...table.rows.map((row) => row.length));
  const headers = Array.from({ length: columnCount }, (_, index) => table.headers[index] ?? 'Column ' + (index + 1));
  const rows = table.rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => row[index] ?? ''),
  );
  const font = { ...style.font, size: style.font.size * CELL_FONT_SCALE };
  const measure = (value: string) => ctx.measurer.measure(value, font);

  let widths = headers.map((header, column) => {
    const values = [header, ...rows.map((row) => row[column])];
    const desired = Math.max(...values.map(measure)) + CELL_PADDING_X * 2;
    return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, desired));
  });

  const total = widths.reduce((sum, width) => sum + width, 0);
  if (total > MAX_TABLE_WIDTH && MIN_COLUMN_WIDTH * widths.length < MAX_TABLE_WIDTH) {
    const available = MAX_TABLE_WIDTH - MIN_COLUMN_WIDTH * widths.length;
    const extra = widths.map((width) => width - MIN_COLUMN_WIDTH);
    const extraTotal = extra.reduce((sum, width) => sum + width, 0) || 1;
    widths = extra.map((width) => MIN_COLUMN_WIDTH + (available * width) / extraTotal);
  }

  const innerWidths = widths.map((width) => Math.max(20, width - CELL_PADDING_X * 2));
  const allRows = [headers, ...rows];
  const lines = allRows.map((row) =>
    row.map((cell, column) => wrapCell(cell, innerWidths[column], measure)),
  );
  const rowHeights = lines.map((line, rowIndex) => {
    const lineCount = Math.max(1, ...line.map((cellLines) => cellLines.length));
    const contentHeight = lineCount * CELL_LINE_HEIGHT + CELL_PADDING_Y * 2;
    return Math.max(rowIndex === 0 ? HEADER_MIN_HEIGHT : ROW_MIN_HEIGHT, contentHeight);
  });

  return {
    widths,
    lines,
    rowHeights,
    width: widths.reduce((sum, width) => sum + width, 0),
    height: rowHeights.reduce((sum, height) => sum + height, 0),
  };
}

/**
 * Renders Markdown tables as genuine grid-shaped SVG table blocks inside the
 * map label: a header row, aligned columns, cell borders and wrapped cell text.
 * The Source note modal and PDF export continue to use Obsidian's semantic HTML
 * table rendering.
 */
const tableAtom: AtomRenderer = {
  measure(inline: Inline, style: TextStyle, ctx: InlineContext): {
    width: number;
    height: number;
    baseline: number;
  } {
    const table = inline as unknown as TableInline;
    const grid = computeGrid(table, style, ctx);
    return { width: grid.width, height: grid.height, baseline: grid.height };
  },

  render(inline: Inline, box: Rect, style: TextStyle, ctx: InlineContext): Primitive[] {
    const table = inline as unknown as TableInline;
    const grid = computeGrid(table, style, ctx);
    const fontSize = style.font.size * CELL_FONT_SCALE;
    const chunks: string[] = [];
    let y = 0;

    grid.lines.forEach((row, rowIndex) => {
      const rowHeight = grid.rowHeights[rowIndex];
      let x = 0;

      row.forEach((cellLines, columnIndex) => {
        const columnWidth = grid.widths[columnIndex];
        const isHeader = rowIndex === 0;
        const fill = isHeader ? 'var(--mm-code-bg)' : 'var(--mm-bg)';
        chunks.push(
          '<rect x="' + x.toFixed(2) +
          '" y="' + y.toFixed(2) +
          '" width="' + columnWidth.toFixed(2) +
          '" height="' + rowHeight.toFixed(2) +
          '" fill="' + fill +
          '" stroke="var(--mm-text)" stroke-opacity="0.34" stroke-width="0.8"/>',
        );

        const totalTextHeight = cellLines.length * CELL_LINE_HEIGHT;
        const firstBaseline = y + (rowHeight - totalTextHeight) / 2 + CELL_LINE_HEIGHT * 0.76;
        const alignment = table.align?.[columnIndex] ?? 'left';
        const anchor = alignment === 'right' ? 'end' : alignment === 'center' ? 'middle' : 'start';
        const textX = alignment === 'right'
          ? x + columnWidth - CELL_PADDING_X
          : alignment === 'center'
            ? x + columnWidth / 2
            : x + CELL_PADDING_X;
        const tspans = cellLines.map((line, lineIndex) =>
          '<tspan x="' + textX.toFixed(2) +
          '" y="' + (firstBaseline + lineIndex * CELL_LINE_HEIGHT).toFixed(2) +
          '">' + xml(line) + '</tspan>',
        ).join('');

        chunks.push(
          '<text text-anchor="' + anchor +
          '" font-family="inherit" font-size="' + fontSize.toFixed(2) +
          '" font-weight="' + (isHeader ? '700' : '400') +
          '" fill="var(--mm-text)">' + tspans + '</text>',
        );
        x += columnWidth;
      });

      y += rowHeight;
    });

    const markup =
      '<g transform="translate(' + box.x.toFixed(2) + ' ' + box.y.toFixed(2) + ')">' +
      chunks.join('') +
      '</g>';

    return [{ kind: 'custom', svg: () => markup }];
  },
};

export const tableContent: ContentPlugin = {
  name: 'maploom-tables',
  atoms: {
    maploomTable: tableAtom,
  } as unknown as ContentPlugin['atoms'],
};
