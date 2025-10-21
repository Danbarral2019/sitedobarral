# 📧 Guia Completo: Configurar Resend para Envio de Emails

## Por que Resend?

✅ **Mais fácil de configurar** que outros serviços
✅ **API moderna** e simples
✅ **Plano gratuito generoso** (100 emails/dia, 3.000/mês)
✅ **Templates HTML** com suporte a React
✅ **Logs detalhados** de todos os emails enviados

---

## 🚀 PARTE 1: Criar Conta no Resend (2 min)

### **Passo 1.1: Acessar site**

1. Abra seu navegador
2. Acesse: **https://resend.com**
3. Clique no botão: **"Start Building for Free"** ou **"Sign Up"**

### **Passo 1.2: Criar conta**

Você tem 3 opções:

**OPÇÃO A - GitHub (Mais rápido):**
- Clique em: **"Continue with GitHub"**
- Autorize o Resend
- Pronto! ✅

**OPÇÃO B - Google:**
- Clique em: **"Continue with Google"**
- Escolha sua conta Google
- Pronto! ✅

**OPÇÃO C - Email:**
- Digite seu email
- Crie uma senha forte
- Clique em **"Sign Up"**
- Verifique seu email
- Clique no link de confirmação

✅ **Resultado:** Você está logado no Dashboard do Resend

---

## 📨 PARTE 2: Verificar Domínio (10-15 min)

**IMPORTANTE:** Você tem 2 opções:

### **OPÇÃO A: Usar Domínio de Teste (Imediato)** ⚡

Se você **não tem domínio próprio ainda** ou quer **testar primeiro**:

1. **Pular esta parte!** ✅
2. O Resend permite enviar emails de teste do domínio deles: `onboarding@resend.dev`
3. **Limitação:** Só pode enviar para **seu próprio email** (não para usuários reais)
4. **Vantagem:** Funciona imediatamente para testes

→ **Pule para PARTE 3** se escolher esta opção

---

### **OPÇÃO B: Configurar Domínio Próprio** (Recomendado para produção)

Se você tem `profbarral.com.br` (ou outro domínio):

#### **Passo 2.1: Adicionar domínio no Resend**

1. **No Dashboard do Resend:**
   - Menu lateral esquerdo
   - Clique em: **"Domains"**

2. **Adicionar novo domínio:**
   - Clique no botão: **"+ Add Domain"**
   - Digite: `profbarral.com.br` (ou seu domínio)
   - Clique em: **"Add"**

3. **Tela de verificação aparece:**
   - Você verá instruções com registros DNS
   - **NÃO FECHE** esta página (vamos usar depois)

#### **Passo 2.2: Anotar registros DNS**

O Resend vai mostrar algo assim:

```
1. SPF Record
   Type: TXT
   Name: @
   Value: v=spf1 include:_spf.resend.com ~all

2. DKIM Record
   Type: TXT
   Name: resend._domainkey
   Value: p=MIGfMA0GCS...muito_longo...

3. DMARC Record (Opcional)
   Type: TXT
   Name: _dmarc
   Value: v=DMARC1; p=none;
```

**→ Anote ou deixe esta aba aberta!**

#### **Passo 2.3: Adicionar registros no seu provedor de domínio**

Onde você registrou seu domínio? Exemplos:

---

##### **Se usar REGISTRO.BR (Brasil):**

1. Acesse: https://registro.br
2. Faça login
3. **Meus Domínios** → Clique em `profbarral.com.br`
4. Menu: **"DNS"** ou **"Editar Zona"**
5. **Adicionar cada registro:**

   **Registro 1 (SPF):**
   - Tipo: `TXT`
   - Nome: `@` (ou deixe vazio)
   - Dados: `v=spf1 include:_spf.resend.com ~all`
   - TTL: `3600` (ou padrão)
   - Salvar

   **Registro 2 (DKIM):**
   - Tipo: `TXT`
   - Nome: `resend._domainkey`
   - Dados: [copie o valor gigante que o Resend mostrou]
   - TTL: `3600`
   - Salvar

   **Registro 3 (DMARC - Opcional):**
   - Tipo: `TXT`
   - Nome: `_dmarc`
   - Dados: `v=DMARC1; p=none;`
   - TTL: `3600`
   - Salvar

---

##### **Se usar HOSTGATOR:**

1. Acesse: https://hostgator.com.br
2. Login → **Portal do Cliente**
3. **Meus Domínios** → Selecione o domínio
4. **Gerenciar DNS** ou **Editor de Zona DNS**
5. **Adicionar registros** (mesmo processo acima)

---

##### **Se usar CLOUDFLARE:**

1. Acesse: https://dash.cloudflare.com
2. Selecione seu domínio
3. Aba: **"DNS"** → **"Records"**
4. Clique em: **"Add record"**
5. Adicione os 3 registros (SPF, DKIM, DMARC)

**IMPORTANTE no Cloudflare:**
- Status do proxy: **DNS only** (nuvem cinza, não laranja)
- Não usar proxy para registros de email!

