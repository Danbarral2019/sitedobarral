# Handoff — conector do STJ, clipping multi-tribunal e material de estudo

**Sessão de 18–19/08/2026.** Versionado de propósito: o ledger de execução fica em `.superpowers/` (gitignored) e não viaja entre máquinas.

**Leia primeiro:** este arquivo. O spec do conector é `docs/superpowers/specs/2026-08-18-conector-stj-espelhos-design.md` — **tem uma Errata no topo** com quatro premissas que caíram durante a execução, e a errata é a parte mais útil dele.

---

## 1. Onde tudo parou

Tudo mergeado em `main`. Nenhuma PR aberta, nenhuma branch pendente.

| PR | o que fez |
|---|---|
| #191 | trunca ementa no e-mail do clipping (limite do Gmail) |
| #192 | troca a fonte do STJ: DataJud → Espelhos de Acórdãos |
| #193 | teto de idade no clipping por `dataJulgamento` |
| #194 | corrige o identificador do acórdão do STJ |

### Em produção

| | |
|---|---:|
| julgados do STJ com ementa real | **396** |
| aprovados (visíveis) | **267** |
| sem `dataJulgamento` | **0** *(o DataJud tinha 254 de 254)* |
| registros do DataJud | 254, preservados e marcados `auto_rejected` |
| clipping | `TCU,TCE-PE,STF,STJ`, com teto de 3 meses |

Suíte: 2.581 → **2.657 testes**.

---

## 2. As três frentes da pauta de 18/08

**(1) STJ — resolvida.** Detalhe na seção 3.

**(2) Clipping multi-tribunal — resolvida.** `CLIPPING_TRIBUNAIS_ENABLED=TCU,TCE-PE,STF,STJ`. TST ficou de fora com motivo medido: de 1.349 registros, **5** tratam de licitação — o resto é direito do trabalho, todos com `relevanceScore` fixo em 100 e 529 sem `dataJulgamento`.

**(3) CNPJ no termo de uso — NÃO INICIADA.** Nada levantado. ⚠️ Antes de executar: o site vende assinaturas (Stripe LIVE) e o **Decreto 7.962/2013 exige CNPJ em destaque** no comércio eletrônico. Perguntar ao Daniel qual é o objetivo real — privacidade do endereço? tirar de páginas públicas mantendo onde a lei exige? O caminho muda conforme a resposta.

---

## 3. O conector do STJ

### Por que a fonte mudou

O DataJud **não estava falhando** — o cron rodava com `success`, a `DATAJUD_API_KEY` estava setada havia 179 dias. O problema era o dado: `datajud.ts:243` montava a `ementa` concatenando capa processual (`"classe - assuntos - órgão. Movimentos: ..."`). Resultado: **0 aprovadas de 254**, escore máximo 28 contra limiar de 55, ementa mediana de 214 caracteres.

Fonte nova: **Espelhos de Acórdãos** do Portal de Dados Abertos do STJ (CKAN), dumps JSON mensais, ementa curada pela Secretaria de Jurisprudência.

### Acesso — diferente do STF

O WAF do STJ **não detecta headless**. Bastam cabeçalhos de navegador (`User-Agent`, `Accept-Language`, `Referer`, `Sec-Fetch-*`) e o conector roda desatendido em cron — ao contrário da coleta manual mensal do STF.

⚠️ **O WAF bloqueia devolvendo HTTP 200** com página de erro de ~1,2 KB. Checar o corpo, não o status. `fetchWithRetry` não repete nesse caso, e está correto assim — retry não vence WAF.
⚠️ `package_show` da API CKAN é rejeitada; usar `package_search?q=name:<slug>`.

### Rendimento

Backfill: 193 dumps, 33.243 espelhos varridos, **694 relevantes (2,0%)**, 396 gravados. Julgados de nov/2021 a jun/2026.

⚠️ **7 dumps de 2022–23 falharam por WAF** e estão listados no spec §9 com a recuperação: `npm run stj:coletar -- --tudo` (idempotente, só cria o que falta).

---

## 4. Os erros que só a execução pegou

Todos passaram por brainstorming, spec, self-review e revisão de código. **Nenhum foi pego por teste unitário.**

