/**
 * classify-incp-44-54-gemini.ts
 *
 * Aciona o Gemini (gemini-3-flash-preview, fallback 2.5-flash) pra identificar
 * os artigos da Lei 14.133/2021 mais relacionados a cada um dos enunciados
 * INCP nº 44-54 (2ª Reunião Técnica), e atualiza o campo `leiArticles` no DB.
 *
 * Antes deste script, os 44-54 só tinham artigos detectados por regex
 * (53→art 23, 54→art 79; demais sem). Gemini classifica semanticamente.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/classify-incp-44-54-gemini.ts          # dry-run, mostra plano
 *   npx dotenv -e .env.local -- npx tsx scripts/classify-incp-44-54-gemini.ts --apply  # grava no DB
 */

import { prisma } from '../lib/prisma';
import { queryGeminiText } from '../lib/gemini/cached-client';

const NUMEROS_ALVO = [44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54];

function buildPrompt(numero: number, texto: string): string {
  return `Você é um especialista em Direito Administrativo brasileiro com foco na Lei 14.133/2021 (Nova Lei de Licitações).

TAREFA: Identifique os artigos da Lei 14.133/2021 mais diretamente relacionados ao tema do enunciado abaixo (INCP - Instituto Nacional de Contratações Públicas).

ENUNCIADO INCP nº ${numero}:
"""
${texto}
"""

ARTIGOS-CHAVE DA LEI 14.133/2021 (referência):
- Arts. 5-13: Princípios, definições, agentes públicos
- Arts. 18-26: Planejamento (ETP, TR, DFD, análise de riscos, PCA)
- Arts. 23-25: Pesquisa de preços, orçamento estimado, orçamento sigiloso
- Arts. 28-33: Modalidades de licitação (pregão, concorrência, etc.)
- Arts. 62-70: Habilitação (jurídica, técnica, fiscal, econômico-financeira)
- Arts. 72-79: Dispensa e inexigibilidade (contratação direta)
- Arts. 82-86: Sistema de Registro de Preços, ata de registro, cadastro reserva
- Arts. 89-104: Contratos administrativos (formalização, garantias, subcontratação)
- Arts. 105-114: Execução, fiscal, gestor, recebimento
- Arts. 115-123: Gestão e fiscalização, sanções por inadimplemento
- Arts. 124-136: Alterações contratuais (acréscimo, supressão, prorrogação, reajuste, repactuação, equilíbrio)
- Arts. 155-163: Sanções administrativas (advertência, multa, impedimento, inidoneidade)
- Arts. 165-169: Recursos administrativos
- Arts. 169-174: Controle das contratações, governança, alta administração
- Arts. 175-184: Disposições gerais, transitórias

INSTRUÇÕES:
1. Identifique de 1 a 5 artigos cujo conteúdo seja DIRETAMENTE relacionado ao tema do enunciado.
2. Se o enunciado tratar EXCLUSIVAMENTE de OUTRA lei (ex.: Lei 13.303/2016 - estatais) sem aplicar a 14.133, retorne array vazio.
3. Se o enunciado mencionar a 14.133 explicitamente (mesmo que também trate de outra norma), inclua os artigos relevantes.
4. Para temas amplos (governança, princípios), inclua artigos correspondentes da 14.133 mesmo se o enunciado não citar texto literal.

RESPONDA APENAS UM JSON, SEM TEXTO ADICIONAL, no formato:
{"artigos": [N1, N2, ...], "raciocinio": "explicação curta em 1-2 frases"}

Onde Nx são inteiros entre 1 e 194 (Lei 14.133 tem 194 artigos).`;
}

function parseResponse(raw: string): { artigos: number[]; raciocinio: string } {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed.artigos)) throw new Error('Campo "artigos" ausente ou não é array');
  const artigos = parsed.artigos
    .filter((n: unknown) => typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= 194)
    .slice(0, 10);
  const raciocinio = typeof parsed.raciocinio === 'string' ? parsed.raciocinio : '';
  return { artigos, raciocinio };
}

const TEXTO_OFICIAL: Record<number, string> = {
  44: 'A ausência de previsão no edital não impede a autorização excepcional da subcontratação em contratos regidos pela Lei 13.303/2016, no caso de fato superveniente, observado o dever de motivação.',
  45: 'O fiscal e o gestor do contrato devem adotar postura colaborativa e dialógica com o contratado, buscando prevenir conflitos, mediante reuniões periódicas e tratativas formais para solução de problemas.',
  46: 'A Lei 14.133/2021 não obriga a adoção de dispensa eletrônica.',
  47: 'Considerando que a Lei 13.303/2016 não estabelece critérios específicos para a dosimetria das sanções aplicáveis pelas estatais, admite-se que os regulamentos internos definam aspectos objetivos — tais como gravidade, risco ao negócio, impacto reputacional, reincidência e colaboração do fornecedor — para parametrizar a decisão sancionadora.',
  48: 'Os instrumentos hábeis a substituir o termo de contrato sujeitam-se às normas de contratos administrativos.',
  49: 'A verificação de informações e documentos pelo agente público diretamente nos sítios eletrônicos oficiais de órgãos e entidades, desde que atestado nos autos, constitui meio legal de prova para todos os fins.',
  50: 'A omissão no dever de implementar a governança das contratações poderá ensejar responsabilização aos membros da alta administração de órgãos e entidades da Administração Pública.',
  51: 'Caso não seja realizada, durante o certame, a análise da proposta e da habilitação dos fornecedores incluídos no cadastro reserva do sistema de registro de preços, caberá a interposição de recurso administrativo por ocasião do chamamento desses fornecedores.',
  52: 'A adoção do orçamento sigiloso não afasta o dever de indicar a data do orçamento estimado no instrumento convocatório, para fins de definição da data-base para o reajustamento em sentido estrito.',
  53: 'Nas pesquisas de preços para obras e serviços de engenharia, é admissível a cotação com potenciais fornecedores, como fonte de preço subsidiária, caso esgotados os parâmetros previstos no art. 23, § 2º, da Lei 14.133/2021.',
  54: 'A previsão de regulamento do Poder Executivo federal no inciso VII do § 1º do art. 79 da Lei 14.133/2021 não impede a edição de regulamento pelos demais entes federativos e demais órgãos independentes.',
};

