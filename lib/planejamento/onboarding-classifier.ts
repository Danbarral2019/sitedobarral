/**
 * Classificador de natureza da contratação a partir da descrição livre do aluno.
 *
 * Estratégia MVP: heurística por keywords (determinística, barata). Futuras
 * versões podem chamar `generate('classification', ...)` do lib/ai para
 * dúvidas; a heurística já responde bem na maior parte dos casos típicos
 * do curso (limpeza, vigilância, frota, TI, obras).
 */
import type { ClassifyResult } from "@/data/planejamento/types";
import { defaultTrailSlug } from "./constants";

interface Rule {
  natureza: ClassifyResult["naturezaSugerida"];
  /** palavras-chave em lowercase, sem acento */
  patterns: string[];
  weight?: number;
}

const RULES: Rule[] = [
  {
    natureza: "SERVICO_CONTINUADO",
    patterns: [
      "limpeza",
      "conservacao",
      "vigilancia",
      "portaria",
      "recepcao",
      "copeiragem",
      "continuado",
      "continuada",
      "apoio administrativo",
      "manutencao predial",
    ],
    weight: 2,
  },
  {
    natureza: "OBRA",
    patterns: ["obra", "construcao", "reforma", "ampliacao", "edificacao"],
    weight: 2,
  },
  {
    natureza: "SERVICO_ENGENHARIA",
    patterns: [
      "engenharia",
      "projeto basico",
      "projeto executivo",
      "topografia",
      "sondagem",
    ],
    weight: 2,
  },
  {
    natureza: "BEM_COMUM",
    patterns: [
      "aquisicao",
      "compra de",
      "material de consumo",
      "mobiliario",
      "veiculo",
      "computador",
      "notebook",
    ],
    weight: 1,
  },
  {
    natureza: "SERVICO_ESPECIAL",
    patterns: [
      "auditoria",
      "consultoria especializada",
      "advocacia",
      "juridico especializado",
      "medico especialista",
    ],
    weight: 2,
  },
  {
    natureza: "BEM_ESPECIAL",
    patterns: [
      "equipamento medico",
      "obra de arte",
      "bem de capital",
      "sob encomenda",
    ],
    weight: 2,
  },
  {
    natureza: "SERVICO_COMUM",
    patterns: ["servico comum", "tercerizacao", "terceirizacao"],
    weight: 1,
  },
];

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function classifyNatureza(descricaoLivre: string): ClassifyResult {
  const text = normalize(descricaoLivre);
  const scores: Record<ClassifyResult["naturezaSugerida"], number> = {
    BEM_COMUM: 0,
    BEM_ESPECIAL: 0,
    SERVICO_COMUM: 0,
    SERVICO_CONTINUADO: 0,
    SERVICO_ESPECIAL: 0,
    OBRA: 0,
    SERVICO_ENGENHARIA: 0,
  };

  for (const rule of RULES) {
    for (const p of rule.patterns) {
      if (text.includes(p)) {
        scores[rule.natureza] += rule.weight ?? 1;
      }
    }
  }

  let best: ClassifyResult["naturezaSugerida"] = "SERVICO_COMUM";
  let bestScore = 0;
  let total = 0;
  for (const [key, val] of Object.entries(scores)) {
    total += val;
    if (val > bestScore) {
      bestScore = val;
      best = key as ClassifyResult["naturezaSugerida"];
    }
  }

  const confianca = total === 0 ? 0 : Math.min(1, bestScore / (total + 1));
  const perguntasFollowUp = buildFollowUp(best, scores, bestScore);

  return {
    naturezaSugerida: best,
    confianca,
    perguntasFollowUp,
    trailTemplateId: defaultTrailSlug(best, "ETP"),
  };
}

function buildFollowUp(
  best: ClassifyResult["naturezaSugerida"],
  scores: Record<string, number>,
  bestScore: number,
): string[] {
  if (bestScore === 0) {
    return [
      "A contratação envolve aquisição de bens, prestação de serviço, ou execução de obra?",
      "O objeto tem caráter continuado (execução mensal recorrente) ou é pontual?",
    ];
  }
  const q: string[] = [];
  if (best === "SERVICO_CONTINUADO") {
    q.push("Há dedicação exclusiva de mão de obra ao órgão?");
    q.push("O contrato terá prorrogação prevista além de 12 meses?");
  }
  if (best === "OBRA" || best === "SERVICO_ENGENHARIA") {
    q.push("Há projeto básico ou anteprojeto disponível?");
    q.push("Há previsão de regime de contratação integrada ou semi-integrada?");
  }
  const competingScore = Object.values(scores).filter((v) => v === bestScore).length;
  if (competingScore > 1) {
    q.push("Confirme se a natureza preponderante corresponde à sugerida.");
  }
  return q;
}
