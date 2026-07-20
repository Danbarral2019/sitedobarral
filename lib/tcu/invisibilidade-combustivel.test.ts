import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CATEGORIA_GRAFO } from './backfill-retroativo';

/**
 * Guarda de regressão. Estas cinco superfícies consultam Document sem
 * filtrar por category nem por isPublic, então a invisibilidade do
 * combustível depende de uma exclusão EXPLÍCITA em cada uma. Se alguém
 * remover a exclusão, este teste quebra antes de 10 mil registros vazarem
 * para um export, um contador ou o e-mail dos assinantes.
 */
const ARQUIVOS = [
  'lib/obsidian/incremental-export.ts',
  'app/api/admin/analytics/summary/route.ts',
  'lib/cached-queries.ts',
  'app/api/search/unified/route.ts',
  'app/api/area-restrita/search-all/route.ts',
];

describe('invisibilidade do combustivel do grafo', () => {
  it.each(ARQUIVOS)('%s exclui a categoria do grafo', (arquivo) => {
    expect(readFileSync(arquivo, 'utf8')).toContain(CATEGORIA_GRAFO);
  });
});
