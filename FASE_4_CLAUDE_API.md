# FASE 4 - Integração com Claude API

## Visão Geral

A FASE 4 adiciona análise semântica avançada usando a API Claude da Anthropic como **fallback opcional** para melhorar a precisão das sugestões automáticas de artigos da Lei 14.133/2021.

### Características

✅ **Opcional**: Sistema funciona perfeitamente sem a API (apenas com análise básica)
✅ **Inteligente**: Só usa IA quando análise básica tem baixa confiança
✅ **Econômico**: Usa Claude Haiku (modelo mais rápido e barato)
✅ **Transparente**: Mostra quando sugestão veio da IA (badge 🤖 IA)
✅ **Combinado**: Mescla sugestões de IA com análise básica (citações + keywords)

---

## Como Funciona

### 1. Análise Básica (SEMPRE executada)

O sistema primeiro executa análise tradicional:
- 🔍 Busca citações diretas (ex: "art. 72º")
- 🔍 Detecta ranges (ex: "arts. 5 a 10")
- 🔍 Analisa palavras-chave (156+ termos jurídicos mapeados)

### 2. Decisão de Usar Claude (CONDICIONAL)

Claude só é usado SE:
- API Key está configurada (`ANTHROPIC_API_KEY`)
- **E** análise básica teve baixa confiança:
  - Menos de 3 sugestões encontradas
  - **OU** menos de 30% com alta confiança

### 3. Análise com IA (quando aplicável)

Se critérios forem atendidos:
- Envia texto do documento para Claude Haiku
- Claude analisa semanticamente e sugere artigos relevantes
- Sistema valida sugestões (artigos 1-193, score mínimo 6/10)
- Combina com sugestões básicas

### 4. Mesclagem Inteligente

Ao combinar sugestões:
- **Se artigo já existe**: adiciona fonte "IA" + aumenta score
- **Se artigo é novo**: adiciona à lista com badge 🤖 IA
- Ordena por score e limita a 20 sugestões

---

## Configuração

### Passo 1: Obter API Key

1. Acesse: https://console.anthropic.com
2. Crie uma conta (ou faça login)
3. Vá em **Settings** → **API Keys**
4. Clique em **Create Key**
5. Copie a chave (formato: `sk-ant-xxxxxxxxxxxxx`)

### Passo 2: Configurar no Projeto

Adicione no arquivo `.env.local`:

```bash
# OPCIONAL - Análise Semântica com IA
ANTHROPIC_API_KEY=sk-ant-sua_chave_aqui
```

**IMPORTANTE**:
- ⚠️ NUNCA faça commit desta chave no Git
- ⚠️ Use chaves diferentes para dev/produção
- ✅ Em produção (Vercel), configure em Environment Variables

### Passo 3: Verificar Funcionamento

Quando configurado corretamente:
- Console mostrará: `📊 Análise básica teve baixa confiança. Usando Claude API...`
- Sugestões de IA terão badge: `🤖 IA`
- Sem API Key: sistema funciona normalmente apenas com análise básica

---

## Custos e Uso

### Modelo Usado

**Claude 3 Haiku** (mais barato e rápido da Anthropic)

### Preços (Janeiro 2025)

- **Input**: $0.25 por milhão de tokens (~750k palavras)
- **Output**: $1.25 por milhão de tokens

### Estimativas de Custo

| Tipo de Documento | Tokens | Custo/Análise | Custo/100 Análises |
|-------------------|--------|---------------|-------------------|
| Pequeno (3 pág)   | ~2,000 | $0.0005       | $0.05             |
| Médio (10 pág)    | ~5,000 | $0.0013       | $0.13             |
| Grande (30 pág)   | ~15,000| $0.0038       | $0.38             |

### Controle de Custos

O sistema **automaticamente limita custos**:

1. ✅ Só usa IA quando análise básica falha (<3 sugestões)
2. ✅ Limita texto enviado a 50k caracteres (~12k tokens)
3. ✅ Limita output a 1024 tokens
4. ✅ Usa modelo mais econômico (Haiku)

