import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { hitParaDecisao, montarUrlBusca, statusTcdf, TCDF_TEMA_LICITACOES } from '../tcdf';

// Decisão real (26/09/2026), com os campos longos encurtados.
const HIT = {
  documento_numero_ano: '2405/2026',
  documento_edoc: '25CCB1BD',
  jurisprudencia_tipo_descricao: 'Decisão',
  processo_numero_completo: '00600-00014304/2025-42',
  processo_relator: 'Antonio Renato Alves Rainha',
  sessao_data: '2026-07-29T18:00:00.000Z',
  jurisprudencia_ementa:
    'Edital do Pregão Eletrônico SRP nº 90037/2025, lançado pela Secretaria de Estado de Desenvolvimento Econômico, Trabalho e Renda do Distrito Federal - SEDET/DF, cujo objeto é o registro de preços para a contratação de empresa especializada na implantação e manutenção de pavimento asfáltico.',
  jurisprudencia_verbetacao:
    '1. LICITAÇÕES E CONTRATOS: LICITAÇÕES E CONTRATOS. GESTÃO PÚBLICA. OBRAS E SERVIÇOS DE ENGENHARIA. PAVIMENTAÇÃO ASFÁLTICA. ORÇAMENTO ESTIMATIVO.;',
  jurisprudencia_decisao:
    'O Tribunal, por unanimidade, de acordo com o voto do Relator, decidiu: I - tomar conhecimento do Ofício nº 1.049/2026 - SEDET/GAB; II - determinar a revisão do orçamento estimativo.',
  jurisprudencia_situacao: 'Publicada',
  jurisprudencia_relevancia: 'Média',
  jurisprudencia_classificacao_tematica: 'Licitações e Contratos',
};

describe('TCDF: hitParaDecisao', () => {
  const d = hitParaDecisao(HIT);

  it('identifica a decisão pelo número/ano e monta o link público pelo e-Doc', () => {
    expect(d.decisionNumber).toBe('2405/2026');
    expect(d.title).toBe('Decisão 2405/2026 TCDF');
    expect(d.url).toBe(
      'https://www.tc.df.gov.br/app/mesaVirtual/implementacao/?a=consultaETCDF&f=formPrincipal&edoc=25CCB1BD',
    );
    expect(d.processNumber).toBe('00600-00014304/2025-42');
    expect(d.relator).toBe('Antonio Renato Alves Rainha');
  });

  it('usa a data da sessão como data de julgamento', () => {
    expect(d.dataJulgamento?.toISOString().slice(0, 10)).toBe('2026-07-29');
  });

  it('põe a verbetação à frente da ementa, porque a ementa do TCDF só descreve o objeto', () => {
    expect(d.ementa.startsWith('LICITAÇÕES E CONTRATOS: LICITAÇÕES E CONTRATOS. GESTÃO PÚBLICA.')).toBe(true);
    expect(d.ementa).toContain('Edital do Pregão Eletrônico SRP nº 90037/2025');
  });

  it('guarda o dispositivo da decisão como texto integral', () => {
    expect(d.fullText).toContain('determinar a revisão do orçamento estimativo');
  });

  it('sem verbetação, a ementa é a do TCDF', () => {
    const s = hitParaDecisao({ ...HIT, jurisprudencia_verbetacao: '' });
    expect(s.ementa.startsWith('Edital do Pregão Eletrônico')).toBe(true);
  });
});

describe('TCDF: statusTcdf', () => {
  const kw = (approvalStatus: 'auto_approved' | 'pending' | 'auto_rejected', reasoning = '+10: licitação') => ({ approvalStatus, reasoning });
  const ia = (veredito: 'aprovar' | 'rejeitar' | 'duvida') => async () => ({ veredito, nota: 50, motivo: 'x', temas: [] });

  it('aprova o que o TCDF marcou com relevância Média ou maior', async () => {
    for (const r of ['Média', 'Alta', 'Altíssima']) expect((await statusTcdf(r, kw('auto_rejected'), null)).status).toBe('auto_approved');
  });

  it('relevância Baixa segue o classificador quando ele aprova ou deixa pendente', async () => {
    expect((await statusTcdf('Baixa', kw('auto_approved'), ia('rejeitar'))).status).toBe('auto_approved');
    expect((await statusTcdf('Baixa', kw('pending'), ia('aprovar'))).status).toBe('pending');
  });

  it('rejeição por palavra-chave vai para a IA em vez de sair rejeitada', async () => {
    expect((await statusTcdf('Baixa', kw('auto_rejected'), ia('aprovar'))).status).toBe('auto_approved');
    expect((await statusTcdf('Baixa', kw('auto_rejected'), ia('rejeitar'))).status).toBe('auto_rejected');
    expect((await statusTcdf('Baixa', kw('auto_rejected'), ia('duvida'))).status).toBe('pending');
  });

  it('sem IA disponível, rejeição por palavra-chave fica pendente', async () => {
    expect((await statusTcdf('Baixa', kw('auto_rejected'), null)).status).toBe('pending');
    expect((await statusTcdf('Baixa', kw('auto_rejected'), async () => null)).status).toBe('pending');
  });

  it('guarda o motivo da IA quando ela revê a rejeição', async () => {
    expect(await statusTcdf('Baixa', kw('auto_rejected'), ia('aprovar'))).toEqual({ status: 'auto_approved', motivoIA: 'x' });
  });

  it('rejeição que já veio da IA é mantida', async () => {
    expect((await statusTcdf('Baixa', kw('auto_rejected', 'IA: capa de edital'), ia('aprovar'))).status).toBe('auto_rejected');
  });
});

describe('TCDF: montarUrlBusca', () => {
  it('filtra no servidor as decisões publicadas do tema de licitações', () => {
    const u = new URL(montarUrlBusca({ ano: 2026, deslocamento: 100 }));
    expect(u.searchParams.get('filter[jurisprudencia_situacao]')).toBe('Publicada');
    expect(u.searchParams.get('filter[jurisprudencia_classificacao_tematica]')).toBe(TCDF_TEMA_LICITACOES);
    expect(u.searchParams.get('filter[ano]')).toBe('2026');
    expect(u.searchParams.get('from')).toBe('100');
  });

  it('sem ano, busca o acervo inteiro', () => {
    expect(new URL(montarUrlBusca({ deslocamento: 0 })).searchParams.has('filter[ano]')).toBe(false);
  });
});
