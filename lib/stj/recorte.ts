/**
 * Regra de seleção: o que dos Espelhos de Acórdãos do STJ entra na base.
 *
 * O espelho entra se satisfizer QUALQUER das duas condições:
 *   1. cita 14.133, 8.666 ou 10.520 no campo estruturado de referências
 *      legislativas — determinístico, não passa por texto livre;
 *   2. casa o vocabulário de licitações na ementa ou na tese jurídica —
 *      rede de segurança para o julgado que discute o tema sem citar a
 *      norma no campo estruturado.
 *
 * Rendimento medido sobre 12 dumps (2.497 acórdãos): 117 entram, 4,7%.
 * Desvio grande desse patamar é sinal de regex frouxa.
 */

import { RE_NORMAS_LICITACAO, RE_VOCABULARIO_LICITACAO } from './constantes';
import type { EspelhoBruto } from './types';

export function ehRelevanteParaBase(e: EspelhoBruto): boolean {
  const refs = (e.referenciasLegislativas ?? []).join('\n');
  if (RE_NORMAS_LICITACAO.test(refs)) return true;

  const texto = `${e.ementa ?? ''}\n${e.teseJuridica ?? ''}`;
  return RE_VOCABULARIO_LICITACAO.test(texto);
}
