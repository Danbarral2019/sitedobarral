/**
 * Leitura e escrita de planilhas .xlsx com a biblioteca `exceljs`.
 *
 * Substitui o `xlsx` (SheetJS 0.18), que tem vulnerabilidades sem correção no
 * npm (prototype pollution e ReDoS). Para não mudar o comportamento das rotas e
 * dos scripts, este módulo reproduz o subconjunto do SheetJS que o projeto usa:
 *
 * - `readWorkbook` devolve `{ SheetNames, Sheets }`, com o intervalo `!ref` de
 *   cada aba (usado na validação de tamanho) e acesso às células;
 * - `sheetToJson` segue a semântica de `XLSX.utils.sheet_to_json` com valores
 *   brutos: cabeçalho na primeira linha (vazios viram `__EMPTY`, repetidos
 *   ganham `_1`, `_2`), ou cabeçalho fixo com `header: [...]` e `range: n`;
 *   linhas vazias são descartadas; células vazias não geram chave;
 * - datas: com `cellDates: true` a célula vira `Date` com o mesmo horário de
 *   parede da planilha no fuso local (como o SheetJS); sem a opção, vira o
 *   número serial do Excel (o SheetJS também devolvia o serial);
 * - `jsonToAoa`/`writeWorkbook` reproduzem `json_to_sheet`, `aoa_to_sheet` e
 *   `XLSX.write`: cabeçalho na ordem em que as chaves aparecem, números,
 *   textos e booleanos com o tipo original, `null`/`undefined` como célula
 *   vazia e `Date` como data com o formato `m/d/yy`.
 *
 * Não lê o formato .xls (BIFF, Excel 97-2003) nem .csv: o `exceljs` não tem
 * leitor de .xls, e as rotas de upload aceitam só .xlsx (ver
 * `validateWorkbookUpload` em `lib/excel-processor.ts`).
 *
 * Sem dependências de servidor: o hook do TCU Manager importa este módulo no
 * navegador (import dinâmico) para gerar a planilha de revisão.
 */

import ExcelJS from 'exceljs';

export type SheetCellType = 's' | 'n' | 'b' | 'd' | 'e';

export interface SheetCell {
  t: SheetCellType;
  v: string | number | boolean | Date;
}

export interface SheetData {
  /** Intervalo ocupado, no formato `A1:C10` (ausente se a aba estiver vazia). */
  '!ref'?: string;
  /** Célula na linha `r` e coluna `c` (base 0), ou `undefined` se vazia. */
  cell?: (r: number, c: number) => SheetCell | undefined;
}

export interface WorkbookData {
  SheetNames: string[];
  Sheets: Record<string, SheetData>;
}

export interface CellRange {
  s: { r: number; c: number };
  e: { r: number; c: number };
}

export interface ReadWorkbookOptions {
  /** Datas como `Date` (padrão: número serial do Excel). */
  cellDates?: boolean;
}

export interface SheetToJsonOptions {
  /** Nomes fixos das colunas, a partir da primeira coluna do intervalo. */
  header?: string[];
  /** Linha inicial (base 0) da leitura. */
  range?: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Dias entre 30/12/1899 (época do Excel) e 01/01/1970. */
const EXCEL_EPOCH_OFFSET_DAYS = 25569;
/** Dias entre as épocas 1900 e 1904 do Excel. */
const DATE1904_OFFSET_DAYS = 1462;
/** Código de erro `#NULL!`, o único que o SheetJS devolvia como `null`. */
const NULL_ERROR = '#NULL!';
/** Formato de data que o SheetJS aplicava em `json_to_sheet` (tabela 14). */
const DEFAULT_DATE_FORMAT = 'm/d/yy';

const XLS_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0];
const ZIP_SIGNATURE = [0x50, 0x4b];

export const XLS_NOT_SUPPORTED_MESSAGE =
  'O formato .xls (Excel 97-2003) não é suportado. Abra a planilha no Excel ou no LibreOffice e salve como .xlsx antes de enviar.';

// ---------------------------------------------------------------------------
// Endereços de célula
// ---------------------------------------------------------------------------

export function encodeCol(col: number): string {
  let s = '';
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(((n - 1) % 26) + 65) + s;
  }
  return s;
}

export function encodeCell(cell: { r: number; c: number }): string {
  return `${encodeCol(cell.c)}${cell.r + 1}`;
}

export function encodeRange(range: CellRange): string {
  const start = encodeCell(range.s);
  const end = encodeCell(range.e);
  return start === end ? start : `${start}:${end}`;
}

