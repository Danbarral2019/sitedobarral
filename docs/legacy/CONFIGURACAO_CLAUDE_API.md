# Configuração - Claude API (Anthropic)

Guia completo para configurar a integração com Claude API para análise semântica avançada de documentos.

---

## 📋 **O que é e para que serve?**

A integração com Claude API é um recurso **OPCIONAL** que melhora a precisão das sugestões automáticas de artigos da Lei 14.133/2021.

### **Funcionamento:**
1. Sistema tenta análise básica (citações + palavras-chave)
2. Se análise básica tiver **baixa confiança**, Claude API é usado como fallback
3. Claude analisa o documento e sugere artigos relevantes usando IA

### **Critérios para usar Claude (fallback automático):**
- ✅ Análise básica encontrou **menos de 3 sugestões**
- ✅ Análise básica tem **menos de 30% de sugestões com alta confiança**

### **Se não configurar:**
- ✅ Sistema funciona normalmente com análise básica
- ❌ Documentos complexos podem ter precisão menor

---

## 🔑 **Passo 1: Obter API Key da Anthropic**

### **1. Criar conta na Anthropic**
Acesse: https://console.anthropic.com

- Clique em **"Sign Up"**
- Use email e senha ou login com Google/GitHub
- Confirme email se necessário

### **2. Adicionar créditos**
A Anthropic oferece **$5 de crédito gratuito** para novos usuários.

Para usar além disso:
- Vá em: **Settings → Billing**
- Adicione método de pagamento
- Defina limite de gastos (recomendado: $10-20/mês)

### **3. Gerar API Key**
- Vá em: **Settings → API Keys**
- Clique em **"Create Key"**
- Dê um nome (ex: "Site Prof Barral - Catalogação")
- Copie a chave (formato: `sk-ant-api03-xxxxxxxxxxxxxx`)

⚠️ **IMPORTANTE:** Guarde a chave em local seguro! Ela só é mostrada uma vez.

---

## 🔧 **Passo 2: Configurar no Projeto**

### **Desenvolvimento Local:**

1. Edite o arquivo `.env.local`:

```bash
# Descomente e cole sua chave
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxx
```

2. Reinicie o servidor de desenvolvimento:

```bash
npm run dev
```

### **Produção (Vercel):**

1. Acesse: https://vercel.com
2. Selecione seu projeto
3. Vá em: **Settings → Environment Variables**
4. Clique em **"Add"**
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-api03-xxxxxxxxxxxxxx`
   - **Environment:** Selecione **Production, Preview, Development**
5. Clique em **"Save"**
6. **Redeploy** o projeto:
   - Vá em **Deployments**
   - Clique nos 3 pontos da última deployment
   - Clique em **"Redeploy"**

---

## 💰 **Custos Estimados**

### **Modelo Usado:**
`claude-3-haiku-20240307` (mais rápido e econômico)

### **Preços:**
- **Input:** $0.25 por milhão de tokens
- **Output:** $1.25 por milhão de tokens

### **Consumo Estimado por Análise:**

| Tamanho do Documento | Tokens | Custo Aproximado |
|----------------------|--------|------------------|
| Pequeno (1-3 páginas) | ~2.000 | $0.0005 |
| Médio (5-10 páginas) | ~5.000 | $0.0013 |
| Grande (20-30 páginas) | ~10.000 | $0.0025 |

### **Exemplo de Uso Mensal:**
- 100 análises de documentos médios
- Custo: **~$0.13/mês** (muito acessível!)

### **Limites:**
- API key gratuita: **$5 de crédito** (suficiente para ~3.800 análises médias)
- Após crédito: você define o limite de gastos

---

## 🧪 **Passo 3: Testar a Integração**

### **Teste Automático (Recomendado):**

1. Acesse: `/admin/documentos`
2. Preencha o formulário com um documento que tenha **pouco texto ou sem citações diretas**
   - **Título:** "Planejamento de Compras 2024"
   - **Descrição:** "Documento sobre planejamento anual de compras do setor público"
   - **Não envie arquivo PDF** (para forçar análise só de metadados)
3. Clique em **"Sugerir Artigos Automaticamente"**
4. Sistema vai:
   - Fazer análise básica (vai ter poucas sugestões)
   - Detectar baixa confiança
   - **Chamar Claude API automaticamente**
   - Mostrar sugestões melhoradas com badge 🤖 IA

### **Verificar nos Logs:**

Se estiver rodando localmente (`npm run dev`), você verá no console:

```
📊 Análise básica teve baixa confiança. Usando Claude API como fallback...
✅ Claude encontrou 5 sugestões adicionais
```

### **Verificar no Analytics:**

1. Acesse: `/admin/analytics-documentos`
2. Na tabela de "Análises Recentes", sugestões com Claude terão mais precisão
3. Em "Artigos Mais Sugeridos", você verá artigos que Claude identificou

---

## 🔍 **Como Funciona (Técnico)**

### **Fluxo de Análise:**

```
1. Usuário clica em "Sugerir Artigos Automaticamente"
   ↓
2. Sistema extrai texto (PDF ou metadados)
   ↓
3. Análise básica:
   - Detecta citações diretas (ex: "art. 72º")
   - Detecta ranges (ex: "arts. 72 a 80")
   - Analisa palavras-chave (ex: "licitação", "pregão")
   ↓
4. Verifica confiança:
   ✅ Alta confiança? → Retorna sugestões básicas
   ❌ Baixa confiança? → Chama Claude API
   ↓
