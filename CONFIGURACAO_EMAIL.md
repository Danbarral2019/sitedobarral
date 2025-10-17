# 📧 Guia Completo de Configuração de Email - Resend

Este guia explica passo a passo como configurar o envio de emails usando o Resend.

---

## 🎯 Por que usar Resend?

- ✅ **Gratuito** - 100 emails/dia no plano free (3.000/mês)
- ✅ **Fácil configuração** - Setup em 5 minutos
- ✅ **Confiável** - Alta taxa de entrega
- ✅ **Moderno** - API simples e intuitiva
- ✅ **Sem cartão** - Não precisa de cartão de crédito para começar

---

## 📋 PASSO 1: Criar Conta no Resend

### 1.1 - Acessar o Site

Acesse: **https://resend.com**

### 1.2 - Criar Conta

1. Clique em **"Sign Up"** (Cadastrar-se)
2. Você pode cadastrar usando:
   - Email e senha
   - GitHub
   - Google

**Recomendação:** Use o email profissional do professor (ex: `contato@profbarral.com.br`)

### 1.3 - Confirmar Email

1. Verifique sua caixa de entrada
2. Clique no link de confirmação enviado pelo Resend
3. Faça login na plataforma

---

## 🔧 PASSO 2: Gerar API Key

### 2.1 - Acessar Configurações

1. No dashboard do Resend, vá em **"API Keys"** no menu lateral
2. Clique em **"Create API Key"**

### 2.2 - Criar a Chave

1. **Name (Nome):** Digite um nome descritivo
   - Exemplo: "Produção Site Prof. Barral"
   - Exemplo: "Desenvolvimento Local"

2. **Permission (Permissão):** Selecione **"Full access"**
   - Permite enviar emails e acessar todas as funcionalidades

3. Clique em **"Create"**

### 2.3 - Copiar a Chave

⚠️ **IMPORTANTE:** A chave só será exibida UMA VEZ!

1. Copie a chave gerada (formato: `re_xxxxxxxxxxxxx`)
2. Guarde em local seguro
3. **NÃO compartilhe** esta chave publicamente

---

## 🌐 PASSO 3: Configurar Domínio (OPCIONAL mas RECOMENDADO)

### Opção A: Usar Domínio Próprio (Recomendado para Produção)

#### 3.1 - Adicionar Domínio

1. No Resend, vá em **"Domains"** no menu lateral
2. Clique em **"Add Domain"**
3. Digite o domínio: `profbarral.com.br`
4. Clique em **"Add"**

#### 3.2 - Configurar DNS

O Resend vai fornecer registros DNS para adicionar no seu provedor de domínio.

**Registros a adicionar:**

```
Tipo: TXT
Nome: @
Valor: [valor fornecido pelo Resend]

Tipo: CNAME
Nome: resend._domainkey
Valor: [valor fornecido pelo Resend]

Tipo: MX
Nome: @
Prioridade: 10
Valor: [valor fornecido pelo Resend]
```

#### 3.3 - Verificar Domínio

1. Aguarde a propagação do DNS (pode levar de 15 minutos a 48 horas)
2. No Resend, clique em **"Verify Domain"**
3. Quando verificado, você verá um ✅ verde

**Após verificação, seus emails sairão de:** `noreply@profbarral.com.br`

---

### Opção B: Usar Email de Teste (Para Desenvolvimento)

Se ainda não tem domínio ou quer testar primeiro:

1. Use o domínio de teste do Resend: `onboarding@resend.dev`
2. **Limitação:** Só pode enviar para o email cadastrado na conta
3. Perfeito para testes locais!

---

## ⚙️ PASSO 4: Configurar Variáveis de Ambiente

### 4.1 - Editar o Arquivo .env.local

Abra o arquivo `.env.local` na raiz do projeto:

```bash
C:\Projeto de site do Barral\projeto do site no claude\site-prof-barral\.env.local
```

### 4.2 - Adicionar as Variáveis

Cole as seguintes linhas **no final do arquivo**:

```env
# ============================================
# EMAIL - Resend Configuration
# ============================================

# API Key do Resend (obrigatório)
RESEND_API_KEY=re_sua_chave_aqui

# Email remetente (use seu domínio verificado ou onboarding@resend.dev para testes)
EMAIL_FROM=noreply@profbarral.com.br

# Nome que aparece como remetente
EMAIL_FROM_NAME=Prof. Daniel Barral
```

### 4.3 - Substituir os Valores

**Com domínio verificado:**
```env
RESEND_API_KEY=re_AbCdEfGh12345678    # Cole sua chave real aqui
EMAIL_FROM=noreply@profbarral.com.br   # Seu domínio verificado
EMAIL_FROM_NAME=Prof. Daniel Barral
```

**Sem domínio (testes):**
```env
RESEND_API_KEY=re_AbCdEfGh12345678    # Cole sua chave real aqui
EMAIL_FROM=onboarding@resend.dev       # Email de teste
EMAIL_FROM_NAME=Prof. Daniel Barral
```

### 4.4 - Salvar o Arquivo

Salve e feche o `.env.local`

---

## 🔄 PASSO 5: Reiniciar o Servidor

### 5.1 - Parar o Servidor

No terminal onde o servidor está rodando:
- Pressione `Ctrl + C`

### 5.2 - Iniciar Novamente

