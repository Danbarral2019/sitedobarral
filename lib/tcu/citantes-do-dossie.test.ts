// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DossieUso, TrechoCitacao } from './trechos-de-citacao';

const { mockDocs } = vi.hoisted(() => ({ mockDocs: vi.fn() }));
vi.mock('../prisma', () => ({ prisma: { document: { findMany: (...a: unknown[]) => mockDocs(...a) } } }));

import { citantesDoDossie, citanteDoTrecho } from './citantes-do-dossie';

const trecho = (over: Partial<TrechoCitacao>): TrechoCitacao => ({
  origemChave: '100/2020', secao: 'voto', noVoto: true, trecho: 't', offset: 0, ...over,
});

const dossie = (trechos: TrechoCitacao[]): DossieUso => ({
  alvo: { numero: 1441, ano: 2016 },
  contagem: { citantesDistintos: trechos.length, noVoto: trechos.length, ocorrenciasTotal: trechos.length },
  trechos,
});

const doc = (id: string, orgao: string) => ({
  id, acordaoNumero: 100, acordaoAno: 2020, tcuOrgaoJulgador: orgao,
  url: `https://u/${id}`, tcuLinkPDF: `https://p/${id}`,
});

describe('citantesDoDossie', () => {
  beforeEach(() => vi.clearAllMocks());

  it('consulta por id quando o trecho traz origemDocumentId', async () => {
    mockDocs.mockResolvedValue([doc('doc-a', 'Plenário')]);
    await citantesDoDossie(dossie([trecho({ origemDocumentId: 'doc-a' })]));
    expect(mockDocs.mock.calls[0][0].where.OR).toEqual([{ id: { in: ['doc-a'] } }]);
  });

  it('consulta pelo par número/ano só para os trechos sem id', async () => {
    mockDocs.mockResolvedValue([]);
    await citantesDoDossie(dossie([
      trecho({ origemChave: '100/2020', origemDocumentId: 'doc-a' }),
      trecho({ origemChave: '200/2021' }),
    ]));
    expect(mockDocs.mock.calls[0][0].where.OR).toEqual([
      { id: { in: ['doc-a'] } },
      { acordaoNumero: 200, acordaoAno: 2021 },
    ]);
  });

  it('não consulta o banco quando não há chave parseável nem id', async () => {
    const r = await citantesDoDossie(dossie([trecho({ origemChave: 'cuid-sem-numero' })]));
    expect(mockDocs).not.toHaveBeenCalled();
    expect(r.porId.size).toBe(0);
    expect(r.porChave.size).toBe(0);
  });

  it('o índice de contingência é determinístico: com dois no mesmo par, fica com o primeiro', async () => {
    // A ordem vem do `orderBy: { id: "asc" }` da consulta. Um `new Map` sobre o
    // findMany ficava com o ÚLTIMO — e o último de uma consulta sem orderBy é
    // indefinido, que é o defeito não-determinístico do C1.
    mockDocs.mockResolvedValue([doc('doc-a', 'Plenário'), doc('doc-b', 'Primeira Câmara')]);
    const r = await citantesDoDossie(dossie([trecho({ origemChave: '100/2020' })]));
    expect(mockDocs.mock.calls[0][0].orderBy).toEqual({ id: 'asc' });
    expect(r.porChave.get('100/2020')?.id).toBe('doc-a');
    expect(r.porId.size).toBe(2);
  });
});

describe('citanteDoTrecho', () => {
  const lookup = {
    porId: new Map([['doc-a', doc('doc-a', 'Plenário')], ['doc-b', doc('doc-b', 'Primeira Câmara')]]),
    porChave: new Map([['100/2020', doc('doc-a', 'Plenário')]]),
  };

  it('prefere o id ao par número/ano — a chave é ambígua por construção', () => {
    // Os dois Document dividem 100/2020; só o id separa o Plenário da Câmara.
    expect(citanteDoTrecho(lookup, { origemChave: '100/2020', origemDocumentId: 'doc-b' })?.id).toBe('doc-b');
  });

  it('cai na chave quando o trecho não traz id', () => {
    expect(citanteDoTrecho(lookup, { origemChave: '100/2020' })?.id).toBe('doc-a');
  });

  it('devolve null quando o id não está no índice — não cai na chave', () => {
    // Cair na chave aqui seria devolver um acórdão que sabidamente NÃO é o
    // citante: o trecho declarou um id, e esse id não foi encontrado.
    expect(citanteDoTrecho(lookup, { origemChave: '100/2020', origemDocumentId: 'sumido' })).toBeNull();
  });

  it('devolve null quando nem id nem chave resolvem', () => {
    expect(citanteDoTrecho(lookup, { origemChave: '999/1999' })).toBeNull();
  });
});
