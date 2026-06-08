import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  authLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  dbLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { withGeminiKeyFallback } from '../api-key-fallback';
import { apiLogger } from '@/lib/logger';

describe('withGeminiKeyFallback', () => {
  const origPrimary = process.env.GEMINI_API_KEY;
  const origBackup = process.env.GEMINI_API_KEY_BACKUP;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (origPrimary !== undefined) process.env.GEMINI_API_KEY = origPrimary;
    else delete process.env.GEMINI_API_KEY;
    if (origBackup !== undefined) process.env.GEMINI_API_KEY_BACKUP = origBackup;
    else delete process.env.GEMINI_API_KEY_BACKUP;
  });

  it('throws com mensagem clara quando nenhuma key está configurada', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY_BACKUP;
    const fn = vi.fn();

    await expect(withGeminiKeyFallback(fn)).rejects.toThrow('GEMINI_API_KEY not configured');
    expect(fn).not.toHaveBeenCalled();
  });

  it('invoca fn uma vez com primary quando primary retorna OK', async () => {
    process.env.GEMINI_API_KEY = 'primary-key';
    process.env.GEMINI_API_KEY_BACKUP = 'backup-key';
    const fn = vi.fn().mockResolvedValue('ok');

    const result = await withGeminiKeyFallback(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('primary-key');
  });

  it('cai pra backup quando primary lança erro 429 RESOURCE_EXHAUSTED', async () => {
    process.env.GEMINI_API_KEY = 'primary-key';
    process.env.GEMINI_API_KEY_BACKUP = 'backup-key';
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('429 RESOURCE_EXHAUSTED quota exceeded'))
      .mockResolvedValueOnce('ok-from-backup');

    const result = await withGeminiKeyFallback(fn);

    expect(result).toBe('ok-from-backup');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 'primary-key');
    expect(fn).toHaveBeenNthCalledWith(2, 'backup-key');
    expect(apiLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ keyIndex: 0, nextIndex: 1 }),
      expect.stringContaining('quota-exhausted'),
    );
  });

  it('lança o erro do backup quando ambas keys retornam 429', async () => {
    process.env.GEMINI_API_KEY = 'primary-key';
    process.env.GEMINI_API_KEY_BACKUP = 'backup-key';
    const primaryErr = new Error('429 primary quota exceeded');
    const backupErr = new Error('429 backup quota exceeded');
    const fn = vi.fn().mockRejectedValueOnce(primaryErr).mockRejectedValueOnce(backupErr);

    await expect(withGeminiKeyFallback(fn)).rejects.toBe(backupErr);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('propaga erro não-quota direto sem tentar backup', async () => {
    process.env.GEMINI_API_KEY = 'primary-key';
    process.env.GEMINI_API_KEY_BACKUP = 'backup-key';
    const authErr = new Error('401 invalid api key');
    const fn = vi.fn().mockRejectedValue(authErr);

    await expect(withGeminiKeyFallback(fn)).rejects.toBe(authErr);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