**A justificativa principal do conector não existia.** O spec dizia que a amarração artigo↔julgado determinística seria o ganho central, como no STF. Medição: **1 acórdão em 2.497** cita 14.133/8.666/10.520 no campo estruturado. Acórdãos claramente de licitação vêm com o campo vazio. O erro foi extrapolar de "50 de 84 têm `referenciasLegislativas`" sem verificar **quais leis** eram — são CPC, súmulas, Constituição. O ganho real, que se sustenta: **ementa jurídica em vez de capa processual**.

**`/licita/` casava "explicitação".** Sem fronteira de palavra, o vocabulário do recorte pegava *explicitação*, *explicitamente*, *implicitamente* — 29% de falso positivo. Depois, `\blicita` ainda casava *licitamente*. Versão final: `\blicita(?!mente\b)`. A cadeia 4,7% → 3,3% → 2,0% é uma sequência de correções, não perda de cobertura.

**O guard de mojibake acusaria 100% do acervo.** `/Ã[A-Z]/` parecia razoável até lembrar que as ementas do STJ vêm em CAIXA ALTA e "ÃO" é a terminação mais comum do português. Depois de corrigido, ainda acusava **MAGALHÃES** — faltava excluir "ÃES". ⚠️ **Ao mexer nesse guard, use controle positivo**: ele deve continuar detectando os 170 registros do DataJud cujo mojibake é real (`Ô` gravado como `Ã`+`U+0094`). Sem isso, "corrigir" o guard até ele não detectar nada parece sucesso.

**O identificador do acórdão estava errado.** `numeroRegistro` identifica o **processo**, não o julgado — um processo rende REsp, depois AgInt, depois EDcl, todos com o mesmo número. O upsert descartava o segundo em silêncio: 28 perdidos em 1.458 (1,9%). Corrigido para o `id` do espelho. **Apareceu porque o Daniel perguntou se podia confiar nas ementas de um material de estudo** — 10 de 107 divergiam, e não por texto corrompido: era o acórdão errado sob aquele número.

**O cron não sabia gritar.** `coletarStj` capturava todo erro e o convertia em contagem, então `withCronTelemetry` nunca gravaria `failure` — e os alertas do projeto só contam `failure`. Um cron mensal desatendido, inalertável por construção. Corrigido: falha total propaga exceção.

---

## 5. Clipping — a armadilha do `createdAt`

O filtro seleciona por `createdAt`, que responde *"é novidade para nós?"*, não *"ainda é notícia?"*. Em backfill de acervo isso explode: **262 dos 264 julgados do STJ** e **210 do STF** ficariam elegíveis de uma vez, com data de julgamento de 2021 a 2026. O clipping é **diário**.

Teto: `dataJulgamento >= hoje - CLIPPING_MAX_IDADE_MESES` (default **3**). Efeito medido: STJ 262→19, STF 210→11, TCE-PE 26→26, TCU 2→2.

🔴 **NUNCA trocar a janela de `createdAt` por `dataJulgamento`.** É a correção intuitiva e destrutiva: STF e STJ são coletados **uma vez por mês**, o acórdão chega ao banco 30–35 dias depois de julgado e nunca caberia numa janela de 14 dias medida pela data de julgamento. **Os dois sumiriam do clipping.** As duas datas têm papéis distintos e há teste travando isso.

---

## 6. Material de estudo produzido

**Artifact** — *Reequilíbrio no STJ*: https://claude.ai/code/artifact/39bb0e5a-2f44-4615-b507-4a81a85068a2

