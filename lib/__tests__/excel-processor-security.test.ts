import { describe, expect, it } from 'vitest';
import type * as XLSX from 'xlsx';
import {
  MAX_WORKBOOK_BYTES,
  MAX_WORKBOOK_CELLS,
  MAX_WORKBOOK_SHEETS,
  validateWorkbookShape,
  validateWorkbookUpload,
} from '../excel-processor';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLS_MIME = 'application/vnd.ms-excel';

function makeWorkbook(sheetRefs: string[]): XLSX.WorkBook {
  const SheetNames = sheetRefs.map((_, index) => `Aba ${index + 1}`);
  const Sheets = Object.fromEntries(
    SheetNames.map((name, index) => [name, { '!ref': sheetRefs[index] }]),
  );
  return { SheetNames, Sheets } as XLSX.WorkBook;
}

describe('validateWorkbookUpload', () => {
  it('rejeita planilha acima de 5 MiB', () => {
    expect(() => validateWorkbookUpload({
      filename: 'entrada.xlsx',
      mimeType: XLSX_MIME,
      size: MAX_WORKBOOK_BYTES + 1,
    })).toThrow('A planilha excede o limite de 5 MiB.');
  });

  it('rejeita extensão que não seja xlsx ou xls', () => {
    expect(() => validateWorkbookUpload({
      filename: 'entrada.csv',
      mimeType: 'text/csv',
      size: 1024,
    })).toThrow('Formato de planilha não permitido. Use .xlsx ou .xls.');
  });

  it('rejeita MIME incompatível com a extensão', () => {
    expect(() => validateWorkbookUpload({
      filename: 'entrada.xlsx',
      mimeType: XLS_MIME,
      size: 1024,
    })).toThrow('O tipo do arquivo não corresponde à extensão .xlsx.');
  });

  it('aceita uploads xlsx e xls com MIME correspondente', () => {
    expect(() => validateWorkbookUpload({
      filename: 'entrada.xlsx',
      mimeType: XLSX_MIME,
      size: MAX_WORKBOOK_BYTES,
    })).not.toThrow();
    expect(() => validateWorkbookUpload({
      filename: 'entrada.XLS',
      mimeType: XLS_MIME,
      size: 1024,
    })).not.toThrow();
  });
});

describe('validateWorkbookShape', () => {
  it('rejeita workbook acima de 25 abas', () => {
    const workbook = makeWorkbook(Array.from({ length: MAX_WORKBOOK_SHEETS + 1 }, () => 'A1'));

    expect(() => validateWorkbookShape(workbook))
      .toThrow('A planilha excede o limite de 25 abas.');
  });

  it('rejeita mais de 100.000 células somadas entre as abas', () => {
    const workbook = makeWorkbook(['A1:CV501', 'A1:CV500']);

    expect(() => validateWorkbookShape(workbook))
      .toThrow('A planilha excede o limite de 100.000 células.');
  });

  it('aceita workbook no limite de 100.000 células', () => {
    const workbook = makeWorkbook(['A1:CV1000']);

    expect(MAX_WORKBOOK_CELLS).toBe(100_000);
    expect(() => validateWorkbookShape(workbook)).not.toThrow();
  });
});
