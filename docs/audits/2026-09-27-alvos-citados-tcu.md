# Acórdãos do TCU que só existiam como citação: carga de 27 a 29/09/2026

Execução do `docs/HANDOFF-2026-09-27-nuvem-alvos-citados-tcu.md` com
`scripts/ingerir-alvos-citados-tcu.ts` (PR #229, mergeada). Sem IA; nada excluído.

**Situação: primeira passada concluída.** A carga começou em 27/09/2026, parou às 19h pela
recusa da senha antiga da `DATABASE_URL` (`P1000`) e foi retomada em 28/09/2026 com a
credencial nova. Rodou 27 lotes até o feed de dados abertos se esgotar (página vazia no
offset 540.000; o feed tem cerca de 535.120 itens). O script não imprimiu "fim
determinístico" porque os alvos que restaram não aparecem no feed; o laço parou pela regra
de 3 lotes seguidos sem avanço. O cursor (`BackfillCursor` `alvos-citados-tcu`) ficou em
540.000, com `concluido: false`.

## Números finais

| Situação | Até 27/09 | 28-29/09 | Total |
|---|---|---|---|
| Ingeridos com inteiro teor | 643 | 2.103 | 2.746 |
| Falhas de download/extração (tentativas esgotadas) | 38 | 315 | 353 |
| Ambíguos (não ingeridos) | 106 | 235 | 341 |
| Não encontrados (o TCU só tem acórdão de relação) | 142 | 78 | 220 |

O total de documentos com `reviewedBy = 'alvos-citados-tcu'` é 3.099 (2.746 com texto e 353
sem). Tamanho médio do texto: 74.456 caracteres. Salvaguardas conferidas no banco em
29/09/2026: os 3.099 estão com `isPublic: false` e `embeddingStatus: 'skipped'`; nenhum foi
promovido. A tabela `AlvoIdentidadeIrresolvida` tem 378 ambíguos e 224 não encontrados no
total, porque guarda também vereditos anteriores a esta carga (desde 08/09/2026).

Distribuição por ano dos 2.746 ingeridos com texto:

| Ano | Ingeridos | | Ano | Ingeridos |
|---|---|---|---|---|
| 2009 | 46 | | 2018 | 189 |
| 2010 | 69 | | 2019 | 234 |
| 2011 | 78 | | 2020 | 288 |
| 2012 | 56 | | 2021 | 258 |
| 2013 | 99 | | 2022 | 319 |
| 2014 | 129 | | 2023 | 433 |
| 2015 | 173 | | 2024 | 30 |
| 2016 | 154 | | 2025 | 8 |
| 2017 | 183 | | | |

Nenhum acórdão de 1994 a 2008 entrou com texto: ver "Falhas", abaixo.

## Pendentes

Ao fim da carga restavam 195 alvos. Só 55 deles estavam na lista original; os outros 140
surgiram durante a própria carga, porque cada acórdão catalogado grava as citações que faz,
e alguns números passaram a ter 2 ou mais citações no voto depois que o cursor já havia
passado pelo ano deles. Distribuição dos 195 por ano: 1999: 1 · 2000: 1 · 2003: 3 · 2005: 3 ·
2006: 5 · 2007: 7 · 2008: 16 · 2009: 10 · 2010: 17 · 2011: 9 · 2012: 4 · 2013: 15 · 2014: 14 ·
2015: 9 · 2016: 11 · 2017: 10 · 2018: 9 · 2019: 8 · 2020: 5 · 2021: 4 · 2022: 9 · 2023: 20 ·
2024: 4 · 2025: 1.

Depois do backfill de precedentes (seção seguinte), o grafo passou de 5.546 para 7.043 alvos
com 2 ou mais citações no voto, e os pendentes, de 195 para **1.676**. É a segunda geração:
acórdãos citados pelos que acabaram de entrar. Trazê-los exige zerar o cursor e caminhar o
feed inteiro de novo (cerca de 108 páginas a ~150 s cada, mais ~10 s por RTF), sem IA. **Não
foi feito; é decisão a tomar.**

## Backfill de precedentes

`npx tsx scripts/backfill-precedentes-tcu.ts --execute` em 29/09/2026 (sem rede, sem IA):
2.347 acórdãos processados, 2.261 com arestas e 86 sem. **26.342 arestas novas** (média de
11,2 por documento); `AcordaoCitacao` passou de 130.959 para 157.301 arestas e de 14.213
para 16.474 acórdãos de origem.

## Classificação por matéria

Não executada nesta sessão: o ambiente da nuvem não tem `ANTHROPIC_API_KEY` nem
`GEMINI_API_KEY`, e o Daniel vai rodá-la localmente. O dry-run
(`classificar-temas-acordaos-tcu.ts --min-no-voto=2 --dry-run`, depois do backfill) deu:

| | Quantidade |
|---|---|
| Alvos acima do limiar | 7.043 |
| Já classificados | 818 |
| A classificar | 6.225 |
| por área oficial do TCU (sem custo) | 185 |
| por LLM | 3.779 |
| sem insumo (alvo não ingerido ou texto curto) | 2.261 |

São 152 chamadas de 25 alvos. Estimativa, não medida com contagem de tokens: cada chamada
leva até 25 recortes de 1.500 caracteres (~12 mil tokens de entrada) e devolve ~2 a 3 mil
tokens; ao preço do Claude Sonnet 5 (US$ 2 por milhão de tokens de entrada e US$ 10 por
milhão de saída), ~US$ 0,05 por chamada, **US$ 6 a 12 no total**. O volume é cerca de 30%
maior que o previsto antes da carga (~115 chamadas), por causa dos alvos novos do backfill.

## Falhas

As 353 falhas esgotaram as 3 tentativas. Plenário: 270; Primeira Câmara: 38; Segunda
Câmara: 45. Pelo último erro registrado:

| Causa | Quantidade |
|---|---|
| HTTP 403 | 179 |
| RTF acima do teto de 20 MB | 114 |
| `rtf-parser` estoura a pilha | 28 |
| HTTP 503 | 16 |
| codificação `SYMBOL` não reconhecida | 11 |
| arquivo não é RTF | 2 |
| `Unsupported charset code #79` | 2 |
| `this.emitIndexSubEntry is not a function` | 1 |

**O 403 não vem do TCU.** 177 dos 179 são os acórdãos de 1994 a 2008, cujo link aponta para
`https://www.tcu.gov.br/acordaoslegados/...*.doc`; a política de rede do ambiente da nuvem
bloqueia esse host (o proxy recusa o `CONNECT`). Há dois obstáculos para recuperá-los: rodar
de uma máquina com acesso ao host e extrair `.doc` (Word 97), que o `catalogarAcordao` não
trata (só RTF). Como as tentativas se esgotaram, retentar exige zerar
`tcuAnaliseTentativas` desses documentos. Os 16 casos de HTTP 503 são provavelmente
transitórios e se resolvem pela mesma via.

Os RTFs acima do teto vão de 23 MB a 383 MB. **Próximo passo sugerido (mantido):** um extrator
que descarte em fluxo os grupos de imagem (`\pict`) antes do parser resolveria o teto e
provavelmente o estouro de pilha.

Acórdãos com 403 (177 com link legado `.doc`, mais 1572/2020 e 2784/2012):

436/1994, 406/1999, 97/2003, 100/2003, 196/2003, 347/2003, 583/2003, 1079/2003, 1146/2003, 1284/2003, 1560/2003, 1564/2003, 1718/2003, 1758/2003, 1815/2003, 1909/2003, 1914/2003, 2521/2003, 27/2004, 341/2004, 398/2004, 458/2004, 473/2004, 713/2004, 824/2004, 1011/2004, 1302/2004, 1456/2004, 1457/2004, 1488/2004, 1619/2004, 1824/2004, 2088/2004, 2415/2004, 2552/2004, 2628/2004, 167/2005, 169/2005, 253/2005, 363/2005, 604/2005, 1120/2005, 1791/2005, 2024/2005, 2248/2005, 2348/2005, 472/2006, 569/2006, 573/2006, 630/2006, 687/2006, 859/2006, 978/2006, 1031/2006, 1227/2006, 1283/2006, 1317/2006, 1432/2006, 1442/2006, 1472/2006, 1631/2006, 1656/2006, 2023/2006, 2068/2006, 2131/2006, 2181/2006, 3137/2006, 3512/2006, 3559/2006, 14/2007, 48/2007, 198/2007, 217/2007, 266/2007, 278/2007, 281/2007, 325/2007, 442/2007, 539/2007, 634/2007, 728/2007, 774/2007, 862/2007, 890/2007, 903/2007, 920/2007, 985/2007, 1093/2007, 1124/2007, 1306/2007, 1322/2007, 1437/2007, 1445/2007, 1514/2007, 1521/2007, 1526/2007, 1537/2007, 1569/2007, 1599/2007, 1873/2007, 1910/2007, 1955/2007, 1969/2007, 1996/2007, 2011/2007, 2139/2007, 2143/2007, 2374/2007, 2482/2007, 2562/2007, 2634/2007, 2656/2007, 2764/2007, 2868/2007, 3070/2007, 3195/2007, 3300/2007, 3403/2007, 143/2008, 188/2008, 219/2008, 278/2008, 299/2008, 399/2008, 481/2008, 599/2008, 602/2008, 608/2008, 620/2008, 622/2008, 649/2008, 690/2008, 727/2008, 731/2008, 775/2008, 813/2008, 933/2008, 1019/2008, 1083/2008, 1134/2008, 1146/2008, 1189/2008, 1226/2008, 1286/2008, 1358/2008, 1398/2008, 1514/2008, 1541/2008, 1551/2008, 1580/2008, 1591/2008, 1603/2008, 1606/2008, 1624/2008, 1653/2008, 1700/2008, 1714/2008, 1730/2008, 1891/2008, 1902/2008, 1940/2008, 1998/2008, 1999/2008, 2390/2008, 2453/2008, 2550/2008, 2610/2008, 2636/2008, 2684/2008, 2687/2008, 2709/2008, 2843/2008, 2873/2008, 3641/2008, 3897/2008, 4661/2008, 5717/2008, 2784/2012, 1572/2020


Demais falhas:

| Acórdão | Colegiado | Último erro |
|---|---|---|
| 2369/2011 | Plenário | excede o teto: 23483623 bytes |
| 2170/2012 | Plenário | excede o teto: 43413935 bytes |
| 3016/2012 | Plenário | excede o teto: 39904608 bytes |
| 571/2013 | Plenário | extração RTF: Maximum call stack size exceeded |
| 1754/2013 | Plenário | extração RTF: Maximum call stack size exceeded |
| 1977/2013 | Plenário | extração RTF: Encoding not recognized: 'SYMBOL' |
| 2373/2013 | Plenário | excede o teto: 27601144 bytes |
| 2602/2013 | Plenário | extração RTF: this.emitIndexSubEntry is not a function |
| 3650/2013 | Plenário | excede o teto: 34100115 bytes |
| 548/2014 | Plenário | excede o teto: 43542618 bytes |
| 696/2014 | Plenário | extração RTF: Maximum call stack size exceeded |
| 1338/2014 | Plenário | excede o teto: 383058729 bytes |
| 1454/2014 | Plenário | extração RTF: Encoding not recognized: 'SYMBOL' |
| 1887/2014 | Plenário | excede o teto: 21941584 bytes |
| 3118/2014 | Plenário | extração RTF: Maximum call stack size exceeded |
| 3291/2014 | Plenário | extração RTF: Maximum call stack size exceeded |
| 996/2015 | Plenário | extração RTF: Maximum call stack size exceeded |
| 1426/2015 | Plenário | excede o teto: 22290585 bytes |
| 1992/2015 | Plenário | extração RTF: Maximum call stack size exceeded |
| 2053/2015 | Plenário | excede o teto: 88346089 bytes |
| 2714/2015 | Plenário | excede o teto: 62639646 bytes |
| 3021/2015 | Plenário | HTTP 503 |
| 3089/2015 | Plenário | HTTP 503 |
| 8928/2015 | Segunda Câmara | excede o teto: 50895473 bytes |
| 718/2016 | Plenário | HTTP 503 |
| 852/2016 | Plenário | HTTP 503 |
| 854/2016 | Plenário | HTTP 503 |
| 908/2016 | Plenário | HTTP 503 |
| 1220/2016 | Plenário | HTTP 503 |
| 1413/2016 | Plenário | HTTP 503 |
| 1583/2016 | Plenário | HTTP 503 |
| 1923/2016 | Plenário | HTTP 503 |
| 2109/2016 | Plenário | HTTP 503 |
| 2130/2016 | Plenário | HTTP 503 |
| 2210/2016 | Plenário | HTTP 503 |
| 2255/2016 | Plenário | HTTP 503 |
| 2336/2016 | Plenário | excede o teto: 79617751 bytes |
| 2428/2016 | Plenário | HTTP 503 |
| 2523/2016 | Plenário | excede o teto: 144608159 bytes |
| 2672/2016 | Plenário | extração RTF: Maximum call stack size exceeded |
| 3073/2016 | Plenário | excede o teto: 83967321 bytes |
| 604/2017 | Plenário | HTTP 503 |
| 630/2017 | Plenário | excede o teto: 29620931 bytes |
| 1057/2017 | Plenário | excede o teto: 21502946 bytes |
| 1058/2017 | Plenário | excede o teto: 55959396 bytes |
| 1260/2017 | Plenário | extração RTF: Encoding not recognized: 'SYMBOL' |
| 1320/2017 | Plenário | excede o teto: 119862602 bytes |
| 1348/2017 | Plenário | excede o teto: 77208748 bytes |
| 2007/2017 | Plenário | extração RTF: Maximum call stack size exceeded |
| 2121/2017 | Plenário | excede o teto: 44153945 bytes |
| 2791/2017 | Plenário | extração RTF: Maximum call stack size exceeded |
| 5785/2017 | Segunda Câmara | excede o teto: 66831038 bytes |
| 229/2018 | Plenário | excede o teto: 39192546 bytes |
| 972/2018 | Plenário | extração RTF: Maximum call stack size exceeded |
| 1174/2018 | Plenário | excede o teto: 62889574 bytes |
| 1214/2018 | Plenário | excede o teto: 26044082 bytes |
| 1290/2018 | Plenário | extração RTF: Unsupported charset code #79 |
| 1322/2018 | Plenário | excede o teto: 138206644 bytes |
| 1744/2018 | Plenário | excede o teto: 28427782 bytes |
| 1874/2018 | Plenário | excede o teto: 32760371 bytes |
| 2010/2018 | Plenário | extração RTF: Unsupported charset code #79 |
| 2135/2018 | Plenário | excede o teto: 24795332 bytes |
| 2207/2018 | Plenário | excede o teto: 40641730 bytes |
| 2446/2018 | Plenário | extração RTF: Maximum call stack size exceeded |
| 2488/2018 | Plenário | excede o teto: 29819302 bytes |
| 2580/2018 | Plenário | excede o teto: 31431640 bytes |
| 2861/2018 | Plenário | excede o teto: 56790110 bytes |
| 933/2019 | Plenário | extração RTF: Maximum call stack size exceeded |
| 937/2019 | Plenário | extração RTF: Encoding not recognized: 'SYMBOL' |
| 1079/2019 | Plenário | excede o teto: 51154785 bytes |
| 1083/2019 | Plenário | excede o teto: 59417328 bytes |
| 1174/2019 | Plenário | excede o teto: 26330880 bytes |
| 1256/2019 | Plenário | excede o teto: 52002651 bytes |
| 1257/2019 | Plenário | excede o teto: 31936094 bytes |
| 1331/2019 | Plenário | excede o teto: 165047879 bytes |
| 1527/2019 | Plenário | extração RTF: Maximum call stack size exceeded |
| 1542/2019 | Plenário | excede o teto: 23955701 bytes |
| 1627/2019 | Plenário | excede o teto: 94199510 bytes |
| 1789/2019 | Plenário | excede o teto: 232114184 bytes |
| 1840/2019 | Plenário | extração RTF: Maximum call stack size exceeded |
| 1921/2019 | Plenário | extração RTF: Maximum call stack size exceeded |
| 1925/2019 | Plenário | excede o teto: 76814104 bytes |
| 1937/2019 | Plenário | excede o teto: 76595498 bytes |
| 2190/2019 | Plenário | excede o teto: 46970546 bytes |
| 2273/2019 | Plenário | extração RTF: Maximum call stack size exceeded |
| 2435/2019 | Plenário | extração RTF: Encoding not recognized: 'SYMBOL' |
| 2504/2019 | Plenário | excede o teto: 93883543 bytes |
| 2619/2019 | Plenário | excede o teto: 35663481 bytes |
| 2704/2019 | Plenário | excede o teto: 111467173 bytes |
| 3061/2019 | Plenário | excede o teto: 32337828 bytes |
| 528/2020 | Plenário | excede o teto: 22111606 bytes |
| 530/2020 | Plenário | extração RTF: Maximum call stack size exceeded |
| 541/2020 | Plenário | extração RTF: Encoding not recognized: 'SYMBOL' |
| 883/2020 | Plenário | excede o teto: 45759009 bytes |
| 971/2020 | Plenário | excede o teto: 48294466 bytes |
| 1010/2020 | Plenário | não é RTF |
| 1101/2020 | Plenário | extração RTF: Maximum call stack size exceeded |
| 1182/2020 | Plenário | excede o teto: 57207957 bytes |
| 1437/2020 | Plenário | excede o teto: 156769453 bytes |
| 1568/2020 | Plenário | excede o teto: 39030207 bytes |
| 1627/2020 | Plenário | excede o teto: 64467185 bytes |
| 1635/2020 | Plenário | extração RTF: Maximum call stack size exceeded |
| 1850/2020 | Plenário | extração RTF: Maximum call stack size exceeded |
| 2688/2020 | Plenário | excede o teto: 28788691 bytes |
| 2710/2020 | Plenário | excede o teto: 26199363 bytes |
| 2750/2020 | Plenário | excede o teto: 41877229 bytes |
| 2758/2020 | Plenário | excede o teto: 54879173 bytes |
| 2772/2020 | Plenário | excede o teto: 53709499 bytes |
| 2914/2020 | Plenário | excede o teto: 31720490 bytes |
| 3056/2020 | Plenário | extração RTF: Encoding not recognized: 'SYMBOL' |
| 3163/2020 | Plenário | excede o teto: 31878465 bytes |
| 3259/2020 | Plenário | extração RTF: Maximum call stack size exceeded |
| 4037/2020 | Plenário | excede o teto: 56396542 bytes |
| 6649/2020 | Primeira Câmara | excede o teto: 66516800 bytes |
| 401/2021 | Plenário | excede o teto: 31044308 bytes |
| 909/2021 | Plenário | excede o teto: 63783421 bytes |
| 1042/2021 | Plenário | excede o teto: 33808530 bytes |
| 1177/2021 | Plenário | excede o teto: 55512822 bytes |
| 1213/2021 | Plenário | excede o teto: 29871024 bytes |
| 1228/2021 | Plenário | excede o teto: 35883964 bytes |
| 1431/2021 | Plenário | excede o teto: 38171060 bytes |
| 1515/2021 | Plenário | não é RTF |
| 1889/2021 | Plenário | extração RTF: Encoding not recognized: 'SYMBOL' |
| 1941/2021 | Plenário | excede o teto: 83811232 bytes |
| 2436/2021 | Plenário | excede o teto: 84132666 bytes |
| 2675/2021 | Plenário | excede o teto: 34524400 bytes |
| 2806/2021 | Plenário | excede o teto: 163908798 bytes |
| 2818/2021 | Plenário | extração RTF: Encoding not recognized: 'SYMBOL' |
| 2878/2021 | Plenário | excede o teto: 44679406 bytes |
| 2930/2021 | Plenário | excede o teto: 56299727 bytes |
| 3132/2021 | Plenário | excede o teto: 25889635 bytes |
| 8176/2021 | Primeira Câmara | extração RTF: Encoding not recognized: 'SYMBOL' |
| 1103/2022 | Plenário | excede o teto: 78742161 bytes |
| 1139/2022 | Plenário | excede o teto: 70553442 bytes |
| 1168/2022 | Plenário | excede o teto: 72885062 bytes |
| 1462/2022 | Plenário | excede o teto: 95100888 bytes |
| 1675/2022 | Plenário | extração RTF: Maximum call stack size exceeded |
| 2185/2022 | Plenário | excede o teto: 35034991 bytes |
| 2534/2022 | Plenário | excede o teto: 27208960 bytes |
| 2535/2022 | Plenário | excede o teto: 97732470 bytes |
| 2609/2022 | Plenário | excede o teto: 79431486 bytes |
| 7748/2022 | Primeira Câmara | excede o teto: 45808985 bytes |
| 158/2023 | Plenário | excede o teto: 75808301 bytes |
| 229/2023 | Plenário | extração RTF: Encoding not recognized: 'SYMBOL' |
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

Até 27/09/2026 (106):

11265/2023, 11264/2023, 11254/2023, 11252/2023, 11249/2023, 10695/2023, 2261/2023, 2163/2023, 2150/2023, 10027/2023, 10001/2023, 9990/2023, 2135/2023, 2134/2023, 2073/2023, 2062/2023, 9659/2023, 9651/2023, 9648/2023, 9646/2023, 9644/2023, 9614/2023, 9612/2023, 9609/2023, 2019/2023, 2012/2023, 1965/2023, 1963/2023, 9376/2023, 9369/2023, 1918/2023, 1917/2023, 1911/2023, 1907/2023, 1798/2023, 1757/2023, 1745/2023, 1695/2023, 1694/2023, 1615/2023, 1613/2023, 1608/2023, 1601/2023, 7031/2023, 1419/2023, 1407/2023, 1406/2023, 1268/2023, 1267/2023, 1228/2023, 1222/2023, 1218/2023, 1215/2023, 1140/2023, 1135/2023, 1130/2023, 3138/2023, 3137/2023, 747/2023, 716/2023, 2557/2023, 2549/2023, 324/2023, 314/2023, 310/2023, 26/2023, 15/2023, 9/2023, 2798/2022, 2764/2022, 2725/2022, 2710/2022, 2707/2022, 2699/2022, 2698/2022, 2639/2022, 2632/2022, 2625/2022, 7859/2022, 2517/2022, 7044/2022, 2473/2022, 2315/2022, 2292/2022, 2289/2022, 2181/2022, 2178/2022, 2173/2022, 2140/2022, 6002/2022, 5996/2022, 2104/2022, 2093/2022, 2062/2022, 2058/2022, 4784/2022, 4540/2022, 4528/2022, 1899/2022, 1774/2022, 1768/2022, 1724/2022, 1722/2022, 1714/2022, 1707/2022, 3227/2022

Em 28 e 29/09/2026 (235):

1375/2022, 3045/2022, 3035/2022, 1357/2022, 1356/2022, 1330/2022, 2886/2022, 2869/2022, 1276/2022, 1257/2022, 1255/2022, 1170/2022, 2622/2022, 2453/2022, 2433/2022, 1011/2022, 2278/2022, 981/2022, 883/2022, 868/2022, 838/2022, 1565/2022, 687/2022, 1123/2022, 1034/2022, 490/2022, 482/2022, 1175/2022, 777/2022, 495/2022, 70/2022, 67/2022, 54/2022, 13/2022, 18373/2021, 18371/2021, 17219/2021, 2150/2021, 2138/2021, 1778/2021, 1750/2021, 1749/2021, 1673/2021, 1668/2021, 1634/2021, 1631/2021, 8471/2021, 8314/2021, 8134/2021, 7636/2021, 4097/2021, 4039/2021, 1723/2021, 57/2021, 11/2021, 13963/2020, 13919/2020, 3147/2020, 10179/2020, 2334/2020, 1404/2020, 1254/2020, 1244/2020, 4485/2020, 611/2020, 814/2020, 650/2020, 631/2020, 3071/2019, 3064/2019, 2850/2019, 2848/2019, 2472/2019, 2469/2019, 2463/2019, 2456/2019, 2284/2019, 1927/2019, 1651/2019, 1292/2019, 1283/2019, 2269/2019, 599/2019, 1643/2019, 181/2019, 175/2019, 11570/2018, 10853/2018, 2240/2018, 2153/2018, 2147/2018, 2016/2018, 1518/2018, 4727/2018, 1292/2018, 1031/2018, 904/2018, 1524/2018, 1010/2018, 2912/2017, 2909/2017, 2535/2017, 2307/2017, 2249/2017, 2005/2017, 1444/2017, 1135/2017, 3220/2017, 2812/2017, 442/2017, 374/2017, 3005/2016, 3000/2016, 2986/2016, 2983/2016, 6864/2016, 2835/2016, 2791/2016, 2784/2016, 2780/2016, 2738/2016, 2491/2016, 6214/2016, 2207/2016, 2053/2016, 2050/2016, 1798/2016, 1476/2016, 877/2016, 2044/2016, 422/2016, 665/2016, 661/2016, 3320/2015, 7473/2015, 7471/2015, 2834/2015, 2828/2015, 2423/2015, 2166/2015, 2158/2015, 1565/2015, 1514/2015, 1512/2015, 61/2015, 3127/2014, 3126/2014, 2290/2014, 2082/2014, 1881/2014, 1797/2014, 1737/2014, 2966/2014, 1542/2014, 1321/2014, 1047/2014, 740/2014, 729/2014, 458/2014, 3034/2013, 5297/2013, 2292/2013, 2081/2013, 2055/2013, 403/2013, 2898/2012, 771/2012, 1075/2012, 3074/2011, 9721/2011, 4780/2011, 3146/2010, 3030/2010, 4855/2010, 1430/2010, 2715/2009, 2710/2009, 2699/2008, 1813/2008, 1590/2008, 800/2008, 417/2008, 130/2008, 32/2008, 2305/2007, 2279/2007, 3083/2007, 1855/2007, 2368/2007, 1329/2007, 1132/2007, 501/2007, 338/2007, 2407/2006, 2323/2006, 1891/2006, 1659/2006, 950/2006, 392/2006, 1842/2005, 1724/2005, 1765/2004, 1455/2004, 1454/2004, 1453/2004, 1452/2004, 1189/2004, 1038/2004, 1059/2004, 1058/2004, 680/2004, 548/2004, 454/2004, 773/2004, 101/2004, 1572/2003, 1571/2003, 1488/2003, 1113/2003, 380/2003, 67/2003, 429/2002, 313/2002, 247/2002, 158/2002, 175/2001, 110/2001, 225/2000, 227/1999, 137/1998, 219/1997, 20/1996, 6/1996, 31/1994, 13/1993

## Não encontrados

Para esses números o TCU só publica acórdão de relação, que o handoff manda preterir.
Registrados em `AlvoIdentidadeIrresolvida` como `naoEncontrado`.

Até 27/09/2026 (142):

157/2025, 148/2025, 87/2025, 2574/2024, 10318/2024, 10197/2024, 8257/2024, 9804/2024, 9750/2024, 2300/2024, 2288/2024, 9637/2024, 9599/2024, 2264/2024, 2166/2024, 8873/2024, 8790/2024, 7028/2024, 6941/2024, 2020/2024, 2018/2024, 1906/2024, 1814/2024, 1805/2024, 6370/2024, 1624/2024, 4745/2024, 1408/2024, 3874/2024, 3777/2024, 1146/2024, 1140/2024, 3237/2024, 3009/2024, 3004/2024, 845/2024, 779/2024, 2769/2024, 695/2024, 551/2024, 546/2024, 501/2024, 474/2024, 194/2024, 172/2024, 2673/2023, 2649/2023, 2646/2023, 2641/2023, 2612/2023, 2603/2023, 2594/2023, 11625/2023, 11587/2023, 11555/2023, 11313/2023, 11203/2023, 11172/2023, 11124/2023, 12873/2023, 12318/2023, 10586/2023, 12088/2023, 11955/2023, 9679/2023, 9593/2023, 9423/2023, 9422/2023, 1844/2023, 9142/2023, 9073/2023, 8876/2023, 8873/2023, 8857/2023, 8833/2023, 8551/2023, 8512/2023, 8262/2023, 1564/2023, 1521/2023, 7382/2023, 6884/2023, 6671/2023, 6522/2023, 1347/2023, 1345/2023, 1343/2023, 1329/2023, 1326/2023, 1322/2023, 6119/2023, 5783/2023, 1297/2023, 4814/2023, 4452/2023, 4329/2023, 1075/2023, 1068/2023, 1064/2023, 3870/2023, 3772/2023, 3766/2023, 3760/2023, 965/2023, 884/2023, 3426/2023, 3351/2023, 3233/2023, 3231/2023, 786/2023, 555/2023, 404/2023, 399/2023, 364/2023, 336/2023, 8717/2022, 8597/2022, 9919/2022, 9740/2022, 8996/2022, 7272/2022, 7155/2022, 7137/2022, 7133/2022, 7092/2022, 5149/2022, 4637/2022, 1867/2022, 3858/2022, 3643/2022, 86/2026, 6909/2025, 2424/2025, 6183/2025, 6180/2025, 5624/2025, 5025/2025, 4909/2025, 3413/2025, 1156/2025, 774/2025, 496/2025

Em 28 e 29/09/2026 (78):

440/2022, 305/2022, 2752/2021, 18510/2021, 18484/2021, 18272/2021, 17631/2021, 17517/2021, 17499/2021, 15646/2021, 15543/2021, 11318/2021, 1973/2021, 1831/2021, 8958/2021, 1567/2021, 952/2021, 6780/2021, 276/2021, 275/2021, 256/2021, 107/2021, 13260/2020, 2795/2020, 10925/2020, 2563/2020, 9925/2020, 9536/2020, 8839/2020, 1870/2020, 6846/2020, 1599/2020, 1577/2020, 237/2020, 13130/2019, 12880/2019, 13698/2019, 12358/2019, 2541/2019, 2414/2019, 2391/2019, 7629/2019, 1885/2019, 6695/2019, 1630/2019, 3495/2019, 1017/2019, 2563/2018, 10305/2018, 10289/2018, 12620/2018, 2107/2018, 4364/2018, 1065/2018, 983/2018, 6896/2017, 4636/2017, 1/2017, 11988/2016, 2663/2016, 9905/2016, 5241/2016, 4863/2016, 1555/2016, 1128/2016, 332/2016, 1196/2014, 7468/2013, 8207/2013, 8885/2012, 2630/2012, 5791/2012, 7427/2011, 1978/2011, 1793/2010, 6423/2009, 5762/2009, 753/2008

## Pendente

1. Classificação por matéria: o Daniel roda localmente (`--min-no-voto=2`, 152 chamadas,
   estimativa de US$ 6 a 12). O script para no primeiro erro de cota, gasto ou credencial.
2. Segunda geração de alvos (1.676): decidir se zera o cursor e caminha o feed de novo.
3. Falhas: acórdãos legados em `.doc` (177, host bloqueado na nuvem), RTFs gigantes (114) e
   erros do `rtf-parser` (44). Pedem extrator novo ou máquina com acesso ao host.
4. Embeddings e destilação de teses: **não autorizados**. Trazer volume e estimativa de custo
   ao Daniel antes. Religar a fila de embeddings é trocar `embeddingStatus` de `skipped` para
   `pending` nos documentos com `reviewedBy = 'alvos-citados-tcu'` (hoje, 2.746 com texto).
