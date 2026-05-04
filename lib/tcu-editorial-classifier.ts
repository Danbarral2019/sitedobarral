/**
 * Classificador editorial de acórdãos TCU.
 *
 * Recebe um acórdão e usa Gemini + a taxonomia oficial TCU
 * (extraída de planilhas curadas) para sugerir área/tema/subtema.
 *
 * Usado por:
 * - `scripts/classify-tcu-pending.ts` (backfill em lote)
 * - `app/api/cron/sync-tcu-acordaos/route.ts` (Fase 3 do enriquecimento)
 *
 * Taxonomia: `data/tcu-taxonomy.json`
 *   Regenerar com `scripts/extract-tcu-taxonomy.ts` se acórdãos novos
 *   da planilha curada forem importados via /admin/tcu-manager.
 */

import * as fs from 'fs';
import * as path from 'path';
import { callGemini } from './tcu-enrichment';

export interface ClassificationInput {
  numeroAcordao: string | null;
  title: string;
  ementa: string;
  relator: string | null;
  orgao: string | null;
}

export interface ClassificationResult {
  area: string;
  tema: string;
  subtema: string | null;
  confianca: number;
  raciocinio: string;
  novoTema: boolean;
  novoSubtema: boolean;
}

type Taxonomy = Record<string, Record<string, string[]>>;

let cachedTaxonomy: Taxonomy | null = null;
let cachedPromptText: string | null = null;

function loadTaxonomy(): Taxonomy {
  if (cachedTaxonomy) return cachedTaxonomy;
  const p = path.join(process.cwd(), 'data', 'tcu-taxonomy.json');
  if (!fs.existsSync(p)) {
    throw new Error(`Taxonomia não encontrada em ${p}. Rode: npx tsx scripts/extract-tcu-taxonomy.ts`);
  }
  cachedTaxonomy = JSON.parse(fs.readFileSync(p, 'utf-8')) as Taxonomy;
  return cachedTaxonomy;
}

function buildTaxonomyText(taxonomy: Taxonomy): string {
  if (cachedPromptText) return cachedPromptText;
  cachedPromptText = Object.entries(taxonomy)
    .map(([area, temas]) => {
      const temasList = Object.entries(temas)
        .map(([tema, subs]) => {
          const subsTxt = subs.length > 0
            ? ` [subtemas: ${subs.slice(0, 8).join(' | ')}${subs.length > 8 ? ` ... +${subs.length - 8}` : ''}]`
            : '';
          return `    - ${tema}${subsTxt}`;
        })
        .join('\n');
      return `* ${area}\n${temasList}`;
    })
    .join('\n\n');
  return cachedPromptText;
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function buildPrompt(input: ClassificationInput, taxonomy: Taxonomy): string {
  return `Você é classificador editorial do TCU. Sua tarefa: classificar o acórdão abaixo na taxonomia oficial.

ACÓRDÃO:
- Número: ${input.numeroAcordao}
- Título: ${input.title}
- Relator: ${input.relator || 'N/A'}
- Órgão: ${input.orgao || 'N/A'}

EMENTA / DESCRIÇÃO:
${input.ementa.slice(0, 4000)}

TAXONOMIA OFICIAL TCU (10 áreas, 206 temas, 473 subtemas):
${buildTaxonomyText(taxonomy)}

REGRAS:
1. **Área**: escolha EXATAMENTE UMA das 10 áreas listadas. Não invente.
2. **Tema**: escolha um tema DENTRO da área. Prefira tema existente. Se nenhum se aplica adequadamente, proponha tema novo curto (até 60 chars) e marque "novoTermo.tema": true.
3. **Subtema**: opcional. Use subtema existente se aplicável. Se não houver, deixe null. Subtema novo só se for substancialmente importante (marque "novoTermo.subtema": true).
4. **Confiança**: 0-100. Use < 60 se a ementa for muito genérica ou ambígua.
5. **Raciocínio**: 1-2 frases explicando.

RETORNE APENAS JSON, sem markdown, sem texto antes/depois:
{
  "area": "...",
  "tema": "...",
  "subtema": null,
  "confianca": 85,
  "raciocinio": "...",
  "novoTermo": { "tema": false, "subtema": false }
}`;
}

function parseResponse(text: string, validAreas: string[]): { area: string; tema: string; subtema: string | null; confianca: number; raciocinio: string; novoTermo: { tema?: boolean; subtema?: boolean } } {
  let json = text.trim();
  if (json.startsWith('```json')) json = json.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  else if (json.startsWith('```')) json = json.replace(/```\n?/g, '').trim();

  const parsed = JSON.parse(json);
  if (!parsed.area || !parsed.tema) throw new Error('Resposta sem area/tema');

  // Match accent-insensitive: aceita "Competence do TCU" → "Competência do TCU"
  const proposedNorm = normalize(parsed.area);
  const canonical = validAreas.find(a => normalize(a) === proposedNorm);
  if (!canonical) {
    throw new Error(`Área inválida: "${parsed.area}". Válidas: ${validAreas.join(', ')}`);
  }

  return {
    area: canonical,
    tema: String(parsed.tema).trim(),
    subtema: parsed.subtema ? String(parsed.subtema).trim() : null,
    confianca: Math.min(100, Math.max(0, parseInt(parsed.confianca) || 0)),
    raciocinio: parsed.raciocinio || '',
    novoTermo: parsed.novoTermo || {},
  };
}

/**
 * Classifica um acórdão TCU usando IA + taxonomia oficial.
 * Throws em caso de falha (resposta inválida, área desconhecida, Gemini error).
 */
export async function classifyTCUEditorial(input: ClassificationInput): Promise<ClassificationResult> {
  const taxonomy = loadTaxonomy();
  const validAreas = Object.keys(taxonomy);

  const prompt = buildPrompt(input, taxonomy);
  const response = await callGemini(prompt);
  const parsed = parseResponse(response, validAreas);

  const temaExiste = !!taxonomy[parsed.area]?.[parsed.tema];
  const subtemaExiste = parsed.subtema
    ? (taxonomy[parsed.area]?.[parsed.tema] || []).includes(parsed.subtema)
    : true;

  return {
    area: parsed.area,
    tema: parsed.tema,
    subtema: parsed.subtema,
    confianca: parsed.confianca,
    raciocinio: parsed.raciocinio,
    novoTema: !temaExiste,
    novoSubtema: !!parsed.subtema && !subtemaExiste,
  };
}
