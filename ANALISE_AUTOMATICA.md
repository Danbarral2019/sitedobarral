# 🤖 Sistema de Análise Automática de Documentos

Sistema inteligente de análise de documentos que sugere automaticamente artigos da Lei 14.133/2021 para catalogação.

---

## ✨ Funcionalidades

### 1. **Detecção de Artigos Citados**
- Identifica citações explícitas como:
  - "art. 5º"
  - "artigo 72"
  - "Arts. 30 a 34"
  - "Artigo 6 da Lei"

### 2. **Análise de Palavras-Chave**
- Detecta temas principais do documento:
  - "princípios" → sugere Art. 5º
  - "dispensa" → sugere Arts. 74-75
  - "pregão" → sugere Art. 30
  - "alterações contratuais" → sugere Arts. 124-136
  - E mais de 50 mapeamentos de palavras-chave!

### 3. **Detecção de Ranges**
- Identifica ranges de artigos:
  - "arts. 72 a 80" → sugere todos de 72 até 80
  - "artigos 124 ao 136" → sugere todos do intervalo

### 4. **Sistema de Scoring e Confiança**
- **Alta confiança (verde)**: Artigo citado explicitamente 3+ vezes
- **Média confiança (amarelo)**: Artigo citado 1-2 vezes ou muito relevante por keywords
- **Baixa confiança (cinza)**: Sugestão baseada em keywords menos específicas

---

## 🚀 Como Usar

### **No Painel Admin** (`/admin/documentos`)

1. **Preencha o formulário básico**:
   - Selecione o curso
   - Digite o título do documento
   - (Opcional) Adicione descrição
   - (Opcional) Faça upload do arquivo PDF

2. **Clique em "Sugerir Artigos Automaticamente"**:
   - Botão roxo/rosa com ícone de ✨ Sparkles
   - Fica logo antes do seletor manual de artigos

3. **Revise as sugestões**:
   - Dialog mostra todos os artigos sugeridos
   - Cada sugestão exibe:
     - Número e ementa do artigo
     - Nível de confiança (Alta/Média/Baixa)
     - Score (0-10)
     - Fontes da sugestão (citação/keyword/range)
     - Contextos onde foi encontrado

4. **Selecione artigos**:
   - Clique nos cards para marcar/desmarcar
   - Sugestões de alta confiança vêm pré-selecionadas
   - Pode selecionar quantos quiser

5. **Aplique as sugestões**:
   - Clique em "Aplicar Selecionados"
   - Artigos são automaticamente adicionados ao campo "Artigos da Lei"
   - Combina com artigos já selecionados manualmente

---

## 📊 Exemplos de Análise

### **Exemplo 1: Apostila sobre Princípios**

**Entrada:**
- Título: "Princípios da Nova Lei de Licitações"
- Descrição: "Análise dos princípios de legalidade, impessoalidade e moralidade"

**Saída:**
- ✅ **Art. 5º** - Confiança: Alta (Score: 10)
  - Fontes: Keyword "princípios", "legalidade", "impessoalidade", "moralidade"

---

### **Exemplo 2: Parecer sobre Dispensa**

**Entrada:**
- Título: "Parecer Jurídico - Dispensa de Licitação por Pequeno Valor"
- Descrição: "Análise da aplicabilidade do art. 75, II da Lei 14.133/2021"

**Saída:**
- ✅ **Art. 75º** - Confiança: Alta (Score: 10)
  - Fontes: Citação direta ("art. 75"), Keyword "dispensa"
  - Contexto: "...aplicabilidade do art. 75, II da Lei 14.133/2021..."
- ✅ **Art. 74º** - Confiança: Média (Score: 8)
  - Fontes: Keyword "dispensa"

---

### **Exemplo 3: Acórdão do TCU**

**Entrada:**
- Título: "TCU Acórdão 1234/2024"
- Descrição: "Análise da fiscalização de contratos. O fiscal não atestou regularmente a execução contratual, infringindo o art. 117 da Lei."

**Saída:**
- ✅ **Art. 117º** - Confiança: Alta (Score: 10)
  - Fontes: Citação direta ("art. 117")
  - Contexto: "...infringindo o art. 117 da Lei..."
- ✅ **Art. 116º** - Confiança: Média (Score: 9)
  - Fontes: Keyword "fiscalização"

---

## 🔧 Arquitetura do Sistema

### **Bibliotecas Core** (`lib/`)

```
lib/
├── text-extractor.ts       # Extração de texto de PDFs/DOCs
├── article-matcher.ts       # Detecção de artigos citados
├── keyword-mapper.ts        # Mapeamento palavra-chave → artigos
└── document-analyzer.ts     # Orquestrador principal
```

### **API Endpoint**

```
POST /api/admin/analyze-document

# Modo 1: Com arquivo (multipart/form-data)
FormData: { file: File }

# Modo 2: Apenas metadados (application/json)
Body: { title: string, description?: string }

# Resposta
{
  "success": true,
  "suggestions": [
    {
      "articleNumber": "5",
      "articleTitle": "Princípios da licitação...",
      "confidence": "high",
      "score": 10,
      "sources": [
        {
          "type": "keyword",
          "reason": "Documento trata de princípios",
          "details": "Palavras-chave: princípios, legalidade"
        }
      ]
    }
  ],
  "stats": {
    "textLength": 1523,
    "citationsFound": 3,
    "keywordsMatched": 7,
    "totalSuggestions": 5
  }
}
```