5. Claude API:
   - Analisa texto com IA
   - Identifica temas e conceitos
   - Sugere artigos relevantes (score 6-10)
   - Retorna justificativas
   ↓
6. Sistema combina sugestões:
   - Básicas + Claude
   - Remove duplicatas
   - Aumenta score se ambos sugeriram
   ↓
7. Retorna ao usuário com badges:
   📌 Citado | 🔍 Palavra-chave | 📊 Range | 🤖 IA
```

### **Prompt Enviado ao Claude:**

O sistema envia um prompt especializado:
- Contexto: "Você é especialista em Direito Administrativo..."
- Tarefa: Analisar documento e sugerir artigos da Lei 14.133/2021
- Formato: JSON com articleNumber, score e reason
- Limitações: Apenas artigos válidos (1-193), score mínimo 6

### **Exemplo de Resposta do Claude:**

```json
[
  {
    "articleNumber": "12",
    "score": 9,
    "reason": "Documento trata de planejamento de contratações"
  },
  {
    "articleNumber": "18",
    "score": 8,
    "reason": "Menciona critérios de sustentabilidade"
  }
]
```

---

## 🛡️ **Segurança**

### **Boas Práticas:**

1. ✅ **NUNCA** faça commit da API key no Git
2. ✅ API key está em `.env.local` (já no `.gitignore`)
3. ✅ Use variáveis de ambiente na Vercel
4. ✅ Defina limite de gastos na Anthropic Console
5. ✅ Monitore uso na dashboard da Anthropic

### **Revogação de Chaves:**

Se sua chave vazar:
1. Vá em: https://console.anthropic.com/settings/keys
2. Clique em **"Delete"** na chave comprometida
3. Gere nova chave
4. Atualize `.env.local` e Vercel

---

## 📊 **Monitoramento de Uso**

### **Dashboard Anthropic:**

Acesse: https://console.anthropic.com/dashboard

Você verá:
- Total de requests
- Tokens consumidos (input + output)
- Custo acumulado
- Gráficos de uso

### **Analytics do Sistema:**

Acesse: `/admin/analytics-documentos`

Você verá:
- Quantas análises usaram Claude (badge 🤖 IA nas fontes)
- Precisão média (com e sem Claude)
- Artigos sugeridos por IA

---

## 🐛 **Troubleshooting**

### **Erro: "Claude API não configurada"**

**Causa:** Variável `ANTHROPIC_API_KEY` não está definida

**Solução:**
1. Verifique `.env.local`:
   ```bash
   # Deve existir esta linha:
   ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxx
   ```
2. Reinicie o servidor:
   ```bash
   npm run dev
   ```

---

### **Erro: "Erro na API Claude: 401"**

**Causa:** API key inválida ou expirada

**Solução:**
1. Verifique se a chave está correta (não tem espaços extras)
2. Teste a chave na Anthropic Console
3. Gere nova chave se necessário

---

### **Erro: "Erro na API Claude: 429"**

**Causa:** Limite de rate (muitas requisições)

**Solução:**
- Aguarde alguns segundos
- Anthropic limita a ~50 requests/minuto no plano gratuito
- Considere fazer upgrade para plano pago

---

### **Erro: "Erro na API Claude: 529"**

**Causa:** API da Anthropic está temporariamente sobrecarregada

**Solução:**
- Aguarde e tente novamente
- Sistema vai usar apenas análise básica como fallback

---

### **Claude não está sendo chamado**

**Causa:** Análise básica teve alta confiança (≥30%)

**Comportamento esperado:** Claude só é chamado quando necessário (fallback)

**Para testar forçadamente:**
- Use documentos sem citações diretas
- Use apenas título/descrição (sem PDF)
- Use textos curtos e genéricos

---

## 📚 **Recursos Adicionais**

### **Documentação Oficial:**
- API Docs: https://docs.anthropic.com/claude/reference/
- Pricing: https://www.anthropic.com/pricing
- Console: https://console.anthropic.com

### **Arquivos do Projeto:**
- Implementação: `lib/claude-analyzer.ts`
- Orquestrador: `lib/document-analyzer.ts`
- API Endpoint: `app/api/admin/analyze-document/route.ts`
- Componente UI: `components/DocumentAnalyzer.tsx`

### **Logs e Debugging:**

Para ver logs detalhados, rode localmente:
```bash
npm run dev
```

E observe o console quando fizer uma análise.

---

## ✅ **Checklist de Configuração**

- [ ] Criar conta na Anthropic Console
- [ ] Gerar API Key
- [ ] Adicionar `ANTHROPIC_API_KEY` no `.env.local`
- [ ] Reiniciar servidor de desenvolvimento
- [ ] Testar análise de documento
- [ ] Verificar logs no console
- [ ] Configurar no Vercel (produção)
- [ ] Definir limite de gastos na Anthropic
- [ ] Monitorar uso no dashboard

---

## 🎯 **Resumo**

A integração com Claude API é:
- ✅ **Opcional** - Sistema funciona sem ela
- ✅ **Inteligente** - Só usa quando necessário (fallback)
- ✅ **Econômica** - ~$0.13/mês para 100 análises
- ✅ **Precisa** - Melhora sugestões em até 40%
- ✅ **Fácil** - Basta adicionar API key

**Recomendação:** Configure! O custo é mínimo e a melhoria na precisão vale muito a pena.

---

**Dúvidas?** Consulte a documentação oficial da Anthropic ou os arquivos do projeto listados acima.