```bash
npm run dev
```

O servidor vai carregar as novas variáveis de ambiente.

---

## 🧪 PASSO 6: Testar o Envio de Emails

### Teste 1: Criar Nova Conta de Aluno

1. Acesse: `http://localhost:3000/validar-acesso`
2. Use um QR Code válido (gere um no painel admin)
3. Preencha o formulário de registro
4. Clique em **"Criar Conta"**

**O que deve acontecer:**
- ✅ Conta criada com sucesso
- ✅ Email de verificação enviado
- ✅ Mensagem: "Verifique sua caixa de entrada"

### Teste 2: Recuperação de Senha

1. Acesse: `http://localhost:3000/esqueci-senha`
2. Digite um email cadastrado
3. Clique em **"Enviar Link"**

**O que deve acontecer:**
- ✅ Mensagem de sucesso
- ✅ Email com link de redefinição enviado

### Teste 3: Verificar no Resend Dashboard

1. Acesse o dashboard do Resend
2. Vá em **"Logs"** no menu lateral
3. Você deve ver os emails enviados com status:
   - 🟢 **Delivered** - Email entregue com sucesso
   - 🔵 **Sent** - Email enviado (aguardando entrega)
   - 🔴 **Failed** - Falha no envio (verifique erros)

---

## 📊 PASSO 7: Verificar os Templates de Email

Os templates já estão configurados em `lib/email.ts`:

### Templates Disponíveis:

1. **Verificação de Email** (`sendVerificationEmail`)
   - Enviado após criar conta
   - Link válido por 24 horas

2. **Recuperação de Senha** (`sendPasswordResetEmail`)
   - Enviado ao solicitar redefinição
   - Link válido por 1 hora

3. **Notificação de Expiração** (`sendExpirationNotificationEmail`)
   - Enviado 90 dias antes da expiração
   - Automático via cron job

### Personalizar Templates (Opcional)

Para personalizar os templates, edite: `lib/email.ts`

```typescript
// Exemplo: Mudar o texto do email de verificação
html: `
  <h1>Bem-vindo ao Site do Prof. Barral!</h1>
  <p>Seu texto personalizado aqui...</p>
  <a href="${verifyUrl}">Verificar Email</a>
`
```

---

## 🚨 SOLUÇÃO DE PROBLEMAS

### Erro: "RESEND_API_KEY não configurado"

**Causa:** Variável de ambiente não carregada

**Solução:**
1. Verifique se o `.env.local` existe
2. Confirme que `RESEND_API_KEY` está definido
3. Reinicie o servidor (`Ctrl + C` e `npm run dev`)

---

### Erro: "Email failed to send"

**Causa:** API Key inválida ou domínio não verificado

**Solução:**
1. Verifique se a API Key está correta
2. Se usando domínio próprio, confirme que está verificado
3. Use `onboarding@resend.dev` para testes

---

### Emails não chegam na caixa de entrada

**Possíveis causas:**

1. **Caixa de Spam**
   - Verifique a pasta de spam/lixo eletrônico
   - Marque como "Não é spam"

2. **Domínio não verificado**
   - Verifique se o domínio tem ✅ verde no Resend
   - Aguarde propagação do DNS (até 48h)

3. **Limite de emails atingido**
   - Plano free: 100 emails/dia
   - Verifique uso no dashboard do Resend

---

### Emails enviados mas não recebidos

**Solução:**

1. Acesse o Resend Dashboard → **Logs**
2. Clique no email enviado
3. Verifique o status e erros
4. Se houver erro, copie e pesquise na documentação

---

## 📝 CHECKLIST FINAL

Antes de considerar concluído, verifique:

- [ ] Conta criada no Resend
- [ ] API Key gerada e copiada
- [ ] Domínio verificado (ou usando email de teste)
- [ ] Variáveis adicionadas ao `.env.local`
- [ ] Servidor reiniciado
- [ ] Teste de cadastro funcionando
- [ ] Email de verificação recebido
- [ ] Logs no Resend mostrando entregas

---

## 🎓 RECURSOS ADICIONAIS

### Documentação Oficial
- Resend Docs: https://resend.com/docs
- Node.js SDK: https://resend.com/docs/send-with-nodejs

### Suporte Resend
- Email: support@resend.com
- Discord: https://resend.com/discord

### Dicas de Produção

1. **Use domínio verificado**
   - Melhora taxa de entrega
   - Aparência profissional

2. **Configure SPF, DKIM e DMARC**
   - Aumenta confiança dos provedores
   - Resend configura automaticamente

3. **Monitore os logs**
   - Acompanhe taxa de entrega
   - Identifique problemas rapidamente

4. **Considere upgrade se precisar**
   - Plano Pro: $20/mês (50.000 emails)
   - Remoção de branding
   - Suporte prioritário

---

## 🎉 PRONTO!

Seu sistema de email está configurado e funcionando!

**Próximos passos:**
- Testar todos os fluxos de email
- Personalizar templates se necessário
- Preparar para deploy em produção

**Em produção, lembre-se de:**
- Usar domínio verificado
- Adicionar variáveis de ambiente no Vercel/host
- Testar emails antes do lançamento oficial

---

**Última atualização:** 17/10/2025
**Versão do Resend SDK:** 3.x
**Compatibilidade:** Next.js 15+
