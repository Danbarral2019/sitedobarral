/**
 * Script: Verificar Cobertura de Artigos da Lei 14.133/2021
 *
 * Verifica se todos os artigos (1-194) estão classificados nos grupos temáticos
 */

import { LEI_14133_GRUPOS } from '../data/lei-14133-grupos';

// Lei 14.133 tem 194 artigos (1-194, incluindo 184-A)
const TOTAL_ARTIGOS = 194;

// Artigos especiais que devem ser considerados
const ARTIGOS_ESPECIAIS = ['184-A'];

// Coletar todos os artigos presentes nos grupos
const artigosNosGrupos = new Set<string>();

LEI_14133_GRUPOS.forEach(group => {
  group.articles.forEach(artigo => {
    artigosNosGrupos.add(artigo);
  });
});

console.log('📊 VERIFICAÇÃO DE COBERTURA - LEI 14.133/2021\n');
console.log(`Total de artigos na lei: ${TOTAL_ARTIGOS}`);
console.log(`Artigos únicos nos grupos: ${artigosNosGrupos.size}\n`);

// Verificar artigos numéricos (1-194)
const artigosFaltantes: string[] = [];

for (let i = 1; i <= TOTAL_ARTIGOS; i++) {
  const artigo = i.toString();
  if (!artigosNosGrupos.has(artigo)) {
    artigosFaltantes.push(artigo);
  }
}

// Verificar artigos especiais
ARTIGOS_ESPECIAIS.forEach(artigo => {
  if (!artigosNosGrupos.has(artigo)) {
    artigosFaltantes.push(artigo);
  }
});

// Resultados
if (artigosFaltantes.length === 0) {
  console.log('✅ COBERTURA COMPLETA!');
  console.log('Todos os artigos da Lei 14.133/2021 estão classificados nos grupos temáticos.\n');
} else {
  console.log('⚠️  ARTIGOS FALTANTES:\n');
  console.log(`Total de artigos sem classificação: ${artigosFaltantes.length}`);
  console.log(`Artigos: ${artigosFaltantes.join(', ')}\n`);
}

// Verificar artigos duplicados (artigo presente em mais de um grupo)
const artigosDuplicados = new Map<string, string[]>();

LEI_14133_GRUPOS.forEach(group => {
  group.articles.forEach(artigo => {
    if (!artigosDuplicados.has(artigo)) {
      artigosDuplicados.set(artigo, []);
    }
    artigosDuplicados.get(artigo)!.push(group.id);
  });
});

const duplicados = Array.from(artigosDuplicados.entries())
  .filter(([_, grupos]) => grupos.length > 1);

if (duplicados.length > 0) {
  console.log('⚠️  ARTIGOS DUPLICADOS (presentes em múltiplos grupos):\n');
  duplicados.forEach(([artigo, grupos]) => {
    console.log(`  Artigo ${artigo}: ${grupos.join(', ')}`);
  });
  console.log();
} else {
  console.log('✅ SEM DUPLICAÇÕES!');
  console.log('Nenhum artigo está presente em múltiplos grupos.\n');
}

// Estatísticas por grupo
console.log('📋 DISTRIBUIÇÃO POR GRUPO:\n');
LEI_14133_GRUPOS.forEach((group, index) => {
  const count = group.articles.length;
  const percent = ((count / TOTAL_ARTIGOS) * 100).toFixed(1);
  console.log(`${String(index + 1).padStart(2)}. ${group.title.padEnd(55)} ${String(count).padStart(3)} artigos (${String(percent).padStart(5)}%)`);
});

console.log('\n' + '='.repeat(80));
console.log(`TOTAL: ${artigosNosGrupos.size} artigos classificados de ${TOTAL_ARTIGOS} na lei`);
console.log('='.repeat(80));
