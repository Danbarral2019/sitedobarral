/**
 * Acesso HTTP ao Portal de Dados Abertos do STJ.
 *
 * O host está atrás de um WAF F5 que rejeita cliente sem cara de navegador —
 * e rejeita devolvendo HTTP **200** com uma página de erro de ~1.2 KB, não um
 * status de erro. Por isso a checagem abaixo olha o corpo, não só o status.
 *
 * Diferente do STF, não há detecção de headless nem desafio JavaScript:
 * estes cabeçalhos bastam, e o conector roda desatendido em cron.
 */

import { BASE_DADOS_ABERTOS_STJ } from './constantes';

const CABECALHOS_NAVEGADOR: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Upgrade-Insecure-Requests': '1',
};

/** Assinatura da página de rejeição do WAF, servida com HTTP 200. */
const MARCA_WAF = 'The requested URL was rejected';

export class RespostaBloqueadaError extends Error {
  constructor(url: string) {
    super(`WAF do STJ rejeitou a requisição para ${url}`);
    this.name = 'RespostaBloqueadaError';
  }
}

export async function baixar(
  url: string,
  referer: string = `${BASE_DADOS_ABERTOS_STJ}/`
): Promise<string> {
  const resposta = await fetch(url, {
    headers: { ...CABECALHOS_NAVEGADOR, Referer: referer },
    signal: AbortSignal.timeout(90_000),
  });

  if (!resposta.ok) {
    throw new Error(`HTTP ${resposta.status} em ${url}`);
  }

  const corpo = await resposta.text();
  if (corpo.includes(MARCA_WAF)) {
    throw new RespostaBloqueadaError(url);
  }

  return corpo;
}
