'use client';

import { KPI, formatKpi } from './kpis';
import { downloadBlob, stamp, type SheetFormat } from './sheetFiles';

type Row = (string | number | null | undefined)[];
type Table = { title: string; headers: string[]; rows: Row[] };

const FOREST = '1F4233';
const CREAM = 'FDFBF0';
const NAVY = '233049';
const MUTED = '66736C';

const clean = (value: unknown): string | number => value === null || value === undefined ? '' : typeof value === 'number' ? value : String(value);
const safe = (value: unknown): string | number => typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : clean(value);
const money = (value: unknown) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function kpiRows(data: any, ids?: string[]): Row[] {
  const entries = Object.entries(data?.kpis ?? {}) as [string, { value: number | null; previous: number | null }][];
  return entries.filter(([id]) => !ids || ids.includes(id)).map(([id, values]) => {
    const def = KPI[id];
    if (!def) return null;
    const delta = values.value !== null && values.previous !== null && values.previous !== 0
      ? Math.round(((values.value - values.previous) / Math.abs(values.previous)) * 1000) / 10
      : null;
    return [def.label, formatKpi(values.value, def.format), formatKpi(values.previous, def.format), delta === null ? '' : `${delta > 0 ? '+' : ''}${delta}%`, def.help];
  }).filter(Boolean) as Row[];
}

function tables(data: any): Table[] {
  const sources = (data.sources ?? []).map((s: any) => [s.name, s.medium, s.visits, s.orders, s.conversion ?? 0, money(s.revenue)]);
  const ranked = (rows: any[] | undefined) => (rows ?? []).map((r) => [r.name, r.value]);
  return [
    { title: 'Headline numbers', headers: ['Metric', 'Current period', 'Previous period', 'Change', 'Definition'], rows: kpiRows(data) },
    { title: 'Revenue over time', headers: ['Period', 'Revenue', 'Paid orders', 'Previous revenue'], rows: (data.salesSeries ?? []).map((p: any) => [p.key, p.revenue, p.orders, p.previous ?? '']) },
    { title: 'Visitors over time', headers: ['Period', 'Visitors', 'Visits'], rows: (data.trafficSeries ?? []).map((p: any) => [p.key, p.visitors, p.visits]) },
    { title: 'Order status', headers: ['Status', 'Orders'], rows: ranked(data.orderStatus) },
    { title: 'Sales by state', headers: ['State', 'Revenue'], rows: ranked(data.salesByState) },
    { title: 'Top customers', headers: ['Customer', 'Revenue'], rows: ranked(data.topCustomers) },
    { title: 'Traffic sources', headers: ['Source', 'Type', 'Visits', 'Orders', 'Conversion %', 'Revenue'], rows: sources },
    { title: 'Most viewed pages', headers: ['Page', 'Views'], rows: ranked(data.topPages) },
    { title: 'Landing pages', headers: ['Page', 'Visits'], rows: ranked(data.landingPages) },
    { title: 'Exit pages', headers: ['Page', 'Visits'], rows: ranked(data.exitPages) },
    { title: 'Devices', headers: ['Device', 'Visits'], rows: ranked(data.devices) },
    { title: 'Countries', headers: ['Country', 'Visits'], rows: ranked(data.countries) },
    { title: 'Clicks and taps by control', headers: ['Control', 'Page', 'Destination', 'Element', 'Interactions'], rows: (data.topInteractions ?? []).map((r: any) => [r.label, r.page, r.href, r.element, r.value]) },
    { title: 'Clicks and taps by page area', headers: ['Page area', 'Interactions'], rows: ranked(data.interactionZones) },
    { title: 'Interaction input', headers: ['Input', 'Interactions'], rows: ranked(data.interactionInputs) },
    { title: 'Product performance', headers: ['Product', 'Category', 'Views', 'Added to cart', 'Cart rate %', 'Units sold', 'Revenue', 'Stock', 'Live'], rows: (data.products ?? []).map((p: any) => [p.name, p.category, p.views, p.addToCarts, p.cartRate ?? '', p.units, p.revenue, p.stock, p.live ? 'Yes' : 'No']) },
    { title: 'Lead sources', headers: ['Source', 'Leads'], rows: ranked(data.leadSources) },
    { title: 'Email campaigns', headers: ['Campaign', 'Sent', 'Open rate %', 'Click rate %', 'Unsubscribes'], rows: (data.campaignResults ?? []).map((c: any) => [c.name, c.sent, c.openRate ?? '', c.clickRate ?? '', c.unsubscribes]) },
  ].filter((table) => table.rows.length);
}

