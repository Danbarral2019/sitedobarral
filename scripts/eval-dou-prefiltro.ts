/**
 * Mede o pré-filtro de escopo do DOU contra o gabarito julgado pelo editor.
 *
 * Critério de aceite: zero atos aprovados descartados.
 * Uso: npx tsx scripts/eval-dou-prefiltro.ts [--listar]
 */
import gabarito from '../eval/dou-triagem-2026-09.json';
import { motivoForaDeEscopo } from '../lib/dou-escopo-prefiltro';

const listar = process.argv.includes('--listar');
const itens = gabarito.itens;
const porMotivo: Record<string, number> = {};
const aprovadosAtingidos: string[] = [];
let rejeitadosPegos = 0;

for (const item of itens) {
  const motivo = motivoForaDeEscopo(item);
  if (!motivo) continue;
  if (item.veredito === 'aprovar') aprovadosAtingidos.push(`${motivo}: ${item.title}`);
  else {
    rejeitadosPegos++;
    porMotivo[motivo] = (porMotivo[motivo] || 0) + 1;
    if (listar) console.log(`  [${motivo}] ${item.title}`);
  }
}

const rejeitados = itens.filter((i) => i.veredito === 'rejeitar').length;
console.log(`Gabarito: ${itens.length} itens (${itens.length - rejeitados} aprovados, ${rejeitados} rejeitados)`);
console.log(`Rejeitados descartados pelo pré-filtro: ${rejeitadosPegos}/${rejeitados} (${((100 * rejeitadosPegos) / rejeitados).toFixed(1)}%)`);
for (const [m, n] of Object.entries(porMotivo).sort((a, b) => b[1] - a[1])) console.log(`  ${m}: ${n}`);
console.log(`Aprovados descartados (deve ser 0): ${aprovadosAtingidos.length}`);
aprovadosAtingidos.forEach((a) => console.log(`  ✗ ${a}`));
process.exit(aprovadosAtingidos.length > 0 ? 1 : 0);