**Três .docx** em `C:\Users\User\Documents\STJ - Licitacoes\`: Equilíbrio econômico-financeiro (37), Sanções e penalidades (34), Dispensa e inexigibilidade (53). Trazem nota metodológica, teses afirmadas com trecho no período inteiro, e ementas na íntegra.

⚠️ **"Dispensa e inexigibilidade" não foi regravado após a correção do identificador** — estava aberto no Word. Regerar quando fechado.

### O achado que orienta o uso do material

**28 dos 37 acórdãos sobre equilíbrio não decidem o mérito.** As Súmulas 5 e 7 barram o reexame de cláusula e prova, e o STJ mantém o que a origem decidiu. Na prática, a discussão se ganha ou se perde na instância ordinária. Os documentos etiquetam cada acórdão como *tese afirmada*, *mérito na origem* ou *juízo de admissibilidade*, porque citar o segundo grupo como posição do STJ é erro comum.

⚠️ **Ao citar por trecho, cuidado com a condição no fim do período.** Exemplo real: "não se aplica a Teoria da Imprevisão para a recomposição do equilíbrio…" parece afastar o instituto. A frase continua: "**na hipótese de aumento salarial decorrente de dissídio coletivo, pois constitui evento certo**". O que se afasta é a imprevisibilidade do dissídio, não a teoria.

---

## 7. Verificação do documento do STF (compilação de 17/08)

Conferido contra `stf_lei14133_dados_2026-08-16.json`:

| | |
|---|---|
| ementas da Parte I | **9 de 9 idênticas** à fonte |
| metadados | 286 de 290 conferem; as 4 divergências são o mesmo processo com julgados distintos, cada data correta para o seu |
| amarração aos artigos (Parte II) | **145 entradas, 0 erros** |
| resumos (290) | **nenhuma alucinação**; testadas leis, órgãos e entidades citadas |

⚠️ Ao verificar esse JSON: **monocráticas não têm `ementa_texto`** — o texto vive em `decisao_texto`. Comparar contra o campo errado produz 22 falsos positivos de "alucinação".

Os resumos não foram verificados quanto à **interpretação jurídica** — só quanto a não inventarem fatos. Isso é diferente, e exige leitura humana.

---

## 8. Pendências

### Com data
- 🔴 **5 de setembro: primeira execução do cron `sync-stj` em produção.** Todo o backfill rodou da máquina local — **é o primeiro teste do WAF do STJ contra um IP da Vercel**. Se falhar, agora o cron alerta (foi a correção que segurou o merge da #192).

### Sem urgência
- 7 dumps do STJ de 2022–23 perdidos por WAF — recuperáveis com `npm run stj:coletar -- --tudo`
- Regerar o .docx de Dispensa e inexigibilidade
- 264 aprovados do STJ estão **sem `summary`** (o backfill usou `--sem-resumo` para não gastar Gemini) e nada os preencherá
- Guard de mojibake vive só em teste, sem fixture real versionada
- A **cobertura** do recorte nunca foi medida — só a precisão
- Dois `scraperCode` para o mesmo conector (`stj-espelhos` no runner; o cron usa `sync-stj`)
- 211 julgados do STF pendentes de revisão no admin, parados desde 18/08

---

## 9. Como retomar

```bash
git pull

# estado do STJ
npx tsx --env-file=.env.local -e "import {prisma} from '@/lib/prisma'; \
  const t = await prisma.tribunalDecision.count({where:{tribunalCode:'STJ', sourceApi:'stj-espelhos-dados-abertos'}}); \
  const a = await prisma.tribunalDecision.count({where:{tribunalCode:'STJ', sourceApi:'stj-espelhos-dados-abertos', approvalStatus:'auto_approved'}}); \
  console.log({total:t, aprovados:a}); await prisma.\$disconnect();"

# saúde do cron mensal
npx tsx --env-file=.env.local -e "import {prisma} from '@/lib/prisma'; \
  const l = await prisma.scraperHealthLog.findMany({where:{scraperCode:{in:['stj-espelhos','sync-stj']}}, \
  orderBy:{runAt:'desc'},take:3}); console.log(l); await prisma.\$disconnect();"

# o que o clipping enviaria hoje, sem escrever nada
npm run stj:coletar -- --dry-run
```

O `.env.local` não está no git. Máquina nova precisa dele com `DATABASE_URL`, `CRON_SECRET`, `GEMINI_API_KEY` e `ANTHROPIC_API_KEY` — e o `CRON_SECRET` deve vir de `npx vercel env pull`, não de cópia antiga.

⚠️ **`vercel env pull` devolve valor vazio para variável marcada como *sensitive*** — e o CLI marca sensitive por padrão em Production. Vazio no pull **não prova** que a env está vazia. Escrever com `--value '...' --no-sensitive --yes` e **sempre reler para conferir**: o "Overrode Environment Variable" do CLI não é evidência.
