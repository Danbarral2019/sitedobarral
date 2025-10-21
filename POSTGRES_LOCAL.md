# 🐘 PostgreSQL Local para Desenvolvimento

## Por que mudar para PostgreSQL?

O schema do Prisma agora usa **PostgreSQL** (ao invés de SQLite) para:
- ✅ Paridade entre desenvolvimento e produção
- ✅ Evitar bugs que só aparecem em produção
- ✅ Suportar features avançadas (full-text search, JSON, etc.)

---

## 🚀 Opção 1: Docker (Recomendado)

### **Pré-requisitos:**
- Docker Desktop instalado: https://www.docker.com/products/docker-desktop

### **Passo a passo:**

1. **Criar arquivo `docker-compose.yml` na raiz do projeto:**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: profbarral-postgres
    restart: always
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: profbarral
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

2. **Iniciar o container:**

```bash
# Iniciar PostgreSQL
docker-compose up -d

# Verificar se está rodando
docker ps
```

3. **Configurar `.env.local`:**

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/profbarral?schema=public"
```

4. **Aplicar schema ao banco:**

```bash
npx prisma db push
```

5. **Criar admin:**

```bash
node scripts/create-admin.js admin@profbarral.com.br SuaSenha "Prof. Daniel Barral"
```

### **Comandos úteis:**

```bash
# Parar o banco
docker-compose down

# Parar e APAGAR dados
docker-compose down -v

# Ver logs
docker-compose logs -f

# Reiniciar
docker-compose restart
```

---

## 🌐 Opção 2: Neon (Gratuito na nuvem)

Se não quiser instalar Docker, use um banco PostgreSQL gratuito na nuvem:

### **Passo a passo:**

1. **Criar conta:** https://neon.tech

2. **Criar projeto:**
   - Nome: profbarral-dev
   - Região: US East (mais próxima)

3. **Copiar Connection String:**
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

4. **Configurar `.env.local`:**
   ```bash
   DATABASE_URL="postgresql://user:password@..."
   ```

5. **Aplicar schema:**
   ```bash
   npx prisma db push
   ```

**Vantagens:**
- ✅ Não precisa instalar nada
- ✅ 512 MB storage grátis
- ✅ Acesso de qualquer lugar

**Desvantagens:**
- ❌ Precisa de internet
- ❌ Latência maior que local

---

## 📊 Opção 3: PostgreSQL Nativo (Windows/Mac/Linux)

### **Windows:**

1. **Download:** https://www.postgresql.org/download/windows/
2. **Instalar** com configurações padrão
3. **Senha:** postgres (ou lembrar a que escolheu)
4. **Porta:** 5432

### **Mac (Homebrew):**

```bash
brew install postgresql@16
brew services start postgresql@16
createdb profbarral
```

### **Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo -u postgres createdb profbarral
```

### **Configurar `.env.local`:**

```bash
DATABASE_URL="postgresql://postgres:sua_senha@localhost:5432/profbarral?schema=public"
```

---

## 🔄 Migrar de SQLite para PostgreSQL

Se você já tem dados em SQLite e quer migrar:

### **Opção A: Exportar/Importar Manualmente**

1. **Exportar dados do SQLite:**

```bash
# Abrir Prisma Studio com SQLite
DATABASE_URL="file:./dev.db" npx prisma studio

# Exportar dados importantes (copiar manualmente)
```

2. **Aplicar schema ao PostgreSQL:**

```bash
# Mudar .env.local para PostgreSQL
DATABASE_URL="postgresql://..."

# Aplicar schema
npx prisma db push
```

3. **Importar dados:**

```bash
# Abrir Prisma Studio com PostgreSQL
npx prisma studio

# Inserir dados manualmente ou via script
```

### **Opção B: Script de Migração**

