import { describe, it, expect } from 'vitest';
import { matchExisting, buildExternalUrl, type ConuniItem } from './conuni-sync';

function makeItem(over: Partial<ConuniItem>): ConuniItem {
  return {
    manifestacao: 'DESPACHO Nº 00292/2026/CONJUR-CGU/CGU/AGU',
    origem_manifestacao: 1,
    link_manifestacao: '3201126977',
    tipo_de_manifestacao: 1,
    assunto: 'Atualização das minutas',
    ementa: '',
    natureza: '',
    ano: 2026,
    numero: 292,
    id: 1846,
    orgao: 'CNMLC',
    vigencia: 1,
    manifestacoes_relacionadas: '',
    manifestacao_revogadora: '',
    efeito_modificacao: '',
    aprovacao: '',
    anexos: null,
    ...over,
  };
}

const existingDoc = (over: Partial<{ id: string; title: string; url: string; aiClassification: string | null }>) => ({
  id: 'doc-1',
  title: 'DESPACHO Nº 00292/2026/CONJUR-CGU/CGU/AGU — Atualização das minutas',
  category: 'despacho',
  content: 'x',
  url: 'https://sapiens.agu.gov.br/valida_publico?id=3201126977',
  aiClassification: null,
  ...over,
});

describe('matchExisting', () => {
  it('casa por URL específica mesmo quando a heurística de título falha (orgao API ≠ título)', () => {
    // Regressão real: item.orgao='CNMLC' (API) mas título tem 'CONJUR' →
    // heurística de órgão falhava e o cron recriava o doc a cada mês.
    const item = makeItem({ orgao: 'CNMLC' });
    const cand = existingDoc({});
    // Sanidade: URLs iguais
    expect(buildExternalUrl(item)).toBe(cand.url);
    const match = matchExisting(item, [cand]);
    expect(match?.id).toBe('doc-1');
  });

  it('não casa por URL genérica de fallback (link vazio)', () => {
    // Dois itens sem link → URL genérica compartilhada; não devem casar por URL.
    const item = makeItem({ link_manifestacao: '', orgao: 'CNMLC', numero: 999, ano: 2099 });
    expect(buildExternalUrl(item)).toBe('https://cgu.agu.gov.br/conuni/');
    const cand = existingDoc({ url: 'https://cgu.agu.gov.br/conuni/', title: 'OUTRO DOC SEM RELAÇÃO' });
    expect(matchExisting(item, [cand])).toBeNull();
  });

  it('casa por conuniId mesmo quando URL e heurística de título falham', () => {
    const item = makeItem({ id: 1846, orgao: 'CNMLC', link_manifestacao: 'DIFERENTE' });
    const cand = existingDoc({
      title: 'TÍTULO SEM CORRELAÇÃO DE ORGAO/NUMERO',
      url: 'https://sapiens.agu.gov.br/valida_publico?id=OUTRO',
      // conuniId persistido igual ao item.id
      aiClassification: JSON.stringify({ conuniId: 1846 }),
    });
    expect(matchExisting(item, [cand])?.id).toBe('doc-1');
  });

  it('ainda casa pela heurística de título quando URL/conuniId não batem mas número/ano/órgão sim', () => {
    const item = makeItem({ orgao: 'CPASP', numero: 1, ano: 2019, link_manifestacao: 'DIFERENTE' });
    const cand = existingDoc({
      title: 'PARECER N. 00001/2019/CPASP/CGU/AGU — CRITÉRIOS NORMATIVOS',
      url: 'https://sapiens.agu.gov.br/valida_publico?id=OUTRO',
    });
    const match = matchExisting(item, [cand]);
    expect(match?.id).toBe('doc-1');
  });

  it('retorna null quando não há candidatos', () => {
    expect(matchExisting(makeItem({}), [])).toBeNull();
  });
});
