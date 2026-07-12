/**
 * Audita atos marcados como revoked=true procurando FALSOS POSITIVOS de
 * revogação parcial (o ato foi apenas ALTERADO, não revogado totalmente).
 *
 * Contexto: o detector de revogação (audit-revogados-planalto.ts) lê o cabeçalho
 * do Planalto e pode marcar como revogado um ato cujo cabeçalho traz notas de
 * "(Revogado pelo Decreto X)" referentes a DISPOSITIVOS específicos — não ao ato
 * inteiro. Caso confirmado: Decreto 11.890/2024 (margem de preferência), apenas
 * alterado pelo 12.218/2024 e ainda alterado em 2025 pelo 12.771.
 *
 * Sinais de FALSO POSITIVO (ato na verdade vigente):
 *   (A) o ato "revogador" (extraído do revokedNote) tem ementa que começa com "Altera";
 *   (B) o texto (content) do ato revogado contém "Redação dada pel<o/a> <revogador>"
 *       ou "Incluído pel<o/a> <revogador>" — prova de que o revogador só alterou.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/audit-revogados-falsos-positivos.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/audit-revogados-falsos-positivos.ts --apply
 *     (--apply corrige para revoked=false APENAS os classificados como falso positivo claro)
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes('--apply');

// "Revogado pelo Decreto nº 12.218, de 2024" → { tipo, numero }
function parseRevoker(note: string | null): { tipo: string; numero: string } | null {
  if (!note) return null;
  const m = note.match(
    /Revogad[oa]\s+pel[oa]\s+(Decreto|Lei|Medida\s+Provis[óo]ria|Portaria|Instru[çc][ãa]o\s+Normativa|Resolu[çc][ãa]o)[^\d]*([\d.]+)/i,
  );
  if (!m) return null;
  return { tipo: m[1].replace(/\s+/g, ' ').trim(), numero: m[2].replace(/\.$/, '') };
}

function contentAlteradoPor(content: string | null, numero: string): boolean {
  if (!content) return false;
  const esc = numero.replace(/[.]/g, '\\.');
  const re = new RegExp(`(Reda[çc][ãa]o dada|Inclu[íi]d[oa]|Vig[êe]ncia)\\s+pel[oa][^\\d]*${esc}`, 'i');
  return re.test(content);
}

async function main() {
  const revoked = await prisma.legislativeAct.findMany({
    where: { revoked: true },
    select: { id: true, type: true, number: true, year: true, fullNumber: true, ementa: true, revokedNote: true, content: true },
    orderBy: [{ year: 'desc' }],
  });

  const falsos: typeof revoked = [];
  const corretos: typeof revoked = [];
  const ambiguos: typeof revoked = [];

  console.log(`\n=== AUDITORIA DE ${revoked.length} ATOS revoked=true ===\n`);

  for (const a of revoked) {
    const rev = parseRevoker(a.revokedNote);
    let ementaRevogador: string | null = null;
    let revogadorAltera = false;
    if (rev) {
      const revogador = await prisma.legislativeAct.findFirst({
        where: { number: rev.numero },
        select: { ementa: true },
      });
      ementaRevogador = revogador?.ementa ?? null;
      revogadorAltera = /^\s*altera\b/i.test(ementaRevogador ?? '');
    }
    const alteradoNoTexto = rev ? contentAlteradoPor(a.content, rev.numero) : false;

    const sinais: string[] = [];
    if (revogadorAltera) sinais.push(`revogador (${rev?.tipo} ${rev?.numero}) tem ementa "Altera…"`);
    if (alteradoNoTexto) sinais.push(`texto contém "Redação dada/Incluído pelo ${rev?.numero}"`);

    let veredito: 'FALSO+' | 'correto' | 'ambíguo';
    if (revogadorAltera || alteradoNoTexto) veredito = 'FALSO+';
    else if (rev) veredito = 'correto';
    else veredito = 'ambíguo';

    (veredito === 'FALSO+' ? falsos : veredito === 'correto' ? corretos : ambiguos).push(a);

    const tag = veredito === 'FALSO+' ? '🔴 FALSO POSITIVO' : veredito === 'correto' ? '✓ revogação ok' : '❓ ambíguo';
    console.log(`${tag}  ${a.fullNumber}`);
    console.log(`    nota: ${(a.revokedNote ?? '—').slice(0, 80)}`);
    if (sinais.length) console.log(`    sinais: ${sinais.join(' · ')}`);
    if (veredito === 'correto' && ementaRevogador) console.log(`    revogador: "${ementaRevogador.slice(0, 70)}…"`);
    console.log('');
  }

  console.log(`\n=== RESUMO ===`);
  console.log(`  🔴 falsos positivos (vigentes, esconder é bug): ${falsos.length}`);
  falsos.forEach((a) => console.log(`       - ${a.fullNumber}`));
  console.log(`  ❓ ambíguos (verificar manualmente no Planalto): ${ambiguos.length}`);
  ambiguos.forEach((a) => console.log(`       - ${a.fullNumber}`));
  console.log(`  ✓  revogação total plausível: ${corretos.length}`);

  if (APPLY && falsos.length) {
    console.log(`\n=== APLICANDO correção (revoked=false) em ${falsos.length} falsos positivos ===`);
    for (const a of falsos) {
      await prisma.legislativeAct.update({
        where: { id: a.id },
        data: { revoked: false, revokedNote: null },
      });
      console.log(`  ✓ ${a.fullNumber} → revoked=false`);
    }
    console.log(`\n⚠️  Reindexar não é necessário (chunks já existem); busca volta a incluí-los imediatamente.`);
  } else if (falsos.length) {
    console.log(`\n[DRY-RUN] Rode com --apply para corrigir os ${falsos.length} falsos positivos.`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