---

##### **Se usar VERCEL Domains:**

1. Dashboard Vercel → Seu projeto
2. **Settings** → **Domains**
3. Clique no domínio
4. **DNS Records**
5. Add Record → adicione os 3 registros

---

#### **Passo 2.4: Verificar domínio no Resend**

1. **Volte para o Resend** (aba que você deixou aberta)
2. **Aguarde 5-10 minutos** (propagação DNS)
3. Clique no botão: **"Verify DNS Records"**

**Resultados possíveis:**

✅ **Sucesso:** Todos os 3 registros validados!
- Status: **"Verified"** (verde)
- Pode enviar emails! 🎉

⏳ **Pendente:** "DNS records not found yet"
- **Aguarde mais 10-30 minutos**
- Propagação DNS pode demorar
- Tente "Verify" de novo depois

❌ **Erro:** "Record not found" ou "Invalid value"
- Verifique se copiou os valores corretamente
- Verifique se usou o Type correto (TXT)
- Verifique se o Nome está certo
- Aguarde mais tempo

**Dica:** DNS pode demorar até 48h, mas geralmente funciona em 10-30 min.

---

## 🔑 PARTE 3: Gerar API Key (1 min)

Agora vamos gerar a chave que o site vai usar:

### **Passo 3.1: Criar API Key**

1. **No Dashboard do Resend:**
   - Menu lateral: **"API Keys"**

2. **Criar nova chave:**
   - Clique no botão: **"+ Create API Key"**

3. **Configurar a chave:**
   - **Name:** Digite um nome descritivo
     - Exemplo: `Produção - Site Prof Barral`
     - Ou: `profbarral.com.br - Production`

   - **Permission:** Selecione
     - ✅ **"Full Access"** (recomendado)
     - Ou: **"Sending access"** (se quiser restringir)

   - **Domain (se configurou domínio próprio):**
     - Selecione: `profbarral.com.br`
     - Ou: Deixe "All Domains"

4. **Criar:**
   - Clique em: **"Create"** ou **"Add"**

### **Passo 3.2: Copiar a API Key**

**⚠️ ATENÇÃO - MUITO IMPORTANTE:**

Aparecerá uma janela com sua API Key:

```
re_123abc456def789ghi012jkl345mno678
```

**ESTA É A ÚNICA VEZ QUE VOCÊ VERÁ A CHAVE COMPLETA!**

1. **Copie imediatamente** (Ctrl+C ou botão Copy)
2. **Cole em um lugar seguro:**
   - Bloco de notas
   - Gerenciador de senhas
   - Arquivo .env.local (local)
   - **NÃO compartilhe com ninguém!**

3. **Clique em "Done" ou feche a janela**

✅ **Resultado:** Você tem a API Key salva

**Se perdeu a chave:** Delete e crie outra (é seguro fazer isso)

---

## 🔗 PARTE 4: Adicionar na Vercel (2 min)

Agora vamos conectar o Resend ao seu site:

### **Passo 4.1: Acessar Vercel**

1. Volte para: https://vercel.com/dashboard
2. Abra seu projeto: **"site-prof-barral"**
3. Vá em: **Settings** → **Environment Variables**

### **Passo 4.2: Adicionar RESEND_API_KEY**

1. **Clique em: "Create new"** (botão verde no topo)

2. **Preencher campos:**
   - **Key:** Digite exatamente `RESEND_API_KEY`
   - **Value:** Cole a chave que você copiou
     - Deve começar com `re_`
     - Exemplo: `re_123abc456def789...`

   - **Environments:** Marque TODOS ✅
     - [x] Production
     - [x] Preview
     - [x] Development

3. **Salvar:**
   - Clique em: **"Save"**

### **Passo 4.3: Adicionar EMAIL_FROM**

1. **Clique em: "Create new"** novamente

2. **Preencher:**
   - **Key:** Digite `EMAIL_FROM`
   - **Value:** Digite o email que vai aparecer como remetente

   **Se configurou domínio próprio:**
   ```
   contato@profbarral.com.br
   ```
   Ou:
   ```
   Prof. Daniel Barral <contato@profbarral.com.br>
   ```

   **Se está usando domínio de teste:**
   ```
   onboarding@resend.dev
   ```

   - **Environments:** Marque todos ✅

3. **Salvar**

✅ **Resultado:** Variáveis de email configuradas!

---

## 🧪 PARTE 5: Testar Envio (5 min)

Vamos testar se está funcionando:

### **Opção A: Testar Localmente Primeiro**

1. **Atualizar .env.local:**

```bash
# No seu arquivo .env.local (local, não commitar!)
RESEND_API_KEY=re_sua_chave_aqui
EMAIL_FROM=contato@profbarral.com.br

# Ou se estiver usando domínio de teste:
EMAIL_FROM=onboarding@resend.dev
```

2. **Reiniciar servidor:**

```bash
# Se estiver rodando, parar (Ctrl+C)
npm run dev
```

