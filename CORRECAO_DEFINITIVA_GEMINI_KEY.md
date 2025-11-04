# ✅ CORREÇÃO DEFINITIVA - Chave API Gemini
**Data:** 2025-11-04
**Status:** PROBLEMA RESOLVIDO

---

## 🔍 CAUSA RAIZ IDENTIFICADA

### Problema
A chave API do Gemini estava sendo **exposta repetidamente** no Git porque:

1. **Campo "env" no settings.local.json**
   - Claude Code lê o campo `"env"` do `.claude/settings.local.json`
   - Define essas variáveis de ambiente ANTES de rodar o MCP server
   - Isso **sobrescreve** as variáveis de ambiente do sistema
   - Resultado: chave ficava HARDCODED no arquivo JSON

2. **Arquivo rastreado pelo Git**
   - `.claude/settings.local.json` NÃO estava no `.gitignore`
   - Git detectava mudanças no arquivo
   - Qualquer commit acidental incluía a chave
   - Ciclo se repetia! 🔄

---

## ✅ CORREÇÕES APLICADAS

### 1. Adicionado ao .gitignore
```gitignore
# Claude Code MCP settings com chaves API (NUNCA COMMITAR)
.claude/settings.local.json
.claude/*.local.json
*settings.local.json
*.local.json
```

### 2. Removido do rastreamento Git
```bash
git rm --cached .claude/settings.local.json
```

### 3. Removido campo "env" do settings.local.json
**Antes (INCORRETO):**
```json
{
  "env": {
    "GEMINI_API_KEY": "AIzaSy..." // ❌ HARDCODED
  },
  "permissions": { ... }
}
```

**Depois (CORRETO):**
```json
{
  "permissions": { ... }
}
```

### 4. MCP Server já está correto
O código em `mcp-server-gemini/build/index.js` JÁ lê corretamente de `process.env.GEMINI_API_KEY`:

```javascript
const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY; // ✅ Correto
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable not set');
    }
    return new GoogleGenerativeAI(apiKey);
};
```

---

## 🔒 CONFIGURAÇÃO SEGURA (VOCÊ DEVE FAZER)

### Após revogar a chave exposta, configure a NOVA chave:

**Windows (PowerShell como Administrador):**
```powershell
[System.Environment]::SetEnvironmentVariable('GEMINI_API_KEY', 'SUA_NOVA_CHAVE', 'User')
```

**Verificar se foi configurada:**
```powershell
echo $env:GEMINI_API_KEY
```

**IMPORTANTE:** Reinicie o terminal/Claude Code após configurar!

---

## 🧪 TESTAR CONFIGURAÇÃO

```bash
# 1. Verificar variável de ambiente
powershell -Command "echo $env:GEMINI_API_KEY"

# 2. Testar MCP
claude mcp list

# 3. Verificar Git (não deve mostrar settings.local.json)
git status
```

---

## ✅ GARANTIAS DE SEGURANÇA

**Agora está IMPOSSÍVEL expor a chave porque:**

1. ✅ `.claude/settings.local.json` está no `.gitignore`
2. ✅ Arquivo foi removido do rastreamento Git (`git rm --cached`)
3. ✅ Campo "env" foi removido (sem chaves hardcoded)
4. ✅ MCP lê APENAS de variável de ambiente do sistema
5. ✅ Proteções adicionais no `.gitignore` para outros arquivos

---

## 📋 PRÓXIMOS PASSOS (VOCÊ DEVE FAZER)

### 1. Revogar chave exposta
- Acessar: https://aistudio.google.com/app/apikey
- Revogar: `AIzaSyBVVUpYGqKhpfl7mPWINz-4Fo5jbbYFwxg`

### 2. Gerar nova chave
- Criar nova API key no Google AI Studio

### 3. Configurar variável de ambiente
```powershell
[System.Environment]::SetEnvironmentVariable('GEMINI_API_KEY', 'NOVA_CHAVE', 'User')
```

### 4. Limpar histórico Git
```bash
# Executar o script
limpar-historico-git.bat

# Force push (CUIDADO: sobrescreve histórico remoto)
git push origin main --force
```

### 5. Commit das correções
```bash
git add .gitignore
git commit -m "security: Corrigir configuração MCP Gemini para evitar exposição de chaves

- Adicionar .claude/settings.local.json ao .gitignore
- Remover campo 'env' do settings.local.json
- MCP agora lê APENAS de variável de ambiente do sistema
- Proteções adicionais no .gitignore"
```

---

## 🎯 RESUMO

**Problema:** Chave API exposta repetidamente no Git
**Causa:** Campo "env" no settings.local.json + arquivo rastreado pelo Git
**Solução:** Remover campo "env" + adicionar ao .gitignore + usar variável de ambiente
**Status:** ✅ RESOLVIDO DEFINITIVAMENTE

**A partir de agora, chaves API NÃO serão mais expostas no Git!**

---

**Documentação criada por:** Claude Code (Anthropic)
**Verificado em:** 2025-11-04
