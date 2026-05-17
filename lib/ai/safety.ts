/**
 * Preset de safety settings permissivos para contexto juridico
 * profissional. Os padroes do Gemini bloqueiam termos como "sancao",
 * "fraude", "ato ilicito", "responsabilizacao" — comuns em ementas de
 * TCU/STJ e em conteudo sobre direito administrativo sancionador.
 *
 * `BLOCK_ONLY_HIGH` evita falsos positivos sem abrir para conteudo
 * genuinamente toxico. Migrado do `lib/gemini/cached-client.ts` legacy
 * onde nasceu (caso fundador: bloqueio de ementas TCU em prod 2026-04).
 *
 * Anthropic ignora este preset — usa trust & safety embarcado.
 */

import type { GeminiSafetySetting } from './types'

export const LEGAL_SAFETY_SETTINGS: GeminiSafetySetting[] = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
]
