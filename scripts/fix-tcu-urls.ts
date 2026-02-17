/**
 * Script para migrar URLs de acórdãos do TCU para o novo formato.
 *
 * O TCU mudou sua plataforma de pesquisa e o formato antigo baseado em hash:
 *   pesquisa.apps.tcu.gov.br/#/documento/acordao-completo/.../NUMACORDAO%253A...
 * não funciona mais (redireciona para página geral).
 *
 * Novo formato:
 *   https://pesquisa.apps.tcu.gov.br/doc/acordao-completo/{numero}/{ano}/{colegiado}
 *
 * Uso:
 *   npx tsx scripts/fix-tcu-urls.ts            # Executa a migração
 *   npx tsx scripts/fix-tcu-urls.ts --dry-run   # Simula sem alterar
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

/** Mapeia código de colegiado para nome completo usado na URL do TCU */
function mapearColegiado(colegiado: string | null): string {
  if (!colegiado) return 'Plenário';
  const c = colegiado.trim();
  if (/1[ªa]\s*c/i.test(c) || /primeira/i.test(c)) return 'Primeira Câmara';
  if (/2[ªa]\s*c/i.test(c) || /segunda/i.test(c)) return 'Segunda Câmara';
  return 'Plenário';
}

/** Constrói a nova URL do TCU */
function construirNovaUrl(numero: number, ano: number, colegiado: string | null): string {
  const col = mapearColegiado(colegiado);
  return `https://pesquisa.apps.tcu.gov.br/doc/acordao-completo/${numero}/${ano}/${encodeURIComponent(col)}`;
}

/** Tenta extrair número e ano da URL antiga */
function extrairDaUrlAntiga(url: string): { numero: number; ano: number } | null {
  // Formato: ...NUMACORDAO%253A{numero}%2520ANOACORDAO%253A{ano}
  const match = url.match(/NUMACORDAO%253A(\d+)%2520ANOACORDAO%253A(\d+)/);
  if (match) {
    return { numero: parseInt(match[1], 10), ano: parseInt(match[2], 10) };
  }
  // Formato sem double-encoding
  const match2 = url.match(/NUMACORDAO%3A(\d+)%20ANOACORDAO%3A(\d+)/);
  if (match2) {
    return { numero: parseInt(match2[1], 10), ano: parseInt(match2[2], 10) };
  }
  return null;
}

async function main() {
  console.log(`\n=== Migração de URLs do TCU ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  // Buscar todos os acórdãos com URL antiga
  const acordaos = await prisma.document.findMany({
    where: {
      category: 'acordao',
      url: { contains: 'pesquisa.apps.tcu.gov.br' },
    },
    select: {
      id: true,
      url: true,
      acordaoNumero: true,
      acordaoAno: true,
      tcuOrgaoJulgador: true,
      title: true,
      metaTcu: {
        select: {
          orgaoJulgador: true,
        },
      },
    },
  });

  console.log(`Total de acórdãos encontrados: ${acordaos.length}`);

  // Filtrar apenas os que têm URL no formato antigo (hash-based)
  const comUrlAntiga = acordaos.filter(a => a.url && a.url.includes('#/documento'));
  const jaNoFormatoNovo = acordaos.filter(a => a.url && a.url.includes('/doc/acordao-completo/'));
  const semUrl = acordaos.filter(a => !a.url);

  console.log(`  - Com URL antiga (hash): ${comUrlAntiga.length}`);
  console.log(`  - Já no formato novo: ${jaNoFormatoNovo.length}`);
  console.log(`  - Sem URL: ${semUrl.length}`);
  console.log('');

  let atualizados = 0;
  let erros = 0;
  let semDados = 0;

  for (const doc of comUrlAntiga) {
    // Priorizar campos do banco (acordaoNumero, acordaoAno)
    let numero = doc.acordaoNumero;
    let ano = doc.acordaoAno;

    // Fallback: extrair da URL antiga
    if (!numero || !ano) {
      const extraido = doc.url ? extrairDaUrlAntiga(doc.url) : null;
      if (extraido) {
        numero = extraido.numero;
        ano = extraido.ano;
      }
    }

    if (!numero || !ano) {
      console.log(`  [SKIP] ${doc.title} — sem número/ano`);
      semDados++;
      continue;
    }

    const novaUrl = construirNovaUrl(numero, ano, doc.metaTcu?.orgaoJulgador || doc.tcuOrgaoJulgador);

    if (DRY_RUN) {
      console.log(`  [DRY] ${doc.title}`);
      console.log(`         ${doc.url}`);
      console.log(`       → ${novaUrl}`);
    } else {
      try {
        await prisma.document.update({
          where: { id: doc.id },
          data: { url: novaUrl },
        });
        atualizados++;
      } catch (err) {
        console.error(`  [ERRO] ${doc.title}: ${err}`);
        erros++;
      }
    }
  }

  // Também corrigir acórdãos sem URL mas com número/ano
  for (const doc of semUrl) {
    if (!doc.acordaoNumero || !doc.acordaoAno) {
      semDados++;
      continue;
    }

    const novaUrl = construirNovaUrl(doc.acordaoNumero, doc.acordaoAno, doc.tcuOrgaoJulgador);

    if (DRY_RUN) {
      console.log(`  [DRY/SEM_URL] ${doc.title} → ${novaUrl}`);
    } else {
      try {
        await prisma.document.update({
          where: { id: doc.id },
          data: { url: novaUrl },
        });
        atualizados++;
      } catch (err) {
        console.error(`  [ERRO] ${doc.title}: ${err}`);
        erros++;
      }
    }
  }

  console.log(`\n=== Resultado ===`);
  if (DRY_RUN) {
    console.log(`Simulação concluída. Nenhum registro alterado.`);
    console.log(`Total que seriam atualizados: ${comUrlAntiga.length + semUrl.length - semDados}`);
  } else {
    console.log(`Atualizados: ${atualizados}`);
  }
  console.log(`Sem dados suficientes: ${semDados}`);
  console.log(`Erros: ${erros}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  prisma.$disconnect();
  process.exit(1);
});
