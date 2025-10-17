# 🚀 Guia de Configuração - Site Prof. Daniel Barral

## 📋 Pré-requisitos

- Node.js 18+ instalado
- npm ou yarn
- Conta no Resend.com (para envio de emails)

---

## ⚙️ Configuração Inicial

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

```bash
# Copiar template de configuração
cp .env.example .env.local
```

Edite o arquivo `.env.local` e configure:

#### **Obrigatório:**
- `JWT_SECRET` - Gere uma chave forte em https://generate-secret.vercel.app/32
- `DATABASE_URL` - Já está configurado para SQLite local

#### **Recomendado:**
- `RESEND_API_KEY` - Para envio de emails
- `EMAIL_FROM` - Email remetente (ex: contato@profbarral.com.br)
- `CRON_SECRET` - Para proteção do cron job

#### **Opcional:**
- `ADMIN_EMAIL` e `ADMIN_PASSWORD_HASH` - Credenciais do admin

### 3. Configurar Banco de Dados

```bash
# Gerar cliente Prisma
npx prisma generate

# Criar banco de dados e tabelas
npx prisma db push

# (Opcional) Abrir interface visual do banco
npx prisma studio
```

### 4. Criar Usuário Admin (Primeiro Acesso)

Execute o script para criar o usuário admin:

```bash
node scripts/create-admin.js admin@profbarral.com.br SuaSenhaAqui "Prof. Daniel Barral"
```

**Parâmetros:**
- `admin@profbarral.com.br` - Email do admin
- `SuaSenhaAqui` - Senha forte (mínimo 8 caracteres)
- `"Prof. Daniel Barral"` - Nome completo (entre aspas se tiver espaço)

O script vai criar automaticamente o usuário no banco de dados.

---

## 🏃‍♂️ Executar o Projeto

### Modo Desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:3000

### Build de Produção

```bash
npm run build
npm start
```

---

## 📧 Configurar Serviço de Email (Resend)

### 1. Criar Conta

Acesse: https://resend.com e crie uma conta gratuita

### 2. Verificar Domínio

1. Vá em **Domains** → **Add Domain**
2. Adicione `profbarral.com.br`
3. Configure os registros DNS conforme instruções
4. Aguarde verificação (pode levar até 48h)

### 3. Gerar API Key

1. Vá em **API Keys** → **Create API Key**
2. Nomeie como "Produção" ou "Desenvolvimento"
3. Copie a chave (formato: `re_xxxxxxxxxxxxx`)
4. Cole no `.env.local`:

```bash
RESEND_API_KEY=re_sua_chave_aqui
EMAIL_FROM=contato@profbarral.com.br
```

### 4. Testar Envio

Execute o servidor e tente:
- Criar uma conta de aluno
- Você deve receber email de verificação

---

## 🔐 Sistema de Autenticação

O site possui dois sistemas de autenticação:

### 1. **Login via QR Code** (Primeira vez)
- Professor gera QR Code no painel admin
- Aluno escaneia QR Code
- Sistema cria matrícula automaticamente
- Acesso válido por 1 ano

### 2. **Login com Email/Senha** (Subsequente)
- Aluno usa email e senha cadastrados
- Acesso a todos os cursos matriculados
- Visualiza status de expiração

---

## 📱 Testar no Celular (Mesma Rede)

### 1. Descobrir IP da Máquina

**Windows:**
```bash
ipconfig
# Procure por "Endereço IPv4": 192.168.x.x
```

**Mac/Linux:**
```bash
ifconfig
# ou
ip addr show
```

### 2. Atualizar .env.local

```bash
NEXT_PUBLIC_BASE_URL=http://192.168.x.x:3000
```

### 3. Reiniciar Servidor

```bash
npm run dev
```

### 4. Acessar do Celular

No navegador do celular: `http://192.168.x.x:3000`

---

## 🗄️ Estrutura do Banco de Dados

```
User
├── id
├── email
├── name
├── passwordHash
├── role (admin | student)
├── emailVerified
└── enrollments []

Enrollment
├── id
├── userId
├── courseId
├── expiresAt (1 ano após QR Code)
├── isLifetime (upgrade vitalício)
└── turma

Document
├── id
├── title
├── courseId
├── isPublic
├── url
└── type (pdf, doc, link, video)

QRCode
├── id
├── code
├── courseId
├── validUntil
└── usedCount
```

---

## 🎯 Funcionalidades Principais

### ✅ Implementadas

- [x] Sistema de QR Code para acesso
- [x] Login/Registro de alunos
- [x] Área restrita com verificação de matrícula
- [x] Banner de status de acesso (expirando, ativo, expirado)
- [x] Upload de documentos (individual e em lote via Excel)
- [x] Download protegido de PDFs
- [x] Sistema de matrículas com expiração (1 ano)
- [x] Upgrade para acesso vitalício
- [x] Notificação de expiração (90 dias antes)
- [x] Painel administrativo
- [x] Importação via Excel com classificação automática
- [x] 10 cursos especializados
- [x] Bibliografia pública

### 🚧 Próximas Implementações

- [ ] Busca avançada de documentos
- [ ] Integração com redes sociais
- [ ] Sistema de pagamento para upgrade
- [ ] Dashboard de analytics
- [ ] Modo offline (PWA)

---

## 🔧 Problemas Comuns

### Erro: "JWT_SECRET não configurado"
**Solução:** Configure `JWT_SECRET` no `.env.local`

### Erro: "Cannot find module 'bcryptjs'"
**Solução:**
```bash
npm install bcryptjs
```

### Emails não estão sendo enviados
**Solução:**
1. Verifique `RESEND_API_KEY` no `.env.local`
2. Confirme que domínio está verificado no Resend
3. Verifique logs do console para erros

### Banco de dados não inicializa
**Solução:**
```bash
# Resetar banco (CUIDADO: apaga todos os dados)
npx prisma db push --force-reset
```

### Download de arquivos não funciona
**Solução:**
1. Verifique se pasta `public/uploads` existe
2. Confirme que usuário está autenticado
3. Verifique se matrícula não expirou

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique a documentação no `/CLAUDE.md`
2. Consulte o arquivo `IMPORTACAO_EXCEL.md` para upload de documentos
3. Revise `RESUMO_MIGRACAO.md` para detalhes do sistema de renovação

---

## 📝 Licença

Projeto proprietário - Prof. Daniel Barral

Desenvolvido com Next.js 15, TypeScript, Prisma e Tailwind CSS
