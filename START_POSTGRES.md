# Como Iniciar PostgreSQL Local

## ✅ Opção 1: Docker Desktop (Recomendado)

### Pré-requisitos
- Docker Desktop instalado: https://www.docker.com/products/docker-desktop

### Passos

1. **Abra PowerShell ou CMD** (não Git Bash)

2. **Navegue até o projeto:**
```powershell
cd "C:\Projeto de site do Barral\projeto do site no claude\site-prof-barral"
```

3. **Inicie o PostgreSQL:**
```powershell
docker compose up -d
```

4. **Verifique se está rodando:**
```powershell
docker ps
```
Deve aparecer: `profbarral-postgres`

5. **Aplique as migrations:**
```powershell
npx prisma db push
```

6. **Inicie o servidor:**
```powershell
npm run dev
```

### Comandos Úteis

**Ver logs do PostgreSQL:**
```powershell
docker logs profbarral-postgres
```

**Parar o PostgreSQL:**
```powershell
docker compose down
```

**Parar e DELETAR dados:**
```powershell
docker compose down -v
```

**Acessar o banco via CLI:**
```powershell
docker exec -it profbarral-postgres psql -U postgres -d profbarral
```

---

## ✅ Opção 2: PostgreSQL Nativo (Windows)

### Pré-requisitos
- PostgreSQL 16 instalado: https://www.postgresql.org/download/windows/

### Durante a Instalação
- **Usuário:** postgres
- **Senha:** postgres
- **Porta:** 5432
- **Marque:** PostgreSQL Server, pgAdmin 4, Command Line Tools

### Após Instalação

1. **Abra pgAdmin 4**

2. **Crie o banco de dados:**
   - Clique com botão direito em "Databases"
   - Create > Database
   - Nome: `profbarral`
   - Owner: postgres
   - Save

3. **Verifique a connection string no `.env.local`:**
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/profbarral"
```

4. **Aplique as migrations:**
```powershell
npx prisma db push
```

5. **Inicie o servidor:**
```powershell
npm run dev
```

---

## ✅ Opção 3: Neon.tech (PostgreSQL Serverless - Grátis)

### Vantagens
- ✅ Sem instalação local
- ✅ Grátis até 10GB
- ✅ Backups automáticos
- ✅ Mesma tecnologia da produção

### Passos

1. **Acesse:** https://neon.tech

2. **Crie conta gratuita** (pode usar GitHub)

3. **Crie novo projeto:**
   - Nome: `site-prof-barral-dev`
   - Região: US East (próximo de Vercel)
   - PostgreSQL versão: 16

4. **Copie a Connection String:**
   - Vai parecer com: `postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb`

5. **Atualize `.env.local`:**
```env
DATABASE_URL="postgresql://seu_user:sua_senha@ep-xxx.us-east-1.aws.neon.tech/neondb"
```

6. **Aplique as migrations:**
```powershell
npx prisma db push
```

7. **Inicie o servidor:**
```powershell
npm run dev
```

---

## 🔧 Troubleshooting

### Erro: "Port 5432 already in use"

**Causa:** Outra instância do PostgreSQL está rodando

**Solução 1 - Parar a outra instância:**
```powershell
# No Windows Services (Win + R > services.msc)
# Encontre "postgresql" e pare o serviço
```

**Solução 2 - Usar porta diferente no Docker:**

Edite `docker-compose.yml`:
```yaml
ports:
  - "5433:5432"  # Mude 5432 para 5433
```

Atualize `.env.local`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/profbarral"
```

### Erro: "Can't reach database server"

**Verifique se o PostgreSQL está rodando:**

**Docker:**
```powershell
docker ps
```

**Nativo Windows:**
```powershell
# Services (Win + R > services.msc)
# Encontre "postgresql-x64-16" - deve estar "Running"
```

**Teste a conexão:**
```powershell
npx prisma db pull
```

### Erro: "SSL connection required"

**Para Neon.tech, adicione `?sslmode=require`:**
```env
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
```

---

## 📊 Verificar se está funcionando

**1. Teste a conexão:**
```powershell
npx prisma db pull
```

**2. Veja as tabelas:**
```powershell
npx prisma studio
```
Abre interface web em http://localhost:5555

**3. Rode o servidor:**
```powershell
npm run dev
```

**4. Acesse:** http://localhost:3000

---

## 🎯 Resumo: Qual escolher?

| Opção | Prós | Contras | Recomendado para |
|-------|------|---------|------------------|
| **Docker** | Fácil, isolado, rápido | Precisa instalar Docker | Desenvolvedores experientes |
| **Nativo** | Familiar, persistente | Ocupa espaço, configuração manual | Quem já usa PostgreSQL |
| **Neon.tech** | Zero setup, grátis, backups | Depende de internet | Testes rápidos, iniciantes |

**Minha recomendação:** Docker (se já tem instalado) ou Neon.tech (se quer rapidez)

---

**Data:** 24/01/2025
**Versão:** 1.0
