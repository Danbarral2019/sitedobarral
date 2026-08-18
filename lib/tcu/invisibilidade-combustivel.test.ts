import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CATEGORIA_GRAFO } from './backfill-retroativo';

/**
 * Guarda de regressão da invisibilidade do combustível do grafo.
 *
 * Contexto. O backfill retroativo cria ~13 mil Documents (`acordao-grafo`)
 * que existem para ser ALVO de citação no grafo de precedentes do TCU. São
 * `isPublic: false` e sem curadoria.
 *
 * Por que cada superfície exclui, e por que os motivos NÃO são o mesmo:
 *
 *  • As duas rotas de busca **não filtram `isPublic` em nenhum ramo** — nem no
 *    de administrador, nem no de aluno. Ali a exclusão da categoria é o ÚNICO
 *    controle de acesso, e afrouxá-la vaza documento não-público para aluno.
 *    Esta é a razão forte, e não admite exceção por destino.
 *
 *  • No admin de analytics e nas queries cacheadas o motivo é de contagem: 13
 *    mil registros invisíveis inflariam números que o professor lê como
 *    "documentos do acervo".
 *
 *  • No export incremental o motivo era de LEGIBILIDADE do cofre do Obsidian,
 *    e não de acesso. Por isso, desde 08/2026, esse filtro é POR DESTINO: o
 *    cofre mantém o default e continua sem eles; o export do ELIC liga
 *    `incluirCombustivelDoGrafo`, porque o destino de lá é um índice de RAG,
 *    que busca em vez de navegar.
 *
 * A versão anterior deste teste só checava se a string aparecia no arquivo —
 * passaria mesmo com o filtro invertido. Agora cada superfície é verificada
 * pelo que ela de fato faz.
 */

const ler = (p: string) => readFileSync(p, 'utf8');

/** Superfícies em que a exclusão é incondicional. */
const INCONDICIONAIS = [
  'app/api/admin/analytics/summary/route.ts',
  'lib/cached-queries.ts',
  'app/api/search/unified/route.ts',
  'app/api/area-restrita/search-all/route.ts',
];

describe('invisibilidade do combustível do grafo', () => {
  it.each(INCONDICIONAIS)('%s exclui a categoria do grafo, sem condicional', (arquivo) => {
    const src = ler(arquivo);
    // Verifica o MECANISMO, não a menção: a exclusão tem de aparecer na forma
    // de cláusula Prisma. Só procurar pela constante deixaria passar um
    // arquivo que a importa e não a usa — foi assim que a versão anterior
    // deste teste conseguia ficar verde com o filtro invertido.
    expect(src).toMatch(/not:\s*CATEGORIA_GRAFO/);
    // E não pode estar atrás de uma opção: nestas superfícies a exclusão é
    // controle de acesso (as rotas de busca não filtram isPublic no WHERE) ou
    // higiene de contagem. Uma flag aqui seria porta destrancada.
    expect(src).not.toMatch(/incluirCombustivelDoGrafo/);
  });

  it('o export incremental filtra POR DESTINO, com default seguro', () => {
    const src = ler('lib/obsidian/incremental-export.ts');
    expect(src).toContain('incluirCombustivelDoGrafo');
    // O default tem que ser exclusão: quem não pedir explicitamente não recebe.
    expect(src).toMatch(/incluirCombustivelDoGrafo\s*\?\s*\{\}\s*:\s*\{\s*category:\s*\{\s*not:\s*CATEGORIA_GRAFO/);
    // E a opção é opcional, para que todo chamador existente siga protegido.
    expect(src).toMatch(/incluirCombustivelDoGrafo\?:\s*boolean/);
  });

  it('o cofre do Obsidian NÃO liga a opção', () => {
    expect(ler('scripts/sync-obsidian.ts')).not.toMatch(/incluirCombustivelDoGrafo/);
  });

  it('o export do ELIC liga a opção de propósito', () => {
    expect(ler('scripts/export-elic.ts')).toMatch(/incluirCombustivelDoGrafo:\s*true/);
  });
});
