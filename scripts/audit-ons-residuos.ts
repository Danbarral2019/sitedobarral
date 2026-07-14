import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { prisma } from '../lib/prisma';

// Auditoria dos "resíduos" da T2b (ONs da AGU):
//   1) ONs públicas com content vazio/curto (sem texto integral)
//   2) ONs públicas sem link do DOU (douUrl)
// Dedupe por onNumber/onYear (a mesma ON pode estar replicada por curso).

type Agg = {
  onNumber: number | null;
  onYear: number | null;
  isPublic: boolean;
  bestContentLen: number;
  hasDouUrl: boolean;
  hasDouData: boolean;
  types: Set<string>;
  count: number;
};

async function main() {
  const docs = await prisma.document.findMany({
    where: { category: 'orientacao-normativa' },
    select: {
      onNumber: true, onYear: true, isPublic: true, type: true,
      content: true, douUrl: true, douData: true,
    },
  });

  const byKey = new Map<string, Agg>();
  for (const d of docs) {
    const key = `${d.onNumber ?? '?'}/${d.onYear ?? '?'}`;
    const len = (d.content ?? '').trim().length;
    let a = byKey.get(key);
    if (!a) {
      a = { onNumber: d.onNumber, onYear: d.onYear, isPublic: false, bestContentLen: 0,
            hasDouUrl: false, hasDouData: false, types: new Set(), count: 0 };
      byKey.set(key, a);
    }
    a.count++;
    a.types.add(d.type);
    if (d.isPublic) a.isPublic = true;
    if (len > a.bestContentLen) a.bestContentLen = len;
    if (d.douUrl && d.douUrl.trim()) a.hasDouUrl = true;
    if (d.douData) a.hasDouData = true;
  }

  const all = Array.from(byKey.values());
  const publics = all.filter((a) => a.isPublic);
  const sortY = (a: Agg, b: Agg) => (a.onYear ?? 0) - (b.onYear ?? 0) || (a.onNumber ?? 0) - (b.onNumber ?? 0);

  console.log(`Registros 'orientacao-normativa': ${docs.length}`);
  console.log(`ONs distintas: ${all.length}  |  públicas: ${publics.length}\n`);

  const CONTENT_MIN = 50; // mesmo piso do pipeline de embeddings
  const semContent = publics.filter((a) => a.bestContentLen < CONTENT_MIN).sort(sortY);
  const semDou = publics.filter((a) => !a.hasDouUrl).sort(sortY);

  console.log(`── (1) ONs públicas SEM texto integral (content < ${CONTENT_MIN} chars): ${semContent.length}`);
  for (const a of semContent) console.log(`   ON ${a.onNumber}/${a.onYear}  content=${a.bestContentLen}  douUrl=${a.hasDouUrl ? 'sim' : 'NÃO'}  [${[...a.types].join(',')}]`);

  console.log(`\n── (2) ONs públicas SEM link do DOU (douUrl vazio): ${semDou.length}`);
  for (const a of semDou) console.log(`   ON ${a.onNumber}/${a.onYear}  content=${a.bestContentLen}  douData=${a.hasDouData ? 'sim' : 'não'}  [${[...a.types].join(',')}]`);

  // Foco: as 4 ONs antigas da CNU mantidas na triagem de 11/07
  const foco = [[1, 2016], [2, 2016], [4, 2016], [6, 2017]];
  console.log(`\n── ONs antigas da CNU mantidas (foco do "polimento"):`);
  for (const [n, y] of foco) {
    const a = byKey.get(`${n}/${y}`);
    if (!a) { console.log(`   ON ${n}/${y}  → NÃO ENCONTRADA no banco`); continue; }
    console.log(`   ON ${n}/${y}  pública=${a.isPublic}  content=${a.bestContentLen}  douUrl=${a.hasDouUrl ? 'sim' : 'NÃO'}  douData=${a.hasDouData ? 'sim' : 'não'}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