### **Componente React**

```tsx
<DocumentAnalyzer
  title="Princípios da Licitação"
  description="Análise completa..."
  file={pdfFile}
  currentSelectedArticles={["5", "6"]}
  onApplySuggestions={(articles) => setArticles(articles)}
/>
```

---

## 🎯 Padrões de Detecção

### **Regex para Artigos**

```regex
# Padrões suportados:
art. 5º
Art. 72
artigo 30
Artigo 6
arts. 5 e 6
arts 30 a 34
```

### **Palavras-Chave Mapeadas**

**Planejamento:**
- planejamento → Arts. 22-25
- estudos técnicos → Art. 23
- gestão de riscos → Art. 24

**Modalidades:**
- pregão → Art. 30
- concorrência → Art. 31
- diálogo competitivo → Art. 34

**Contratação Direta:**
- dispensa → Arts. 74-75
- inexigibilidade → Arts. 72-73

**Contratos:**
- alteração → Arts. 124-136
- reequilíbrio → Arts. 137-139
- fiscalização → Arts. 116-117

**Sanções:**
- multa → Art. 157
- inidoneidade → Art. 159
- processo sancionador → Arts. 160-162

*E muitas outras...*

---

## 📝 Limitações Atuais

### **Extração de PDF**
- ⚠️ **Não implementada ainda** - requer biblioteca `pdf-parse`
- Por enquanto, usa apenas título + descrição
- Para implementar:
  ```bash
  npm install pdf-parse
  ```

### **Análise de DOC/DOCX**
- ⚠️ **Não implementada ainda** - requer biblioteca `mammoth`
- Para implementar:
  ```bash
  npm install mammoth
  ```

### **Fallback Automático**
- Se PDF não funcionar, sistema automaticamente usa análise de metadados
- Usuário é informado via mensagem

---

## 🔮 Melhorias Futuras

### **v2.0 - Análise com IA**
- Integração com Claude API ou OpenAI
- Análise semântica mais profunda
- Compreensão de contexto jurídico
- Sugestões ainda mais precisas

### **v1.5 - Melhorias Incrementais**
- ✅ Extração de PDF funcional
- ✅ Análise de arquivos Word
- ✅ Cache de análises
- ✅ Mais palavras-chave mapeadas
- ✅ Detecção de incisos e parágrafos

### **v1.2 - Analytics**
- Dashboard de precisão das sugestões
- Taxa de aceitação por tipo de documento
- Palavras-chave mais comuns

---

## 🧪 Como Testar

### **Teste Rápido**
1. Acesse `/admin/documentos`
2. Preencha:
   - Curso: Qualquer
   - Título: "Princípios da Nova Lei de Licitações"
   - Descrição: "Análise dos princípios de legalidade e impessoalidade"
3. Clique em "Sugerir Artigos Automaticamente"
4. Deve sugerir: **Art. 5º** com alta confiança

### **Teste com Citações**
1. Título: "Comentários ao art. 75 da Lei 14.133"
2. Descrição: "Dispensa de licitação conforme art. 75, II e análise do art. 74"
3. Deve sugerir:
   - Art. 75 (citado 2x) - Alta confiança
   - Art. 74 (citado 1x) - Média/Alta confiança

### **Teste com Range**
1. Título: "Análise dos artigos 72 a 80"
2. Descrição: "Contratação direta na Lei 14.133"
3. Deve sugerir: Arts. 72, 73, 74, 75, 76, 77, 78, 79, 80

---

## 💡 Dicas de Uso

### **Para Melhores Resultados**
1. ✅ Preencha título E descrição sempre que possível
2. ✅ Use termos técnicos corretos da lei
3. ✅ Cite artigos explicitamente na descrição se souber
4. ✅ Revise as sugestões antes de aplicar

### **Quando Usar**
- ✅ Catalogando novos documentos
- ✅ Recatalogando documentos antigos
- ✅ Quando não tem certeza dos artigos relevantes

### **Quando NÃO Depender 100%**
- ⚠️ Documentos muito genéricos
- ⚠️ Títulos muito curtos ou vagos
- ⚠️ Temas não mapeados nas palavras-chave

---

## 📚 Referências

- **Lei 14.133/2021**: `data/lei-14133-artigos.ts`
- **Keyword Mapper**: `lib/keyword-mapper.ts` (50+ mapeamentos)
- **Documentação Completa**: Este arquivo

---

## 🐛 Troubleshooting

### **"Nenhum artigo sugerido"**
- Verifique se preencheu o título
- Tente adicionar descrição mais detalhada
- Use termos técnicos da lei

### **"Erro ao extrair texto do PDF"**
- Normal! Extração de PDF ainda não implementada
- Sistema automaticamente usa análise de metadados
- Instale `pdf-parse` para habilitar

### **Sugestões com baixa confiança**
- Revise manualmente antes de aplicar
- Combine com seleção manual
- Sugestões de baixa confiança podem estar corretas, mas precisam validação

---

**Sistema criado em:** 2025-01-26
**Última atualização:** 2025-01-26
**Versão:** 1.0.0
