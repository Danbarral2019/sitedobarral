// Gerador da folha de calibração a partir do JSON do probe de destilação
// (docs/audits/2026-07-19-probe-teses-tcu.json, formato
// { geradoEm, casos: TeseDestilada[], dossies: DossieUso[] }).
//
// Histórico: este é o gerador da Fase 2-A, quando as teses existiam só no JSON
// do probe de 3 casos. Para o acervo destilado corrente use
// scripts/build-folha-teses-tcu.ts, que lê do banco. Os dois compartilham o
// template em scripts/lib/folha-teses-template.mjs.
//
// Uso: node scripts/build-folha-teses.mjs [caminho-de-saida]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderFolha } from './lib/folha-teses-template.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const JSON_PATH = path.join(REPO_ROOT, 'docs', 'audits', '2026-07-19-probe-teses-tcu.json');
// Antes apontava para um scratchpad Windows fixo, o que quebrava em qualquer
// outra máquina. O padrão agora fica no repo; o caminho é sobrescrevível.
const OUT_PATH = process.argv[2] ?? path.join(REPO_ROOT, 'docs', 'audits', 'folha-teses-probe.html');

const src = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

if (!Array.isArray(src.casos) || !Array.isArray(src.dossies) || src.casos.length !== src.dossies.length) {
  throw new Error('Formato inesperado: casos.length deve bater com dossies.length no JSON do probe.');
}

function resolveTrechos(dossie, indices, chave) {
  const out = [];
  for (const idx of indices || []) {
    const t = dossie && Array.isArray(dossie.trechos) ? dossie.trechos[idx] : undefined;
    if (!t) {
      console.warn('[aviso] ' + chave + ': índice de trecho-fonte fora do intervalo (' + idx + ')');
      continue;
    }
    out.push({ trecho: t.trecho, origemChave: t.origemChave, noVoto: !!t.noVoto });
  }
  return out;
}

const cards = src.casos.map((c, i) => {
  const dossie = src.dossies[i] || { contagem: {}, trechos: [], alvo: {} };
  return {
    chave: c.chave,
    assunto: c.assunto,
    confianca: c.confianca || null,
    contagem: {
      noVoto: dossie.contagem?.noVoto ?? 0,
      citantesDistintos: dossie.contagem?.citantesDistintos ?? 0,
      ocorrenciasTotal: dossie.contagem?.ocorrenciasTotal ?? 0,
    },
    teses: (c.teses || []).map((t) => ({
      enunciado: t.enunciado,
      inovacao: t.inovacao,
      trechos: resolveTrechos(dossie, t.trechosFonte, c.chave),
    })),
    sinais: c.sinaisQualitativos || [],
    divergencias: (c.divergencias || []).map((d) => ({
      precedenteApontado: d.precedenteApontado,
      natureza: d.natureza,
      trecho: d.trecho,
      origemChave: d.origemChave,
    })),
  };
});

// Ordena por contagem.noVoto desc — o sinal mais forte de leading case.
cards.sort((a, b) => b.contagem.noVoto - a.contagem.noVoto);

const html = renderFolha({
  cards,
  geradoEm: src.geradoEm || '',
  eyebrow: 'Rede de precedentes · Fase 2-A · probe de destilação de teses',
});

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, html);
console.log('OK — folha gerada, ' + cards.length + ' cards, ' + html.length + ' bytes -> ' + OUT_PATH);
