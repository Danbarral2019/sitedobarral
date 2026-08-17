/**
 * Coleta mensal da jurisprudência do STF — rodada MANUALMENTE, na máquina do
 * Daniel. Não roda em CI. Veja o porquê abaixo.
 *
 * O host jurisprudencia.stf.jus.br fica atrás de um AWS WAF. Medições de
 * 16-17/08/2026, todas na mesma máquina e no mesmo minuto:
 *
 *   requisição server-side (curl/fetch)  → 202, corpo vazio, x-amzn-waf-action: challenge
 *   Chromium HEADLESS                    → 403
 *   Chromium HEADED (janela visível)     → 200 ✅
 *
 * Ou seja: o bloqueio não é de IP nem é o desafio JavaScript em si — é
 * DETECÇÃO DE HEADLESS. Por isso `headless: false` abaixo não é preferência,
 * é requisito de funcionamento, e por isso este script não roda no GitHub
 * Actions (ver o cabeçalho de .github/workflows/stf-jurisprudencia.yml).
 *
 * Uso:
 *   npm run stf:coletar
 *
 * Abre uma janela de Chromium por ~30s e posta o resultado em
 * POST /api/ingest/stf (produção, por padrão — ver `ingestUrl` abaixo).
 */

import { chromium } from 'playwright';
import { montarCorpoConsulta } from '@/lib/stf/consulta';

const PAGINA_BUSCA = 'https://jurisprudencia.stf.jus.br/pages/search';
const CAMINHO_API = '/api/search/search';
const DIAS_JANELA = 30;
/** Tempo para o desafio JS do WAF resolver antes da primeira consulta. */
const ESPERA_DESAFIO_MS = 12_000;

function dataLimite(dias: number): string {
  const d = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function main() {
  // STF_INGEST_URL explícito vence; senão deriva da base do site. A guarda
  // continua valendo: sem uma URL de destino OU sem o segredo, aborta antes
  // de abrir o navegador.
  const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  const ingestUrl = process.env.STF_INGEST_URL || (base ? `${base}/api/ingest/stf` : null);
  const cronSecret = process.env.CRON_SECRET;

  if (!ingestUrl) {
    console.error('Defina STF_INGEST_URL, ou NEXT_PUBLIC_BASE_URL para derivá-la.');
    process.exit(1);
  }
  if (!cronSecret) {
    console.error('CRON_SECRET é obrigatório (o mesmo valor configurado na Vercel).');
    process.exit(1);
  }

  const desde = dataLimite(DIAS_JANELA);
  const consultas = [
    montarCorpoConsulta({ termo: '"Lei 14.133"', base: 'acordaos', dataInicio: desde }),
    montarCorpoConsulta({ termo: '"Lei 14.133"', base: 'decisoes', dataInicio: desde }),
    montarCorpoConsulta({
      termo: 'licitação OR licitações OR licitatório OR licitatória',
      base: 'acordaos',
      dataInicio: desde,
    }),
  ];

  // headless: false é REQUISITO, não preferência — headless recebe 403. Ver
  // o cabeçalho deste arquivo para as medições.
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const documentos: unknown[] = [];
  let erroColeta: unknown = null;

  try {
    // 'networkidle' NUNCA resolve aqui: o portal é um SPA que mantém conexões
    // abertas, e a espera estourava 120s sem nunca chegar à consulta. Espera-se
    // o DOM e então dá-se tempo explícito para o desafio do WAF resolver.
    await page.goto(PAGINA_BUSCA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(ESPERA_DESAFIO_MS);

    for (const corpo of consultas) {
      const lote = await page.evaluate(
        async ([caminho, body]) => {
          const r = await fetch(caminho as string, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (r.status !== 200) {
            throw new Error(`STF respondeu ${r.status} (waf=${r.headers.get('x-amzn-waf-action')})`);
          }
          const json = await r.json();
          return (json?.result?.hits?.hits || []).map((h: { _source: unknown }) => h._source);
        },
        [CAMINHO_API, corpo] as const
      );

      console.log(`consulta devolveu ${lote.length} documentos`);
      documentos.push(...lote);
    }
  } catch (err) {
    // Não deixar a falha de coleta (ex.: WAF barrou o desafio) abortar a
    // função antes do POST — senão o guard de "lote vazio = falha" da rota
    // de ingestão nunca dispara justamente no caso em que ele deveria.
    erroColeta = err;
  } finally {
    await browser.close();
  }

  if (erroColeta) {
    console.error('Falha na coleta:', erroColeta);
  }

  console.log(`total coletado: ${documentos.length}`);

  const res = await fetch(ingestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cronSecret}`,
    },
    body: JSON.stringify({ documentos }),
  });

  // A resposta nem sempre é JSON (deploy fora do ar devolve HTML de 404, por
  // exemplo). Ler como texto e só então tentar parsear evita trocar uma
  // mensagem clara por um stack trace de JSON.parse.
  const corpoResposta = await res.text();
  let resumo: string;
  try {
    resumo = JSON.stringify(JSON.parse(corpoResposta));
  } catch {
    resumo = `resposta não-JSON (${corpoResposta.slice(0, 120).replace(/\s+/g, ' ')}...)`;
  }
  console.log(`ingestão respondeu ${res.status}: ${resumo}`);

  // A rota devolve 422 para lote vazio de propósito — o job precisa ficar
  // vermelho nesse caso, não verde e mudo. O POST agora acontece sempre
  // (mesmo com lote vazio ou parcial por erro de coleta), então o 422
  // passa a significar de fato "a coleta não produziu documentos".
  if (erroColeta || !res.ok) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
