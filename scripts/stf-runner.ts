/**
 * Coleta semanal da jurisprudência do STF.
 *
 * O host jurisprudencia.stf.jus.br fica atrás de um AWS WAF que responde
 * HTTP 202 + `x-amzn-waf-action: challenge` a qualquer cliente que não execute
 * o desafio JavaScript. Verificado em 16/08/2026: nem headers completos de
 * navegador nem reuso de sessão passam. Por isso a consulta é feita DENTRO de
 * um Chromium real, via page.evaluate, e só o resultado viaja para a rota de
 * ingestão do site.
 *
 * Uso local:
 *   STF_INGEST_URL=http://localhost:3000/api/ingest/stf \
 *   CRON_SECRET=... npx tsx scripts/stf-runner.ts
 */

import { chromium } from 'playwright';
import { montarCorpoConsulta } from '@/lib/stf/consulta';

const PAGINA_BUSCA = 'https://jurisprudencia.stf.jus.br/pages/search';
const CAMINHO_API = '/api/search/search';
const DIAS_JANELA = 30;

function dataLimite(dias: number): string {
  const d = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const ingestUrl = process.env.STF_INGEST_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!ingestUrl || !cronSecret) {
    console.error('STF_INGEST_URL e CRON_SECRET são obrigatórios.');
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

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const documentos: unknown[] = [];
  let erroColeta: unknown = null;

  try {
    await page.goto(PAGINA_BUSCA, { waitUntil: 'networkidle', timeout: 120_000 });

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

  const json = await res.json();
  console.log(`ingestão respondeu ${res.status}:`, JSON.stringify(json));

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
