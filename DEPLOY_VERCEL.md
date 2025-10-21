# 🚀 Guia de Deploy na Vercel

## 📋 Pré-requisitos

Antes de fazer deploy, você precisa:

1. ✅ Conta na [Vercel](https://vercel.com)
2. ✅ Repositório no GitHub conectado
3. ✅ Banco de dados PostgreSQL configurado

---

## 🗄️ PASSO 1: Configurar Banco de Dados PostgreSQL

Você tem **3 opções** para o banco de dados em produção:

### **Opção A: Vercel Postgres** (Recomendado - Mais fácil)

1. **Acessar projeto na Vercel:**
   - Dashboard → Seu Projeto → Storage → Create Database

2. **Criar Vercel Postgres:**
   - Tipo: Postgres
   - Nome: profbarral-db (ou qualquer nome)
   - Região: Washington D.C. (iad1) - mesma do projeto

3. **Conectar ao projeto:**
   - A Vercel adiciona automaticamente as variáveis:
     - `POSTGRES_URL` - Para Prisma
     - `POSTGRES_PRISMA_URL` - Com connection pooling
     - `POSTGRES_URL_NON_POOLING` - Sem pooling

4. **Copiar DATABASE_URL:**
   ```bash
   # Usar a variável POSTGRES_PRISMA_URL
   # Ela já vem configurada automaticamente
   ```

**Plano Free:**
- ✅ 60 horas de compute por mês
- ✅ 256 MB storage
- ✅ 10,000 total de linhas

---

### **Opção B: Neon Database** (Gratuito e Generoso)

1. **Criar conta:** https://neon.tech

2. **Criar novo projeto:**
   - Nome: profbarral
   - Região: US East (Ohio) ou mais próxima
   - PostgreSQL version: 16

3. **Copiar Connection String:**
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

4. **Adicionar na Vercel** (próximo passo)

**Plano Free:**
- ✅ 512 MB storage
- ✅ 100 horas de compute
- ✅ Pooling automático

---

### **Opção C: Supabase** (Gratuito)

1. **Criar projeto:** https://supabase.com

2. **Ir em Settings → Database:**
   - Copiar "Connection String" → "URI"
   - Formato: `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

3. **Adicionar na Vercel** (próximo passo)

**Plano Free:**
- ✅ 500 MB storage
- ✅ Backup automático
- ✅ Autenticação inclusa

---

## 🔐 PASSO 2: Configurar Variáveis de Ambiente na Vercel

### **2.1 Acessar Configurações:**

```
Dashboard → Projeto → Settings → Environment Variables
```

### **2.2 Adicionar Variáveis Obrigatórias:**

#### **Database:**
```bash
# Se usar Vercel Postgres: já vem configurado automaticamente
# Se usar Neon/Supabase: adicione manualmente

DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

#### **JWT (Segurança):**
```bash
# Gere uma chave secreta forte em: https://generate-secret.vercel.app/32
JWT_SECRET=sua-chave-super-secreta-de-32-caracteres-ou-mais
```

#### **Email (Resend):**
```bash
RESEND_API_KEY=re_sua_chave_aqui
EMAIL_FROM=contato@profbarral.com.br
```

#### **Base URL:**
```bash
# Deixe em branco inicialmente - a Vercel preenche automaticamente
# Ou use seu domínio customizado
NEXT_PUBLIC_BASE_URL=https://profbarral.com.br
```

#### **Cron Job:**
```bash
# Para proteger endpoint de verificação de expiração
CRON_SECRET=outro-secret-forte-diferente-do-jwt
```

#### **MailChimp (Opcional):**
```bash
MAILCHIMP_API_KEY=sua_chave
MAILCHIMP_SERVER_PREFIX=us1
MAILCHIMP_AUDIENCE_ID=id_da_lista
MAILCHIMP_REPLY_TO=contato@profbarral.com.br
```

### **2.3 Ambientes:**

Configure as variáveis para **todos os ambientes**:
- ✅ Production
- ✅ Preview
- ✅ Development (se for testar localmente com Vercel CLI)

---

## 🚀 PASSO 3: Deploy

### **3.1 Deploy Automático:**

Se conectou o GitHub, a Vercel faz deploy automático:

1. **Push para main:**
   ```bash
   git push origin main
   ```

2. **Aguardar build:**
   - Dashboard → Deployments
   - Ver logs em tempo real
   - Build leva ~2-3 minutos

3. **Verificar sucesso:**
   - Status: ✅ Ready
   - URL: projeto.vercel.app

### **3.2 Deploy Manual (Vercel CLI):**

```bash
# Instalar Vercel CLI
npm i -g vercel

# Fazer login
vercel login

# Deploy de produção
vercel --prod

# Ou preview (staging)
vercel
```

---

## 🗄️ PASSO 4: Inicializar Banco de Dados

Após o primeiro deploy bem-sucedido, o banco está vazio. Você precisa:

### **Opção 1: Usar Prisma Studio (Mais fácil)**

```bash
# No terminal local, conectar ao banco de produção
DATABASE_URL="postgresql://..." npx prisma studio

# Criar usuário admin manualmente na interface
```

### **Opção 2: Script de Setup**

```bash
# Conectar ao banco de produção e rodar script
DATABASE_URL="postgresql://..." node scripts/create-admin.js \
  admin@profbarral.com.br \
  SenhaForte123! \
  "Prof. Daniel Barral"
```

### **Opção 3: Via Console do Provedor**

Se usar Vercel Postgres, Neon ou Supabase:
- Acessar console SQL
- Executar queries manualmente para criar admin

---

## ✅ PASSO 5: Verificar Deploy

### **Checklist pós-deploy:**

- [ ] Site acessível em: `https://projeto.vercel.app`
- [ ] Banco de dados conectado (ver logs)
- [ ] Páginas públicas funcionando (/, /sobre, /cursos)
- [ ] Login admin funciona (`/admin/login`)
- [ ] Envio de email funciona (testar registro)
- [ ] QR Codes podem ser gerados
- [ ] Cron job configurado (vercel.json)

### **Testar funcionalidades:**

1. **Registro de usuário:**
   - `/registro`
   - Verificar se email é enviado

2. **Login admin:**
   - `/admin/login`
   - Acessar painel

3. **Gerar QR Code:**
   - `/admin`
   - Criar novo QR Code
   - Fazer download

4. **Upload de documento:**
   - `/admin/documentos`
   - Fazer upload de PDF teste

---

## 🔧 Troubleshooting

### **Erro: "DATABASE_URL not found"**

**Causa:** Variável não configurada na Vercel

**Solução:**
1. Settings → Environment Variables
2. Adicionar `DATABASE_URL`
3. Redeploy: Deployments → ⋯ → Redeploy

---

### **Erro: "Prisma schema validation failed"**

**Causa:** Schema não compatível com o banco

**Solução:**
1. Verificar que está usando PostgreSQL
2. Verificar connection string está correta
3. Testar conexão localmente:
   ```bash
   DATABASE_URL="postgresql://..." npx prisma db push
   ```

---

### **Erro: "Can't reach database server"**

**Causa:** Firewall ou URL incorreta

**Solução:**
1. Verificar se connection string tem `?sslmode=require`
2. Verificar whitelist de IPs (Vercel usa IPs dinâmicos)
3. Usar connection pooling se disponível

---

### **Build passa mas site dá 500 erro**

**Causa:** Runtime error, geralmente falta variável de ambiente

**Solução:**
1. Ver logs: Deployments → Logs → Runtime Logs
2. Verificar todas as variáveis estão configuradas
3. Verificar `JWT_SECRET` está presente

---

### **Email não está enviando**

**Causa:** RESEND_API_KEY não configurado ou domínio não verificado

**Solução:**
1. Adicionar `RESEND_API_KEY` na Vercel
2. Verificar domínio no Resend.com
3. Ver logs em: https://resend.com/emails

---

## 🔄 Cron Jobs (Verificação de Expiração)

O arquivo `vercel.json` já está configurado:

```json
{
  "crons": [{
    "path": "/api/enrollment/check-expiration",
    "schedule": "0 9 * * *"
  }]
}
```

Isso executa **diariamente às 9h UTC** (6h Brasília).

### **Verificar se está funcionando:**

1. **Ver logs de cron:**
   - Dashboard → Cron Jobs
   - Ver execuções e logs

2. **Testar manualmente:**
   ```bash
   curl -X POST https://seu-site.vercel.app/api/enrollment/check-expiration \
     -H "Content-Type: application/json" \
     -H "X-Cron-Secret: seu-cron-secret"
   ```

---

## 📊 Monitoramento

### **Logs:**
- Vercel Dashboard → Deployments → Logs
- Ver logs em tempo real
- Filtrar por erro/warning

### **Analytics:**
- Vercel Analytics (incluso no free tier)
- Ver pageviews, performance
- Ativar em: Settings → Analytics

### **Uptime:**
- Usar serviços como:
  - UptimeRobot (gratuito)
  - StatusCake
  - Pingdom

---

## 🎯 Próximos Passos Após Deploy

1. **Configurar domínio customizado:**
   - Settings → Domains
   - Adicionar `profbarral.com.br`
   - Configurar DNS (A/CNAME)

2. **Habilitar HTTPS:**
   - Automático com domínio da Vercel
   - Ou usar certificado próprio

3. **Configurar redirects:**
   - www → não-www
   - http → https

4. **Backup do banco:**
   - Configurar backup automático no provider
   - Ou criar script de backup semanal

5. **Monitorar custos:**
   - Vercel tem plano free generoso
   - Monitorar usage em Dashboard

---

## 📞 Suporte

- **Vercel:** https://vercel.com/support
- **Documentação Prisma:** https://www.prisma.io/docs
- **Documentação Next.js:** https://nextjs.org/docs

---

## 🔑 Resumo de Variáveis Obrigatórias

```bash
# OBRIGATÓRIAS
DATABASE_URL=postgresql://...
JWT_SECRET=...

# RECOMENDADAS (para email funcionar)
RESEND_API_KEY=re_...
EMAIL_FROM=contato@...
CRON_SECRET=...

# OPCIONAIS
NEXT_PUBLIC_BASE_URL=https://...
MAILCHIMP_API_KEY=...
MAILCHIMP_SERVER_PREFIX=us1
MAILCHIMP_AUDIENCE_ID=...
```

---

✅ **Pronto! Seu site estará no ar em produção.**
