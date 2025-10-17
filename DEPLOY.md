# 🚀 Guia de Deploy - Site Prof. Daniel Barral

## 📋 Pré-requisitos para Produção

- [ ] Conta na Vercel (https://vercel.com)
- [ ] Conta no Resend.com para emails (ou configurar depois)
- [ ] Domínio personalizado (opcional, mas recomendado)
- [ ] Git configurado e código commitado

---

## 🎯 Opção 1: Deploy Rápido na Vercel

### Passo 1: Preparar Repositório

```bash
# Se ainda não tem git inicializado:
git init
git add .
git commit -m "feat: site completo para produção"

# Subir para GitHub (criar repositório primeiro em github.com):
git remote add origin https://github.com/seu-usuario/site-prof-barral.git
git branch -M main
git push -u origin main
```

### Passo 2: Deploy na Vercel

1. **Acesse** https://vercel.com e faça login
2. **Clique** em "New Project"
3. **Importe** seu repositório do GitHub
4. **Configure** as variáveis de ambiente (ver seção abaixo)
5. **Deploy!** 🎉

### Passo 3: Configurar Variáveis de Ambiente na Vercel

No painel da Vercel, vá em **Settings → Environment Variables** e adicione:

#### ⚠️ **Obrigatórias:**

```env
# JWT (gere em https://generate-secret.vercel.app/32)
JWT_SECRET=sua-chave-super-secreta-aqui-minimo-32-caracteres

# Database - Usar Vercel Postgres ou outro provider
DATABASE_URL=sua-url-do-banco-aqui
```

#### 🔧 **Recomendadas:**

```env
# Email (Resend)
RESEND_API_KEY=re_sua_chave_do_resend
EMAIL_FROM=contato@profbarral.com.br

# Cron Job
CRON_SECRET=seu-secret-para-cron-jobs

# Base URL
NEXT_PUBLIC_BASE_URL=https://profbarral.com.br
```

### Passo 4: Configurar Banco de Dados em Produção

**Opção A: Vercel Postgres (Recomendado)**

1. No projeto na Vercel, vá em **Storage → Create Database**
2. Escolha **Postgres**
3. A Vercel vai adicionar automaticamente a variável `DATABASE_URL`
4. Execute as migrations:

```bash
# Na sua máquina, com a DATABASE_URL de prod:
npx prisma db push
```

**Opção B: Neon.tech (Grátis)**

1. Crie conta em https://neon.tech
2. Crie novo projeto PostgreSQL
3. Copie a connection string
4. Adicione como `DATABASE_URL` na Vercel

### Passo 5: Rodar Migrations em Produção

```bash
# Opção 1: Via comando local (com DATABASE_URL de prod no .env)
npx prisma db push

# Opção 2: Adicionar no build (package.json)
{
  "scripts": {
    "vercel-build": "prisma generate && prisma db push && next build"
  }
}
```

### Passo 6: Criar Usuário Admin em Produção

```bash
# Com DATABASE_URL de produção:
node scripts/create-admin.js admin@profbarral.com.br SenhaSegura123 "Prof. Daniel Barral"
```

---

## 📧 Configurar Email (Resend)

### 1. Criar Conta

- Acesse https://resend.com
- Crie conta gratuita (100 emails/dia grátis)

### 2. Verificar Domínio

1. Vá em **Domains → Add Domain**
2. Adicione `profbarral.com.br`
3. Configure registros DNS conforme instruções:
   - **SPF**: `v=spf1 include:_spf.resend.com ~all`
   - **DKIM**: `valor fornecido pelo Resend`
4. Aguarde verificação (até 48h)

### 3. Gerar API Key

1. Vá em **API Keys → Create API Key**
2. Nomeie como "Produção"
3. Copie a chave (formato: `re_xxxxx`)
4. Adicione na Vercel como `RESEND_API_KEY`

---

## 🔐 Segurança em Produção

### Checklist de Segurança:

- [ ] JWT_SECRET com pelo menos 32 caracteres aleatórios
- [ ] CRON_SECRET configurado e secreto
- [ ] Domínio com HTTPS (Vercel faz automaticamente)
- [ ] DATABASE_URL não exposta no código
- [ ] Senha do admin forte e única
- [ ] Email de admin diferente do pessoal
- [ ] Rate limiting habilitado (ver middleware)
- [ ] Backups do banco configurados

---

## 🌐 Configurar Domínio Personalizado

### Na Vercel:

1. Vá em **Settings → Domains**
2. Clique em "Add"
3. Digite seu domínio (ex: `profbarral.com.br`)
4. Configure DNS no seu provedor:

```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

5. Aguarde propagação (até 48h)

---

## 📊 Monitoramento

### Analytics (Opcional):

**Google Analytics:**
1. Crie conta em https://analytics.google.com
2. Adicione o tracking ID como variável de ambiente
3. Instale `@next/third-parties`

**Vercel Analytics:**
```bash
npm install @vercel/analytics
```

Adicione ao `layout.tsx`:
```tsx
import { Analytics } from '@vercel/analytics/react';

// No return:
<Analytics />
```

---

## 🔄 Atualizações Futuras

### Para fazer deploy de updates:

```bash
# 1. Commitar mudanças
git add .
git commit -m "feat: nova funcionalidade"

# 2. Push para GitHub
git push origin main

# 3. Vercel faz deploy automático! 🎉
```

---

## 🆘 Troubleshooting

### Erro: "Database not found"
**Solução:** Execute `npx prisma db push` com DATABASE_URL de produção

### Erro: "JWT_SECRET is not defined"
**Solução:** Adicione a variável nas Settings da Vercel

### Erro: "Failed to send email"
**Solução:**
1. Verifique RESEND_API_KEY
2. Confirme domínio verificado no Resend
3. Veja logs na dashboard do Resend

### Deploy falhou
**Solução:**
1. Verifique logs na Vercel
2. Confirme todas variáveis de ambiente
3. Teste localmente com `npm run build`

---

## 📝 Checklist Final

Antes de considerar o deploy completo:

- [ ] Site acessível na URL da Vercel
- [ ] Login funcionando
- [ ] Registro de aluno funcionando
- [ ] Upload de documentos funcionando
- [ ] Download de documentos funcionando
- [ ] QR Code gerando corretamente
- [ ] Emails sendo enviados
- [ ] Domínio personalizado configurado
- [ ] SSL/HTTPS funcionando
- [ ] Admin consegue acessar painel
- [ ] Backup do banco configurado
- [ ] Monitoramento ativo

---

## 🎉 Próximos Passos

Após deploy bem-sucedido:

1. **Teste tudo** novamente em produção
2. **Configure backups** automáticos do banco
3. **Monitore erros** via Vercel ou Sentry
4. **Documente** procedimentos internos
5. **Treine** o Prof. Barral no uso do admin
6. **Divulgue** o site! 🚀

---

## 📞 Suporte

Para dúvidas sobre o deploy:
- Vercel Docs: https://vercel.com/docs
- Resend Docs: https://resend.com/docs
- Prisma Docs: https://www.prisma.io/docs
- Next.js Docs: https://nextjs.org/docs

**Desenvolvido com ❤️ para o Prof. Daniel Barral**