3. **Testar registro:**
   - Acesse: http://localhost:3000/registro
   - Crie uma conta de teste com **SEU email real**
   - Verifique se recebeu email de verificação

4. **Verificar nos logs:**

No terminal, você deve ver:
```
✅ Email enviado com sucesso: {
  to: 'seu-email@example.com',
  subject: 'Confirme seu email - Prof. Daniel Barral',
  id: 're_abc123...'
}
```

5. **Verificar no Resend:**
   - Dashboard Resend → **"Emails"**
   - Você deve ver o email enviado
   - Status: **"Delivered"** (verde) ✅

---

### **Opção B: Testar em Produção (Após Deploy)**

Depois do deploy na Vercel:

1. **Acesse seu site:** `https://seu-site.vercel.app`
2. **Registre um usuário teste:** `/registro`
3. **Use seu email real**
4. **Verifique:**
   - Email chegou? ✅
   - Verificar no Resend Dashboard se foi enviado
   - Clicar no link de verificação funciona?

---

## 🎯 Checklist Final

Após seguir todos os passos:

### **Configuração Básica (Domínio de Teste):**
- [ ] Conta criada no Resend
- [ ] API Key gerada e copiada
- [ ] `RESEND_API_KEY` adicionada na Vercel
- [ ] `EMAIL_FROM=onboarding@resend.dev` na Vercel
- [ ] Testou localmente e funcionou

### **Configuração Completa (Domínio Próprio):**
- [ ] Conta criada no Resend
- [ ] Domínio adicionado no Resend
- [ ] Registros DNS (SPF, DKIM, DMARC) configurados
- [ ] Domínio verificado (status verde)
- [ ] API Key gerada
- [ ] `RESEND_API_KEY` na Vercel
- [ ] `EMAIL_FROM=contato@profbarral.com.br` na Vercel
- [ ] Testou e emails chegam

---

## ❓ Troubleshooting

### **Problema: "API key is invalid"**

**Causa:** Chave incorreta ou não configurada

**Solução:**
1. Verificar se copiou a chave completa
2. Verificar se começa com `re_`
3. Gerar nova chave no Resend se necessário
4. Atualizar na Vercel
5. Fazer redeploy

---

### **Problema: "Emails vão para SPAM"**

**Causa:** Domínio não verificado ou falta de registros DNS

**Solução:**
1. Verificar se domínio está com status "Verified" no Resend
2. Adicionar registro DMARC se não adicionou
3. Configurar SPF, DKIM corretamente
4. Aguardar reputação do domínio melhorar (1-2 semanas)
5. Pedir aos usuários para marcar como "Não é spam"

---

### **Problema: "Domain not verified"**

**Causa:** Registros DNS não propagaram ou incorretos

**Solução:**
1. Verificar registros DNS com ferramenta:
   - https://mxtoolbox.com/SuperTool.aspx
   - Digite: `profbarral.com.br`
   - Verificar TXT records

2. Aguardar mais tempo (até 48h)

3. Verificar se copiou valores corretamente

4. Se usar Cloudflare: desligar proxy (DNS only)

---

### **Problema: "Rate limit exceeded"**

**Causa:** Ultrapassou limite do plano free

**Solução:**
1. Resend Free: 100 emails/dia, 3.000/mês
2. Verificar Dashboard → Usage
3. Aguardar reset diário (00:00 UTC)
4. Ou fazer upgrade para plano pago

---

### **Problema: Emails não chegam (sem erro)**

**Causa:** Pode estar na caixa de spam ou bloqueado

**Solução:**
1. Verificar pasta de spam/lixo eletrônico
2. Verificar no Resend Dashboard se email foi enviado
3. Ver status: Delivered, Bounced, Complained
4. Se "Bounced": email destinatário inválido
5. Se "Complained": usuário marcou como spam

---

## 📊 Planos do Resend

### **Free (Gratuito):**
- ✅ 3.000 emails/mês
- ✅ 100 emails/dia
- ✅ 1 domínio
- ✅ 1 usuário
- ⚠️ Marca "via Resend" em emails de domínio de teste

### **Pro ($20/mês):**
- 📈 50.000 emails/mês inclusos
- 📈 Domínios ilimitados
- 📈 10 usuários
- 📈 Suporte prioritário
- 📈 Webhooks
- 📈 Remove marca "via Resend"

**Para começar:** Free é mais que suficiente!

---

## 🎓 Recursos Úteis

- **Documentação Resend:** https://resend.com/docs
- **Verificar DNS:** https://mxtoolbox.com
- **Testar SPF/DKIM:** https://www.mail-tester.com
- **Templates React:** https://resend.com/docs/send-with-react

---

## ✅ Próximo Passo

Depois de configurar o Resend:

1. **Voltar para o deploy da Vercel**
2. **Adicionar outras variáveis** (JWT_SECRET, CRON_SECRET)
3. **Fazer redeploy**
4. **Testar o site em produção**

---

**Pronto! Agora você tem emails funcionando perfeitamente! 📧✨**
