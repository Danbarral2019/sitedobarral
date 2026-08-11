/**
 * Classifica cada leading case destilado num bloco temático, para que a folha de
 * calibração possa ser julgada por matéria — quem julga uma tese de licitação
 * está num contexto mental diferente de quem julga uma de aposentadoria, e
 * misturar as duas na mesma folha custa acurácia do JULGADOR, não do motor.
 *
 * A classificação NÃO vive no banco (nenhuma coluna nova): sai num JSON
 * versionado no repo, chaveado por "numero/ano". Se virar produto — filtro por
 * matéria na tela pública — aí sim vira coluna em `TeseDestilacao`.
 *
 * Uso:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/classificar-temas-teses-tcu.ts
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/classificar-temas-teses-tcu.ts --force
 *
 * Sem `--force`, só classifica o que ainda não está no JSON (o cron destila
 * casos novos todo dia; reclassificar o acervo inteiro a cada rodada é gasto
 * sem ganho).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { prisma } from '../lib/prisma';
import { generate } from '../lib/ai';

const OUT_PADRAO = 'docs/audits/temas-teses-tcu.json';
const LOTE = 20;

/** Blocos do controle externo, na divisão que o acervo do TCU realmente tem. */
export const TEMAS = {
  'licitacoes-contratos': 'Licitações e contratos administrativos',
  'obras-engenharia': 'Obras públicas e engenharia (BDI, sobrepreço, projeto, medição)',
  pessoal: 'Pessoal (admissão, aposentadoria, pensão, acumulação, vantagens)',
  responsabilizacao: 'Responsabilização, débito, multa e prescrição',
  'processo-controle': 'Processo de controle externo e competência do TCU',
  'convenios-transferencias': 'Convênios, transferências voluntárias e prestação de contas',
  'financas-orcamento': 'Finanças públicas, orçamento e renúncia de receita',
  'concessoes-estatais': 'Concessões, PPP, desestatização e estatais',
  outros: 'Outros',
} as const;
export type Tema = keyof typeof TEMAS;

export interface TemaAtribuido {
  chave: string;
  tema: Tema;
  subtema: string;
  fronteirico: boolean;
}

const SYSTEM = `Você classifica precedentes do TCU por matéria, para organizar uma folha de revisão.

BLOCOS (use exatamente estas chaves):
${Object.entries(TEMAS)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}

Regras de fronteira (as que mais confundem):
- Sobrepreço, superfaturamento, BDI, administração local, projeto básico, medição de obra
  => "obras-engenharia" (não "licitacoes-contratos"), mesmo que o caso trate de contrato.
- Regra de licitação/contrato aplicada a obra, mas sem tecnicalidade de engenharia
  (habilitação, modalidade, aditivo, reequilíbrio, sanção a licitante) => "licitacoes-contratos".
- Erro grosseiro (art. 28 LINDB), culpa grave, débito, multa, inidoneidade, prescrição
  => "responsabilizacao", ainda que o fato de origem seja uma licitação.
- Competência do TCU, recurso, cautelar, contraditório, revelia, coisa julgada
  => "processo-controle", ainda que o fato de origem seja uma licitação.
- Ato de admissão/aposentadoria/pensão, acumulação de cargos, parcela remuneratória,
  concurso público => "pessoal".

Escolha o bloco pelo que a TESE fixa, não pelo cenário de fundo do caso.

"subtema": rótulo curto (2 a 5 palavras) do assunto específico, em minúsculas.
"fronteirico": true quando o caso caberia de forma defensável em outro bloco.

Responda APENAS com JSON: {"itens":[{"chave":"N/AAAA","tema":"<chave>","subtema":"...","fronteirico":bool}]}`;

function flag(nome: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nome}=`))?.split('=')[1];
}

function extrairJson(text: string): string {
  const s = text.replace(/```(?:json)?/gi, '').trim();
  const i = s.indexOf('{');
  const f = s.lastIndexOf('}');
  if (i < 0 || f <= i) throw new Error('resposta sem JSON reconhecível');
  return s.slice(i, f + 1);
}

async function classificarLote(
  casos: Array<{ chave: string; assunto: string; enunciados: string[] }>
): Promise<TemaAtribuido[]> {
  const userContent = casos
    .map((c) =>
      [
        `### Acórdão ${c.chave}`,
        `ASSUNTO: ${c.assunto || '(vazio)'}`,
        c.enunciados.length ? `TESE: ${c.enunciados[0].slice(0, 600)}` : 'TESE: (o motor não fixou tese)',
      ].join('\n')
    )
    .join('\n\n');

  const { text } = await generate('enhancement', {
    systemPrompt: SYSTEM,
    messages: [{ role: 'user', content: userContent }],
    jsonMode: true,
    maxTokens: 4096,
  });
  if (!text) throw new Error('classificarLote: resposta vazia');

  const raw = JSON.parse(extrairJson(text)) as { itens?: TemaAtribuido[] };
  const validos = (raw.itens ?? []).filter((i) => i && typeof i.chave === 'string' && i.tema in TEMAS);
  // O lote inteiro é inútil se o modelo devolver menos itens do que entrou: o
  // pareamento é por chave, e um caso omitido some sem aviso.
  const vistos = new Set(validos.map((i) => i.chave));
  const faltando = casos.filter((c) => !vistos.has(c.chave)).map((c) => c.chave);
  if (faltando.length) console.warn(`  ⚠️ sem classificação neste lote: ${faltando.join(', ')}`);
  return validos;
}

async function main() {
  const out = flag('out') ?? OUT_PADRAO;
  const force = process.argv.includes('--force');

  const destilacoes = await prisma.teseDestilacao.findMany({
    where: { atual: true },
    select: {
      chave: true,
      assunto: true,
      enunciados: { select: { enunciado: true }, orderBy: { ordem: 'asc' } },
    },
  });

  const anterior: Record<string, TemaAtribuido> =
    !force && existsSync(out) ? JSON.parse(readFileSync(out, 'utf-8')) : {};

  const pendentes = destilacoes
    .filter((d) => force || !anterior[d.chave])
    .map((d) => ({ chave: d.chave, assunto: d.assunto, enunciados: d.enunciados.map((e) => e.enunciado) }));

  console.log(`destilações atuais: ${destilacoes.length}  ·  a classificar: ${pendentes.length}`);
  if (!pendentes.length) {
    console.log('nada a fazer.');
    return;
  }

  const mapa: Record<string, TemaAtribuido> = { ...anterior };
  for (let i = 0; i < pendentes.length; i += LOTE) {
    const lote = pendentes.slice(i, i + LOTE);
    console.log(`lote ${i / LOTE + 1} (${lote.length} casos)…`);
    for (const item of await classificarLote(lote)) mapa[item.chave] = item;
  }

  mkdirSync(dirname(out), { recursive: true });
  // Ordenado por chave: o JSON é versionado, e diff estável é o que permite ver
  // uma reclassificação como mudança, não como reescrita do arquivo inteiro.
  const ordenado = Object.fromEntries(Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(out, JSON.stringify(ordenado, null, 1) + '\n');

  const porTema = new Map<string, number>();
  for (const v of Object.values(ordenado)) porTema.set(v.tema, (porTema.get(v.tema) ?? 0) + 1);
  console.log(`\nclassificados: ${Object.keys(ordenado).length}`);
  for (const [t, n] of [...porTema.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${t}  — ${TEMAS[t as Tema]}`);
  }
  const fronteiricos = Object.values(ordenado).filter((v) => v.fronteirico).length;
  console.log(`fronteiriços (caberiam em outro bloco): ${fronteiricos}`);
  console.log(`OK — ${out}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