**Exemplo prático**: Se você analisar 100 documentos médios por mês, e apenas 20% precisarem de IA, o custo será de **~$0.26/mês**.

---

## Exemplo de Uso

### Documento com Boa Análise Básica

**Entrada:**
```
Título: Parecer sobre pregão eletrônico nº 123/2024
Descrição: Análise da modalidade pregão para compra de computadores...
```

**Análise básica encontra:**
- Art. 30 (citado: "pregão")
- Art. 6 (keyword: "modalidade")
- Art. 72 (keyword: "julgamento")

**Resultado**: 3 sugestões com alta confiança → **NÃO usa Claude** ✅

---

### Documento com Baixa Análise Básica

**Entrada:**
```
Título: Proposta de implantação de novo sistema de gestão contratual
Descrição: Documento discute melhorias no acompanhamento e fiscalização...
```

**Análise básica encontra:**
- Art. 117 (keyword vaga: "fiscalização")

**Resultado**: 1 sugestão, baixa confiança → **USA Claude** 🤖

**Claude adiciona:**
- Art. 5 (IA: "Princípios da administração pública")
- Art. 140 (IA: "Gestão e fiscalização de contratos")
- Art. 174 (IA: "Sistema de gestão contratual")

**Total**: 4 sugestões (1 básica + 3 IA) → Melhor resultado! ✅

---

## Implementação Técnica

### Arquivos Criados/Modificados

```
lib/
  ├── claude-analyzer.ts          [NOVO] Integração com API Claude
  └── document-analyzer.ts         [MODIFICADO] Usa Claude como fallback

app/api/admin/analyze-document/
  └── route.ts                     [MODIFICADO] Suporte async analyzeMetadata

components/
  └── DocumentAnalyzer.tsx         [MODIFICADO] Badge 🤖 IA

.env.example                       [MODIFICADO] Documentação ANTHROPIC_API_KEY
```

### Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuário clica "Sugerir Artigos Automaticamente"         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Sistema executa ANÁLISE BÁSICA                          │
│    - Citações diretas (art. Xº)                            │
│    - Ranges (arts. X a Y)                                  │
│    - Palavras-chave (156+ termos)                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
              ┌───────────────────────┐
              │ Resultado suficiente? │
              │ (≥3 sugestões)       │
              └───────────────────────┘
                    /          \
                SIM /            \ NÃO
                   /              \
                  ↓                ↓
    ┌──────────────────┐    ┌────────────────────┐
    │ Retorna resultado│    │ Claude disponível? │
    │    (sem IA)      │    └────────────────────┘
    └──────────────────┘            /        \
                                SIM /          \ NÃO
                                   /            \
                                  ↓              ↓
                    ┌─────────────────────┐   ┌────────────────┐
                    │ 3. CHAMA CLAUDE API │   │ Retorna básica │
                    │  - Envia texto      │   └────────────────┘
                    │  - Recebe sugestões │
                    │  - Valida artigos   │
                    └─────────────────────┘
                              ↓
                    ┌─────────────────────┐
                    │ 4. MESCLA RESULTADOS│
                    │  - Combina básica+IA│
                    │  - Remove duplicatas│
                    │  - Ordena por score │
                    └─────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Exibe Dialog com Sugestões                              │
│    - Badge 📌 (citação), 🔍 (keyword), 🤖 (IA)            │
│    - Pré-seleciona alta confiança                         │
│    - Usuário confirma ou ajusta                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Monitoramento

### Logs no Console

Quando Claude é usado, você verá:

```
📊 Análise básica teve baixa confiança. Usando Claude API como fallback...
✅ Claude encontrou 5 sugestões adicionais
```

### Analytics Dashboard

Acesse: `/admin/analytics-documentos`

Estatísticas incluem:
- Total de análises realizadas
- Precisão média das sugestões
- Artigos mais sugeridos (básica + IA)
- Artigos mais aceitos pelos usuários

**NOTA**: Analytics não diferencia entre fonte básica vs IA. Isso permite avaliar qualidade geral do sistema.

---

## Perguntas Frequentes

### 1. É obrigatório configurar a API Claude?

