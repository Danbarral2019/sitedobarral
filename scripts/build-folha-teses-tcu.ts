/**
 * Gera a folha de calibração a partir das teses JÁ PERSISTIDAS no banco
 * (`TeseDestilacao` com `atual: true`), para o Daniel julgar cada tese contra os
 * trechos-fonte literais que a sustentam.
 *
 * Diferença para `build-folha-teses.mjs`: aquele lê o JSON do probe de 3 casos
 * de 19/07/2026 e está congelado nele; este lê o acervo destilado corrente, que
 * é o que a onda A-W2 produz.
 *
 * Os índices de `trechosFonte` apontam para posições do dossiê que existia no
 * momento da destilação, e o dossiê NÃO é persistido — é recomposto aqui a
 * partir do grafo. Se ele mudou desde então (o grafo cresceu, um citante novo
 * entrou), os índices deixam de casar; o caso é então marcado
 * `trechosIndisponiveis` e a folha avisa em vez de exibir o trecho errado.
 * Julgar uma tese contra evidência trocada é pior que julgar sem evidência.
 *
 * Uso:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/build-folha-teses-tcu.ts
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/build-folha-teses-tcu.ts --min-no-voto=10 --out=/tmp/folha.html
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/build-folha-teses-tcu.ts --min-no-voto=5 --amostra=45 --seed=20260810
 *
 * `--amostra=N` gera uma folha de calibração amostral em vez do acervo inteiro:
 * sorteia N casos para medir a taxa de acerto do motor sem julgar tudo. O
 * sorteio é determinístico (`--seed`), então a mesma folha pode ser regerada.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { prisma } from '../lib/prisma';
import { coletarTrechosDoAlvo } from '../lib/tcu/trechos-de-citacao';
import { renderFolha, type CasoCard } from './lib/folha-teses-template.mjs';

const OUT_PADRAO = 'docs/audits/folha-teses-tcu.html';

function flag(nome: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nome}=`))?.split('=')[1];
}

/**
 * PRNG determinístico (mulberry32). `Math.random` serviria para sortear, mas
 * não para REGERAR a mesma amostra: o veredito do Daniel vale por caso julgado,
 * e uma folha que não pode ser reproduzida a partir da semente vira evidência
 * sem procedência.
 */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates com o PRNG semeado — embaralha uma cópia, não a lista de origem. */
