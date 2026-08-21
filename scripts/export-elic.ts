/**
 * Exporta a base de conhecimento do site para a pasta do projeto ELIC, que a
 * usa como acervo de RAG.
 *
 * Reusa `runIncrementalExport` — o mesmo motor que escreve o cofre do Obsidian,
 * com os mesmos filtros. Duas diferenças deliberadas:
 *
 * 1. Só exporta. O caminho de volta (Obsidian → banco) existe para as lições do
 *    LMS e fica restrito ao cofre; a pasta do ELIC é acervo de leitura, e uma
 *    edição acidental lá não pode virar escrita no banco de produção.
 * 2. Escreve um README na raiz, que serve tanto para o operador quanto para o
 *    próprio RAG, que vai indexá-lo como qualquer outro arquivo.
 *
 * O estado de sincronização é por destino (ver `sync-state.ts`), então rodar
 * isto não interfere no incremental do cofre do Obsidian.
 *
 * Uso:
 *   npm run export:elic -- --dry-run
 *   npm run export:elic
 *   npm run export:elic -- --full
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';

import { runIncrementalExport } from '../lib/obsidian/incremental-export';

export const VAULT_ELIC =
  'C:/Users/User/OneDrive - AGU/Elic - uniformização/20-Referencia - Base do Site do Barral';

function readme(stats: { documents: number; acts: number; decisions: number }, quando: string): string {
  return `# Base de conhecimento — Site do Prof. Daniel Barral

Acervo exportado automaticamente do banco do \`sitedobarral\` para servir de
fonte ao RAG deste projeto. **Não editar à mão:** o conteúdo é sobrescrito a
cada exportação, e não há caminho de volta para o banco.

## Última exportação

- **Quando:** ${quando}
- **Documentos:** ${stats.documents}
- **Atos legislativos:** ${stats.acts}
- **Jurisprudência:** ${stats.decisions}

## O que está aqui

Pareceres, Orientações Normativas da AGU, súmulas, notas técnicas, manuais e
acórdãos do TCU, informativos, atos normativos, jurisprudência do TCU, dos
tribunais de contas estaduais, do TST, do STF e do STJ, e os artigos da Lei
14.133/2021 com os comentários do professor. Os arquivos são Markdown com
frontmatter e wikilinks no estilo Obsidian — os wikilinks são inertes fora de um
cofre, mas preservam a relação entre as peças para quem lê.

Inclui também os ~13 mil acórdãos do TCU ingeridos como combustível do grafo de
precedentes (\`category: 'acordao-grafo'\`), que **não** aparecem no cofre do
Obsidian do professor nem nas superfícies de busca do sítio. Aqui eles entram de
propósito: este destino é índice de RAG, e a recuperação busca em vez de ler
sequencialmente, então o argumento do "dossiê ilegível" não se transfere. São
milhares de acórdãos com sumário real que não existem em nenhum outro ponto do
acervo. Sem curadoria editorial — tratar como fonte bruta.

## O que NÃO está aqui

Material proprietário do professor que não seja norma ou julgado público: as
aulas do LMS, os quizzes e as anotações internas de curadoria.

## Como atualizar

No repositório \`sitedobarral\`:

\`\`\`bash
npm run export:elic -- --dry-run   # confere o que mudaria
npm run export:elic                # escreve (incremental)
npm run export:elic -- --full      # reescreve tudo
\`\`\`

O modo padrão é incremental: só grava o que mudou desde a última exportação.
Depois de qualquer mudança no **escopo** do que é exportado — ligar uma
categoria nova, afrouxar um filtro — é preciso um \`--full\`, porque o
incremental não conhece o passivo que passou a ser elegível e nunca foi escrito.
`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const full = process.argv.includes('--full');
  const projectRoot = resolve('.');

  console.log('=== Export da base do site → pasta do ELIC ===\n');
  console.log(`  destino: ${VAULT_ELIC}`);
  if (dryRun) console.log('  [DRY RUN] Nenhuma escrita em disco.\n');

  const inicio = Date.now();
  const stats = await runIncrementalExport({
    projectRoot,
    outputDir: VAULT_ELIC,
    full,
    dryRun,
    // O destino aqui e um indice de RAG, nao um cofre para navegar: os
    // acordaos do grafo entram. O cofre do Obsidian mantem o default e
    // continua sem eles.
    incluirCombustivelDoGrafo: true,
  });

  console.log(`\n  Documentos      : ${stats.documents}`);
  console.log(`  Atos            : ${stats.acts}`);
  console.log(`  Jurisprudência  : ${stats.decisions}`);
  console.log(`  Arquivos escritos: ${stats.filesWritten}`);
  console.log(`  Tempo           : ${((Date.now() - inicio) / 1000).toFixed(1)}s`);

  if (!dryRun) {
    await mkdir(VAULT_ELIC, { recursive: true });
    await writeFile(
      join(VAULT_ELIC, 'README.md'),
      readme(stats, new Date().toISOString().slice(0, 10)),
      'utf-8'
    );
    console.log('  README.md escrito na raiz do destino.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
