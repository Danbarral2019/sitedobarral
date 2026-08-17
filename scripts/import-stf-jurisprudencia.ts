/**
 * Backfill da jurisprudência do STF a partir do JSON extraído da API.
 *
 * O host jurisprudencia.stf.jus.br está atrás de um AWS WAF com desafio
 * JavaScript, de modo que a extração não pode ser feita server-side. Este
 * script consome um JSON já colhido de dentro do navegador — ver a seção
 * "O bloqueio" em docs/superpowers/plans/2026-08-16-conector-stf-jurisprudencia.md.
 *
 * Formato esperado do JSON: { gerado_em, acordaos[], monocraticas[], amplo[] }
 *
 * Uso:
 *   npm run import:stf -- --dry-run
 *   npm run import:stf -- --limit 20
 *   npm run import:stf
 *   STF_DADOS_JSON=/caminho/arquivo.json npm run import:stf
 */

import { readFileSync } from 'node:fs';
import { normalizarDocumentoStf } from '@/lib/stf/normalizar';
import { selecionarRecorte } from '@/lib/stf/recorte';
import { persistirDecisoesStf } from '@/lib/stf/persistir';
import type { StfDocumentoBruto, StfDecisaoNormalizada } from '@/lib/stf/types';

const CAMINHO_PADRAO =
  'D:/OneDrive/XX - Arquivos/Documentos/STF_licitacoes/stf_lei14133_dados_2026-08-16.json';

interface CorpusStf {
  gerado_em?: string;
  acordaos?: StfDocumentoBruto[];
  monocraticas?: StfDocumentoBruto[];
  amplo?: StfDocumentoBruto[];
}

function arg(nome: string): string | null {
  const i = process.argv.indexOf(nome);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : null;
}

/**
 * Lê `--limit` e valida antes de qualquer leitura de arquivo ou conexão de
 * banco. Um valor inválido (ausente, não numérico, zero, negativo, ou outra
 * flag consumida como valor) NÃO pode degradar em silêncio para "processar
 * tudo": por política do projeto documentos nunca são excluídos, então um
 * `--limit` digitado errado grava um backfill inteiro de forma irreversível.
 */
function lerLimiteOuAbortar(): number | null {
  if (!process.argv.includes('--limit')) return null;

  const limiteRaw = arg('--limit');
  const numero = limiteRaw === null ? NaN : Number(limiteRaw);
  const valido =
    limiteRaw !== null &&
    !limiteRaw.startsWith('--') &&
    Number.isInteger(numero) &&
    numero > 0;

  if (!valido) {
    console.error(
      `--limit inválido: recebido "${limiteRaw ?? '(nenhum valor)'}", esperado um número inteiro positivo (ex.: --limit 20).`
    );
    process.exit(1);
  }

  return numero;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const forcar = process.argv.includes('--force');
  const limite = lerLimiteOuAbortar();
  const caminho = process.env.STF_DADOS_JSON || CAMINHO_PADRAO;

  console.log('=== Backfill STF — jurisprudência de licitações ===');
  console.log(`Fonte: ${caminho}`);
  if (dryRun) console.log('(DRY RUN — nada será gravado)');

  const corpus: CorpusStf = JSON.parse(readFileSync(caminho, 'utf-8'));
  const brutos = [
    ...(corpus.acordaos || []),
    ...(corpus.monocraticas || []),
    ...(corpus.amplo || []),
  ];
  console.log(`Documentos brutos: ${brutos.length}`);

  const normalizados = brutos
    .map(normalizarDocumentoStf)
    .filter((d): d is StfDecisaoNormalizada => d !== null);
  console.log(`Normalizados: ${normalizados.length}`);

  let selecionados = selecionarRecorte(normalizados);
  console.log(`Selecionados pelo recorte: ${selecionados.length}`);

  const comArtigos = selecionados.filter(d => d.artigos14133.length > 0).length;
  const comTese = selecionados.filter(d => d.tese).length;
  const truncados = selecionados.filter(d => d.ementaTruncada).length;
  console.log(`  com dispositivos da 14.133: ${comArtigos}`);
  console.log(`  com tese oficial firmada:   ${comTese}`);
  console.log(`  com texto truncado em 6000: ${truncados}`);

  if (limite !== null) {
    selecionados = selecionados.slice(0, limite);
    console.log(`Limitado a ${selecionados.length} documentos.`);
  }

  const r = await persistirDecisoesStf(selecionados, { dryRun, forcar });

  console.log('\n=== Resultado ===');
  console.log(`criados=${r.criados} atualizados=${r.atualizados} ignorados=${r.ignorados} erros=${r.erros}`);
  for (const m of r.mensagensErro.slice(0, 10)) console.log(`  ERRO ${m}`);

  if (r.erros > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
