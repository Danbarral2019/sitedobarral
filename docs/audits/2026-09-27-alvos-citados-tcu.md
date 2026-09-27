# Acórdãos do TCU que só existiam como citação: carga de 27/09/2026 (PARCIAL)

Execução do `docs/HANDOFF-2026-09-27-nuvem-alvos-citados-tcu.md` com
`scripts/ingerir-alvos-citados-tcu.ts` (PR #229, mergeada). Sem IA; nada excluído.

**Situação: interrompida, não concluída.** Às 19h de 27/09/2026 o Neon passou a recusar a
senha da `DATABASE_URL` do ambiente da nuvem (`P1000 AuthenticationFailed`). O estado está
todo no banco, então a carga retoma de onde parou assim que houver credencial válida:

```
npx tsx scripts/ingerir-alvos-citados-tcu.ts --execute --limite=300   # repetir até "fim determinístico"
```

O cursor (`BackfillCursor` `alvos-citados-tcu`) estava no offset 95.000 do feed de dados
abertos (datas de 2022). O último lote parou antes por timeout da busca do TCU em 3200/2022,
que é transitório e não avança o cursor.

## Números (piloto + 4 lotes)

| Situação | Quantidade |
|---|---|
| Alvos pendentes no início (≥2 citações no voto, sem Document, sem tese) | 3.606 |
| Ingeridos com inteiro teor | 643 |
| por identidade oficial única | 487 |
| por convergência unânime dos citantes | 155 |
| Falhas permanentes de download/extração | 38 |
| Ambíguos (não ingeridos) | 106 |
| Não encontrados (em todos, o TCU só tem acórdão de relação) | 142 |
| Ainda pendentes | 2.677 |

Tamanho médio do texto: 60.035 caracteres. Tempo médio por acórdão: ~8 s.

Distribuição por ano dos ingeridos: 2022: 172 · 2023: 433 · 2024: 30 · 2025: 8. A carga anda
do mais recente para o mais antigo, porque o link do RTF só existe no feed de dados abertos,
que é ordenado por data e não filtra por número. Os leading cases de 2005 a 2021 ainda não
foram alcançados.

Todos entraram como `acordao-grafo`, `isPublic: false`, `reviewedBy: 'alvos-citados-tcu'` e
`embeddingStatus: 'skipped'` (fora da fila de embeddings), sem promoção a acervo público.

## Falhas permanentes

31 são RTFs acima do teto de 20 MB (de 23 MB a 375 MB), 6 estouram a pilha do `rtf-parser`
e 1 tem codificação `SYMBOL` não reconhecida. Quase todas são do Plenário, que concentra os
acórdãos mais relevantes. Os arquivos gigantes provavelmente carregam imagens embutidas
(`\pict`), o que não foi medido. **Próximo passo sugerido:** um extrator que descarte os
grupos de imagem do RTF em fluxo, antes do parser, resolveria as duas causas sem subir o teto.

| Acórdão | Colegiado | Erro |
|---|---|---|
| 1675/2022 | Plenário | extração RTF: Maximum call stack size exceeded |
| 2185/2022 | Plenário | excede o teto: 35034991 bytes |
| 2534/2022 | Plenário | excede o teto: 27208960 bytes |
| 2535/2022 | Plenário | excede o teto: 97732470 bytes |
| 2609/2022 | Plenário | excede o teto: 79431486 bytes |
| 7748/2022 | Primeira Câmara | excede o teto: 45808985 bytes |
| 158/2023 | Plenário | excede o teto: 75808301 bytes |
| 229/2023 | Plenário | extração RTF: Encoding not recognized: 'SYMBOL' (searched as: 'symbol') |
| 237/2023 | Plenário | excede o teto: 69401188 bytes |
| 395/2023 | Plenário | excede o teto: 45450296 bytes |
| 516/2023 | Plenário | excede o teto: 46475558 bytes |
| 651/2023 | Plenário | excede o teto: 45926579 bytes |
| 664/2023 | Plenário | extração RTF: Maximum call stack size exceeded |
| 717/2023 | Plenário | excede o teto: 24757573 bytes |
| 789/2023 | Plenário | excede o teto: 35191146 bytes |
| 995/2023 | Plenário | excede o teto: 70462759 bytes |
| 1126/2023 | Plenário | excede o teto: 374562935 bytes |
| 1142/2023 | Plenário | excede o teto: 66601897 bytes |
| 1303/2023 | Plenário | excede o teto: 68720446 bytes |
| 1408/2023 | Plenário | excede o teto: 27812897 bytes |
| 1533/2023 | Plenário | excede o teto: 24227425 bytes |
| 1576/2023 | Plenário | extração RTF: Maximum call stack size exceeded |
| 1581/2023 | Plenário | excede o teto: 31044972 bytes |
| 1679/2023 | Plenário | excede o teto: 25252763 bytes |
| 2015/2023 | Plenário | excede o teto: 24054859 bytes |
| 2165/2023 | Plenário | excede o teto: 32109071 bytes |
| 2207/2023 | Plenário | excede o teto: 73508022 bytes |
| 2342/2023 | Plenário | excede o teto: 94049960 bytes |
| 2353/2023 | Plenário | excede o teto: 25661617 bytes |
| 2364/2023 | Plenário | excede o teto: 58762912 bytes |
| 2467/2023 | Plenário | excede o teto: 99026840 bytes |
| 2478/2023 | Plenário | excede o teto: 23762496 bytes |
| 4376/2023 | Primeira Câmara | extração RTF: Maximum call stack size exceeded |
| 5215/2023 | Segunda Câmara | extração RTF: Maximum call stack size exceeded |
| 5561/2023 | Segunda Câmara | extração RTF: Maximum call stack size exceeded |
| 13047/2023 | Primeira Câmara | excede o teto: 24814413 bytes |
| 1830/2024 | Plenário | excede o teto: 59689393 bytes |
| 1835/2024 | Plenário | excede o teto: 63057805 bytes |

## Ambíguos

O mesmo número existe em mais de um colegiado no ano, e os acórdãos que o citam não
convergem por unanimidade para um deles (regra do handoff: na dúvida, não ingerir).
Registrados em `AlvoIdentidadeIrresolvida`. Desempatar por maioria dos citantes, ou pelo
contexto da citação, é decisão a tomar.

11265/2023, 11264/2023, 11254/2023, 11252/2023, 11249/2023, 10695/2023, 2261/2023, 2163/2023, 2150/2023, 10027/2023, 10001/2023, 9990/2023, 2135/2023, 2134/2023, 2073/2023, 2062/2023, 9659/2023, 9651/2023, 9648/2023, 9646/2023, 9644/2023, 9614/2023, 9612/2023, 9609/2023, 2019/2023, 2012/2023, 1965/2023, 1963/2023, 9376/2023, 9369/2023, 1918/2023, 1917/2023, 1911/2023, 1907/2023, 1798/2023, 1757/2023, 1745/2023, 1695/2023, 1694/2023, 1615/2023, 1613/2023, 1608/2023, 1601/2023, 7031/2023, 1419/2023, 1407/2023, 1406/2023, 1268/2023, 1267/2023, 1228/2023, 1222/2023, 1218/2023, 1215/2023, 1140/2023, 1135/2023, 1130/2023, 3138/2023, 3137/2023, 747/2023, 716/2023, 2557/2023, 2549/2023, 324/2023, 314/2023, 310/2023, 26/2023, 15/2023, 9/2023, 2798/2022, 2764/2022, 2725/2022, 2710/2022, 2707/2022, 2699/2022, 2698/2022, 2639/2022, 2632/2022, 2625/2022, 7859/2022, 2517/2022, 7044/2022, 2473/2022, 2315/2022, 2292/2022, 2289/2022, 2181/2022, 2178/2022, 2173/2022, 2140/2022, 6002/2022, 5996/2022, 2104/2022, 2093/2022, 2062/2022, 2058/2022, 4784/2022, 4540/2022, 4528/2022, 1899/2022, 1774/2022, 1768/2022, 1724/2022, 1722/2022, 1714/2022, 1707/2022, 3227/2022

## Não encontrados

Para esses números o TCU só publica acórdão de relação, que o handoff manda preterir.
Registrados em `AlvoIdentidadeIrresolvida` como `naoEncontrado`.

157/2025, 148/2025, 87/2025, 2574/2024, 10318/2024, 10197/2024, 8257/2024, 9804/2024, 9750/2024, 2300/2024, 2288/2024, 9637/2024, 9599/2024, 2264/2024, 2166/2024, 8873/2024, 8790/2024, 7028/2024, 6941/2024, 2020/2024, 2018/2024, 1906/2024, 1814/2024, 1805/2024, 6370/2024, 1624/2024, 4745/2024, 1408/2024, 3874/2024, 3777/2024, 1146/2024, 1140/2024, 3237/2024, 3009/2024, 3004/2024, 845/2024, 779/2024, 2769/2024, 695/2024, 551/2024, 546/2024, 501/2024, 474/2024, 194/2024, 172/2024, 2673/2023, 2649/2023, 2646/2023, 2641/2023, 2612/2023, 2603/2023, 2594/2023, 11625/2023, 11587/2023, 11555/2023, 11313/2023, 11203/2023, 11172/2023, 11124/2023, 12873/2023, 12318/2023, 10586/2023, 12088/2023, 11955/2023, 9679/2023, 9593/2023, 9423/2023, 9422/2023, 1844/2023, 9142/2023, 9073/2023, 8876/2023, 8873/2023, 8857/2023, 8833/2023, 8551/2023, 8512/2023, 8262/2023, 1564/2023, 1521/2023, 7382/2023, 6884/2023, 6671/2023, 6522/2023, 1347/2023, 1345/2023, 1343/2023, 1329/2023, 1326/2023, 1322/2023, 6119/2023, 5783/2023, 1297/2023, 4814/2023, 4452/2023, 4329/2023, 1075/2023, 1068/2023, 1064/2023, 3870/2023, 3772/2023, 3766/2023, 3760/2023, 965/2023, 884/2023, 3426/2023, 3351/2023, 3233/2023, 3231/2023, 786/2023, 555/2023, 404/2023, 399/2023, 364/2023, 336/2023, 8717/2022, 8597/2022, 9919/2022, 9740/2022, 8996/2022, 7272/2022, 7155/2022, 7137/2022, 7133/2022, 7092/2022, 5149/2022, 4637/2022, 1867/2022, 3858/2022, 3643/2022, 86/2026, 6909/2025, 2424/2025, 6183/2025, 6180/2025, 5624/2025, 5025/2025, 4909/2025, 3413/2025, 1156/2025, 774/2025, 496/2025

## Pendente

1. Retomar a carga até o fim determinístico (feed abaixo do ano do alvo mais antigo).
2. `npx tsx scripts/backfill-precedentes-tcu.ts --execute`: arestas dos acórdãos novos (sem rede, sem IA).
3. Classificação por matéria, autorizada pelo Daniel em 27/09/2026:
   `scripts/classificar-temas-acordaos-tcu.ts --min-no-voto=2`. Usa `generate('enhancement')`,
   ou seja, Claude Sonnet 5 por padrão, e exige `ANTHROPIC_API_KEY` (ou
   `AI_ENHANCEMENT_PROVIDER=gemini` com `GEMINI_API_KEY`). Estimativa antes do fim da carga:
   ~2.700 a 2.900 alvos, ~115 chamadas de 25, US$ 5 a 10 (não medido com contagem de tokens).
   O script para no primeiro erro de cota, gasto ou credencial.
4. Embeddings e destilação de teses: **não autorizados**. Trazer volume e estimativa de custo
   ao Daniel antes. Religar a fila de embeddings é trocar `embeddingStatus` de `skipped` para
   `pending` nos documentos com `reviewedBy = 'alvos-citados-tcu'`.
