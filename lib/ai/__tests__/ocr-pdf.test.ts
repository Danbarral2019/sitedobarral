import { describe, it, expect, vi } from 'vitest';
import { limparCabecalhosDeOcr, transcreverPdfComOcr, MODELO_OCR } from '../ocr-pdf';

const cliente = (res: unknown) => ({ models: { generateContent: vi.fn().mockResolvedValue(res) } });

describe('transcreverPdfComOcr', () => {
  it('usa o modelo de OCR, sem raciocínio, e devolve texto e tokens', async () => {
    const c = cliente({ text: 'PARECER\u0000 Nº 1', candidates: [{ finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 } });
    const r = await transcreverPdfComOcr(Buffer.from('%PDF'), { cliente: c });
    expect(r).toEqual({ ok: true, texto: 'PARECER Nº 1', tokensEntrada: 10, tokensSaida: 20 });
    const req = c.models.generateContent.mock.calls[0][0];
    expect(req.model).toBe(MODELO_OCR);
    expect(req.config.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it('não usa o modelo principal (gemini-3), que recusa transcrição com RECITATION', () => {
    expect(MODELO_OCR).toBe('gemini-2.5-flash-lite');
  });

  it.each(['RECITATION', 'MAX_TOKENS', 'SAFETY'])('trata finishReason %s como falha', async (fim) => {
    const r = await transcreverPdfComOcr(Buffer.from('%PDF'), { cliente: cliente({ text: 'parcial', candidates: [{ finishReason: fim }] }) });
    expect(r).toEqual({ ok: false, erro: `OCR interrompido: ${fim}` });
  });

  it('não lança quando a chamada falha', async () => {
    const c = { models: { generateContent: vi.fn().mockRejectedValue(new Error('429 quota')) } };
    expect(await transcreverPdfComOcr(Buffer.from('%PDF'), { cliente: c })).toEqual({ ok: false, erro: 'OCR: 429 quota' });
  });
});

describe('limparCabecalhosDeOcr', () => {
  it('tira número de folha, "Fls.", "continuação do..." e cabeçalho curto repetido', () => {
    const texto = [
      'Advocacia-Geral da União', 'Parágrafo um do parecer.', '1',
      'Advocacia-Geral da União', 'continuação do PARECER Nº 043/2014/DECOR', 'Fls. 281', 'Parágrafo dois.',
      'Advocacia-Geral da União', '(...)', 'Parágrafo três.', '(...)', '(...)',
    ].join('\n');
    const limpo = limparCabecalhosDeOcr(texto).split('\n');
    expect(limpo).toEqual(['Parágrafo um do parecer.', 'Parágrafo dois.', '(...)', 'Parágrafo três.', '(...)', '(...)']);
  });
});
