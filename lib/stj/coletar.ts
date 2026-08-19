/**
 * Orquestração da coleta dos Espelhos de Acórdãos do STJ.
 *
 * Vive em `lib/` e não em `scripts/` porque o `tsconfig.json` exclui
 * `scripts/` do build — a rota de cron precisa importar daqui.
 */
import { DATASETS_STJ } from './constantes';
import { listarDumps } from './catalogo';
import { baixar } from './consulta';
import { normalizarEspelho } from './normalizar';
import { ehRelevanteParaBase } from './recorte';
import { persistirDecisoesStj } from './persistir';
import type { EspelhoBruto } from './types';

export interface ResultadoColeta {
  dumpsLidos: number;
  espelhosVistos: number;
  relevantes: number;
  criados: number;
  atualizados: number;
  ignorados: number;
  erros: number;
  mensagensErro: string[];
}

export async function coletarStj(opcoes: {
  meses?: number;
  dryRun?: boolean;
  gerarResumo?: boolean;
  forcar?: boolean;
}): Promise<ResultadoColeta> {
  const meses = opcoes.meses ?? 2;
  const r: ResultadoColeta = {
    dumpsLidos: 0,
    espelhosVistos: 0,
    relevantes: 0,
    criados: 0,
    atualizados: 0,
    ignorados: 0,
    erros: 0,
    mensagensErro: [],
  };

  for (const { slug, orgao } of DATASETS_STJ) {
    let dumps;
    try {
      dumps = await listarDumps(slug);
    } catch (error) {
      r.erros++;
      r.mensagensErro.push(`catalogo ${slug}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    for (const dump of dumps.slice(0, meses)) {
      try {
        const corpo = await baixar(dump.url, `https://dadosabertos.web.stj.jus.br/dataset/${slug}`);
        const espelhos = JSON.parse(corpo.replace(/^﻿/, '')) as EspelhoBruto[];
        r.dumpsLidos++;
        r.espelhosVistos += espelhos.length;

        const normalizadas = espelhos
          .filter(ehRelevanteParaBase)
          .map((e) => normalizarEspelho(e, orgao))
          .filter((d): d is NonNullable<typeof d> => d !== null);

        r.relevantes += normalizadas.length;

        const p = await persistirDecisoesStj(normalizadas, {
          dryRun: opcoes.dryRun,
          forcar: opcoes.forcar,
          gerarResumo: opcoes.gerarResumo,
        });
        r.criados += p.criados;
        r.atualizados += p.atualizados;
        r.ignorados += p.ignorados;
        r.erros += p.erros;
        r.mensagensErro.push(...p.mensagensErro);

        console.log(
          `[stj] ${slug} ${dump.nome}: ${espelhos.length} espelhos → ${normalizadas.length} relevantes → +${p.criados} novos`
        );
      } catch (error) {
        r.erros++;
        r.mensagensErro.push(`${slug}/${dump.nome}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return r;
}
