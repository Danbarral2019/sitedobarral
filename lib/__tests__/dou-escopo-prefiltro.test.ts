/**
 * Testes para lib/dou-escopo-prefiltro.ts
 *
 * Exemplos reais da triagem de 26/09/2026 (eval/dou-triagem-2026-09.json).
 */

import { describe, it, expect } from 'vitest';
import { motivoForaDeEscopo } from '../dou-escopo-prefiltro';
import gabarito from '../../eval/dou-triagem-2026-09.json';

const DEFESA_CIVIL =
  'Ministério da Integração e do Desenvolvimento Regional/Secretaria Nacional de Proteção e Defesa Civil';

describe('motivoForaDeEscopo', () => {
  it('descarta ato da Defesa Civil', () => {
    expect(
      motivoForaDeEscopo({ title: 'PORTARIA Nº 2.546, DE 6 DE AGOSTO DE 2026', abstract: 'Reconhece situação de emergência', hierarchyStr: DEFESA_CIVIL }),
    ).toBe('defesa-civil');
  });

  it('descarta crédito suplementar e limites de empenho', () => {
    expect(motivoForaDeEscopo({ title: 'PORTARIA GM/MPO Nº 196, DE 25 DE MAIO DE 2026', abstract: 'Abre aos Orçamentos Fiscal e da Seguridade Social crédito suplementar' })).toBe('orcamento');
    expect(motivoForaDeEscopo({ title: 'PORTARIA GM/MPO Nº 398', abstract: 'Altera os limites de movimentação e empenho' })).toBe('orcamento');
  });

  it('descarta solução de consulta e ato COTEPE', () => {
    expect(motivoForaDeEscopo({ title: 'SOLUÇÃO DE CONSULTA Nº 170, DE 2 DE SETEMBRO DE 2026' })).toBe('tributario');
    expect(motivoForaDeEscopo({ title: 'ATO COTEPE/ICMS Nº 96, DE 14 DE SETEMBRO DE 2026' })).toBe('tributario');
  });

  it('mantém instrução normativa da Receita para a IA avaliar', () => {
    expect(
      motivoForaDeEscopo({ title: 'INSTRUÇÃO NORMATIVA RFB Nº 2.341, DE 31 DE AGOSTO DE 2026', hierarchyStr: 'Ministério da Fazenda/Secretaria Especial da Receita Federal do Brasil' }),
    ).toBeNull();
  });

  it('descarta decisão pontual de agência sobre concessão', () => {
    expect(motivoForaDeEscopo({ title: 'DECISÃO SUROD Nº 1.093, DE 17 DE AGOSTO DE 2026' })).toBe('concessao-especifica');
    expect(motivoForaDeEscopo({ title: 'Deliberação ANTT Nº 271, DE 4 DE SETEMBRO DE 2026' })).toBe('concessao-especifica');
    expect(motivoForaDeEscopo({ title: 'ACÓRDÃO Nº 479/2026-ANTAQ' })).toBe('concessao-especifica');
  });

  it('descarta atos concretos pelo título', () => {
    expect(motivoForaDeEscopo({ title: 'RESULTADO DE HABILITAÇÃO' })).toBe('ato-concreto');
    expect(motivoForaDeEscopo({ title: 'CONTRATO DE TERMO ADITIVO' })).toBe('ato-concreto');
    expect(motivoForaDeEscopo({ title: 'DECISÃO Nº 9, DE 22 DE JUNHO DE 2026' })).toBe('ato-concreto');
  });

  it('descarta destinação de imóvel da União pela SPU', () => {
    expect(
      motivoForaDeEscopo({ title: 'Portaria SPU/MGI Nº 4.617', abstract: 'Autoriza a alienação de imóveis da União', hierarchyStr: 'Ministério da Gestão e da Inovação em Serviços Públicos/Secretaria do Patrimônio da União' }),
    ).toBe('patrimonio-imovel');
  });

  it('mantém norma geral de contratação', () => {
    expect(
      motivoForaDeEscopo({ title: 'DECRETO Nº 13.106, DE 24 DE AGOSTO DE 2026', abstract: 'art. 79, caput, inciso IV, da Lei nº 14.133, para dispor sobre o Sistema de Compras', hierarchyStr: 'Atos do Poder Executivo' }),
    ).toBeNull();
  });

  it('não descarta nenhum ato aprovado no gabarito', () => {
    const aprovados = gabarito.itens.filter((i) => i.veredito === 'aprovar');
    expect(aprovados.length).toBe(12);
    for (const ato of aprovados) expect(motivoForaDeEscopo(ato), ato.title).toBeNull();
  });
});
