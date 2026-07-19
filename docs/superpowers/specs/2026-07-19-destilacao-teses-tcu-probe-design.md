# Design — Probe de destilação de teses do TCU (Fase 2-A)

**Data:** 2026-07-19
**Status:** aprovado (brainstorming), aguarda plano de implementação
**Antecede:** o sistema de precedentes por teses (Fases 2-B em diante)
**Relacionado:** rede de precedentes do TCU Fase 1 (grafo `AcordaoCitacao`, mergeada `2610ff14`); Fase 2 "importar leading cases" (`2026-07-18-rede-precedentes-tcu-fase2-importar-design.md`) — reposicionada como dependência posterior.

## 1. Contexto e problema

A Fase 1 construiu o grafo de citações do TCU: 16.833 arestas (origem → alvo, com `noVoto` e `ocorrencias`) sobre 1.685 acórdãos com inteiro teor. A wishlist da Fase 2 rankeou os leading cases ausentes por frequência de citação.

**O que o grafo NÃO entrega, e o Daniel exige:** o valor de um sistema de precedentes não está no resumo do acórdão (a ementa descreve o *caso*), mas na **tese que o leading case fixou de maneira inovadora e que passou a orientar os votos posteriores** — a *ratio decidendi*. A folha de curadoria inicial mostrou ementas (resumo do caso) e por isso não deixava a tese identificável.

O objetivo do sistema, nas palavras do Daniel, é uma **visão privilegiada e única do sistema de precedentes do TCU**, com dois diferenciais sobre a própria ferramenta do TCU:
1. **Tese em destaque** — cada precedente apresentado pelo enunciado que fixou, não pelo resumo do processo.
2. **Controle qualitativo, não só popularidade** — se o Acórdão X é o mais citado para um assunto, mas um voto declara que outro acórdão anterior (pouco citado) é o verdadeiro precedente de referência, o sistema **sinaliza a divergência sem anular o dado majoritário**.

### Decisões de produto (fixadas no brainstorming)
- **Unidade central:** dois níveis navegáveis — *assunto → teses do assunto → leading case âncora de cada tese → acórdãos que a citam/divergem*.
- **Fonte da tese:** **híbrida** — destila a tese do próprio acórdão E confirma/refina pelos trechos de citação dos votos posteriores; divergências explícitas quando os votos apontam outro precedente.
- **Autoridade:** contagem de citações **no voto** (contador fidedigno) **+ sinais qualitativos** extraídos dos trechos ("leading case sobre X", "primeira vez que o Tribunal…"), com divergências sinalizadas à parte, sem rebaixar o majoritário.
- **Estratégia:** **probe de qualidade primeiro** — provar que a tese destilada tem qualidade editorial antes de construir schema, tela, importação em escala e classificação de assuntos.

## 2. Objetivo do probe (escopo desta spec)

Provar, com evidência julgável pelo Daniel, que é possível produzir a **tese** de um leading case — a partir do cruzamento entre o próprio acórdão e o uso real nos votos posteriores — com qualidade editorial, e que **sinais qualitativos e divergências** emergem de forma confiável.

**Entregável:** uma folha de calibração (artifact) com um card por leading case, no formato que o Daniel aprovou (card por item, trecho real, veredito 3-vias, resumo que volta). O Daniel julga cada tese; o resultado é **GO/NO-GO** para o sistema completo.

**Não-objetivos (YAGNI deste probe):** persistência em schema; a tela navegável de dois níveis; a importação dos ausentes em escala; a classificação de assuntos em escala. Nada disso entra antes do GO.

## 3. Entrada — 3 leading cases para estressar o motor

1. **1441/2016** (Plenário) — prescrição das sanções do TCU. Tese jurídica pura; 80 citações no voto. Testa destilação de enunciado jurídico abstrato.
2. **2622/2013** (Plenário) — referenciais de BDI. Tese técnica/quantitativa; 21 no voto. Testa tese não-puramente-jurídica.
3. **Par concorrente no mesmo assunto** — dois alvos fortes do grafo que disputam ser o precedente de referência de um tema. Escolhido na execução por consulta ao grafo (dois `numeroAlvo` distintos com muitos citantes em comum de assunto próximo). Testa **hierarquização e detecção de divergência**.

