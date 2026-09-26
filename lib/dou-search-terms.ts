/**
 * Termos de busca do DOU Clipping v2, compartilhados pelo cron
 * `sync-dou-atos-normativos` e pelo CLI `scripts/dou-lookback.ts`.
 */

// Termos expandidos do Clipping v2 — recall > precision (Apêndice 1 da spec).
// Os termos de pessoal ficam: trazem ruído, mas o prompt v2 da IA editorial
// dá nota baixa a atos de pessoal. Tirá-los reduziria o recall sem medição.
export const SEARCH_TERMS_V2 = [
  'lei 14.133 OR lei 14133 OR nova lei de licitações',
  'decreto licitação OR decreto contratação',
  'instrução normativa SEGES OR instrução normativa MGI',
  'portaria normativa licitação OR portaria normativa contratação',
  'portaria SEGES OR portaria MGI',
  'instrução normativa CGU OR portaria CGU',
  'parecer AGU OR orientação normativa AGU',
  'portaria SECEX OR resolução TCU',
  'decreto servidor público federal',
  'decreto teletrabalho OR decreto jornada servidor',
  'decreto contratos administrativos federais',
  'decreto regime jurídico único',
  'decreto regulamenta lei 14.133',
  'reorganização administração federal contratações',
  'fundo de contratações OR centralização compras governo',
];
