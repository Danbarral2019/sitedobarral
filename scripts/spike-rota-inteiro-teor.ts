/**
 * Spike do portão 3 (spec §3.3): existe rota para obter o RTF de um acórdão
 * histórico arbitrário? Testa duas rotas candidatas e grava o achado.
 * Descartável — some na Task 3.
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const BUSCA_URL = 'https://pesquisa.apps.tcu.gov.br/api/publico/entidades/busca';
const UA = 'Mozilla/5.0 (compatible; SiteDoBarral/1.0)';
const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function buscaCrua(termo: string): Promise<Record<string, unknown>> {
  const r = await fetch(BUSCA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', Accept: 'application/json', 'User-Agent': UA },
    body: termo,
  });
  if (!r.ok) throw new Error(`busca ${r.status} ${r.statusText}`);
  return (await r.json()) as Record<string, unknown>;
}

async function main() {
  const achados: Record<string, unknown> = {};

  // ROTA 1 — o payload da busca traz campo de arquivo/RTF?
  const bruto = await buscaCrua('2219/2023');
  const ents = (bruto.entidades ?? []) as Record<string, unknown>[];
  achados.chavesDoEnvelope = Object.keys(bruto);
  achados.totalEntidades = ents.length;
  achados.chavesDaEntidade = ents[0] ? Object.keys(ents[0]) : [];
  achados.primeiraEntidade = ents[0] ?? null;
  achados.rota1_temCampoArquivo = ents[0]
    ? Object.keys(ents[0]).some((k) => /arquivo|rtf|pdf|download|url/i.test(k))
    : false;
  await dorme(1000);

  // ROTA 2 — a página do documento expõe a URL do RTF?
  const link = (ents[0]?.link as string) ?? '';
  const pagina = link.startsWith('http') ? link : `https://pesquisa.apps.tcu.gov.br${link}`;
  const html = await fetch(pagina, { headers: { 'User-Agent': UA } }).then((r) => r.text());
  const urls = [...html.matchAll(/https?:\/\/[^"'\s<>]*(?:Rtf|Sisdoc)[^"'\s<>]*/gi)].map((m) => m[0]);
  achados.rota2_paginaTestada = pagina;
  achados.rota2_urlsCandidatas = [...new Set(urls)].slice(0, 5);
  achados.rota2_htmlEhSpa = html.length < 5000 || /<div id="root"|__NEXT_DATA__/.test(html);
  await dorme(1000);

  // PORTÃO 1 — paginação: os parâmetros óbvios mudam o resultado?
  const p2 = await fetch(`${BUSCA_URL}?inicio=10&quantidade=10`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', Accept: 'application/json', 'User-Agent': UA },
    body: '2219/2023',
  }).then((r) => (r.ok ? r.json() : null));
  achados.portao1_paginacaoTestada = 'inicio/quantidade na querystring';
  achados.portao1_totalComOffset = p2 ? ((p2.entidades ?? []) as unknown[]).length : null;
  achados.portao1_primeiroTituloBase = (ents[0]?.titulo as string) ?? null;
  achados.portao1_primeiroTituloOffset = p2 ? (((p2.entidades ?? []) as Record<string, unknown>[])[0]?.titulo ?? null) : null;

  mkdirSync('docs/audits', { recursive: true });
  writeFileSync('docs/audits/2026-07-20-portoes-colheita.json', JSON.stringify(achados, null, 2));
  console.log(JSON.stringify(achados, null, 2));
}

main().catch((e) => {
  console.error('spike falhou:', e);
  process.exit(1);
});
