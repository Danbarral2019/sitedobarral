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
import { montarCorpoConsulta, type OpcoesConsultaStf } from '@/lib/stf/consulta';

const PAGINA_BUSCA = 'https://jurisprudencia.stf.jus.br/pages/search';
const CAMINHO_API = '/api/search/search';
// A janela filtra por DATA DE JULGAMENTO, e o acórdão do STF é publicado
// 30-35 dias depois do julgamento. Com coleta mensal, a janela precisa cobrir
// o intervalo entre coletas + o atraso de publicação, senão o julgado de um
// mês nunca é pego: ainda não saiu na coleta seguinte e já saiu da janela na
// outra. Com 30 dias, isso acontecia sistematicamente. A sobreposição é
// inofensiva: a ingestão ignora o que já existe (lib/stf/persistir.ts).
const DIAS_JANELA = Number(process.env.STF_DIAS_JANELA) || 90;
/** Resultados por página da API do STF. */
const TAMANHO_PAGINA = 200;
/** Teto de páginas por consulta — trava contra laço infinito. */
const MAX_PAGINAS = 10;
/**
 * Documentos por POST de ingestão. Cada julgado NOVO passa por classificação
 * e resumo no Gemini dentro da rota (maxDuration 300 s); lote grande estoura.
 */
const LOTE_INGESTAO = 40;
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
  console.log(`janela: julgados desde ${desde} (${DIAS_JANELA} dias)`);
  const consultas: OpcoesConsultaStf[] = [
    { termo: '"Lei 14.133"', base: 'acordaos', dataInicio: desde },
    { termo: '"Lei 14.133"', base: 'decisoes', dataInicio: desde },
    { termo: 'licitação OR licitações OR licitatório OR licitatória', base: 'acordaos', dataInicio: desde },
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

    for (const consulta of consultas) {
      for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
        const corpo = montarCorpoConsulta({
          ...consulta,
          tamanho: TAMANHO_PAGINA,
          desloc: pagina * TAMANHO_PAGINA,
        });
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

        console.log(`consulta ${consulta.base} "${consulta.termo}" pág. ${pagina + 1}: ${lote.length} documentos`);
        documentos.push(...lote);
        if (lote.length < TAMANHO_PAGINA) break;
        if (pagina === MAX_PAGINAS - 1) {
          console.warn('⚠️ teto de páginas atingido — pode haver documentos não coletados');
        }
      }
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

  // Lotes pequenos para cada POST caber no maxDuration da rota. Sem nada
  // coletado, ainda se envia um lote vazio para a rota responder 422.
  const lotes: unknown[][] = [];
  for (let i = 0; i < documentos.length; i += LOTE_INGESTAO) {
    lotes.push(documentos.slice(i, i + LOTE_INGESTAO));
  }
  if (lotes.length === 0) lotes.push([]);

  let algumaFalha = false;
  for (const [i, lote] of lotes.entries()) {
    const res = await fetch(ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ documentos: lote }),
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
    console.log(`lote ${i + 1}/${lotes.length}: ingestão respondeu ${res.status}: ${resumo}`);
    if (!res.ok) algumaFalha = true;
  }

  // A rota devolve 422 para lote vazio de propósito — o job precisa ficar
  // vermelho nesse caso, não verde e mudo. O POST acontece sempre
  // (mesmo com lote vazio ou parcial por erro de coleta), então o 422
  // passa a significar de fato "a coleta não produziu documentos".
  if (erroColeta || algumaFalha) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