async function main() {
  const apply = process.argv.includes('--apply');

  console.log('='.repeat(60));
  console.log(`CLASSIFY-INCP-44-54-GEMINI — ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log('='.repeat(60) + '\n');

  type Plan = {
    numero: number;
    dbId: string;
    title: string;
    artigosAtuais: string[];
    artigosNovos: number[];
    raciocinio: string;
    erro?: string;
  };

  const planos: Plan[] = [];

  for (const n of NUMEROS_ALVO) {
    const doc = await prisma.document.findFirst({
      where: { category: 'enunciados', entityType: 'INCP', enunciadoNumber: String(n) },
      select: { id: true, title: true, leiArticles: true, leiArticlesArr: true },
    });
    if (!doc) {
      console.log(`  ❌ nº ${n}: não encontrado no DB. Pulando.`);
      continue;
    }
    const atuais: string[] = doc.leiArticles ? JSON.parse(doc.leiArticles) : [];
    const texto = TEXTO_OFICIAL[n];

    process.stdout.write(`  🤖 nº ${n}... `);
    try {
      const result = await queryGeminiText(buildPrompt(n, texto), {
        temperature: 0.2,
        maxOutputTokens: 512,
        useCache: false,
        thinkingBudget: 0,
      });
      const { artigos, raciocinio } = parseResponse(result.response);
      console.log(`arts=[${artigos.join(',')}] (${result.latency}ms, ${result.tokens?.total ?? '?'} tk)`);
      planos.push({ numero: n, dbId: doc.id, title: doc.title, artigosAtuais: atuais, artigosNovos: artigos, raciocinio });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`ERRO: ${msg}`);
      planos.push({ numero: n, dbId: doc.id, title: doc.title, artigosAtuais: atuais, artigosNovos: [], raciocinio: '', erro: msg });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('PLANO DE ATUALIZAÇÃO');
  console.log('='.repeat(60));

  let mudancas = 0;
  for (const p of planos) {
    if (p.erro) {
      console.log(`\n  ❌ nº ${p.numero}: erro Gemini — ${p.erro}`);
      continue;
    }
    const atuaisStr = p.artigosAtuais.length ? p.artigosAtuais.join(',') : '∅';
    const novosStr = p.artigosNovos.length ? p.artigosNovos.join(',') : '∅';
    const igual = JSON.stringify(p.artigosAtuais.map(Number).sort((a,b)=>a-b)) === JSON.stringify([...p.artigosNovos].sort((a,b)=>a-b));
    const flag = igual ? '⏭️ igual' : '🔄 mudar';
    if (!igual) mudancas++;
    console.log(`\n  ${flag} nº ${p.numero}: [${atuaisStr}] → [${novosStr}]`);
    if (p.raciocinio) console.log(`    raciocínio: ${p.raciocinio}`);
  }

  console.log(`\nResumo: ${mudancas} a atualizar | ${planos.length - mudancas} sem mudança | ${planos.filter(p=>p.erro).length} erros\n`);

  if (!apply) {
    console.log('Para aplicar:');
    console.log('  npx dotenv -e .env.local -- npx tsx scripts/classify-incp-44-54-gemini.ts --apply');
    await prisma.$disconnect();
    return;
  }

  console.log('Aplicando...');
  let success = 0;
  let errors = 0;
  for (const p of planos) {
    if (p.erro) continue;
    const igual = JSON.stringify(p.artigosAtuais.map(Number).sort((a,b)=>a-b)) === JSON.stringify([...p.artigosNovos].sort((a,b)=>a-b));
    if (igual) continue;
    try {
      const novosOrdenados = [...p.artigosNovos].sort((a, b) => a - b).map(String);
      await prisma.document.update({
        where: { id: p.dbId },
        data: {
          leiArticles: novosOrdenados.length > 0 ? JSON.stringify(novosOrdenados) : null,
        },
      });
      success++;
      console.log(`  ✅ nº ${p.numero}`);
    } catch (err) {
      errors++;
      console.log(`  ❌ nº ${p.numero}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`\n✅ Atualizadas: ${success} | ❌ Falhas: ${errors}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
