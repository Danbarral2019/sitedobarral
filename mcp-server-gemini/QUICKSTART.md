# Guia Rápido - MCP Gemini

## ✅ Status da Instalação

- [x] MCP Server criado
- [x] SDK oficial instalada (`@google/generative-ai`)
- [x] TypeScript compilado
- [x] MCP registrado no Claude Code
- [ ] **API Key configurada** ← VOCÊ ESTÁ AQUI
- [ ] Testado

## 🔑 Passo 1: Obter API Key do Gemini

### 1.1 Acessar Google AI Studio
Abra: https://aistudio.google.com/app/apikey

### 1.2 Criar API Key
1. Clique em "Get API key"
2. Escolha "Create API key in new project" (ou use projeto existente)
3. Copie a chave gerada

### 1.3 Configurar API Key

**Windows (Permanente):**
```cmd
setx GEMINI_API_KEY "sua-api-key-aqui"
```

**Ou adicione ao `.env.local` do projeto:**
```bash
# No arquivo: C:\Projeto de site do Barral\projeto do site no claude\site-prof-barral\.env.local
GEMINI_API_KEY=sua-api-key-aqui
```

**Importante:** Após usar `setx`, você precisa fechar e reabrir o terminal/Claude Code.

## 🧪 Passo 2: Verificar Instalação

```bash
# Verificar se MCP está registrado
claude mcp list
# Deve mostrar "gemini" na lista
```

## 🚀 Passo 3: Testar

**Reinicie o Claude Code** e teste:

```
User: "Can you ask Gemini what it thinks about using TypeScript for backend development?"
```

Claude automaticamente invocará o tool `gemini_query` e você verá a resposta do Gemini!

## 🛠️ Tools Disponíveis

### 1. `gemini_query` - Perguntas Gerais
```
"Ask Gemini about React best practices"
```

### 2. `gemini_code_review` - Revisão de Código
```
"Ask Gemini to review this function"
[Claude envia código automaticamente]
```

### 3. `gemini_compare_approaches` - Comparar Soluções
```
"Ask Gemini to compare Redux vs Context API"
```

### 4. `gemini_brainstorm` - Brainstorming
```
"Ask Gemini to brainstorm solutions for handling file uploads"
```

### 5. `gemini_collaborate` - Colaboração Geral
```
"Get Gemini's opinion on my authentication implementation"
```

## 📊 Exemplo de Uso Real

```
User: "I need to implement caching for this API"

Claude: "Let me consult with Gemini on the best caching approach..."
[Invoca gemini_compare_approaches]

Gemini: "For your use case (high reads, low writes), I recommend:
1. Redis: Best performance, requires infrastructure
2. In-memory: Simple, limited by RAM
3. CDN: Great for static content..."

Claude: "Based on Gemini's analysis, I recommend Redis because..."
[Claude implementa solução]
```

## 🔧 Verificar Status

```bash
# Ver status de todos MCPs
claude mcp list

# Ver logs do MCP (se houver problemas)
# Os logs aparecem automaticamente no Claude Code
```

## ❌ Troubleshooting

### "GEMINI_API_KEY not set"
**Solução:**
```cmd
setx GEMINI_API_KEY "sua-key"
# Feche e reabra Claude Code
```

### "Failed to connect"
**Soluções:**
1. Verificar se o build foi feito: `cd mcp-server-gemini && npm run build`
2. Remover e readicionar MCP:
```bash
claude mcp remove gemini
claude mcp add gemini "node \"C:\\Projeto de site do Barral\\projeto do site no claude\\site-prof-barral\\mcp-server-gemini\\build\\index.js\""
```

### API Key inválida
**Solução:**
1. Verificar se a key é válida em: https://aistudio.google.com/app/apikey
2. Gerar nova key se necessário
3. Reconfigurar: `setx GEMINI_API_KEY "nova-key"`

## 🎯 Próximos Passos

1. Configure a API key (acima)
2. Reinicie Claude Code
3. Teste: "Ask Gemini about Next.js 15 features"
4. Use naturalmente! Claude decidirá quando consultar Gemini

## 📝 Notas

- Claude invoca Gemini **automaticamente** quando relevante
- Você não precisa mencionar "Gemini" explicitamente (mas pode)
- Custos da API Gemini: verifique em https://ai.google.dev/pricing
- Rate limits: Gemini free tier tem limites, veja documentação

## 🤝 Workflow Colaborativo

```
Você → Claude → Gemini
         ↓
    Implementação
    (Claude usa input de ambos AIs)
```

**Exemplo:**
- Claude implementa solução principal
- Consulta Gemini para validação/alternativas
- Apresenta resultado combinado para você

Pronto para testar? Configure a API key e reinicie o Claude Code! 🚀
