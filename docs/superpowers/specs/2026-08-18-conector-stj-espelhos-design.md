# Conector do STJ pelos Espelhos de Acórdãos — design

**Data:** 2026-08-18
**Substitui:** o conector DataJud (`lib/tribunal-scrapers/datajud.ts`), que permanece no repo marcado como aposentado.

---

## 1. Por que trocar a fonte

O conector atual do STJ funciona e é inútil. Medido em 18/08/2026 contra produção:

| | |
|---|---:|
| decisões do STJ em `TribunalDecision` | 254 |
| **aprovadas** | **0** |
| `pending` | 15 (escore máximo **28**; o limiar é 55) |
| `auto_rejected` | 239 (escore médio 6,6) |
| sem `dataJulgamento` | **254 de 254** |
| sem `summary` | **254 de 254** |
| ementa — mediana | 214 caracteres |

O cron **não** está falhando: `ScraperHealthLog` registra `2026-08-17 success found=20 new=19`, e a `DATAJUD_API_KEY` existe na Vercel há 179 dias. A hipótese de falha silenciosa, levantada na pauta de retomada, foi verificada e descartada.

A causa é o dado. `datajud.ts:243` monta o campo `ementa` concatenando metadados de capa processual:

```
"Agravo em Recurso Especial - Concorrência, Contrato Administrativo -
 PRESIDÊNCIA. Movimentos: Distribuição; Conclusão; Recebimento"
```

Isso é rastreamento processual, não conteúdo decisório. O escore de relevância acaba medindo a **etiqueta de assunto do CNJ**, não a tese julgada — o `+10: "concorrência"; +10: "contrato"` vem do campo `assuntos`. Nenhum ajuste de limiar corrige isso, e baixá-lo repetiria um erro já registrado no projeto: nunca compensar fonte ruim afrouxando o corte.

Defeito colateral do conector atual: os registros gravados têm **mojibake** — `RICARDO VILLAS BÃAS CUEVA`, `PRESIDÃNCIA`, `NÃCLEO`.

## 2. A fonte nova

O STJ publica **Espelhos de acórdãos** no Portal de Dados Abertos (CKAN), um dataset por órgão julgador, em dumps **JSON mensais**, com ~52 meses de histórico. São os acórdãos que a Secretaria de Jurisprudência do STJ trata tecnicamente — jurisprudência curada.

Conferido no dump de junho/2026 da Primeira Seção (84 registros):

| campo | cobertura | observação |
|---|---|---|
| `ementa` | 84/84 | mediana 1.457 caracteres, máximo 11.831 |
| `dataDecisao` | 84/84 | formato `AAAAMMDD` |
| `referenciasLegislativas` | 50/84 | estruturado |
| `tema` | 43/84 | |
| `teseJuridica` | 8/84 | |

Também vêm `ministroRelator`, `nomeOrgaoJulgador`, `siglaClasse`, `numeroRegistro`, `decisao` (dispositivo), `jurisprudenciaCitada` e `acordaosSimilares`.

