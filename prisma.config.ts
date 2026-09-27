import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js usa .env.local por padrão
dotenv.config({ path: ".env.local" });

// A CLI (generate, migrate) precisa de conexão direta: o `migrate deploy` segura um
// advisory lock de sessão, que o PgBouncer do pooler da Neon pode deixar preso numa
// conexão reaproveitada (P1002 no build de preview do #237). O runtime não passa por
// aqui (usa o adapter PrismaNeon com DATABASE_URL). Só na Vercel se troca de URL: lá
// as duas variáveis vêm da integração Neon e apontam para o mesmo banco. Localmente, o
// .env.local traz a UNPOOLED de produção e anularia um DATABASE_URL de teste passado
// na linha de comando.
const cliDatabaseUrl =
  (process.env.VERCEL === "1" ? process.env.DATABASE_URL_UNPOOLED : undefined) ||
  process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Fallback para CI onde DATABASE_URL pode não existir (prisma generate não precisa de conexão)
    url: cliDatabaseUrl ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