function embaralhar<T>(itens: T[], rand: () => number): T[] {
  const out = itens.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function main() {
  const minNoVoto = Number(flag('min-no-voto') ?? 10);
  const amostra = flag('amostra') ? Number(flag('amostra')) : null;
  const seed = Number(flag('seed') ?? 20260810);
  const out = flag('out') ?? OUT_PADRAO;
  // Folha por matéria: julgar 68 teses de aposentadoria e licitação embaralhadas
  // cansa o julgador à toa. `--tema` recorta pela tabela `AcordaoTema`;
  // `--casos` restringe a chaves na mão; `--mais-casos` ACRESCENTA chaves ao
  // recorte temático (é assim que entram os fronteiriços — inidoneidade,
  // leniência — que a taxonomia manda para responsabilização mas que são
  // matéria de licitação para quem julga).
  const temas = flag('tema')?.split(',').map((t) => t.trim()).filter(Boolean) ?? null;
  const casosExplicitos = flag('casos')?.split(',').map((c) => c.trim()).filter(Boolean) ?? null;
  const maisCasos = flag('mais-casos')?.split(',').map((c) => c.trim()).filter(Boolean) ?? null;

  const destilacoes = await prisma.teseDestilacao.findMany({
    where: { atual: true },
    include: {
      enunciados: { orderBy: { ordem: 'asc' } },
      // Ordenado: a posição que o card exibe é a chave por onde o veredito
      // exportado volta para a linha certa em `importar-veredito-teses`.
      divergencias: { orderBy: { ordem: 'asc' } },
    },
  });
  console.log(`destilações atuais no banco: ${destilacoes.length}`);

  // Filtra ANTES de montar dossiê: `coletarTrechosDoAlvo` baixa o inteiro teor
  // de cada citante, e os casos fortes têm centenas deles.
  const contagens = await prisma.$queryRaw<Array<{ numero: number; ano: number; no_voto: number }>>`
    SELECT "numeroAlvo" AS numero, "anoAlvo" AS ano,
           count(DISTINCT "origemId") FILTER (WHERE "noVoto")::int AS no_voto
    FROM "AcordaoCitacao"
    GROUP BY 1, 2
    HAVING count(DISTINCT "origemId") FILTER (WHERE "noVoto") >= ${minNoVoto}`;
  const acimaDoLimiar = new Set(contagens.map((c) => `${c.numero}/${c.ano}`));
  let selecionadas = destilacoes.filter((d) => acimaDoLimiar.has(`${d.numeroAlvo}/${d.anoAlvo}`));
  console.log(`acima de ${minNoVoto} citações no voto: ${selecionadas.length}`);

  if (temas) {
    const classificados = await prisma.acordaoTema.findMany({
      where: { chave: { in: selecionadas.map((d) => d.chave) } },
      select: { chave: true, tema: true },
    });
    const temaPorChave = new Map(classificados.map((c) => [c.chave, c.tema]));
    const extras = new Set(maisCasos ?? []);

    // Caso destilado depois da última classificação não tem tema e ficaria fora
    // em silêncio — avisa, porque some da folha sem aparecer em lugar nenhum.
    const semTema = selecionadas.filter((d) => !temaPorChave.has(d.chave)).map((d) => d.chave);
    if (semTema.length) console.log(`⚠️ sem tema atribuído (fora do recorte): ${semTema.join(', ')}`);

    selecionadas = selecionadas.filter(
      (d) => temas.includes(temaPorChave.get(d.chave) ?? '') || extras.has(d.chave)
    );
    console.log(`no(s) tema(s) ${temas.join(', ')}${extras.size ? ` + ${extras.size} caso(s) avulso(s)` : ''}: ${selecionadas.length}`);

    if (maisCasos) {
      const presentes = new Set(selecionadas.map((d) => d.chave));
      const ausentes = maisCasos.filter((c) => !presentes.has(c));
      if (ausentes.length) console.log(`⚠️ --mais-casos sem destilação vigente acima do limiar: ${ausentes.join(', ')}`);
    }
  }
  if (casosExplicitos) {
    const achados = new Set(selecionadas.map((d) => d.chave));
    const ausentes = casosExplicitos.filter((c) => !achados.has(c));
    if (ausentes.length) console.log(`⚠️ --casos sem destilação vigente acima do limiar: ${ausentes.join(', ')}`);
    selecionadas = selecionadas.filter((d) => casosExplicitos.includes(d.chave));
    console.log(`após --casos: ${selecionadas.length}`);
  }

  // Na folha amostral, o universo do sorteio exclui as destilações em que o
  // motor se calou (`teses: []`): elas são um resultado a auditar em separado,
  // mas não têm enunciado para o julgador marcar fiel/imprecisa/errada — entrar
  // no sorteio só consumiria vaga da amostra.
  const universo = amostra ? selecionadas.filter((d) => d.enunciados.length > 0) : selecionadas;
  const ordemVisita = amostra ? embaralhar(universo, prng(seed)) : universo;
  if (amostra) {
    console.log(`universo do sorteio (com ao menos uma tese): ${universo.length}`);
    console.log(`sorteando ${amostra} · seed ${seed}`);
  }

  const cards: Array<CasoCard & { _ordem: number }> = [];
  let semTrechos = 0;
  let puladosSemTrechos = 0;

  for (const d of ordemVisita) {
    if (amostra !== null && cards.length >= amostra) break;
    const dossie = await coletarTrechosDoAlvo({ numero: d.numeroAlvo, ano: d.anoAlvo });

    // O dossiê recomposto só é intercambiável com o original se tiver o mesmo
    // tamanho — mesmo tamanho não prova mesma ordem, mas tamanho diferente
    // prova que os índices se deslocaram.
    const trechosConfiaveis = dossie.trechos.length === d.dossieTrechos;
    if (!trechosConfiaveis) semTrechos++;

    // Numa folha amostral o card sem trechos-fonte é inútil: o pedido é julgar a
    // tese CONTRA a prova literal, e sem ela não há julgamento — só opinião.
    // Pula e segue sorteando. Isso enviesa a amostra para casos de dossiê
    // estável, então o total pulado é reportado, não escondido.
    if (amostra !== null && !trechosConfiaveis) {
      puladosSemTrechos++;
      continue;
    }

    const resolve = (indices: unknown) =>
      (Array.isArray(indices) ? (indices as number[]) : [])
        .map((i) => dossie.trechos[i])
        .filter(Boolean)
        .map((t) => ({ trecho: t.trecho, origemChave: t.origemChave, noVoto: t.noVoto }));

    cards.push({
      _ordem: dossie.contagem.noVoto,
      chave: d.chave,
      assunto: d.assunto,
      confianca: d.confianca,
      contagem: {
        noVoto: dossie.contagem.noVoto,
        citantesDistintos: dossie.contagem.citantesDistintos,
        ocorrenciasTotal: dossie.contagem.ocorrenciasTotal,
      },
      teses: d.enunciados.map((e) => ({
        enunciado: e.enunciado,
        inovacao: e.inovacao,
        trechos: trechosConfiaveis ? resolve(e.trechosFonte) : [],
      })),
      sinais: (Array.isArray(d.sinais) ? d.sinais : []) as CasoCard['sinais'],
      divergencias: d.divergencias.map((v) => ({
        precedenteApontado: v.precedenteApontado,
        natureza: v.natureza,
        trecho: v.trecho,
        origemChave: v.origemChave,
      })),
      trechosIndisponiveis: !trechosConfiaveis,
    });
  }

  // O sinal mais forte de leading case primeiro: citações na razão de decidir.
  cards.sort((a, b) => b._ordem - a._ordem);

  // O inteiro teor de alguns acórdãos chega do TCU com bytes mal decodificados,
  // que sobrevivem como U+FFFD ("Exp<?>e" no lugar de "Expõe"). São poucos, mas
  // o publicador de artifacts rejeita a página inteira por causa deles. Trocar
  // por "?" preserva o resto da citação literal e deixa a lacuna visível — não
  // adivinhamos a letra que faltou dentro de um texto que é prova.
  const serializado = JSON.stringify(cards);
  const corrompidos = (serializado.match(/�/g) ?? []).length;
  const limpos = JSON.parse(serializado.replace(/�/g, '?')) as typeof cards;
  const semTese = cards.filter((c) => c.teses.length === 0).length;
  const enunciados = cards.reduce((s, c) => s + c.teses.length, 0);

  const rotuloTema = temas ? `${temas.join(' + ')} · ` : '';
  const eyebrow = amostra
    ? `Rede de precedentes · ${rotuloTema}amostra aleatória de ${cards.length} de ${universo.length} leading cases destilados (>=${minNoVoto} no voto) · seed ${seed}`
    : `Rede de precedentes · ${rotuloTema}${cards.length} leading cases (>=${minNoVoto} no voto)`;

  const notas = [
    amostra && puladosSemTrechos
      ? `${puladosSemTrechos} caso(s) sorteado(s) foram descartados por terem o dossiê alterado após a destilação (sem trechos-fonte confiáveis) e substituídos pelo próximo do sorteio.`
      : '',
    amostra
      ? `Amostra determinística: seed ${seed} sobre as ${universo.length} destilações vigentes com ao menos uma tese. Regerar com --amostra=${amostra} --seed=${seed} --min-no-voto=${minNoVoto} reproduz exatamente estes cards.`
      : '',
    !amostra && semTrechos
      ? `${semTrechos} caso(s) tiveram o dossiê alterado após a destilação e aparecem sem trechos-fonte.`
      : '',
  ].filter(Boolean);

  const html = renderFolha({
    cards: limpos.map(({ _ordem, ...c }) => c),
    geradoEm: new Date().toISOString().slice(0, 10),
    eyebrow,
    notaRodape: notas.join(' '),
  });

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);

  console.log(`\ncards: ${cards.length}  ·  enunciados: ${enunciados}  ·  sem tese: ${semTese}`);
  console.log(`sem trechos-fonte confiáveis: ${semTrechos}`);
  if (amostra !== null) {
    console.log(`sorteados e descartados por dossiê alterado: ${puladosSemTrechos}`);
    if (cards.length < amostra) {
      console.log(`⚠️ amostra INCOMPLETA: pedidos ${amostra}, obtidos ${cards.length} — o universo se esgotou.`);
    }
    console.log(`casos: ${cards.map((c) => c.chave).join(', ')}`);
  }
  console.log(`caracteres corrompidos no inteiro teor de origem, trocados por "?": ${corrompidos}`);
  console.log(`OK — ${out} (${(html.length / 1024).toFixed(0)} KB)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
