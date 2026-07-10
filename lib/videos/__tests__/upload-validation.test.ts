import { describe, it, expect } from 'vitest';
import {
  validateVideoUpload,
  generateVideoKey,
  MAX_VIDEO_SIZE_BYTES,
} from '../upload-validation';

describe('validateVideoUpload', () => {
  const ok = { fileName: 'aula-01.mp4', fileSize: 1_000_000, fileType: 'video/mp4' };

  it('aceita mp4 dentro do limite', () => {
    expect(validateVideoUpload(ok)).toEqual({ valid: true });
  });

  it('rejeita MIME não-vídeo', () => {
    const r = validateVideoUpload({ ...ok, fileType: 'application/pdf' });
    expect(r.valid).toBe(false);
  });

  it('rejeita arquivo acima do teto', () => {
    const r = validateVideoUpload({ ...ok, fileSize: MAX_VIDEO_SIZE_BYTES + 1 });
    expect(r.valid).toBe(false);
  });

  it('rejeita nome vazio', () => {
    const r = validateVideoUpload({ ...ok, fileName: '   ' });
    expect(r.valid).toBe(false);
  });

  it('rejeita tamanho zero/negativo', () => {
    expect(validateVideoUpload({ ...ok, fileSize: 0 }).valid).toBe(false);
  });
});

describe('generateVideoKey', () => {
  it('gera chave sob videos/<courseId>/ com nome sanitizado', () => {
    const key = generateVideoKey('3', 'Aula 01 — Introdução.mp4', 'abc-123');
    expect(key).toBe('videos/3/abc-123-aula-01-introducao.mp4');
  });

  it('remove caracteres especiais e acentos', () => {
    const key = generateVideoKey('2', 'Gestão & Fiscalização!.mov', 'uid');
    expect(key).toMatch(/^videos\/2\/uid-gestao-fiscalizacao-\.mov$/);
  });
});