```typescript
// scripts/migrate-sqlite-to-postgres.ts
import { PrismaClient as SQLiteClient } from '@prisma/client';
import { PrismaClient as PostgresClient } from '@prisma/client';

const sqlite = new SQLiteClient({
  datasources: { db: { url: 'file:./dev.db' } }
});

const postgres = new PostgresClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function migrate() {
  // Migrar usuários
  const users = await sqlite.user.findMany();
  for (const user of users) {
    await postgres.user.create({ data: user });
  }

  // Migrar documentos
  const documents = await sqlite.document.findMany();
  for (const doc of documents) {
    await postgres.document.create({ data: doc });
  }

  // ... migrar outros modelos

  console.log('✅ Migração concluída!');
}

migrate();
```

---

## 🎨 Ferramentas Visuais para PostgreSQL

### **Prisma Studio** (já incluído)

```bash
npx prisma studio
```

- ✅ Funciona com qualquer banco Prisma
- ✅ Interface web simples
- ✅ Editar dados facilmente

### **pgAdmin**

- Download: https://www.pgadmin.org/
- ✅ Cliente oficial do PostgreSQL
- ✅ Interface completa
- ❌ Mais complexo

### **TablePlus** (Mac/Windows)

- Download: https://tableplus.com/
- ✅ Interface bonita
- ✅ Suporta múltiplos bancos
- 💰 Pago (com trial gratuito)

### **DBeaver** (Gratuito)

- Download: https://dbeaver.io/
- ✅ Open source
- ✅ Multi-plataforma
- ✅ Suporta todos os bancos

---

## 🧪 Testar Conexão

```bash
# Testar se PostgreSQL está acessível
npx prisma db execute --stdin <<< "SELECT version();"

# Ver tabelas existentes
npx prisma db execute --stdin <<< "SELECT tablename FROM pg_tables WHERE schemaname='public';"

# Verificar schema
npx prisma validate
```

---

## 🔧 Troubleshooting

### **Erro: "Can't reach database server"**

**Causa:** PostgreSQL não está rodando ou porta errada

**Solução:**
```bash
# Docker
docker ps | grep postgres

# Nativo Windows (PowerShell)
Get-Service postgresql*

# Nativo Linux/Mac
pg_isready -h localhost -p 5432
```

### **Erro: "password authentication failed"**

**Causa:** Senha incorreta no DATABASE_URL

**Solução:**
- Verificar credenciais no `.env.local`
- Docker: usuário=postgres, senha=postgres
- Nativo: usar senha que configurou na instalação

### **Erro: "database 'profbarral' does not exist"**

**Causa:** Banco não foi criado

**Solução:**
```bash
# Docker: recriar container
docker-compose down -v && docker-compose up -d

# Nativo: criar banco
createdb profbarral
# ou
psql -U postgres -c "CREATE DATABASE profbarral;"
```

---

## ✅ Checklist de Setup

- [ ] PostgreSQL rodando (Docker/Neon/Nativo)
- [ ] `.env.local` com DATABASE_URL correto
- [ ] `npx prisma db push` executado com sucesso
- [ ] `npx prisma studio` abre sem erros
- [ ] Admin criado (`scripts/create-admin.js`)
- [ ] `npm run dev` funciona normalmente

---

## 🔄 Voltar para SQLite (se necessário)

Se quiser voltar para SQLite temporariamente:

1. **Editar `prisma/schema.prisma`:**

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

2. **Editar `.env.local`:**

```bash
DATABASE_URL="file:./dev.db"
```

3. **Regenerar client:**

```bash
npx prisma generate
npx prisma db push
```

**ATENÇÃO:** Não faça commit com provider="sqlite" se for fazer deploy!

---

## 📚 Recursos

- **Prisma + PostgreSQL:** https://www.prisma.io/docs/concepts/database-connectors/postgresql
- **Docker Compose:** https://docs.docker.com/compose/
- **Neon Docs:** https://neon.tech/docs/introduction
- **PostgreSQL Docs:** https://www.postgresql.org/docs/

---

✅ **Pronto! Agora você tem PostgreSQL rodando localmente para desenvolvimento.**
