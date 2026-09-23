/**
 * The product spreadsheet: which columns an export writes and which headings an
 * import understands.
 *
 * Shared by the dashboard (which reads and writes the files in the browser) and
 * the import route (which validates every row again), so the two cannot
 * disagree about what a column means. Nothing secret lives here.
 *
 * Imports come from other people's spreadsheets — another store's catalogue, a
 * supplier's price list — so each field accepts several common headings, in
 * English and Spanish. Unknown columns are ignored rather than refused.
 */

export type SheetFieldType = 'text' | 'money' | 'integer' | 'boolean' | 'date' | 'list';

export interface SheetField {
  key: string;
  header: string;
  type: SheetFieldType;
  aliases: string[];
  /** Shown in the PDF, which has no room for every column. */
  inPdf?: boolean;
}

export const PRODUCT_SHEET_FIELDS: SheetField[] = [
  { key: 'name', header: 'Name', type: 'text', inPdf: true, aliases: ['product', 'product name', 'title', 'nombre', 'producto'] },
  { key: 'sku', header: 'SKU', type: 'text', inPdf: true, aliases: ['code', 'product code', 'item code', 'codigo', 'código', 'ref'] },
  { key: 'category', header: 'Category', type: 'text', inPdf: true, aliases: ['category name', 'categoria', 'categoría', 'type'] },
  { key: 'price', header: 'Price', type: 'money', inPdf: true, aliases: ['regular price', 'price usd', 'price (usd)', 'unit price', 'precio', 'cost'] },
  { key: 'sale_price', header: 'Sale price', type: 'money', inPdf: true, aliases: ['sale', 'discount price', 'offer price', 'precio oferta', 'precio de oferta'] },
  { key: 'stock_count', header: 'Stock', type: 'integer', inPdf: true, aliases: ['stock count', 'quantity', 'qty', 'inventory', 'units', 'units in stock', 'existencias', 'cantidad'] },
  { key: 'purity', header: 'Purity', type: 'text', inPdf: true, aliases: ['pureza'] },
  { key: 'is_active', header: 'Live', type: 'boolean', inPdf: true, aliases: ['active', 'published', 'visible', 'status', 'activo'] },
  { key: 'slug', header: 'Web address', type: 'text', aliases: ['slug', 'url', 'handle', 'url slug'] },
  { key: 'description', header: 'Description', type: 'text', aliases: ['descripcion', 'descripción', 'details', 'short description'] },
  { key: 'sequence', header: 'Sequence', type: 'text', aliases: ['secuencia', 'amino acid sequence'] },
  { key: 'cas_number', header: 'CAS number', type: 'text', aliases: ['cas', 'cas no', 'cas #'] },
  { key: 'molar_mass', header: 'Molar mass', type: 'text', aliases: ['molecular weight', 'mw', 'masa molar', 'peso molecular'] },
  { key: 'formula', header: 'Formula', type: 'text', aliases: ['molecular formula', 'fórmula'] },
  { key: 'storage', header: 'Storage', type: 'text', aliases: ['almacenamiento', 'storage conditions'] },
  { key: 'appearance', header: 'Appearance', type: 'text', aliases: ['apariencia', 'form'] },
  { key: 'tags', header: 'Tags', type: 'list', aliases: ['keywords', 'etiquetas'] },
  { key: 'image', header: 'Photo link', type: 'text', aliases: ['image', 'image url', 'photo', 'imagen', 'picture'] },
  { key: 'coa_url', header: 'Certificate link', type: 'text', aliases: ['coa', 'coa url', 'certificate', 'certificado'] },
  { key: 'coa_lot', header: 'Certificate lot', type: 'text', aliases: ['lot', 'batch', 'lote'] },
  { key: 'coa_tested_at', header: 'Tested on', type: 'date', aliases: ['test date', 'tested', 'fecha de prueba'] },
  { key: 'coa_lab', header: 'Testing laboratory', type: 'text', aliases: ['lab', 'laboratory', 'testing lab', 'analytical lab', 'laboratorio'] },
  { key: 'coa_method', header: 'Test method', type: 'text', aliases: ['method', 'analytical method', 'test', 'assay method', 'metodo', 'método'] },
  { key: 'is_featured', header: 'Featured', type: 'boolean', aliases: ['destacado'] },
  { key: 'is_popular', header: 'Popular', type: 'boolean', aliases: ['popular item'] },
  { key: 'sort_order', header: 'Sort position', type: 'integer', aliases: ['sort', 'position', 'order', 'orden'] },
];

const normalise = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9#]+/g, ' ').trim();

const HEADER_LOOKUP = new Map<string, string>();
for (const field of PRODUCT_SHEET_FIELDS) {
  for (const label of [field.key, field.header, ...field.aliases]) {
    HEADER_LOOKUP.set(normalise(label), field.key);
  }
}

/** The product field a spreadsheet heading refers to, or null. */
export function fieldForHeader(header: string): string | null {
  return HEADER_LOOKUP.get(normalise(String(header ?? ''))) ?? null;
}

/** Map a row keyed by the file's own headings onto product field names. */
export function mapSheetRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [header, value] of Object.entries(raw)) {
    const key = fieldForHeader(header);
    if (!key || key in out) continue;
    // Undo the apostrophe our export adds in front of formula-like text.
    out[key] = typeof value === 'string' && /^'[=+\-@]/.test(value) ? value.slice(1) : value;
  }
  return out;
}

/** One product as the cells of an export row, in PRODUCT_SHEET_FIELDS order. */
export function productToCells(product: Record<string, unknown>, fields = PRODUCT_SHEET_FIELDS): (string | number)[] {
  return fields.map((field) => {
    const coa = (product.coa ?? {}) as Record<string, unknown>;
    const value =
      field.key === 'coa_lab' ? coa.lab
      : field.key === 'coa_method' ? coa.method
      : product[field.key];
    if (value === null || value === undefined) return '';
    switch (field.type) {
      case 'money':
      case 'integer':
        return Number.isFinite(Number(value)) ? Number(value) : '';
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'list':
        return Array.isArray(value) ? value.join(', ') : String(value);
      case 'date':
        return String(value).slice(0, 10);
      default:
        return String(value);
    }
  });
}

const TRUE_WORDS = new Set(['yes', 'y', 'true', '1', 'si', 'sí', 'live', 'active', 'published', 'on', 'x']);
const FALSE_WORDS = new Set(['no', 'n', 'false', '0', 'draft', 'hidden', 'inactive', 'off', '']);

/** Read a yes/no cell. Undefined when the cell says something else. */
export function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const word = String(value ?? '').trim().toLowerCase();
  if (TRUE_WORDS.has(word)) return true;
  if (FALSE_WORDS.has(word)) return false;
  return undefined;
}

/** Read a money cell: "$1,299.50", "1299,50" and 1299.5 all work. */
export function readMoney(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  let text = String(value ?? '').trim().replace(/[^\d.,-]/g, '');
  if (!text) return undefined;
  // "1.299,50" or "12,5" — a comma after the last dot is the decimal mark.
  if (text.lastIndexOf(',') > text.lastIndexOf('.')) text = text.replace(/\./g, '').replace(',', '.');
  else text = text.replace(/,/g, '');
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

export const PRODUCT_IMPORT_LIMIT = 1000;
