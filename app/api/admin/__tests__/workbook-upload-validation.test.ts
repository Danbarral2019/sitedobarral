// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { MAX_WORKBOOK_BYTES, MAX_WORKBOOK_SHEETS } from '@/lib/excel-processor';

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  sheetToJson: vi.fn(),
}));

vi.mock('xlsx', () => ({
  read: mocks.read,
  utils: {
    sheet_to_json: mocks.sheetToJson,
  },
}));
vi.mock('@/lib/api/handler', () => ({
  withAdminApi: (handler: unknown) => handler,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: { document: { findFirst: vi.fn() } },
}));
vi.mock('@/lib/documents', () => ({ addDocument: vi.fn() }));
vi.mock('@/lib/logger', () => {
  const logger = {
    child: () => logger,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return { apiLogger: logger, authLogger: logger, logger };
});

import { POST as analyzeTcuFile } from '../analyze-tcu-file/route';
import { POST as convertTcu } from '../convert-tcu/route';
import { POST as validateTcuManager } from '../tcu-manager/validate/route';
import { POST as convertTcuManager } from '../tcu-manager/convert/route';
import { POST as validateExcelImport } from '../import-excel/validate/route';
import { POST as executeExcelImport } from '../import-excel/import/route';

type UploadHandler = typeof analyzeTcuFile;

const handlers: Array<[string, UploadHandler]> = [
  ['analyze-tcu-file', analyzeTcuFile],
  ['convert-tcu', convertTcu],
  ['tcu-manager/validate', validateTcuManager],
  ['tcu-manager/convert', convertTcuManager],
  ['import-excel/validate', validateExcelImport],
  ['import-excel/import', executeExcelImport],
];

function makeRequest(file: File): NextRequest {
  const formData = new FormData();
  formData.set('file', file);
  return new NextRequest('http://localhost/api/admin/workbook', {
    method: 'POST',
    body: formData,
  });
}

const context = { params: Promise.resolve({}) };

describe.each(handlers)('POST /api/admin/%s', (_name, handler) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sheetToJson.mockReturnValue([]);
  });

  it('rejeita arquivo grande antes de chamar o parser xlsx', async () => {
    const file = new File(
      [new Uint8Array(MAX_WORKBOOK_BYTES + 1)],
      'entrada.xlsx',
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    );

    await expect(handler(makeRequest(file), context))
      .rejects.toThrow('A planilha excede o limite de 5 MiB.');
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('rejeita workbook com mais de 25 abas antes de iterar dados', async () => {
    const SheetNames = Array.from(
      { length: MAX_WORKBOOK_SHEETS + 1 },
      (_, index) => `Aba ${index + 1}`,
    );
    mocks.read.mockReturnValue({
      SheetNames,
      Sheets: Object.fromEntries(SheetNames.map((name) => [name, { '!ref': 'A1' }])),
    });
    const file = new File(
      [new Uint8Array([1])],
      'entrada.xlsx',
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    );

    await expect(handler(makeRequest(file), context))
      .rejects.toThrow('A planilha excede o limite de 25 abas.');
    expect(mocks.sheetToJson).not.toHaveBeenCalled();
  });
});
