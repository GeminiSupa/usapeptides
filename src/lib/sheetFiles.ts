'use client';

/**
 * Reading and writing CSV, Excel and PDF files in the browser.
 *
 * The libraries are large, so each is loaded only when somebody actually clicks
 * export or picks a file — the dashboard does not pay for them on every load.
 * Generic on purpose: any table in the dashboard can export through these.
 */

export type Cell = string | number | null | undefined;

export interface SheetExport {
  /** File name without extension. */
  filename: string;
  title: string;
  headers: string[];
  rows: Cell[][];
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Spreadsheet programs run a cell that starts with = + - @ as a formula, so a
 * product called "=HYPERLINK(...)" becomes a live link on the office PC.
 * Prefixing an apostrophe shows the text as typed.
 */
const safeText = (value: Cell): string | number => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
};

export const stamp = () => new Date().toISOString().slice(0, 10);

export async function exportCsv({ filename, headers, rows }: SheetExport) {
  const Papa = (await import('papaparse')).default;
  const csv = Papa.unparse({ fields: headers, data: rows.map((r) => r.map(safeText)) });
  // The BOM makes Excel read accents (Spanish product names) correctly.
  downloadBlob(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
}

export async function exportXlsx({ filename, title, headers, rows }: SheetExport) {
  const ExcelJS = (await import('exceljs')).default;
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet(title.slice(0, 31) || 'Sheet1');
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row.map(safeText));

  const head = sheet.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFDFBF0' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4233' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.columns.forEach((column, i) => {
    const longest = Math.max(headers[i]?.length ?? 8, ...rows.slice(0, 200).map((r) => String(r[i] ?? '').length));
    column.width = Math.min(Math.max(longest + 2, 8), 60);
  });

  const buffer = await book.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${filename}.xlsx`
  );
}

export async function exportPdf({ filename, title, headers, rows }: SheetExport, subtitle?: string) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait', unit: 'pt' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(31, 66, 51);
  doc.text(title, 40, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(subtitle ?? `${rows.length} rows · ${new Date().toLocaleString()}`, 40, 60);

  autoTable(doc, {
    startY: 74,
    head: [headers],
    body: rows.map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c)))),
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [31, 66, 51], textColor: [253, 251, 240] },
    alternateRowStyles: { fillColor: [247, 245, 234] },
    margin: { left: 40, right: 40 },
  });

  doc.save(`${filename}.pdf`);
}

export type SheetFormat = 'csv' | 'xlsx' | 'pdf';

export function exportSheet(format: SheetFormat, data: SheetExport, subtitle?: string) {
  if (format === 'csv') return exportCsv(data);
  if (format === 'xlsx') return exportXlsx(data);
  return exportPdf(data, subtitle);
}

/** Largest file the dashboard will try to read. */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

/**
 * Read a CSV or Excel file into rows keyed by its heading row.
 * Throws with a sentence a person can act on.
 */
export async function readSpreadsheet(file: File): Promise<Record<string, unknown>[]> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('That file is over 10 MB. Split it into smaller files.');
  const name = file.name.toLowerCase();

  if (name.endsWith('.csv') || name.endsWith('.txt') || file.type === 'text/csv') {
    const Papa = (await import('papaparse')).default;
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: 'greedy' });
    if (!parsed.meta.fields?.length) throw new Error('The file has no heading row.');
    return parsed.data;
  }

  if (name.endsWith('.xls')) {
    throw new Error('This is an old-style .xls file. Open it in Excel and use File > Save As > Excel Workbook (.xlsx), then import that.');
  }

  if (name.endsWith('.xlsx')) {
    const ExcelJS = (await import('exceljs')).default;
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await file.arrayBuffer());
    const sheet = book.worksheets.find((s) => s.actualRowCount > 0);
    if (!sheet) throw new Error('The workbook is empty.');

    // The heading row is the first row with at least two filled cells, so a
    // title line above the table does not become the headings.
    let headerRow = 1;
    for (let r = 1; r <= Math.min(sheet.rowCount, 10); r += 1) {
      const filled = (sheet.getRow(r).values as unknown[]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '').length;
      if (filled >= 2) { headerRow = r; break; }
    }
    const headers: string[] = [];
    sheet.getRow(headerRow).eachCell((cell, col) => { headers[col] = cellText(cell.value).trim(); });

    const rows: Record<string, unknown>[] = [];
    for (let r = headerRow + 1; r <= sheet.rowCount; r += 1) {
      const row = sheet.getRow(r);
      const out: Record<string, unknown> = {};
      let any = false;
      row.eachCell((cell, col) => {
        const key = headers[col];
        if (!key) return;
        const value = cellValue(cell.value);
        if (value !== '' && value !== null) any = true;
        out[key] = value;
      });
      if (any) rows.push(out);
    }
    return rows;
  }

  if (name.endsWith('.pdf')) {
    throw new Error('A PDF cannot be imported reliably — its table is a picture of text. Use the CSV or Excel file instead.');
  }

  throw new Error('Choose a .csv or .xlsx file.');
}

/** An Excel cell as a plain value: formulas give their result, dates an ISO day. */
function cellValue(value: unknown): unknown {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if ('result' in v) return cellValue(v.result);
    if ('text' in v) return String(v.text ?? '');
    if ('hyperlink' in v) return String(v.hyperlink ?? '');
    if (Array.isArray(v.richText)) return (v.richText as { text: string }[]).map((t) => t.text).join('');
    return '';
  }
  return value;
}

const cellText = (value: unknown) => String(cellValue(value) ?? '');
