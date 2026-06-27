/**
 * Avery label sheet generator for survey (camera) locations.
 *
 * Produces a print-ready .docx laid out to a chosen Avery US-Letter template.
 * Label content rules:
 *   - Title (bold): location name
 *   - Access Control projects: "Access: <method>" + each associated artifact
 *   - Video Surveillance projects: "Camera: <manufacturer model>"
 *   - Notes line: "Notes: <survey notes>" (own line, omitted when empty)
 *   - Footer line: company name, 8pt italic (printed on every label)
 *
 * Requires: npm install docx  (already a project dependency)
 */
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, VerticalAlign, HeightRule,
} from 'docx';

// -- Avery templates (US Letter, DXA: 1440 = 1 inch) --

export type AverySize = '5160' | '5161' | '5163' | '5164';

interface AveryTemplate {
  label:      string;
  dims:       string;
  cols:       number;
  rows:       number;
  cellW:      number;
  cellH:      number;
  gutter:     number;
  topMargin:  number;
  sideMargin: number;
  titlePt:    number;
  bodyPt:     number;
  maxLines:   number;
}

export const AVERY_TEMPLATES: Record<AverySize, AveryTemplate> = {
  '5160': { label: 'Avery 5160', dims: '1" x 2-5/8" (30/sheet)', cols: 3, rows: 10, cellW: 3780, cellH: 1440, gutter: 176, topMargin: 720, sideMargin: 274, titlePt: 16, bodyPt: 12, maxLines: 2 },
  '5161': { label: 'Avery 5161', dims: '1" x 4" (20/sheet)',     cols: 2, rows: 10, cellW: 5760, cellH: 1440, gutter: 252, topMargin: 720, sideMargin: 234, titlePt: 16, bodyPt: 13, maxLines: 2 },
  '5163': { label: 'Avery 5163', dims: '2" x 4" (10/sheet)',     cols: 2, rows: 5,  cellW: 5760, cellH: 2880, gutter: 270, topMargin: 720, sideMargin: 225, titlePt: 22, bodyPt: 18, maxLines: 7 },
  '5164': { label: 'Avery 5164', dims: '3-1/3" x 4" (6/sheet)',  cols: 2, rows: 3,  cellW: 5760, cellH: 4800, gutter: 270, topMargin: 720, sideMargin: 225, titlePt: 24, bodyPt: 18, maxLines: 13 },
};

export const DEFAULT_AVERY_SIZE: AverySize = '5163';

export function isAverySize(v: string | null | undefined): v is AverySize {
  return !!v && Object.prototype.hasOwnProperty.call(AVERY_TEMPLATES, v);
}

// -- Label model + content rules --

export interface LabelModel {
  title: string;
  lines: string[];
  notes?: string | null;
}

export interface LocationLabelInput {
  areaName:         string | null;
  floor:            string | null;
  mountingLocation: string | null;
  surveyNotes:      string | null;
  cameraModel:  { manufacturer: string | null; model: string | null } | null;
  accessMethod: {
    name:  string;
    items: { quantity: number; artifactType: { name: string } }[];
  } | null;
}

export type ProjectTypeValue = 'VIDEO_SURVEILLANCE' | 'ACCESS_CONTROL';

export function buildLocationLabelModels(
  projectType: ProjectTypeValue,
  locations:   LocationLabelInput[],
): LabelModel[] {
  return locations.map((loc, idx) => {
    const title =
      loc.areaName?.trim() ||
      [loc.floor, loc.mountingLocation].filter(Boolean).join(' - ') ||
      `Location ${idx + 1}`;

    const lines: string[] = [];

    if (projectType === 'ACCESS_CONTROL') {
      if (loc.accessMethod?.name) lines.push(`Access: ${loc.accessMethod.name}`);
      for (const item of loc.accessMethod?.items ?? []) {
        const qty = item.quantity && item.quantity > 1 ? ` x${item.quantity}` : '';
        lines.push(`• ${item.artifactType.name}${qty}`);
      }
    } else {
      const model = loc.cameraModel
        ? [loc.cameraModel.manufacturer, loc.cameraModel.model].filter(Boolean).join(' ')
        : '';
      lines.push(`Camera: ${model || '—'}`);
    }

    return { title, lines, notes: loc.surveyNotes?.trim() || null };
  });
}

// -- Rendering --

// Footer line printed on every label (8pt italic).
const COMPANY_FOOTER = 'Digital Support Systems, Inc.';

const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = {
  top: NONE, bottom: NONE, left: NONE, right: NONE,
  insideHorizontal: NONE, insideVertical: NONE,
};
const PREVIEW = { style: BorderStyle.DASHED, size: 1, color: 'BBBBBB' };
const PREVIEW_BORDERS = { top: PREVIEW, bottom: PREVIEW, left: PREVIEW, right: PREVIEW };