> ## ⚠️ Errata de 18/08, posterior à aprovação — leia antes do resto
>
> Três premissas deste spec caíram quando o código da Task 2 rodou contra os dumps reais. O texto abaixo foi mantido como estava e corrigido aqui, para o erro não se perder:
>
> **1. A amarração determinística à Lei 14.133 não existe no STJ.** Este spec a deu como justificativa principal do conector. Medição: **1 acórdão em 2.497** cita 14.133/8.666/10.520 em `referenciasLegislativas`. Acórdãos inequivocamente de licitação vêm com o campo **vazio** — ex. `AREsp 202303185934` ("AÇÃO POPULAR. LICITAÇÃO. CONTRATAÇÃO DE EMPRESA… PROIBIÇÃO DE LICITAR"). O erro foi extrapolar de "50 de 84 têm `referenciasLegislativas`" sem verificar **quais leis** eram: são CPC, súmulas e Constituição. A regra de auto-aprovação por amarração continua no código, mas é praticamente inerte aqui — ao contrário do STF, onde rendeu 114 amarrações em 600 julgados.
>
> **2. O rendimento de 4,7% estava inflado.** O vocabulário usava `/licita/` sem fronteira de palavra, que casa dentro de *explicitação*, *explicitamente* e *implicitamente*. Eram **33 falsos positivos em 115** — 29% do recorte. Com `\b` antes de cada termo, o rendimento real é **3,3%**, projetando ~1.400 julgados e não ~2.000. O termo `inexigibilidade` também era ambíguo (casava "ação declaratória de inexigibilidade de débito") e passou a exigir o contexto: `inexigibilidade de licitação`.
>
> **3. O ganho real é outro, e se sustenta.** Não é a amarração — é ter **ementa jurídica em vez de capa processual**. Medido com o classificador real sobre 614 espelhos da Segunda Turma: **9 auto-aprovados, 16 pendentes, 8 rejeitados** entre os 33 relevantes. Contra **0 aprovados em 254** do DataJud. A troca de fonte continua justificada.
>
> **Decisão do Daniel decorrente da errata:** julgado que o classificador deixe em `pending` **não é persistido**. Só entram `auto_approved` e `auto_rejected`. Sem isso o backfill despejaria ~680 itens numa fila de revisão que já tem 211 do STF parados. A zona cinzenta é recuperável depois — os dumps continuam publicados.

O formato das referências legislativas é o ponto decisivo:

```
LEG:FED LEI:013105 ANO:2015
 *****  CPC-15    CÓDIGO DE PROCESSO CIVIL DE 2015
        ART:00967
```

É o mesmo padrão do campo `documental_legislacao_citada_texto` do STF que rendeu as 114 amarrações artigo↔julgado determinísticas — **sem LLM e sem heurística de proximidade**. Muda apenas o separador: `:` no STJ, `-` no STF.

### Acesso

Diferente do STF, o STJ **não bloqueia cliente headless**. Medido na mesma máquina:

| requisição | resultado |
|---|---|
| `curl` com `User-Agent` simples | **rejeitado** pelo WAF (F5, 1.193 bytes de página de erro) |
| `curl` com cabeçalhos completos de navegador | **200** com o JSON íntegro |

Bastam `User-Agent`, `Accept`, `Accept-Language`, `Referer` e os `Sec-Fetch-*`. Não há desafio JavaScript nem exigência de janela visível. **Consequência: o conector roda desatendido em cron**, ao contrário da coleta manual mensal do STF.

Ressalva registrada: a API CKAN é irregular. `package_show` é rejeitada pelo WAF; `package_search?q=name:<slug>` passa. O catálogo usa `package_search`.

## 3. Escopo

**Órgãos coletados** (decisão de 18/08): Corte Especial, Primeira Seção, Primeira Turma, Segunda Turma — onde o STJ julga direito público. Ficam de fora Segunda Seção e Terceira/Quarta Turma (direito privado) e Terceira Seção e Quinta/Sexta Turma (penal, incluindo os crimes licitatórios do art. 337-E do CP).

**Histórico:** completo, os ~52 dumps mensais de cada órgão.

**Rendimento medido** — 12 dumps amostrados, 3 por órgão:

| dataset | acórdãos | relevantes | % |
|---|---:|---:|---:|
| Corte Especial | 257 | 18 | 7,0% |
| Primeira Seção | 310 | 21 | 6,8% |
| Primeira Turma | 1.316 | 37 | 2,8% |
| Segunda Turma | 614 | 41 | 6,7% |
| **total** | **2.497** | **117** | **4,7%** |

Projeção para 4 órgãos × 52 meses (208 dumps): **~43 mil acórdãos varridos, ~2.000 julgados de licitação persistidos** — mais de três vezes o acervo do STF.

**Filtro de ingestão:** só entra em `TribunalDecision` o que passa no recorte temático. O acervo bruto não é armazenado. Isso evita repetir o caso do TST, que tem 1.349 registros no banco dos quais 5 tratam de licitação.

**Critério do recorte**, explícito para não ficar a cargo da implementação — o espelho entra se satisfizer **qualquer** das duas condições:

