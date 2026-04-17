/**
 * Migração one-shot Mercado Pago → Stripe.
 * Idempotente — pode rodar mais de uma vez sem efeito.
 *
 * Uso:
 *   DATABASE_URL=postgres://... npx tsx scripts/migrate-mp-to-stripe.ts
 */
import { neon } from '@neondatabase/serverless';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL não definido');
    process.exit(1);
  }

  const sql = neon(url);

  console.log('1/4 Removendo colunas MP...');
  await sql`ALTER TABLE "User" DROP COLUMN IF EXISTS "mercadopagoPayerId"`;
  await sql`ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "mercadopagoPreapprovalId"`;

  console.log('2/4 Adicionando colunas Stripe...');
  await sql`ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "stripeCheckoutSessionId" TEXT`;
  await sql`ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT`;

  console.log('3/4 Criando índices...');
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeCheckoutSessionId_key" ON "Subscription"("stripeCheckoutSessionId")`;
  await sql`CREATE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId")`;

  console.log('4/4 Criando tabela ProcessedWebhookEvent...');
  await sql`CREATE TABLE IF NOT EXISTS "ProcessedWebhookEvent" (
    "stripeEventId" TEXT PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`;
  await sql`CREATE INDEX IF NOT EXISTS "ProcessedWebhookEvent_processedAt_idx" ON "ProcessedWebhookEvent"("processedAt")`;

  console.log('Migracao MP->Stripe aplicada com sucesso');
}

main().catch((err) => {
  console.error('Falha na migracao:', err);
  process.exit(1);
});
