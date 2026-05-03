# Roadmap — Integração PNCP (Portal Nacional de Contratações Públicas)

**Criado em:** 2026-05-03
**Autor:** Daniel Barral + Claude (sessão de análise das APIs Conecta gov.br)
**Status:** Estudo / planejamento futuro. Nenhum código escrito ainda.

---

## Por que PNCP

O PNCP é o portal oficial obrigatório de divulgação de todos os atos da Lei 14.133/2021 (editais, contratos, atas de registro de preços, planos de contratações anuais). Como o site é centrado em direito administrativo e Lei 14.133, o PNCP é o casamento natural entre o conteúdo editorial (lei comentada, pareceres AGU, acórdãos TCU) e dados concretos do mercado de contratações públicas.

Sem PNCP, o site é "comentário sobre a lei". Com PNCP, vira "comentário sobre a lei + como o mercado está aplicando a lei agora".

---

## API — o que está disponível

**Base URL pública (consulta sem autenticação):** `https://pncp.gov.br/api/consulta/v1/`
**Swagger oficial:** https://pncp.gov.br/api/consulta/swagger-ui/index.html
**Manual oficial:** [Manual das APIs de Consultas PNCP](https://www.gov.br/pncp/pt-br/central-de-conteudo/manuais/versoes-anteriores/ManualPNCPAPIConsultasVerso1.0.pdf)

**Endpoints de consulta principais:**
| Endpoint | Conteúdo | Uso editorial |
|---|---|---|
| `GET /contratacoes/publicacao` | Editais publicados (todas modalidades) | Linkar artigos da Lei 14.133 a casos concretos |
| `GET /contratacoes/proposta` | Editais com propostas abertas (ainda recebem) | Bloco "licitações abertas" pra usuários do site |
| `GET /contratos` | Contratos firmados | Comparar valor estimado vs valor contratado |
| `GET /atas` | Atas de registro de preços | Estudo de IRP, adesões |
| `GET /pca` | Planos de contratações anuais | Análise de tendências por órgão |

**Filtros típicos por endpoint:** `dataInicial`, `dataFinal`, `codigoModalidadeContratacao`, `uf`, `cnpjOrgao`, `tamanhoPagina`, `pagina`.

**Paginação:** `tamanhoPagina` máximo provavelmente 500 por chamada (validar no swagger). Resposta JSON, UTF-8.

**Sem rate limit documentado público** — assumir conservador (≤ 1 req/s, retry com backoff exponencial).

---

## Hipóteses de valor (4 features candidatas, em ordem de impacto)

### F1. Lei 14.133 ao vivo — vincular artigo a editais reais
**Ideia:** em cada artigo da `/lei-14133/comentada`, mostrar bloco "casos recentes no PNCP" listando 3-10 editais publicados nas últimas 4 semanas que se enquadram naquele artigo.

**Mecânica:**
- Cron diário pull de novos editais via `/contratacoes/publicacao`
- Mapeamento `codigoModalidadeContratacao` → artigo (ex: pregão eletrônico → art. 28 IV; diálogo competitivo → art. 28 V)
- Limitar a editais federais relevantes (filtrar por valor mínimo? por órgão?)

**Diferencial:** ninguém faz isso. Comentário acadêmico + dados ao vivo é proposta única no mercado.

**Risco:** volume diário do PNCP é alto (milhares de editais). Sem filtro forte, o bloco vira ruído.

**Decisão pendente:** que filtro de relevância? (valor mínimo? órgãos federais apenas? seleção curada por modalidade incomum?)

---

### F2. Estatísticas didáticas por modalidade
**Ideia:** dashboard simples mostrando "como o mercado está aplicando a Lei 14.133":
- % de pregões eletrônicos vs concorrência por mês
- Número de diálogos competitivos publicados (modalidade nova, indicador de adoção)
- Top 10 órgãos por volume de editais
- Distribuição por UF

**Mecânica:**
- ETL diário consolida em tabela `PncpStatsDaily`
- Página pública `/estatisticas-pncp` ou widget na home

**Valor pedagógico:** professor consegue dizer "olhem como a modalidade X está sendo subutilizada" com gráfico atualizado.

**Risco baixo:** dados agregados são fáceis de processar e estáveis.

---

### F3. Newsletter mensal — destaques de licitações
**Ideia:** acrescentar bloco na newsletter mensal existente (`cron 0 9 1 * *`):
- Top 3 contratos do mês por valor
- Modalidades incomuns publicadas (diálogo competitivo, credenciamento)
- Cross-reference: "este edital usa entendimento do Acórdão TCU X / Parecer AGU Y"

**Mecânica:**
- Estende newsletter existente — não cria infra nova
- Reutiliza pipeline de embeddings pra cross-reference

**Risco:** baixo, é incremento de feature já existente.

---

### F4. Busca cruzada "valide este edital"
**Ideia:** usuário cola URL ou número PNCP de um edital → site mostra:
- Resumo do edital
- Artigos da Lei 14.133 aplicáveis (com link pra comentário do prof)
- Pareceres AGU sobre o tema
- Acórdãos TCU citando situações similares

**Mecânica:**
- Endpoint `/api/edital/[pncpId]` busca via PNCP API + cruzamento com base local
- Embeddings da ementa do edital → similar search nos atos/pareceres/acórdãos do site

**Diferencial alto:** ferramenta prática que advogados públicos usariam diariamente.

**Risco:** maior complexidade técnica (UI nova, integração com 3 bases). Melhor depois de F1-F3 validarem que dá pra confiar nos dados PNCP.

---

## Arquitetura proposta (esboço)

### Tabelas novas
```prisma
model PncpRecord {
  id                String   @id @default(uuid())
  pncpId            String   @unique  // id canônico do PNCP
  tipo              String   // 'contratacao' | 'contrato' | 'ata' | 'pca'
  numeroControle    String   // ex: "00038174000143-1-000001/2026"
  modalidade        String?  // código + descrição
  modalidadeNome    String?
  orgaoCnpj         String
  orgaoNome         String
  uf                String?
  municipio         String?
  objeto            String   @db.Text
  valorEstimado     Decimal?
  valorTotal        Decimal?
  dataPublicacao    DateTime
  dataAbertura      DateTime?
  situacao          String?
  urlPncp           String
  rawPayload        Json     // backup completo da API pra evolução
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  syncedAt          DateTime

  @@index([tipo, dataPublicacao])
  @@index([modalidade])
  @@index([orgaoCnpj])
  @@index([uf])
}

// Vínculo editorial: artigo da Lei 14.133 ↔ edital exemplo
model LeiArticlePncpExample {
  id            String   @id @default(uuid())
  articleNumber String
  pncpRecordId  String
  reason        String?  // por que esse exemplo foi vinculado (auto/manual)
  source        String   // 'auto' | 'manual'
  createdAt     DateTime @default(now())

  article    LeiArticle  @relation(...)
  pncpRecord PncpRecord  @relation(...)

  @@unique([articleNumber, pncpRecordId])
  @@index([articleNumber])
}
```

### Pipeline
```
Cron diário (madrugada) →
  pull /contratacoes/publicacao com dataInicial = ontem →
  upsert PncpRecord →
  classifier (rule-based: modalidade → artigo) →
  cria LeiArticlePncpExample auto (com source='auto') →
  revalidate ISR /lei-14133/[numero]
```

### Reuso da infra existente
- Cron infrastructure (✅ já existe — usado em CONUNI sync, newsletter, indexação)
- Webhook `/api/admin/revalidate` (✅ já existe)
- Padrão de monitoramento health endpoint (✅ replicar `/api/pncp-health` análogo a `/api/conuni-health`)
- Padrão de routine recorrente alertando falha de sync (✅ replicar)

---

## Decisões a tomar antes de começar

1. **Escopo geográfico:** federal apenas, ou inclui estados/municípios? (PNCP cobre todos)
   - Recomendação inicial: federal + capitais, evita explosão de volume
2. **Volume:** limitar a tipos específicos (pregão, concorrência, diálogo competitivo, dispensa)?
   - Recomendação: sim, filtrar por modalidade da Lei 14.133, descartar adesões a ata e dispensa de baixo valor
3. **UI:** feature pública ou área restrita?
   - Recomendação: pública (dados públicos do PNCP, atrai SEO)
4. **Frequência sync:** diário, semanal, ou real-time-ish?
   - Recomendação: diário cron na madrugada (4h), suficiente pra newsletter mensal e blocos no site
5. **Indexação na busca IA:** indexar ementa de editais nos embeddings Gemini?
   - Custo Gemini ~R$ por 1k embeddings; com volume diário pode escalar
   - Recomendação: começar SEM indexação; medir uso primeiro

---

## Pré-requisitos (todos ✅ presentes)

- [x] Newsletter mensal estável
- [x] Cron infrastructure (Vercel)
- [x] Webhook revalidate ISR
- [x] Padrão de health endpoint + routine de monitoramento
- [x] Migration system Prisma fluente
- [x] Embeddings Gemini funcionais (caso F4 venha a usar)

---

## Sinal vermelho — quando NÃO começar

- Se o volume diário do PNCP (medido em sample inicial) inviabilizar storage/processamento sem filtros agressivos
- Se a API tiver instabilidade frequente (validar com `scripts/test-pncp-api.ts` rodando 1 semana antes)
- Se o ROI editorial for baixo: testar primeiro em **uma** página de artigo (F1 piloto) antes de roll-out

---

## Próximos passos quando retomar

1. Ler swagger oficial completo e o manual de consultas (PDF)
2. Criar `scripts/test-pncp-api.ts` exploratório: pull de 1 dia, contar volume por modalidade
3. Decidir as 5 perguntas pendentes acima com base no volume real
4. Brainstorm formal pra escolher F1/F2/F3/F4 como MVP
5. Spec → plano → implementação seguindo metodologia padrão

---

## Referências

- [Swagger consulta PNCP](https://pncp.gov.br/api/consulta/swagger-ui/index.html)
- [Manual API Consultas PNCP v1.0](https://www.gov.br/pncp/pt-br/central-de-conteudo/manuais/versoes-anteriores/ManualPNCPAPIConsultasVerso1.0.pdf)
- [PNCP em Dados Abertos](https://www.gov.br/pncp/pt-br/acesso-a-informacao/dados-abertos)
- [Recomendações técnicas PNCP — Transparência Brasil](https://www.transparencia.org.br/downloads/publicacoes/portalnacionaldecontratacoespublicas_recomendacoesedesafiostecnicos.pdf)
