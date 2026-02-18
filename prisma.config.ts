import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js usa .env.local por padrão
dotenv.config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Fallback para CI onde DATABASE_URL pode não existir (prisma generate não precisa de conexão)
    url: process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
