import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { tcePEScraper } from '../tce-pe';

const PARAGRAFO = 'Trata-se de auditoria de conformidade na contratação de serviços de limpeza urbana. '.repeat(4).trim();

const base = {
  nomeTipoDocumento: 'ACORDAO',
  numeroDeliberacaoProcesso: '1966',
  anoDeliberacaoProcesso: '2026',
  dataJulgamentoProcesso: '2026-09-24',
  detalheProcessoNomeUnidadeJurisdicionada: 'Prefeitura da Cidade do Recife',
};

describe('TCE-PE: inteiro teor da deliberação', () => {
  it('guarda o inteiro teor com parágrafos, e a forma achatada segue para ementa e classificação', () => {
    const raw = tcePEScraper.deliberacaoToDecision({
      ...base,
      descricaoParecerProcesso: `<p>INTEIRO TEOR DA DELIBERAÇÃO</p><p>RELATÓRIO</p><p>${PARAGRAFO}</p>`,
    });
    expect(raw.inteiroTeor).toBe(`INTEIRO TEOR DA DELIBERAÇÃO\nRELATÓRIO\n${PARAGRAFO}`);
    // A forma achatada não muda com esta correção (ementa e classificação iguais às de antes).
    expect(raw.fullText).not.toContain('\n');
    expect(raw.ementa).toContain('Trata-se de auditoria de conformidade');
  });

  it('trata o aviso "Não foi possível obter o texto." como ausência de texto', () => {
    const raw = tcePEScraper.deliberacaoToDecision({
      ...base,
      descricaoParecerProcesso: 'Não foi possível obter o texto.',
    });
    expect(raw.inteiroTeor).toBeUndefined();
    expect(raw.fullText).toBeUndefined();
    expect(raw.ementa).toBe('ACORDAO 1966/2026 - Prefeitura da Cidade do Recife');
  });
});