1. `referenciasLegislativas` cita a Lei 14.133/2021, a 8.666/1993 ou a 10.520/2002 (`LEI:014133`, `LEI:008666`, `LEI:010520`); **ou**
2. `ementa` ou `teseJuridica` casa o vocabulário de licitações, **cada termo ancorado em fronteira de palavra (`\b`)**: *licita…*, *contrato administrativo*, *pregão*, *dispensa de licitação*, ***inexigibilidade de licitação***, *concorrência pública*, *tomada de preços*, *contratação pública*.

A condição 1 não passa por texto livre, mas — ver Errata — dispara em 1 de 2.497 acórdãos: na prática quem seleciona é a condição 2. A âncora `\b` não é detalhe de estilo: sem ela `licita` casa dentro de *explicitação* e *implicitamente*, o que respondia por 29% do recorte. E `inexigibilidade` isolado casa "ação declaratória de inexigibilidade de débito", alheia ao tema.

**Persistência restrita a veredito definido:** o espelho que passa no recorte é classificado por `classifyDecision`, e só é gravado se o resultado for `auto_approved` ou `auto_rejected`. `pending` é descartado — decisão do Daniel em 18/08, para o backfill não criar ~680 itens de fila de revisão sobre os 211 do STF já parados.

## 4. Arquitetura

Módulo `lib/stj/`, espelhando a divisão de `lib/stf/` — o padrão mais bem fatiado do repositório e validado na sessão de 16-18/08.

| arquivo | responsabilidade | depende de |
|---|---|---|
| `constantes.ts` | slugs dos 4 datasets, vocabulário do recorte | — |
| `types.ts` | shape do espelho como o STJ publica | — |
| `catalogo.ts` | lista os dumps JSON de um dataset via CKAN | `consulta` |
| `consulta.ts` | baixa uma URL com os cabeçalhos que vencem o WAF | — |
| `recorte.ts` | decide se um espelho entra | `constantes` |
| `normalizar.ts` | espelho → shape de `TribunalDecision` | `legislacao-citada` |
| `persistir.ts` | upsert idempotente + saúde do scraper | `prisma`, `classifier` |

Entrada: `scripts/stj-runner.ts`, exposto como `npm run stj:coletar`, e cron `/api/cron/sync-stj` **mensal** — a cadência dos dumps. Rodar semanalmente não traria nada.

O conector **não** entra no registry `lib/tribunal-scrapers/index.ts`. Aquele registry serve os scrapers de portal (TCEs); o STJ segue o padrão de módulo dedicado do STF.

### Parser de legislação citada — compartilhado

`lib/stf/legislacao-citada.ts` (49 linhas) casa `LEI-014133` e `ART-00075`. O STJ traz `LEI:014133` e `ART:00075`. Em vez de duplicar, o parser é extraído para `lib/jurisprudencia/legislacao-citada.ts`, com o separador generalizado para `[-:]`, e `lib/stf/` passa a reexportar de lá.

O STF está em produção e estabilizado há dois dias, então a extração é precedida de **testes de caracterização** sobre o comportamento atual do parser do STF, escritos antes de mover o código. Nenhum comportamento do STF pode mudar.

### Fluxo de dados

```
CKAN package_search (por dataset)
   └─> lista de dumps JSON mensais
        └─> consulta.baixar(url)             # cabeçalhos de navegador
             └─> recorte.entra?(espelho)      # filtro temático
                  └─> normalizar(espelho)     # + extrairArtigos14133
                       └─> classifyDecision(…, useAI = false)
                            └─> persistir     # upsert por fullIdentifier
```

`classifyDecision` nunca chama LLM (`useAI = false` é o default), então o backfill dos 208 dumps não tem custo de inferência.

### Aprovação

Mesma regra de produto adotada no STF: espelho com `artigos14133.length > 0` é **auto-aprovado**, independentemente do escore de palavra-chave. A referência legislativa publicada pelo tribunal é fonte autoritativa; o escore é aproximação. Os demais seguem o classificador comum e caem na fila de revisão do admin.

### Idempotência e incremento

`fullIdentifier = stj-acordao-<numeroRegistro>`. O `numeroRegistro` é o número de registro do STJ (ex.: `202402187409`), estável e único por acórdão.