function decodeCell(address: string): { r: number; c: number } {
  const match = /^\$?([A-Z]{1,3})\$?(\d{1,7})$/i.exec(address.trim());
  if (!match) throw new Error(`Endereço de célula inválido: ${address}`);
  let c = 0;
  for (const ch of match[1].toUpperCase()) c = c * 26 + (ch.charCodeAt(0) - 64);
  const r = parseInt(match[2], 10);
  if (r < 1) throw new Error(`Endereço de célula inválido: ${address}`);
  return { r: r - 1, c: c - 1 };
}

/** Converte `A1:C10` (ou `A1`) em intervalo de base 0. Lança erro se inválido. */
export function decodeRange(reference: string): CellRange {
  const parts = reference.split(':');
  if (parts.length > 2 || !parts[0]) throw new Error(`Intervalo inválido: ${reference}`);
  const s = decodeCell(parts[0]);
  const e = decodeCell(parts[1] ?? parts[0]);
  return { s, e };
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

/**
 * O `exceljs` devolve a data da planilha como instante UTC (meia-noite UTC para
 * uma data sem hora). O SheetJS devolvia o mesmo horário de parede no fuso
 * local. Em UTC (Vercel) as duas formas coincidem; em fusos como o de Brasília
 * o SheetJS 0.18 ainda somava ~28 s (offset histórico de 1899), defeito que não
 * é reproduzido aqui.
 */
function utcWallClockToLocal(date: Date): Date {
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  );
}

/** Inverso de `utcWallClockToLocal`, usado na escrita (o `exceljs` grava em UTC). */
function localWallClockToUtc(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds(),
    ),
  );
}

function dateToSerial(date: Date, date1904: boolean): number {
  // O exceljs arredonda a Date para milissegundos: serial inteiro (data sem
  // hora) volta exato; fração de dia pode diferir na 9ª casa decimal.
  const serial = date.getTime() / MS_PER_DAY + EXCEL_EPOCH_OFFSET_DAYS;
  return date1904 ? serial - DATE1904_OFFSET_DAYS : serial;
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

function startsWith(buffer: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => buffer[index] === byte);
}

interface ConvertContext {
  cellDates: boolean;
  date1904: boolean;
}

function convertValue(value: unknown, ctx: ConvertContext): SheetCell | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return { t: 'n', v: value };
  if (typeof value === 'string') return { t: 's', v: value };
  if (typeof value === 'boolean') return { t: 'b', v: value };
  if (value instanceof Date) {
    return ctx.cellDates
      ? { t: 'd', v: utcWallClockToLocal(value) }
      : { t: 'n', v: dateToSerial(value, ctx.date1904) };
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      const text = (obj.richText as Array<{ text?: unknown }>)
        .map((part) => (part.text == null ? '' : String(part.text)))
        .join('');
      return { t: 's', v: text };
    }
    if (typeof obj.error === 'string') return { t: 'e', v: obj.error };
    if ('formula' in obj || 'sharedFormula' in obj) return convertValue(obj.result, ctx);
    if ('hyperlink' in obj || 'text' in obj) return convertValue(obj.text, ctx);
  }
  return undefined;
}

function buildSheet(worksheet: ExcelJS.Worksheet, ctx: ConvertContext): SheetData {
  const cells = new Map<number, Map<number, SheetCell>>();
  let range: CellRange | undefined;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const r = rowNumber - 1;
      const c = colNumber - 1;
      if (!range) {
        range = { s: { r, c }, e: { r, c } };
      } else {
        range.s.r = Math.min(range.s.r, r);
        range.s.c = Math.min(range.s.c, c);
        range.e.r = Math.max(range.e.r, r);
        range.e.c = Math.max(range.e.c, c);
      }
      // Células escravas de mesclagem: o exceljs repete o valor da célula
      // mestre; o SheetJS as deixava vazias.
      if (cell.type === ExcelJS.ValueType.Merge) return;
      const converted = convertValue(cell.value, ctx);
      if (!converted) return;
      let rowCells = cells.get(r);
      if (!rowCells) {
        rowCells = new Map();
        cells.set(r, rowCells);
      }
      rowCells.set(c, converted);
    });
  });

  return {
    ...(range ? { '!ref': encodeRange(range) } : {}),
    cell: (r, c) => cells.get(r)?.get(c),
  };
}

/**
 * Lê uma planilha .xlsx. Lança erro se o conteúdo não for .xlsx (inclusive se
 * for .xls renomeado).
 */
