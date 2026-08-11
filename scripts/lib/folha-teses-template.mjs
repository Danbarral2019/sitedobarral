// Template da folha de calibração de teses do TCU — HTML autocontido, sem rede.
//
// Extraído de build-folha-teses.mjs (probe de 2026-07-19) para ser compartilhado
// com o gerador que lê do banco (build-folha-teses-tcu.ts). O formato já foi
// aprovado pelo Daniel na Fase 2-A; mudanças aqui afetam as duas folhas.
//
// Contrato de `cards` (um por leading case), já ordenado como deve aparecer:
//   { chave, assunto, confianca, contagem: {noVoto, citantesDistintos, ocorrenciasTotal},
//     teses: [{enunciado, inovacao, trechos: [{trecho, origemChave, noVoto}]}],
//     sinais: [{tipo, origemChave, trecho}],
//     divergencias: [{precedenteApontado, natureza, trecho, origemChave}],
//     trechosIndisponiveis?: boolean }
//
// `trechosIndisponiveis` marca o caso cujo dossiê mudou depois da destilação:
// os índices gravados deixariam de apontar para os trechos que sustentaram a
// tese, e exibir o texto errado é pior que não exibir nenhum — o card avisa em
// vez de mostrar evidência que não é a que o modelo leu.

export function renderFolha({ cards, geradoEm, eyebrow, notaRodape }) {
  const DATA = JSON.stringify(cards);
  const GERADO_EM = geradoEm || '';
  const EYEBROW = eyebrow || 'Rede de precedentes · Fase 2-A';
  const NOTA = notaRodape || '';

  return `<title>Calibração — Teses do TCU</title>
<style>
:root{
  --bg:#f5f6f7; --surface:#ffffff; --surface-2:#eef0f2; --line:#dfe3e6;
  --ink:#1b2228; --ink-soft:#525d66; --ink-faint:#8a939b;
  --accent:#0f6b62; --accent-soft:#0f6b6215;
  --fiel:#1f7a49; --fiel-bg:#1f7a4914;
  --imprecisa:#9a6a12; --imprecisa-bg:#9a6a1214;
  --errada:#b3261e; --errada-bg:#b3261e14;
  --shadow:0 1px 2px rgba(20,30,40,.06),0 1px 8px rgba(20,30,40,.05);
  --serif:"Iowan Old Style","Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --mono:ui-monospace,"SFMono-Regular","Cascadia Code",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#11151a; --surface:#191f26; --surface-2:#20272f; --line:#2a333c;
  --ink:#e7ebee; --ink-soft:#a7b0b8; --ink-faint:#6d7780;
  --accent:#4fb3a6; --accent-soft:#4fb3a61f;
  --fiel:#4caf76; --fiel-bg:#4caf761f;
  --imprecisa:#d6a94a; --imprecisa-bg:#d6a94a1f;
  --errada:#e5675f; --errada-bg:#e5675f1f;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 2px 12px rgba(0,0,0,.25);
}}
:root[data-theme="dark"]{
  --bg:#11151a; --surface:#191f26; --surface-2:#20272f; --line:#2a333c;
  --ink:#e7ebee; --ink-soft:#a7b0b8; --ink-faint:#6d7780;
  --accent:#4fb3a6; --accent-soft:#4fb3a61f;
  --fiel:#4caf76; --fiel-bg:#4caf761f;
  --imprecisa:#d6a94a; --imprecisa-bg:#d6a94a1f;
  --errada:#e5675f; --errada-bg:#e5675f1f;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 2px 12px rgba(0,0,0,.25);
}
:root[data-theme="light"]{
  --bg:#f5f6f7; --surface:#ffffff; --surface-2:#eef0f2; --line:#dfe3e6;
  --ink:#1b2228; --ink-soft:#525d66; --ink-faint:#8a939b;
  --accent:#0f6b62; --accent-soft:#0f6b6215;
  --fiel:#1f7a49; --fiel-bg:#1f7a4914;
  --imprecisa:#9a6a12; --imprecisa-bg:#9a6a1214;
  --errada:#b3261e; --errada-bg:#b3261e14;
  --shadow:0 1px 2px rgba(20,30,40,.06),0 1px 8px rgba(20,30,40,.05);
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.5;
  -webkit-font-smoothing:antialiased;font-size:15px}
.wrap{max-width:920px;margin:0 auto;padding:0 20px 120px}

/* header */
header{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);
  backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.head-in{max-width:920px;margin:0 auto;padding:18px 20px 14px}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--accent);font-weight:600}
h1{font-family:var(--serif);font-weight:600;font-size:25px;line-height:1.15;margin:6px 0 2px;
  text-wrap:balance;letter-spacing:-.01em}
.sub{color:var(--ink-soft);font-size:13.5px;max-width:70ch}
.tally{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;align-items:center}
.chip{display:inline-flex;align-items:center;gap:7px;font-family:var(--mono);font-size:12.5px;
  padding:5px 11px;border-radius:999px;border:1px solid var(--line);background:var(--surface);
  font-variant-numeric:tabular-nums;font-weight:600}
.chip b{font-size:14px}
.chip.fiel{color:var(--fiel);background:var(--fiel-bg);border-color:transparent}
.chip.imprecisa{color:var(--imprecisa);background:var(--imprecisa-bg);border-color:transparent}
.chip.errada{color:var(--errada);background:var(--errada-bg);border-color:transparent}
.chip .dot{width:8px;height:8px;border-radius:50%;background:currentColor;opacity:.85}
.bar{height:6px;border-radius:99px;background:var(--surface-2);margin-top:12px;overflow:hidden;display:flex}
.bar span{height:100%;display:block;transition:width .35s ease}
.bar .s-fiel{background:var(--fiel)} .bar .s-imprecisa{background:var(--imprecisa)} .bar .s-errada{background:var(--errada)}
.actions{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;align-items:center}
button{font-family:var(--sans);font-size:13px;cursor:pointer;border-radius:8px;border:1px solid var(--line);
  background:var(--surface);color:var(--ink);padding:7px 13px;font-weight:500;transition:.15s}
button:hover{border-color:var(--accent);color:var(--accent)}
button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
button.primary{background:var(--accent);color:#fff;border-color:var(--accent)}
button.primary:hover{filter:brightness(1.08);color:#fff}
.filters{display:flex;gap:4px;margin-left:auto;background:var(--surface-2);padding:3px;border-radius:9px}
.filters button{border:none;background:transparent;padding:5px 10px;font-size:12.5px;border-radius:6px}
.filters button.on{background:var(--surface);color:var(--accent);box-shadow:var(--shadow)}

/* cards */
.list{margin-top:18px;display:flex;flex-direction:column;gap:12px}
.card{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:12px;
  padding:18px 20px 18px 22px;box-shadow:var(--shadow);overflow:hidden;transition:.18s}
.card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--line);transition:.18s}
.card[data-v="fiel"]::before{background:var(--fiel)}
.card[data-v="imprecisa"]::before{background:var(--imprecisa)}
.card[data-v="errada"]::before{background:var(--errada)}
.card[data-v="errada"]{opacity:.85}
.card.hidden{display:none}
.c-top{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.rank{font-family:var(--mono);font-size:11.5px;color:var(--ink-faint);font-weight:600;
  border:1px solid var(--line);border-radius:6px;padding:1px 6px}
.chave{font-family:var(--serif);font-size:20px;font-weight:600;letter-spacing:-.01em;color:var(--ink)}
.conf-badge{font-size:11.5px;color:var(--ink-faint);margin-left:auto;font-family:var(--mono)}
.assunto{font-size:13.5px;color:var(--ink-soft);margin:6px 0 2px;line-height:1.5}
.metrics{display:flex;align-items:center;gap:16px;margin:12px 0 14px;flex-wrap:wrap}
.metric{display:flex;flex-direction:column;gap:1px}
.metric .n{font-family:var(--mono);font-size:16px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1}
.metric .l{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-faint)}
.votobar{flex:1;min-width:140px}
.votobar .track{height:7px;border-radius:99px;background:var(--surface-2);overflow:hidden;margin-top:5px}
.votobar .fill{height:100%;background:linear-gradient(90deg,var(--accent),color-mix(in srgb,var(--accent) 60%,#6cc));border-radius:99px}
.votobar .cap{display:flex;justify-content:space-between;font-size:10.5px;color:var(--ink-faint);
  text-transform:uppercase;letter-spacing:.05em}
.votobar .cap b{color:var(--accent);font-family:var(--mono);font-weight:600}

/* teses */
.tese-wrap{display:flex;flex-direction:column;gap:16px;margin-bottom:6px}
.tese-block{padding:14px 16px;background:var(--surface-2);border-radius:10px}
.tese-label{font-family:var(--mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;
  color:var(--accent);font-weight:700;margin-bottom:6px}
.enunciado{font-family:var(--serif);font-size:18px;line-height:1.45;color:var(--ink);font-weight:500;
  text-wrap:pretty}
.inovacao{font-size:13px;color:var(--ink-soft);margin-top:9px;line-height:1.55}
.inovacao-tag{display:block;font-family:var(--mono);font-size:10px;text-transform:uppercase;
  letter-spacing:.07em;color:var(--ink-faint);margin-bottom:3px}
.sem-trecho{font-size:12.5px;color:var(--errada);margin-top:8px}
.trechos-off{font-size:12.5px;color:var(--imprecisa);margin-top:8px;line-height:1.5}

/* trechos-fonte */
.trechos-details{margin-top:12px}
.trechos-details summary{cursor:pointer;font-size:12.5px;color:var(--accent);font-weight:600;
  list-style:none;display:flex;align-items:center;gap:5px}
.trechos-details summary::-webkit-details-marker{display:none}
.trechos-details summary::before{content:"▸";transition:transform .15s}
.trechos-details[open] summary::before{transform:rotate(90deg)}
.trechos-scroll{margin-top:9px;max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:9px;
  padding-right:4px}
.trecho-item{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:9px 11px}
.trecho-head{display:flex;align-items:center;gap:8px;margin-bottom:5px}
.trecho-chave{font-family:var(--mono);font-size:11px;color:var(--ink-faint);font-weight:600}
.badge-voto{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.05em;
  color:var(--accent);background:var(--accent-soft);padding:1px 6px;border-radius:99px;font-weight:700}
blockquote{margin:0;font-size:12.5px;line-height:1.55;color:var(--ink-soft);font-style:italic}

/* sem tese */
.sem-tese-block{padding:14px 16px;background:var(--errada-bg);border:1px solid transparent;border-radius:10px;
  margin-bottom:6px}
.sem-tese-title{font-family:var(--serif);font-size:17px;font-weight:600;color:var(--errada)}
.sem-tese-sub{font-size:12.5px;color:var(--ink-soft);margin:6px 0 0}

/* sinais */
.sinais-block{margin-top:6px;padding-top:12px;border-top:1px solid var(--line)}
.sinais-block h4,.diverg-block h4{font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;
  color:var(--ink-faint);font-weight:700;margin:0 0 9px}
.sinal-item{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;margin-bottom:8px;font-size:12.5px}
.sinal-item blockquote{flex-basis:100%}
.badge-tipo{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.04em;
  color:var(--ink-soft);background:var(--surface-2);padding:1px 7px;border-radius:99px;font-weight:600}

/* divergências */
.diverg-block{margin-top:12px;padding:12px 14px;border:1px solid var(--imprecisa);border-radius:10px;
  background:var(--imprecisa-bg)}
.diverg-item{padding:9px 0;border-top:1px dashed var(--line)}
.diverg-item:first-of-type{border-top:none;padding-top:0}
.diverg-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px}
.diverg-item .trecho-chave{display:block;margin-bottom:5px}
.diverg-item blockquote{margin-bottom:9px}
.diverg-seg{margin-top:2px}

.c-foot{margin-top:14px;padding-top:12px;border-top:1px solid var(--line);display:flex}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden;background:var(--surface)}
.seg button{border:none;border-radius:0;padding:7px 14px;font-size:12.5px;font-weight:600;color:var(--ink-soft);
  border-left:1px solid var(--line)}
.seg button:first-child{border-left:none}
.seg button:hover{background:var(--surface-2);color:var(--ink)}
.seg button[aria-pressed="true"].v-fiel{background:var(--fiel);color:#fff}
.seg button[aria-pressed="true"].v-imprecisa{background:var(--imprecisa);color:#fff}
.seg button[aria-pressed="true"].v-errada{background:var(--errada);color:#fff}
.seg button[aria-pressed="true"].v-procede{background:var(--fiel);color:#fff}
.seg button[aria-pressed="true"].v-naoprocede{background:var(--errada);color:#fff}

/* export dialog */
dialog{border:1px solid var(--line);border-radius:14px;padding:0;max-width:560px;width:92vw;
  background:var(--surface);color:var(--ink);box-shadow:0 20px 60px rgba(0,0,0,.3)}
dialog::backdrop{background:rgba(10,15,20,.5);backdrop-filter:blur(2px)}
.dlg-in{padding:22px 24px}
.dlg-in h2{font-family:var(--serif);font-size:19px;margin:0 0 4px;font-weight:600}
.dlg-in p{font-size:13px;color:var(--ink-soft);margin:0 0 14px}
textarea{width:100%;height:260px;font-family:var(--mono);font-size:12.5px;line-height:1.5;
  border:1px solid var(--line);border-radius:9px;padding:12px;background:var(--bg);color:var(--ink);resize:vertical}
.dlg-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
.foot-note{margin-top:26px;padding-top:18px;border-top:1px solid var(--line);font-size:12px;color:var(--ink-faint);line-height:1.6}
.theme-tog{position:fixed;bottom:16px;right:16px;z-index:30;width:40px;height:40px;border-radius:50%;
  display:grid;place-items:center;background:var(--surface);box-shadow:var(--shadow);font-size:16px;padding:0}
@media (max-width:560px){.conf-badge{margin-left:0}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<header>
  <div class="head-in">
    <div class="eyebrow">${EYEBROW}</div>
    <h1>Calibração das teses destiladas — TCU</h1>
    <div class="sub">Cada card é um leading case com a tese que o modelo destilou a partir das citações reais no acervo. Confira a tese contra os <b>trechos-fonte literais</b> (não parafraseados) antes de julgar. Sua marcação fica salva neste navegador; ao terminar, clique <b>Exportar veredito</b> e devolva o texto.</div>
    <div class="tally" id="tally"></div>
    <div class="bar" id="bar"></div>
    <div class="actions">
      <button class="primary" id="btnExport">Exportar veredito</button>
      <button id="btnReset">Limpar marcações</button>
      <div class="filters" id="filters">
        <button data-f="all" class="on">Todos</button>
        <button data-f="fiel">Fiel</button>
        <button data-f="imprecisa">Imprecisa</button>
        <button data-f="errada">Errada</button>
        <button data-f="pendente">Pendentes</button>
      </div>
    </div>
  </div>
</header>

<div class="wrap">
  <div class="list" id="list"></div>
  <div class="foot-note">
    <b>Como ler estes cards.</b> <b>No voto</b> = acórdãos que citam este caso dentro da fundamentação do voto (razão de decidir); <b>citantes distintos</b> = quantos acórdãos diferentes o citam; <b>ocorrências totais</b> = todas as menções, em qualquer seção. A barra mostra, dos citantes distintos, qual fração cita no voto em vez de só mencionar de passagem. Os trechos-fonte de cada tese são o texto literal dos acórdãos citantes — nenhuma paráfrase. ${NOTA} Gerado em ${GERADO_EM}.
  </div>
</div>

<button class="theme-tog" id="themeTog" title="Alternar tema" aria-label="Alternar tema">◐</button>

<dialog id="dlg">
  <div class="dlg-in">
    <h2>Veredito da calibração</h2>
    <p>Copie o texto abaixo e cole na conversa.</p>
    <textarea id="exportText" readonly></textarea>
    <div class="dlg-foot">
      <button id="btnCopy" class="primary">Copiar</button>
      <button id="btnClose">Fechar</button>
    </div>
  </div>
</dialog>

<script>
const DATA = ${DATA};
const KEY = 'calibracao-teses-tcu-fase2a-v1';
let store = { cards: {}, divs: {} };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) store = JSON.parse(raw);
} catch (e) {}
if (!store.cards) store.cards = {};
if (!store.divs) store.divs = {};
let filter = 'all';

function save() { localStorage.setItem(KEY, JSON.stringify(store)); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Fração dos CITANTES DISTINTOS que citam no voto (razão de decidir), não das
// ocorrências totais — misturar "citantes distintos" (denominador de pessoas)
// com "ocorrências totais" (denominador de menções) produzia uma métrica sem
// unidade coerente.
function pctNoVoto(d) {
  const total = d.contagem.citantesDistintos || 0;
  if (!total) return 0;
  return Math.max(2, Math.min(100, Math.round((100 * d.contagem.noVoto) / total)));
}

function renderTeseBlock(t, idx, total, indisponivel) {
  let out = '<div class="tese-block">';
  if (total > 1) out += '<div class="tese-label">Tese ' + (idx + 1) + ' de ' + total + '</div>';
  out += '<div class="enunciado">' + esc(t.enunciado) + '</div>';
  out += '<div class="inovacao"><span class="inovacao-tag">O que fixou de novo</span>' + esc(t.inovacao) + '</div>';
  if (indisponivel) {
    out += '<p class="trechos-off">Trechos-fonte não exibidos: o dossiê deste caso mudou depois da destilação, ' +
           'e os índices gravados já não apontam com segurança para os trechos que o modelo leu. ' +
           'Julgue pelo enunciado, ou peça a redestilação deste caso.</p>';
  } else if (t.trechos && t.trechos.length) {
    out += '<details class="trechos-details"' + (t.trechos.length <= 4 ? ' open' : '') + '>';
    out += '<summary>' + t.trechos.length + ' trecho' + (t.trechos.length === 1 ? '' : 's') + '-fonte (citações literais)</summary>';
    out += '<div class="trechos-scroll">';
    for (let k = 0; k < t.trechos.length; k++) {
      const tr = t.trechos[k];
      out += '<div class="trecho-item">';
      out += '<div class="trecho-head"><span class="trecho-chave">Acórdão ' + esc(tr.origemChave) + '</span>';
      if (tr.noVoto) out += '<span class="badge-voto">no voto</span>';
      out += '</div>';
      out += '<blockquote>' + esc(tr.trecho) + '</blockquote>';
      out += '</div>';
    }
    out += '</div></details>';
  } else {
    out += '<p class="sem-trecho">Nenhum trecho-fonte resolvido para esta tese.</p>';
  }
  out += '</div>';
  return out;
}

function renderSinais(d) {
  if (!d.sinais || !d.sinais.length) return '';
  let out = '<div class="sinais-block"><h4>Sinais qualitativos (' + d.sinais.length + ')</h4>';
  for (let i = 0; i < d.sinais.length; i++) {
    const s = d.sinais[i];
    out += '<div class="sinal-item"><span class="badge-tipo">' + esc(s.tipo || 'sinal') + '</span>';
    out += '<span class="trecho-chave">Acórdão ' + esc(s.origemChave) + '</span>';
    out += '<blockquote>' + esc(s.trecho) + '</blockquote></div>';
  }
  out += '</div>';
  return out;
}

function renderDivergencias(d) {
  if (!d.divergencias || !d.divergencias.length) return '';
  let out = '<div class="diverg-block"><h4>Divergências apontadas (' + d.divergencias.length + ')</h4>';
  for (let i = 0; i < d.divergencias.length; i++) {
    const dv = d.divergencias[i];
    const dvKey = d.chave + '::' + i;
    const v = store.divs[dvKey] || '';
    out += '<div class="diverg-item">';
    out += '<div class="diverg-head"><b>' + esc(dv.precedenteApontado || '(precedente não identificado)') + '</b>';
    if (dv.natureza) out += '<span class="badge-tipo">' + esc(dv.natureza) + '</span>';
    out += '</div>';
    out += '<span class="trecho-chave">Acórdão ' + esc(dv.origemChave) + '</span>';
    out += '<blockquote>' + esc(dv.trecho) + '</blockquote>';
    out += '<div class="seg diverg-seg" role="group" aria-label="Veredito da divergência ' + (i + 1) + '">';
    out += '<button class="v-procede" data-dv="' + dvKey + '" data-set="procede" aria-pressed="' + (v === 'procede') + '">Procede</button>';
    out += '<button class="v-naoprocede" data-dv="' + dvKey + '" data-set="naoprocede" aria-pressed="' + (v === 'naoprocede') + '">Não procede</button>';
    out += '</div></div>';
  }
  out += '</div>';
  return out;
}

function renderCard(d, order) {
  const v = store.cards[d.chave] || '';
  const card = document.createElement('div');
  card.className = 'card';
  if (v) card.dataset.v = v;
  let html = '';
  html += '<div class="c-top">';
  html += '<span class="rank">#' + order + '</span>';
  html += '<span class="chave">Acórdão ' + esc(d.chave) + '</span>';
  if (d.confianca) html += '<span class="conf-badge">confiança do modelo: ' + esc(d.confianca) + '</span>';
  html += '</div>';
  html += '<p class="assunto">' + esc(d.assunto) + '</p>';
  html += '<div class="metrics">';
  html += '<div class="metric"><span class="n">' + d.contagem.noVoto + '</span><span class="l">No voto</span></div>';
  html += '<div class="metric"><span class="n">' + d.contagem.citantesDistintos + '</span><span class="l">Citantes distintos</span></div>';
  html += '<div class="metric"><span class="n">' + d.contagem.ocorrenciasTotal + '</span><span class="l">Ocorrências totais</span></div>';
  html += '<div class="votobar"><div class="cap"><span>Dos citantes, % no voto</span><b>' + pctNoVoto(d) + '%</b></div>';
  html += '<div class="track"><div class="fill" style="width:' + pctNoVoto(d) + '%"></div></div></div>';
  html += '</div>';

  if (!d.teses || !d.teses.length) {
    html += '<div class="sem-tese-block">';
    html += '<div class="sem-tese-title">Tese não destilada — apoio insuficiente nos trechos</div>';
    html += '<p class="sem-tese-sub">O modelo optou por não fixar uma tese para este caso. Julgue, à luz do assunto acima e do acervo disponível, se foi conservadorismo correto ou falha de extração.</p>';
    html += '</div>';
  } else {
    html += '<div class="tese-wrap">';
    for (let i = 0; i < d.teses.length; i++) {
      html += renderTeseBlock(d.teses[i], i, d.teses.length, d.trechosIndisponiveis);
    }
    html += '</div>';
  }

  html += renderSinais(d);
  html += renderDivergencias(d);

  html += '<div class="c-foot">';
  html += '<div class="seg" role="group" aria-label="Veredito ' + esc(d.chave) + '">';
  html += '<button class="v-fiel" data-c="' + esc(d.chave) + '" data-set="fiel" aria-pressed="' + (v === 'fiel') + '">Tese fiel</button>';
  html += '<button class="v-imprecisa" data-c="' + esc(d.chave) + '" data-set="imprecisa" aria-pressed="' + (v === 'imprecisa') + '">Imprecisa</button>';
  html += '<button class="v-errada" data-c="' + esc(d.chave) + '" data-set="errada" aria-pressed="' + (v === 'errada') + '">Errada</button>';
  html += '</div></div>';

  card.innerHTML = html;
  return card;
}

function render() {
  const list = document.getElementById('list');
  list.innerHTML = '';
  for (let i = 0; i < DATA.length; i++) {
    const d = DATA[i];
    const v = store.cards[d.chave] || '';
    if (filter === 'fiel' && v !== 'fiel') continue;
    if (filter === 'imprecisa' && v !== 'imprecisa') continue;
    if (filter === 'errada' && v !== 'errada') continue;
    if (filter === 'pendente' && v) continue;
    list.appendChild(renderCard(d, i + 1));
  }
  updateTally();
}

function updateTally() {
  const c = { fiel: 0, imprecisa: 0, errada: 0 };
  for (let i = 0; i < DATA.length; i++) {
    const v = store.cards[DATA[i].chave];
    if (v) c[v]++;
  }
  const pend = DATA.length - c.fiel - c.imprecisa - c.errada;
  document.getElementById('tally').innerHTML =
    '<span class="chip fiel"><span class="dot"></span>Fiel <b>' + c.fiel + '</b></span>' +
    '<span class="chip imprecisa"><span class="dot"></span>Imprecisa <b>' + c.imprecisa + '</b></span>' +
    '<span class="chip errada"><span class="dot"></span>Errada <b>' + c.errada + '</b></span>' +
    '<span class="chip">Pendentes <b>' + pend + '</b> / ' + DATA.length + '</span>';
  const n = DATA.length || 1;
  document.getElementById('bar').innerHTML =
    '<span class="s-fiel" style="width:' + (100 * c.fiel / n) + '%"></span>' +
    '<span class="s-imprecisa" style="width:' + (100 * c.imprecisa / n) + '%"></span>' +
    '<span class="s-errada" style="width:' + (100 * c.errada / n) + '%"></span>';
}

document.getElementById('list').addEventListener('click', function (e) {
  const b = e.target.closest('button[data-set]');
  if (!b) return;
  if (b.dataset.c) {
    const ch = b.dataset.c, set = b.dataset.set;
    store.cards[ch] = store.cards[ch] === set ? '' : set;
    if (!store.cards[ch]) delete store.cards[ch];
    save();
    render();
  } else if (b.dataset.dv) {
    const dv = b.dataset.dv, set2 = b.dataset.set;
    store.divs[dv] = store.divs[dv] === set2 ? '' : set2;
    if (!store.divs[dv]) delete store.divs[dv];
    save();
    render();
  }
});

document.getElementById('filters').addEventListener('click', function (e) {
  const b = e.target.closest('button');
  if (!b) return;
  filter = b.dataset.f;
  const kids = document.getElementById('filters').children;
  for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('on', kids[i] === b);
  render();
});

document.getElementById('btnReset').addEventListener('click', function () {
  if (confirm('Limpar todas as marcações?')) {
    store = { cards: {}, divs: {} };
    localStorage.removeItem(KEY);
    render();
  }
});

document.getElementById('btnExport').addEventListener('click', function () {
  let lines = [];
  lines.push('CALIBRAÇÃO DE TESES — Rede de precedentes TCU');
  lines.push('');
  lines.push('VEREDITOS POR CASO:');
  for (let i = 0; i < DATA.length; i++) {
    const d = DATA[i];
    const v = store.cards[d.chave] || '(pendente)';
    lines.push('  Acórdão ' + d.chave + ': ' + v);
  }
  let hasDiv = false;
  const divLines = [];
  for (let i = 0; i < DATA.length; i++) {
    const d = DATA[i];
    for (let j = 0; j < (d.divergencias || []).length; j++) {
      hasDiv = true;
      const key = d.chave + '::' + j;
      const v2 = store.divs[key] || '(pendente)';
      divLines.push('  Acórdão ' + d.chave + ' / divergência ' + (j + 1) + ': ' + v2);
    }
  }
  if (hasDiv) {
    lines.push('');
    lines.push('VEREDITOS POR DIVERGÊNCIA:');
    lines = lines.concat(divLines);
  }
  document.getElementById('exportText').value = lines.join('\\n');
  document.getElementById('dlg').showModal();
});
document.getElementById('btnClose').addEventListener('click', function () { document.getElementById('dlg').close(); });
document.getElementById('btnCopy').addEventListener('click', function () {
  const t = document.getElementById('exportText');
  t.select();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(t.value).then(function () {
      const b = document.getElementById('btnCopy');
      b.textContent = 'Copiado ✓';
      setTimeout(function () { b.textContent = 'Copiar'; }, 1500);
    }).catch(function () { document.execCommand('copy'); });
  } else {
    document.execCommand('copy');
  }
});

document.getElementById('themeTog').addEventListener('click', function () {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : cur === 'light' ? 'dark' : (matchMedia('(prefers-color-scheme:dark)').matches ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', next);
});

render();
</script>`;
}