A seleção do par concorrente é uma etapa exploratória do próprio probe (query sobre `AcordaoCitacao`), não um dado fixo — se nenhum par claro emergir, o probe registra isso como achado (a divergência pode ser rara) e segue com um 3º leading case simples.

## 4. Pipeline (tudo offline, sobre o que já está no banco)

Todos os módulos novos vivem em `lib/tcu/` e são puros onde possível (texto → dados), espelhando o padrão da Fase 1.

### 4.1 Capturar trechos de citação — `lib/tcu/trechos-de-citacao.ts` (puro)
Para um alvo `(numero, ano)`:
- Consulta o grafo: `AcordaoCitacao` onde `numeroAlvo/anoAlvo = alvo` → lista de `origemId` citantes (com `noVoto`).
- Para cada citante, carrega `Document.tcuTextoCompleto`, roda `extractAcordaoCitations` (já existe) para achar os `index` das citações ao alvo, e recorta uma **janela de ±400 caracteres** ao redor de cada ocorrência, expandida até fronteira de frase quando possível.
- Marca cada trecho com a seção via `secaoDe(seccionarAcordao(texto), index)` — `voto` vs. resto.
- Retorna `TrechoCitacao[] = { origemChave, secao, noVoto, trecho, offset }`.

Função pura de recorte (`recortarTrechos(texto, alvo)`) separada da que toca o banco (`coletarTrechosDoAlvo(alvo)`), para testar o recorte sem rede.

### 4.2 Agregar o dossiê de uso
Junta todos os trechos de um alvo num "dossiê": prioriza trechos `noVoto`, dedup de trechos quase idênticos (citações boilerplate repetidas), limita ao top-N trechos mais informativos por tamanho/seção para caber no contexto do LLM. Guarda a **contagem fidedigna** separada: nº de citantes distintos, nº no voto, nº total de ocorrências.

### 4.3 Buscar o próprio acórdão — reusar a descoberta da API do TCU
A metade "tese do próprio acórdão" precisa do texto do leading case, que está **ausente** do acervo. Reusa a API pública validada em 2026-07-19:
`POST https://pesquisa.apps.tcu.gov.br/api/publico/entidades/busca` — **`Content-Type: text/plain`, body = `"numero/ano"` cru** (NÃO `application/json`; isso retorna HTTP 415). Resposta `{entidades:[{titulo, subtitulo="Relator: …", texto=ementa, link com KEY:ACORDAO-COMPLETO-NNNN}]}`. Para o probe basta a **ementa**; o inteiro teor (RTF/página) fica para a importação pós-GO. Módulo `lib/tcu/buscar-acordao-tcu.ts` conforme o spec da Fase 2 **corrigido para text/plain**.

### 4.4 Destilar (LLM) — `lib/tcu/destilar-tese.ts`
Um prompt recebe, por leading case:
- (a) ementa do próprio acórdão (da 4.3), e
- (b) o dossiê de uso (trechos dos votos posteriores, da 4.2).

E retorna **JSON estruturado validado** (schema forçado):
```
{
  chave, // "1441/2016"
  assunto,               // tema jurídico sob o qual a tese vive
  teses: [               // 1+ enunciados que o acórdão fixou
    { enunciado,         // linguagem de súmula
      inovacao,          // o que fixou de novo / por que é leading
      trechosFonte: []   // índices dos trechos do dossiê que sustentam
    }
  ],
  sinaisQualitativos: [  // votos que o tratam como seminal/paradigmático
    { origemChave, trecho, tipo } // tipo: "seminal" | "leading" | "primeira-vez" | ...
  ],
  divergencias: [        // votos que apontam OUTRO precedente como referência
    { origemChave, precedenteApontado, trecho, natureza }
  ],
  confianca             // auto-avaliação do modelo p/ triagem na folha
}
```
Modelo: o que o projeto já usa para síntese jurídica (Claude Sonnet 5 via a infra existente de `lib/`). O prompt é **conservador**: instrui a NÃO inventar tese quando os trechos não a sustentam (retornar `teses: []` com justificativa), e a só reportar divergência com trecho literal de apoio — evita o "plausível mas errado".