function chart(title: string, labels: string[], series: { label: string; values: number[]; color: string }[], kind: 'line' | 'bar' = 'line') {
  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 420;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = `#${CREAM}`; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = `#${NAVY}`; ctx.font = 'bold 28px Arial'; ctx.fillText(title, 44, 44);
  const box = { l: 78, r: 32, t: 78, b: 62 };
  const width = canvas.width - box.l - box.r;
  const height = canvas.height - box.t - box.b;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  ctx.font = '18px Arial'; ctx.strokeStyle = '#D8D6CB'; ctx.lineWidth = 1;
  [0, .5, 1].forEach((step) => {
    const y = box.t + height * (1 - step);
    ctx.beginPath(); ctx.moveTo(box.l, y); ctx.lineTo(canvas.width - box.r, y); ctx.stroke();
    ctx.fillStyle = `#${MUTED}`; ctx.textAlign = 'right'; ctx.fillText(Math.round(max * step).toLocaleString('en-US'), box.l - 12, y + 6);
  });
  const every = Math.max(1, Math.ceil(labels.length / 7));
  labels.forEach((label, i) => {
    if (i % every && i !== labels.length - 1) return;
    const x = box.l + (labels.length <= 1 ? width / 2 : (i / (labels.length - 1)) * width);
    ctx.fillStyle = `#${MUTED}`; ctx.textAlign = 'center'; ctx.fillText(label.slice(0, 12), x, canvas.height - 25);
  });
  series.forEach((item, sIndex) => {
    ctx.strokeStyle = item.color; ctx.fillStyle = item.color; ctx.lineWidth = 4;
    if (kind === 'bar') {
      const group = width / Math.max(labels.length, 1);
      const bar = Math.max(3, (group * .72) / series.length);
      item.values.forEach((value, i) => {
        const x = box.l + i * group + group * .14 + sIndex * bar;
        const h = (value / max) * height;
        ctx.fillRect(x, box.t + height - h, bar, h);
      });
    } else {
      ctx.beginPath();
      item.values.forEach((value, i) => {
        const x = box.l + (labels.length <= 1 ? width / 2 : (i / (labels.length - 1)) * width);
        const y = box.t + height * (1 - value / max);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.fillStyle = item.color; ctx.textAlign = 'left'; ctx.fillRect(box.l + sIndex * 230, 54, 22, 5);
    ctx.fillText(item.label, box.l + 30 + sIndex * 230, 61);
  });
  return canvas.toDataURL('image/png');
}

function chartImages(data: any) {
  const sales = data.salesSeries ?? [];
  const traffic = data.trafficSeries ?? [];
  const interactions = (data.topInteractions ?? []).slice(0, 10);
  return [
    sales.length ? { title: 'Revenue over time', image: chart('Revenue over time', sales.map((p: any) => p.key), [{ label: 'Revenue', values: sales.map((p: any) => Number(p.revenue || 0)), color: `#${FOREST}` }]) } : null,
    traffic.length ? { title: 'Visitors over time', image: chart('Visitors over time', traffic.map((p: any) => p.key), [{ label: 'Visitors', values: traffic.map((p: any) => Number(p.visitors || 0)), color: `#${NAVY}` }]) } : null,
    interactions.length ? { title: 'Most clicked controls', image: chart('Most clicked controls', interactions.map((p: any) => String(p.label)), [{ label: 'Clicks / taps', values: interactions.map((p: any) => Number(p.value || 0)), color: `#${FOREST}` }], 'bar') } : null,
  ].filter(Boolean) as { title: string; image: string }[];
}

async function exportCsv(data: any, filename: string, period: string) {
  const Papa = (await import('papaparse')).default;
  const rows: Row[] = [['Report', 'Period', 'Value', period, '', '', '', '', '', '']];
  for (const table of tables(data)) {
    table.rows.forEach((row) => {
      const out: Row = [table.title, row[0]];
      for (let i = 1; i < row.length; i += 1) out.push(table.headers[i], row[i]);
      rows.push(out);
    });
  }
  const width = Math.max(4, ...rows.map((r) => r.length));
  const fields = ['Report section', 'Item', 'Metric 1', 'Value 1', 'Metric 2', 'Value 2', 'Metric 3', 'Value 3', 'Metric 4', 'Value 4', 'Metric 5', 'Value 5', 'Metric 6', 'Value 6', 'Metric 7', 'Value 7', 'Metric 8', 'Value 8'].slice(0, width);
  const csv = Papa.unparse({ fields, data: rows.map((row) => Array.from({ length: width }, (_, i) => safe(row[i]))) });
  downloadBlob(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
}

async function exportXlsx(data: any, filename: string, period: string) {
  const ExcelJS = (await import('exceljs')).default;
  const book = new ExcelJS.Workbook();
  book.creator = 'Analytics'; book.created = new Date();
  const groups: { name: string; tables: Table[] }[] = [
    { name: 'Overview', tables: tables(data).slice(0, 3) },
    { name: 'Sales', tables: tables(data).filter((t) => ['Revenue over time', 'Order status', 'Sales by state', 'Top customers'].includes(t.title)) },
    { name: 'Traffic', tables: tables(data).filter((t) => ['Visitors over time', 'Traffic sources', 'Most viewed pages', 'Landing pages', 'Exit pages', 'Devices', 'Countries'].includes(t.title)) },
    { name: 'Clicks and taps', tables: tables(data).filter((t) => t.title.startsWith('Clicks') || t.title === 'Interaction input') },
    { name: 'Products', tables: tables(data).filter((t) => t.title === 'Product performance') },
    { name: 'Marketing', tables: tables(data).filter((t) => ['Lead sources', 'Email campaigns'].includes(t.title)) },
  ].filter((group) => group.tables.length);
  for (const group of groups) {
    const sheet = book.addWorksheet(group.name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 3 }] });
    sheet.addRow([`ANALYTICS — ${period}`]); sheet.mergeCells(1, 1, 1, 8);
    sheet.getRow(1).font = { bold: true, size: 18, color: { argb: `FF${CREAM}` } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } };
    sheet.addRow([`Generated ${new Date().toLocaleString()}`]); sheet.mergeCells(2, 1, 2, 8);
    let rowNo = 4;
    for (const table of group.tables) {
      sheet.getCell(rowNo, 1).value = table.title; sheet.mergeCells(rowNo, 1, rowNo, Math.max(2, table.headers.length));
      sheet.getCell(rowNo, 1).font = { bold: true, size: 13, color: { argb: `FF${FOREST}` } };
      rowNo += 1;
      const heading = sheet.getRow(rowNo); heading.values = table.headers;
      heading.font = { bold: true, color: { argb: `FF${CREAM}` } };
      heading.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${FOREST}` } };
      table.rows.forEach((row, index) => {
        const target = sheet.getRow(rowNo + 1 + index); target.values = row.map(safe);
        if (index % 2) target.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F1E6' } };
      });
      rowNo += table.rows.length + 3;
    }
    sheet.columns.forEach((column, i) => {
      const values = (column.values ?? []).slice(1, 250).map((v) => String(v ?? '').length);
      column.width = Math.min(55, Math.max(i === 0 ? 18 : 11, ...values.map((n) => n + 2)));
    });
    sheet.eachRow((row) => { row.alignment = { vertical: 'top', wrapText: true }; });
  }
  const overview = book.getWorksheet('Overview');
  if (overview) {
    let top = overview.rowCount + 2;
    for (const item of chartImages(data)) {
      const imageId = book.addImage({ base64: item.image, extension: 'png' });
      overview.addImage(imageId, { tl: { col: 0, row: top }, ext: { width: 720, height: 252 } });
      top += 15;
    }
  }
  const buffer = await book.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`);
}

async function exportPdf(data: any, filename: string, period: string) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const addHeader = (title: string) => {
    doc.setFillColor(35, 48, 73); doc.rect(0, 0, pageWidth, 58, 'F');
    doc.setTextColor(253, 251, 240); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(title, 36, 35);
    doc.setTextColor(90, 100, 95); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(`${period}  |  Generated ${new Date().toLocaleString()}`, 36, 76);
  };
  addHeader('Analytics report');
  const headline = tables(data)[0];
  autoTable(doc, { startY: 92, head: [headline.headers.slice(0, 4)], body: headline.rows.slice(0, 12).map((r) => r.slice(0, 4).map(clean)), theme: 'grid',
    styles: { fontSize: 8, cellPadding: 4 }, headStyles: { fillColor: [31, 66, 51], textColor: [253, 251, 240] }, alternateRowStyles: { fillColor: [247, 245, 234] }, margin: { left: 36, right: 36 } });

  for (const item of chartImages(data)) {
    doc.addPage(); addHeader(item.title); doc.addImage(item.image, 'PNG', 36, 96, pageWidth - 72, 245);
  }
  for (const table of tables(data).slice(1)) {
    doc.addPage(); addHeader(table.title);
    autoTable(doc, { startY: 92, head: [table.headers], body: table.rows.map((row) => row.map(clean)), theme: 'grid',
      styles: { fontSize: table.headers.length > 7 ? 6.5 : 8, cellPadding: 3, overflow: 'linebreak' }, headStyles: { fillColor: [31, 66, 51], textColor: [253, 251, 240] }, alternateRowStyles: { fillColor: [247, 245, 234] }, margin: { left: 36, right: 36 } });
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page); doc.setTextColor(100); doc.setFontSize(8); doc.text(`Page ${page} of ${pages}`, pageWidth - 36, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
  }
  doc.save(`${filename}.pdf`);
}

export async function exportAnalyticsReport(format: SheetFormat, data: any, period: string) {
  const filename = `analytics-${stamp()}`;
  if (format === 'csv') return exportCsv(data, filename, period);
  if (format === 'xlsx') return exportXlsx(data, filename, period);
  return exportPdf(data, filename, period);
}
