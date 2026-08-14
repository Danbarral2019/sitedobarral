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
acórdãos do TCU, informativos, atos normativos e os artigos da Lei 14.133/2021
com os comentários do professor. Os arquivos são Markdown com frontmatter e
wikilinks no estilo Obsidian — os wikilinks são inertes fora de um cofre, mas
preservam a relação entre as peças para quem lê.

## O que NÃO está aqui

Os ~13 mil acórdãos do TCU ingeridos como combustível do grafo de precedentes
(\`category: 'acordao-grafo'\`). São invisíveis por construção, não têm curadoria
e transformariam este acervo num dossiê ilegível.

## Como atualizar

No repositório \`sitedobarral\`:

\`\`\`bash
npm run export:elic -- --dry-run   # confere o que mudaria
npm run export:elic                # escreve
\`\`\`
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