**Não.** O sistema funciona perfeitamente apenas com análise básica (citações + keywords). Claude é um **aprimoramento opcional**.

### 2. Quanto vou gastar por mês?

Depende do volume e qualidade dos documentos. Estimativas:

- **Baixo uso** (10-20 análises/mês): < $0.05/mês
- **Médio uso** (100 análises/mês, 20% usam IA): ~$0.26/mês
- **Alto uso** (500 análises/mês, 30% usam IA): ~$2.00/mês

💡 **Dica**: Configure alertas de billing no console da Anthropic.

### 3. Como sei se Claude está sendo usado?

Procure pelo badge **🤖 IA** nas sugestões. Se aparecer, aquela sugestão veio (total ou parcialmente) de Claude.

### 4. Posso forçar o uso de Claude sempre?

Sim, modificando a função `shouldUseClaude()` em `lib/claude-analyzer.ts`:

```typescript
export function shouldUseClaude(): boolean {
  return isClaudeAvailable(); // Sempre usa se disponível
}
```

⚠️ **Atenção**: Isso aumentará custos significativamente.

### 5. Qual modelo Claude é usado?

**Claude 3 Haiku** - O mais rápido e econômico. Para tarefas mais complexas, você pode trocar para Sonnet ou Opus editando `lib/claude-analyzer.ts` (linha com `model:`).

### 6. Claude funciona com PDFs grandes?

Sim, mas o sistema limita texto enviado a **50k caracteres** (~12k tokens / ~30 páginas) para controlar custos. Documentos maiores têm o texto truncado.

### 7. Como testar sem gastar?

Anthropic oferece **$5 em créditos gratuitos** para novos usuários. Isso permite testar ~4.000 análises médias antes de precisar pagar.

---

## Troubleshooting

### Erro: "Claude API não configurada"

**Causa**: `ANTHROPIC_API_KEY` não está no `.env.local`

**Solução**: Adicione a chave ou ignore (sistema funciona sem IA)

---

### Erro: "Erro na API Claude: 401"

**Causa**: API Key inválida ou expirada

**Solução**:
1. Verifique se copiou a chave completa (começa com `sk-ant-`)
2. Gere nova chave em https://console.anthropic.com

---

### Erro: "Erro na API Claude: 429"

**Causa**: Rate limit atingido (muitas requisições)

**Solução**:
1. Aguarde alguns segundos
2. Verifique se tem créditos/billing configurado
3. Aumente intervalo entre análises

---

### Nenhuma sugestão de IA aparece

**Possíveis causas**:

1. ✅ **Análise básica está funcionando bem** (≥3 sugestões) → Claude não é necessário
2. ❌ **API Key não configurada** → Verifique `.env.local`
3. ❌ **Documento vazio** → Claude precisa de texto para analisar
4. ❌ **Resposta de Claude inválida** → Veja logs do console para detalhes

---

## Próximos Passos

### Melhorias Futuras

1. **Cache de Respostas**: Evitar re-análise de documentos idênticos
2. **Streaming**: Exibir sugestões conforme Claude responde
3. **Fine-tuning**: Treinar modelo específico para Lei 14.133
4. **Multi-modelo**: Permitir usar GPT-4, Gemini, etc.
5. **Análise em Lote**: Processar múltiplos documentos de uma vez

### Feedback

Se tiver sugestões ou problemas, documente em:
- Issues do projeto
- Comentários neste arquivo

---

## Conclusão

A integração com Claude API representa um **aprimoramento opcional mas poderoso** para o sistema de sugestões automáticas.

**Quando usar:**
- ✅ Documentos sem citações diretas
- ✅ Textos com linguagem não-jurídica
- ✅ Casos complexos que palavras-chave não capturam

**Quando NÃO usar:**
- ❌ Orçamento muito limitado (<$1/mês)
- ❌ Análise básica já está funcionando bem
- ❌ Preocupações de privacidade (dados enviados para Anthropic)

**Decisão final**: É totalmente opcional e o sistema foi projetado para funcionar otimamente **com ou sem IA**. 🚀