function labelParagraphs(model: LabelModel, t: AveryTemplate): Paragraph[] {
  const paras: Paragraph[] = [
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: model.title, bold: true, size: t.titlePt, font: 'Arial' })],
    }),
  ];

  const shown = model.lines.slice(0, t.maxLines);
  const hidden = model.lines.length - shown.length;
  for (const line of shown) {
    paras.push(new Paragraph({
      spacing: { after: 0 },
      children: [new TextRun({ text: line, size: t.bodyPt, font: 'Arial' })],
    }));
  }
  if (hidden > 0) {
    paras.push(new Paragraph({
      spacing: { after: 0 },
      children: [new TextRun({ text: `(+${hidden} more)`, italics: true, size: t.bodyPt, font: 'Arial', color: '6B7280' })],
    }));
  }
  if (model.notes) {
    paras.push(new Paragraph({
      spacing: { before: 40, after: 0 },
      children: [new TextRun({ text: `Notes: ${model.notes}`, italics: true, size: t.bodyPt, font: 'Arial' })],
    }));
  }
  // Per-label footer: company name, 8pt italic (size is in half-points -> 16 = 8pt).
  paras.push(new Paragraph({
    spacing: { before: 40, after: 0 },
    children: [new TextRun({ text: COMPANY_FOOTER, italics: true, size: 16, font: 'Arial', color: '6B7280' })],
  }));

  return paras;
}

interface GenerateOpts {
  previewBorders?: boolean;
  projectName?: string;
  /** 1-based row of the first label to print on the first sheet (default 1). */
  startRow?: number;
  /** 1-based column of the first label to print on the first sheet (default 1). */
  startCol?: number;
}

/**
 * Number of label cells to skip before the first label, given a 1-based
 * starting row/column for the supplied template. Clamped to a single sheet.
 */
export function startOffset(t: AveryTemplate, startRow?: number, startCol?: number): number {
  const perPage = t.cols * t.rows;
  const row = Math.min(Math.max(Math.floor(startRow ?? 1), 1), t.rows);
  const col = Math.min(Math.max(Math.floor(startCol ?? 1), 1), t.cols);
  const offset = (row - 1) * t.cols + (col - 1);
  return Math.min(Math.max(offset, 0), perPage - 1);
}

export async function generateLocationLabelsDocx(
  models: LabelModel[],
  size:   AverySize = DEFAULT_AVERY_SIZE,
  opts:   GenerateOpts = {},
): Promise<Buffer> {
  const t = AVERY_TEMPLATES[size] ?? AVERY_TEMPLATES[DEFAULT_AVERY_SIZE];
  const cellBorders = opts.previewBorders ? PREVIEW_BORDERS : NO_BORDERS;

  if (models.length === 0) {
    const doc = new Document({
      sections: [{
        properties: { page: { size: { width: 12240, height: 15840 } } },
        children: [new Paragraph({
          children: [new TextRun({
            text: `No survey locations to print${opts.projectName ? ` for ${opts.projectName}` : ''}.`,
            font: 'Arial', size: 24,
          })],
        })],
      }],
    });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  const colWidths: number[] = [];
  for (let c = 0; c < t.cols; c++) {
    colWidths.push(t.cellW);
    if (c < t.cols - 1) colWidths.push(t.gutter);
  }
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  const emptyCell = () => new TableCell({
    width: { size: t.cellW, type: WidthType.DXA }, borders: cellBorders,
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    verticalAlign: VerticalAlign.TOP, children: [new Paragraph('')],
  });
  const gutterCell = () => new TableCell({
    width: { size: t.gutter, type: WidthType.DXA }, borders: NO_BORDERS, children: [new Paragraph('')],
  });

  // Skip already-used labels on the first sheet by padding with blank cells.
  const offset = startOffset(t, opts.startRow, opts.startCol);
  const padded: (LabelModel | null)[] = offset > 0
    ? [...Array<null>(offset).fill(null), ...models]
    : models;

  const perPage = t.cols * t.rows;
  const pages: (LabelModel | null)[][] = [];
  for (let i = 0; i < padded.length; i += perPage) pages.push(padded.slice(i, i + perPage));

  const children: (Paragraph | Table)[] = [];
  pages.forEach((page, pIdx) => {
    const rows: TableRow[] = [];
    for (let r = 0; r < t.rows; r++) {
      const cells: TableCell[] = [];
      for (let c = 0; c < t.cols; c++) {
        const model = page[r * t.cols + c];
        cells.push(
          model
            ? new TableCell({
                width: { size: t.cellW, type: WidthType.DXA }, borders: cellBorders,
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                verticalAlign: VerticalAlign.TOP, children: labelParagraphs(model, t),
              })
            : emptyCell(),
        );
        if (c < t.cols - 1) cells.push(gutterCell());
      }
      rows.push(new TableRow({ height: { value: t.cellH, rule: HeightRule.EXACT }, children: cells }));
    }
    children.push(new Table({
      width: { size: tableWidth, type: WidthType.DXA },
      columnWidths: colWidths, borders: NO_BORDERS, rows,
    }));
    if (pIdx < pages.length - 1) {
      children.push(new Paragraph({ pageBreakBefore: true }));
    }
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial' } } } },
    sections: [{
      properties: {
        page: {
          size:   { width: 12240, height: 15840 },
          margin: { top: t.topMargin, bottom: t.topMargin, left: t.sideMargin, right: t.sideMargin },
        },
      },
      children,
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