### 4.5 Folha de calibração — artifact
Um card por leading case, com:
- **Tese em destaque** (enunciado + o que inovou), tipograficamente dominante.
- **Contador fidedigno:** citado no voto / total de citantes distintos.
- **Trechos-fonte reais** que sustentam a tese (do dossiê, não parafraseados).
- **Sinais qualitativos** detectados (com o trecho literal).
- **Divergências** (com o trecho e o precedente apontado).
- **Veredito 3-vias** por card: *tese fiel / imprecisa / errada* — e, para as divergências, *procede / não procede*.
- Resumo no topo que consolida o julgamento para devolver ao Claude.

Formato conforme `feedback-formato-golden-julgamento`: card por item, trecho real, veredito 3-vias, resumo que volta.

## 5. Critério de sucesso (GO/NO-GO)

- **GO** se, no julgamento do Daniel, a **maioria das teses sai fiel** (enunciado correto e reconhecível como a *ratio* do acórdão) E pelo menos uma **divergência real** é detectada com trecho de apoio válido (ou, se não houver divergência nos casos escolhidos, o probe demonstra que o motor a detectaria — registrando ausência, não falso positivo).
- **NO-GO / iterar** se as teses saem genéricas (ementa reembalada), imprecisas, ou se há alucinação de divergência.

O probe também mede, como subproduto: quão informativos são os trechos de citação (o dossiê de uso realmente carrega a tese?), e a taxa de leading cases sem citantes suficientes no acervo para a metade "uso" do híbrido.

## 6. Componentes e limites (para o plano)

| Módulo | Tipo | Responsabilidade | Depende de |
|---|---|---|---|
| `lib/tcu/trechos-de-citacao.ts` | puro + acesso a dados | recortar/coletar trechos de citação de um alvo | `extractAcordaoCitations`, `seccionarAcordao`/`secaoDe`, `AcordaoCitacao`, `Document.tcuTextoCompleto` |
| `lib/tcu/buscar-acordao-tcu.ts` | rede | resolver número→ementa/metadados via API TCU (text/plain) | API pública TCU |
| `lib/tcu/destilar-tese.ts` | LLM | dossiê+ementa → tese/assunto/sinais/divergências (JSON validado) | infra LLM existente |
| `scripts/probe-teses-tcu.ts` | orquestração | roda os 3 casos, emite JSON + dados p/ a folha | os módulos acima |
| folha de calibração | artifact | julgamento humano 3-vias | saída do script |

Testes: unidades puras (`recortarTrechos`, dedup do dossiê, parse da resposta do LLM) com casos sintéticos; smoke real de 1 chamada à API TCU e 1 destilação. Sem novo schema, sem migração.

## 7. Riscos

- **Trechos boilerplate:** muitas citações são de rotina ("no mesmo sentido, Acórdãos X, Y, Z") e não carregam tese. Mitigação: priorizar trechos no voto e mais longos; o LLM instruído a distinguir uso substancial de menção ornamental (mesma lição de `feedback_audit_warnings`/princípios ornamentais vs. substanciais).
- **Ementa não basta para a metade "próprio acórdão":** se a ementa for pobre, a tese apoia-se mais no uso. Aceitável no probe; a importação do inteiro teor (pós-GO) fecha isso.
- **Divergência rara:** pode não aparecer nos casos escolhidos. Tratada como achado, não falha (ver §4.3/§5).
- **Custo LLM:** 3 casos é barato; o objetivo é justamente medir qualidade antes de escalar para dezenas.
