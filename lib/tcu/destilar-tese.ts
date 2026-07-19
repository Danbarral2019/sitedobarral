/**
 * Destila a TESE (ratio decidendi) de um leading case do TCU cruzando (a) a
 * ementa do próprio acórdão com (b) o dossiê de uso — os trechos onde os votos
 * posteriores o invocam. Também extrai sinais qualitativos (reconhecimento como
 * leading case) e divergências (votos que apontam outro precedente). Motor da
 * Fase 2-A. O prompt é conservador: NÃO inventar tese sem apoio nos trechos.
 */
import { generate } from '../ai';
import type { DossieUso } from './trechos-de-citacao';

export interface CasoDestilacao {
  chave: string;
  ementaPropria: string | null;
  colegiado: string | null;
  relator: string | null;
  dossie: DossieUso;
}
export interface TeseEnunciado { enunciado: string; inovacao: string; trechosFonte: number[] }
export interface SinalQualitativo { origemChave: string; trecho: string; tipo: string }
export interface Divergencia { origemChave: string; precedenteApontado: string; trecho: string; natureza: string }
export interface TeseDestilada {
  chave: string;
  assunto: string;
  teses: TeseEnunciado[];
  sinaisQualitativos: SinalQualitativo[];
  divergencias: Divergencia[];
  confianca: 'alta' | 'media' | 'baixa';
}

const SYSTEM = `Você é um analista de jurisprudência do TCU. Sua tarefa é identificar a TESE
(ratio decidendi) que um acórdão fixou e que passou a orientar votos posteriores — NÃO resumir o caso.

Regras:
- Enuncie a tese em linguagem de súmula: abstrata, aplicável a casos futuros.
- Baseie-se SOBRETUDO em como os votos posteriores invocam o precedente (os trechos numerados).
- Seja CONSERVADOR: se os trechos não sustentam uma tese clara, retorne "teses": [] e explique em "assunto".
  NÃO invente tese, NÃO extrapole além dos trechos. Prefira omitir a alucinar.
- "sinaisQualitativos": só quando um trecho LITERAL trata o precedente como seminal/paradigmático
  ("primeira vez que o Tribunal", "leading case", "precedente paradigmático").
- "divergencias": só quando um trecho aponta OUTRO acórdão como o precedente de referência para o mesmo assunto.
- Cada tese lista em "trechosFonte" os índices [n] dos trechos que a sustentam.

Responda APENAS com JSON, sem texto ao redor, no formato:
{"assunto": string, "teses": [{"enunciado": string, "inovacao": string, "trechosFonte": number[]}],
 "sinaisQualitativos": [{"origemChave": string, "trecho": string, "tipo": string}],
 "divergencias": [{"origemChave": string, "precedenteApontado": string, "trecho": string, "natureza": string}],
 "confianca": "alta"|"media"|"baixa"}`;

export function montarPromptTese(caso: CasoDestilacao): { systemPrompt: string; userContent: string } {
  const trechos = caso.dossie.trechos
    .map((t, i) => `[${i}] (${t.noVoto ? 'VOTO' : t.secao ?? 'outro'}, cita ${caso.chave} em ${t.origemChave}) ${t.trecho}`)
    .join('\n');
  const userContent = [
    `LEADING CASE: Acórdão ${caso.chave}${caso.colegiado ? ' - ' + caso.colegiado : ''}${caso.relator ? ' (Rel. ' + caso.relator + ')' : ''}`,
    `Citado no voto por ${caso.dossie.contagem.noVoto} de ${caso.dossie.contagem.citantesDistintos} acórdãos citantes.`,
    '',
    caso.ementaPropria ? `EMENTA DO PRÓPRIO ACÓRDÃO:\n${caso.ementaPropria}` : 'EMENTA DO PRÓPRIO ACÓRDÃO: (indisponível)',
    '',
    `TRECHOS DE USO NOS VOTOS POSTERIORES (numerados para "trechosFonte"):`,
    trechos || '(nenhum trecho capturado)',
  ].join('\n');
  return { systemPrompt: SYSTEM, userContent };
}

/** Extrai o primeiro objeto JSON de um texto (tolera cercas ```json e prosa). */
function extrairJson(text: string): string {
  const semCerca = text.replace(/```(?:json)?/gi, '').trim();
  const ini = semCerca.indexOf('{');
  const fim = semCerca.lastIndexOf('}');
  if (ini < 0 || fim <= ini) throw new Error('resposta sem JSON reconhecível');
  return semCerca.slice(ini, fim + 1);
}

export function parseRespostaTese(chave: string, text: string): TeseDestilada {
  const raw = JSON.parse(extrairJson(text)) as Partial<TeseDestilada>;
  return {
    chave,
    assunto: typeof raw.assunto === 'string' ? raw.assunto : '',
    teses: Array.isArray(raw.teses) ? raw.teses : [],
    sinaisQualitativos: Array.isArray(raw.sinaisQualitativos) ? raw.sinaisQualitativos : [],
    divergencias: Array.isArray(raw.divergencias) ? raw.divergencias : [],
    confianca: raw.confianca === 'alta' || raw.confianca === 'media' ? raw.confianca : 'baixa',
  };
}

export async function destilarTese(caso: CasoDestilacao): Promise<TeseDestilada> {
  const { systemPrompt, userContent } = montarPromptTese(caso);
  const { text } = await generate('enhancement', {
    systemPrompt,
    messages: [{ role: 'user', content: userContent }],
    jsonMode: true,
    temperature: 0.2,
    maxTokens: 2048,
  });
  if (!text) throw new Error(`destilarTese: resposta vazia para ${caso.chave}`);
  return parseRespostaTese(caso.chave, text);
}