export async function readWorkbook(
  data: Uint8Array | ArrayBuffer,
  options: ReadWorkbookOptions = {},
): Promise<WorkbookData> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (startsWith(bytes, XLS_SIGNATURE)) {
    throw new Error(XLS_NOT_SUPPORTED_MESSAGE);
  }
  if (!startsWith(bytes, ZIP_SIGNATURE)) {
    throw new Error('O arquivo não é uma planilha .xlsx válida.');
  }

  const workbook = new ExcelJS.Workbook();
  // A tipagem do exceljs pede o Buffer antigo do Node; o load aceita Uint8Array.
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);

  const ctx: ConvertContext = {
    cellDates: options.cellDates === true,
    date1904: Boolean(workbook.properties?.date1904),
  };

  const SheetNames: string[] = [];
  const Sheets: Record<string, SheetData> = {};
  for (const worksheet of workbook.worksheets) {
    SheetNames.push(worksheet.name);
    Sheets[worksheet.name] = buildSheet(worksheet, ctx);
  }
  return { SheetNames, Sheets };
}

/** Texto do cabeçalho, como o `format_cell` do SheetJS para os tipos comuns. */
function headerText(cell: SheetCell | undefined): string {
  if (!cell) return '__EMPTY';
  switch (cell.t) {
    case 's':
      return cell.v as string;
    case 'b':
      return cell.v ? 'TRUE' : 'FALSE';
    case 'd':
      return (cell.v as Date).toISOString();
    default:
      return String(cell.v);
  }
}

/**
 * Equivalente a `XLSX.utils.sheet_to_json(sheet, options)` com valores brutos.
 */
export function sheetToJson<T = Record<string, unknown>>(
  sheet: SheetData | undefined,
  options: SheetToJsonOptions = {},
): T[] {
  if (!sheet || !sheet['!ref'] || !sheet.cell) return [];
  const getCell = sheet.cell;
  const range = decodeRange(sheet['!ref']);
  if (typeof options.range === 'number') range.s.r = options.range;

  const fixedHeader = Array.isArray(options.header) ? options.header : undefined;
  const hdr: Array<string | undefined> = [];
  const headerCount: Record<string, number> = {};

  for (let c = range.s.c; c <= range.e.c; c++) {
    if (fixedHeader) {
      hdr[c] = fixedHeader[c - range.s.c];
      continue;
    }
    const base = headerText(getCell(range.s.r, c));
    let name = base;
    let counter = headerCount[base] || 0;
    if (!counter) {
      headerCount[base] = 1;
    } else {
      do {
        name = `${base}_${counter++}`;
      } while (headerCount[name]);
      headerCount[base] = counter;
      headerCount[name] = 1;
    }
    hdr[c] = name;
  }

  const out: T[] = [];
  const firstDataRow = fixedHeader ? range.s.r : range.s.r + 1;
  for (let r = firstDataRow; r <= range.e.r; r++) {
    const row: Record<string, unknown> = {};
    Object.defineProperty(row, '__rowNum__', { value: r, enumerable: false });
    let isEmpty = true;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const key = hdr[c];
      if (key == null) continue;
      const cell = getCell(r, c);
      if (!cell) continue;
      if (cell.t === 'e') {
        // #NULL! vira null; os demais erros são ignorados (como no SheetJS).
        if (cell.v === NULL_ERROR) row[key] = null;
        continue;
      }
      row[key] = cell.v;
      isEmpty = false;
    }
    if (!isEmpty) out.push(row as T);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export interface WorksheetSpec {
  name: string;
  /** Linhas da aba (matriz), como em `aoa_to_sheet`. */
  rows: unknown[][];
  /** Largura de cada coluna em caracteres (o `wch` do SheetJS). */
  columnWidths?: number[];
}

/**
 * Equivalente ao `json_to_sheet`: devolve a matriz com o cabeçalho na primeira
 * linha. As colunas seguem `header` e depois as chaves na ordem em que
 * aparecem nas linhas.
 */
export function jsonToAoa<T extends object>(rows: T[], header: string[] = []): unknown[][] {
  const columns = [...header];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }
  return [
    columns,
    ...rows.map((row) => columns.map((column) => (row as Record<string, unknown>)[column])),
  ];
}

/** Gera o arquivo .xlsx com as abas na ordem informada. */
export async function writeWorkbook(sheets: WorksheetSpec[]): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook();
  for (const spec of sheets) {
    const worksheet = workbook.addWorksheet(spec.name);
    spec.rows.forEach((values, rowIndex) => {
      const row = worksheet.getRow(rowIndex + 1);
      values.forEach((value, colIndex) => {
        if (value === null || value === undefined) return;
        const cell = row.getCell(colIndex + 1);
        if (value instanceof Date) {
          cell.value = localWallClockToUtc(value);
          cell.numFmt = DEFAULT_DATE_FORMAT;
        } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          cell.value = value;
        }
      });
    });
    spec.columnWidths?.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
