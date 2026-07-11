# 🔒 Guia Seguro: Configurar Chave API Gemini

**Status:** ✅ Chave antiga revogada, nova chave gerada
**Objetivo:** Configurar a nova chave SEM expor no Git

---

## ✅ MÉTODO CORRETO: Variáveis de Ambiente

### Passo 1: Adicionar ao .env.local

O arquivo `.env.local` já está no `.gitignore`, então é seguro:

```bash
# Abra o arquivo .env.local no editor (ou crie se não existir)
notepad .env.local
```

Adicione esta linha (substitua pela sua chave real):
```bash
GEMINI_API_KEY=SUA_CHAVE_REAL_AQUI
```

**Exemplo:**
```bash
GEMINI_API_KEY=AIzaSyDexamplekey123456789abcdefg
```

Salve e feche o arquivo.

### Passo 2: Configurar Variável de Ambiente do Sistema (Windows)

Isso permite que o Claude Code acesse a chave:

**Opção A: Via PowerShell (Recomendado)**
```powershell
# Execute como Administrador
[System.Environment]::SetEnvironmentVariable('GEMINI_API_KEY', 'SUA_CHAVE_REAL_AQUI', 'User')
```

**Opção B: Via Painel de Controle**
1. Pressione `Win + R`
2. Digite: `sysdm.cpl` + Enter
3. Aba "Avançado" → "Variáveis de Ambiente"
4. Em "Variáveis do usuário", clique "Novo"
5. Nome: `GEMINI_API_KEY`
6. Valor: `SUA_CHAVE_REAL_AQUI`
7. OK → OK → OK

### Passo 3: Verificar Configuração

```powershell
# Verificar que a variável foi configurada
echo $env:GEMINI_API_KEY

# Deve mostrar os primeiros caracteres da sua chave
```

### Passo 4: Reiniciar Terminal/VSCode

Para que as mudanças tenham efeito:
1. Feche TODOS os terminais abertos
2. Feche o VSCode (se estiver aberto)
3. Reabra o VSCode
4. Abra um novo terminal

---

## 🧪 TESTAR A CONFIGURAÇÃO

### Teste 1: Verificar Variável
```powershell
$env:GEMINI_API_KEY
# Deve mostrar sua chave
```

### Teste 2: Verificar .env.local
```bash
cat .env.local | grep GEMINI
# Deve mostrar: GEMINI_API_KEY=...
```

### Teste 3: Verificar que NÃO está no Git
```bash
git ls-files | grep ".env.local"
# NÃO deve retornar nada (arquivo ignorado)
```

### Teste 4: Testar MCP Gemini
No Claude Code, execute:
```bash
mcp__gemini__gemini_query "Diga apenas 'Configuração OK!'"
```

Se retornar "Configuração OK!", está funcionando! ✅

---

## ❌ NUNCA FAÇA ISSO

### ❌ NÃO hardcode a chave em scripts:
```powershell
# ❌ ERRADO - NÃO FAÇA ISSO!
$apiKey = "AIzaSyD..."
```

### ❌ NÃO comite .env.local:
```bash
# ❌ ERRADO!
git add .env.local
git add .env
```

### ❌ NÃO coloque a chave em arquivos rastreados:
```typescript
// ❌ ERRADO!
const GEMINI_KEY = "AIzaSyD...";
```

---

## ✅ SEMPRE FAÇA ISSO

### ✅ Use variável de ambiente:
```powershell
# ✅ CORRETO
$apiKey = [System.Environment]::GetEnvironmentVariable('GEMINI_API_KEY', 'User')
if (-not $apiKey) {
    Write-Error "GEMINI_API_KEY não configurada!"
    exit 1
}
# Agora use $apiKey
```

### ✅ Use process.env em Node.js/TypeScript:
```typescript
// ✅ CORRETO
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY not set');
}
```

### ✅ Verifique antes de commitar:
```bash
# Antes de cada commit, verifique:
git diff --cached | grep -i "aiza"
# Se encontrar algo, NÃO comite!
```

---

## 🔐 ESTRUTURA SEGURA DO MCP SERVER

O MCP server já está configurado corretamente em `mcp-server-gemini/src/index.ts`:

```typescript
// ✅ Código atual (correto)
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY environment variable not set');
}
```

E no `.claude/settings.local.json` (também correto):

```json
{
  "mcpServers": {
    "gemini": {
      "command": "node",
      "args": ["C:/path/to/mcp-server-gemini/build/index.js"],
      "env": {
        "GEMINI_API_KEY": "${GEMINI_API_KEY}"  // ✅ Lê da variável
      }
    }
  }
}
```

---

## 📋 CHECKLIST DE SEGURANÇA

Marque cada item após completar:

- [ ] Chave adicionada ao `.env.local`
- [ ] `.env.local` NÃO está no Git (`git ls-files` não mostra)
- [ ] Variável de ambiente configurada no sistema
- [ ] Terminal/VSCode reiniciado
- [ ] Teste `echo $env:GEMINI_API_KEY` funcionou
- [ ] Teste do MCP Gemini retornou sucesso
- [ ] Nenhum arquivo `.ps1` com chave hardcoded
- [ ] `.gitignore` tem proteções para `*-definitivo.ps1`
- [ ] Commit não contém strings "AIza"

---

## 🚀 PRÓXIMOS PASSOS

Após configurar a chave:

1. **Limpar histórico Git:**
   ```bash
   # Execute o script que criei
   limpar-historico-git.bat
   ```

2. **Force push para GitHub:**
   ```bash
   git push origin main --force
   ```

3. **Verificar no GitHub:**
   - Vá para: https://github.com/seu-usuario/sitedobarral
   - Verifique que o commit `c8a161d` não aparece mais
   - Verifique que `configurar-gemini-definitivo.ps1` não existe

---

## 🆘 SOLUÇÃO DE PROBLEMAS

### "GEMINI_API_KEY not set"
1. Verificar que variável foi configurada: `echo $env:GEMINI_API_KEY`
2. Reiniciar terminal/VSCode
3. Reconfigurar variável de ambiente

### MCP não funciona
1. Verificar que o server foi buildado: `cd mcp-server-gemini && npm run build`
2. Testar manualmente: `node mcp-server-gemini/build/index.js`
3. Verificar logs: `claude mcp logs gemini`

### Chave ainda aparece no histórico Git
1. Executar: `limpar-historico-git.bat`
2. Fazer force push: `git push origin main --force`
3. Aguardar GitHub processar (pode levar alguns minutos)

---

## 📞 PRECISA DE AJUDA?

Se algo não funcionar:
1. Execute: `claude mcp list` para ver status dos MCPs
2. Execute: `echo $env:GEMINI_API_KEY | Measure-Object -Character` para verificar tamanho da chave
3. Compartilhe a mensagem de erro (SEM a chave!)

---

**Criado por:** Claude Code
**Data:** 2025-11-04
**Versão:** 1.0 (Guia Seguro)