O runner reprocessa sempre os **dois dumps mais recentes** de cada órgão. Como o upsert é idempotente, isso dispensa cursor de estado persistido e cobre a republicação de um mês já baixado — situação real, já que os dumps são revisados após a publicação inicial.

### Erros

Falha ao baixar ou parsear um dump não aborta os demais: o erro é acumulado e o resultado vira `partial_failure` em `ScraperHealthLog`, com `scraperCode = 'stj-espelhos'`. Só falha total (nenhum dump lido) vira `failure`.

## 5. Legado do DataJud

- Os **254 registros existentes não são apagados** — regra permanente do projeto. Recebem `approvalStatus = 'auto_rejected'` e saem da listagem e da busca.
- O cron `sync-datajud` é removido do `vercel.json`.
- `lib/tribunal-scrapers/datajud.ts` permanece no repositório com um comentário de cabeçalho registrando por que foi aposentado, e sai do registry.
- A env `DATAJUD_API_KEY` **não** é removida: a API do DataJud cobre outros tribunais e pode servir a outra frente.

## 6. Testes

Fixtures são dumps reais já baixados, reduzidos, versionados em `lib/stj/__tests__/fixtures/`.

| teste | o que trava |
|---|---|
| caracterização do parser do STF | comportamento idêntico antes e depois da extração |
| `legislacao-citada` com ambos separadores | `LEI-014133` e `LEI:014133` rendem os mesmos artigos |
| `recorte` | espelho de licitação entra; espelho tributário fica fora |
| `normalizar` — datas | `dataDecisao: "20260519"` vira `Date` correta, não `Invalid Date` |
| `normalizar` — mojibake | o texto normalizado não casa o detector de UTF-8-lido-como-Latin-1, e o detector reconhece as strings reais que o DataJud gravou |
| `persistir` — idempotência | processar o mesmo dump duas vezes não cria segundo registro |
| `persistir` — auto-aprovação | espelho com artigo da 14.133 nasce aprovado mesmo com escore baixo |

O guard de mojibake existe porque é exatamente o defeito que corrompeu os nomes dos ministros no conector atual, e passaria despercebido sem verificação explícita.

⚠️ **O primeiro guard que este spec propôs estava errado** e só falhou ao rodar. Era `/Ã[A-Z]/`, descrito como "a assinatura de UTF-8 lido como Latin-1". Em texto maiúsculo português, porém, `ÃO` é a terminação mais comum que existe — FALCÃO, LICITAÇÃO, PREGÃO, SEÇÃO, DECISÃO — e as ementas do STJ vêm em caixa alta. Medido: **4 falsos positivos em 4 amostras legítimas**, ou seja, o guard acusaria todas as ementas do acervo. O detector correto combina o caractere de substituição `U+FFFD`, `Ã` seguido de maiúscula que não seja `O` nem `S`, e as sequências clássicas em caixa baixa (`Ã©`, `Ã¡`, `Ã§`…). Um guard que dispara em tudo é tão inútil quanto um que nunca dispara — e este teria sido "corrigido" desligando-o.

## 7. Fora de escopo

- Nenhuma tela nova de admin: os pendentes caem na fila de revisão que já existe.
- Nada na busca além da indexação que o cron de embeddings já faz.
- **O STJ não entra no clipping nesta leva.** Pelo mesmo motivo do STF: `createdAt` é data de ingestão, e um backfill de ~2.000 registros os tornaria todos elegíveis de uma vez, despejando julgados antigos como se fossem do dia. Fica para depois que o acervo assentar.
- Segunda e Terceira Seção, e as Turmas de direito privado e penal.

## 8. Riscos

| risco | mitigação |
|---|---|
| WAF do STJ endurece e passa a exigir navegador | cabeçalhos centralizados em `consulta.ts`; se cair, o caminho já mapeado no STF (Chromium headed) se aplica |
| dump republicado com conteúdo alterado | upsert por `fullIdentifier` atualiza; reprocessamento dos 2 últimos meses cobre |
| recorte temático largo demais | rendimento medido em 4,7%; desvio grande é sinal de regex frouxa, verificável contra os 2.497 amostrados |
| extração do parser regride o STF | testes de caracterização escritos antes do movimento |
