/**
 * Migra o `fullIdentifier` dos acórdãos do STJ do número de registro para o
 * `id` do espelho.
 *
 * Por quê: `numeroRegistro` identifica o PROCESSO, e um processo rende vários
 * acórdãos (REsp, depois AgInt, depois EDcl) com o mesmo número. O upsert
 * chaveado por registro descartava 1,9% do acervo — medido em 1.458 espelhos
 * da Segunda Turma: 1.430 registros distintos para 1.458 acórdãos.
 *
 * Esta migração NÃO apaga nem cria registro nenhum: apenas reescreve a chave
 * dos que já existem, casando pela ementa. O que não casar fica intacto, e o
 * backfill seguinte cria o que faltar.
 *
 *   npx tsx --env-file=.env.local scripts/migrar-identificador-stj.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/migrar-identificador-stj.ts
 */
import { prisma } from '@/lib/prisma';
import { DATASETS_STJ } from '@/lib/stj/constantes';
import { listarDumps } from '@/lib/stj/catalogo';
import { baixar } from '@/lib/stj/consulta';
import type { EspelhoBruto } from '@/lib/stj/types';

const SOURCE_API = 'stj-espelhos-dados-abertos';

function normalizarTexto(t: string | null | undefined): string {
  return (t ?? '').replace(/[​‌‍﻿]/g, '').replace(/\s+/g, ' ').trim();
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const existentes = await prisma.tribunalDecision.findMany({
    where: { tribunalCode: 'STJ', sourceApi: SOURCE_API },
    select: { id: true, fullIdentifier: true, ementa: true },
  });
  console.log(`registros do STJ no banco: ${existentes.length}`);

  // indexa por ementa normalizada — é o que identifica o acórdão sem ambiguidade
  const porEmenta = new Map<string, { id: string; fullIdentifier: string }>();
  for (const r of existentes) {
    porEmenta.set(normalizarTexto(r.ementa), { id: r.id, fullIdentifier: r.fullIdentifier });
  }

  let vistos = 0;
  let migrados = 0;
  let jaCertos = 0;
  const erros: string[] = [];
  const usados = new Set<string>();

  for (const { slug } of DATASETS_STJ) {
    let dumps;
    try {
      dumps = await listarDumps(slug);
    } catch (e) {
      erros.push(`catalogo ${slug}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    for (const dump of dumps) {
      let espelhos: EspelhoBruto[];
      try {
        const corpo = await baixar(dump.url, `https://dadosabertos.web.stj.jus.br/dataset/${slug}`);
        espelhos = JSON.parse(corpo.replace(/^﻿/, '')) as EspelhoBruto[];
      } catch (e) {
        erros.push(`${slug}/${dump.nome}: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }

      for (const esp of espelhos) {
        const idEspelho = normalizarTexto(esp.id);
        const ementa = normalizarTexto(esp.ementa);
        if (!idEspelho || !ementa) continue;

        const alvo = porEmenta.get(ementa);
        if (!alvo || usados.has(alvo.id)) continue;

        vistos++;
        const novo = `stj-acordao-${idEspelho}`;
        if (alvo.fullIdentifier === novo) {
          jaCertos++;
          usados.add(alvo.id);
          continue;
        }

        if (!dryRun) {
          try {
            await prisma.tribunalDecision.update({
              where: { id: alvo.id },
              data: { fullIdentifier: novo, sourceId: idEspelho },
            });
          } catch (e) {
            erros.push(`update ${alvo.fullIdentifier} -> ${novo}: ${e instanceof Error ? e.message : String(e)}`);
            continue;
          }
        }
        migrados++;
        usados.add(alvo.id);
      }
      console.log(`  ${slug} ${dump.nome}: casados ${vistos}, migrados ${migrados}`);
    }
  }

  console.log(`\n=== ${dryRun ? 'DRY RUN — nada foi escrito' : 'migração concluída'}`);
  console.log(`  registros casados por ementa : ${vistos}`);
  console.log(`  identificador reescrito      : ${migrados}`);
  console.log(`  já estavam corretos          : ${jaCertos}`);
  console.log(`  não casados (ficam intactos) : ${existentes.length - vistos}`);
  console.log(`  erros                        : ${erros.length}`);
  for (const e of erros.slice(0, 5)) console.log(`    ! ${e}`);

  const depois = await prisma.tribunalDecision.count({
    where: { tribunalCode: 'STJ', sourceApi: SOURCE_API },
  });
  console.log(`\n  total no banco depois: ${depois} (era ${existentes.length}) — nenhum registro criado ou apagado`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
