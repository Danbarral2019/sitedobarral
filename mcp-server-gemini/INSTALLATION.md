# Instalação Completa - MCP Gemini

## ✅ Status

- [x] MCP Server criado usando SDK oficial do Google
- [x] TypeScript compilado
- [x] Dependências instaladas (`@google/generative-ai`)
- [x] MCP adicionado ao Claude Code
- [ ] **API Key configurada** ← PRÓXIMO PASSO
- [ ] Testado

## 🎯 Visão Geral

Este MCP server usa a **SDK oficial do Google** (`@google/generative-ai`), não CLI. Isso significa:
- ✅ Mais confiável e performático
- ✅ Sem dependências externas
- ✅ Funciona nativamente com a API do Gemini

## 📦 Passo 1: Verificar Instalação

Tudo já foi instalado! Verifique:

```bash
cd mcp-server-gemini
npm list
# Deve mostrar @google/generative-ai@^0.21.0
```

## 🔑 Passo 2: Obter API Key do Gemini

### 2.1 Acessar Google AI Studio
Abra: https://aistudio.google.com/app/apikey

### 2.2 Criar API Key
1. Clique em "Get API key" ou "Create API key"
2. Selecione "Create API key in new project" (ou use projeto existente)
3. Copie a chave gerada (algo como `AIza...`)

## ⚙️ Passo 3: Configurar API Key

### Opção A: Variável de Ambiente Global (Recomendado)

**Windows:**
```cmd
setx GEMINI_API_KEY "AIza..."
```

**IMPORTANTE:** Após usar `setx`, você DEVE:
1. Fechar todos os terminais abertos
2. Fechar e reabrir o Claude Code
3. A variável só estará disponível em novas sessões

**Linux/Mac:**
```bash
export GEMINI_API_KEY="AIza..."
# Adicione ao ~/.bashrc ou ~/.zshrc para persistir
echo 'export GEMINI_API_KEY="AIza..."' >> ~/.bashrc
```

### Opção B: Arquivo .env.local (Alternativa)

Adicione ao `.env.local` do projeto principal:

```bash
# C:\Projeto de site do Barral\projeto do site no claude\site-prof-barral\.env.local
GEMINI_API_KEY=AIza...
```

**Nota:** O MCP server roda como processo separado e lerá a variável de ambiente do sistema, não do .env.local. Use Opção A.

## 🧪 Passo 4: Verificar MCP

```bash
# Listar MCPs instalados
claude mcp list

# Deve mostrar:
# gemini: node "C:\...\build\index.js" - ✓ Connected (após configurar API key)
# OU
# gemini: node "C:\...\build\index.js" - ✗ Failed (se API key não configurada)
```

## 🚀 Passo 5: Testar Integração

### 5.1 Reiniciar Claude Code
Depois de configurar a API key, **feche completamente e reabra o Claude Code**.

### 5.2 Testar em Conversa

Tente:
```
User: "Ask Gemini what it thinks about TypeScript for backend development"
```

Ou simplesmente:
```
User: "What does Gemini think about using React Server Components?"
```

Claude automaticamente invocará o tool apropriado!

## 🔧 Troubleshooting

### "GEMINI_API_KEY not set"

**Solução:**
1. Configure a variável: `setx GEMINI_API_KEY "sua-key"`
2. **Feche e reabra Claude Code completamente**
3. Verifique se funcionou:
```cmd
echo %GEMINI_API_KEY%
# Deve mostrar sua key (em novo terminal)
```

### "Failed to connect" no `claude mcp list`

**Soluções:**

1. **Rebuild do server:**
```bash
cd mcp-server-gemini
npm run build
```

2. **Remover e readicionar MCP:**
```bash
claude mcp remove gemini
claude mcp add gemini "node \"C:\\Projeto de site do Barral\\projeto do site no claude\\site-prof-barral\\mcp-server-gemini\\build\\index.js\""
```

3. **Verificar logs:**
   - Logs aparecem no Claude Code quando você tenta usar o tool
   - Procure por erros relacionados à API key

### API Key Inválida

**Sintomas:**
- MCP conecta, mas retorna erro ao usar

**Solução:**
1. Gerar nova key em: https://aistudio.google.com/app/apikey
2. Reconfigurar: `setx GEMINI_API_KEY "nova-key"`
3. Reiniciar Claude Code

### Rate Limit / Quota Exceeded

**Sintomas:**
- Erro "429 Too Many Requests" ou "quota exceeded"

**Solução:**
- Aguardar reset do rate limit (geralmente por minuto)
- Considerar upgrade para plano pago: https://ai.google.dev/pricing
- Free tier: 15 requests/minute, 1500 requests/day (Gemini 1.5 Pro)

## 📊 Verificar Configuração

Execute este script PowerShell para verificar:

```powershell
# verificar-gemini.ps1
Write-Host "🔍 Verificando configuração do Gemini MCP..."
Write-Host ""

# 1. Verificar API Key
if ($env:GEMINI_API_KEY) {
    Write-Host "✅ GEMINI_API_KEY configurada" -ForegroundColor Green
    Write-Host "   Key: $($env:GEMINI_API_KEY.Substring(0,8))..." -ForegroundColor Gray
} else {
    Write-Host "❌ GEMINI_API_KEY não encontrada" -ForegroundColor Red
}

# 2. Verificar build
if (Test-Path ".\build\index.js") {
    Write-Host "✅ Server compilado (build/index.js existe)" -ForegroundColor Green
} else {
    Write-Host "❌ Server não compilado" -ForegroundColor Red
    Write-Host "   Execute: npm run build" -ForegroundColor Yellow
}

# 3. Verificar dependências
$packageJson = Get-Content "package.json" | ConvertFrom-Json
if ($packageJson.dependencies.'@google/generative-ai') {
    Write-Host "✅ SDK Gemini instalada" -ForegroundColor Green
} else {
    Write-Host "❌ SDK Gemini não instalada" -ForegroundColor Red
}
```

Salve como `verificar-gemini.ps1` e execute:
```powershell
cd mcp-server-gemini
powershell -ExecutionPolicy Bypass -File verificar-gemini.ps1
```

## 🎯 Próximos Passos

1. ✅ Instalar dependências (já feito)
2. ✅ Compilar TypeScript (já feito)
3. ✅ Registrar MCP (já feito)
4. **⏳ Configurar GEMINI_API_KEY** (faça agora!)
5. ⏳ Reiniciar Claude Code
6. ⏳ Testar integração

## 📚 Documentação Adicional

- **QUICKSTART.md** - Guia rápido de uso
- **README.md** - Documentação completa dos tools
- **Google AI Studio:** https://aistudio.google.com
- **Gemini API Docs:** https://ai.google.dev/docs
- **Pricing:** https://ai.google.dev/pricing

## 💰 Custos

**Free Tier (Suficiente para desenvolvimento):**
- Gemini 1.5 Pro: 15 req/min, 1500 req/dia, 1M tokens/dia
- Gemini 1.5 Flash: 15 req/min, 1500 req/dia, 1M tokens/dia

Monitore uso em: https://aistudio.google.com/app/apikey

---

**Pronto!** Após configurar a API key e reiniciar Claude Code, você terá acesso a todos os 5 tools do Gemini! 🚀
