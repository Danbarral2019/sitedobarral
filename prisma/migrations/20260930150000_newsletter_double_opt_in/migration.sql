-- AlterTable
ALTER TABLE "NewsletterSubscriber" ADD COLUMN     "confirmationSentAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3);

-- Double opt-in: os inscritos existentes antes desta migração continuam
-- recebendo a newsletter. Todos passam a constar como confirmados na data da
-- inscrição; os envios filtram isActive = true AND confirmedAt IS NOT NULL,
-- de modo que os cancelados seguem fora. Inscrições criadas depois desta
-- migração ficam pendentes (confirmedAt nulo) até o clique no link.
UPDATE "NewsletterSubscriber"
SET "confirmedAt" = "subscribedAt"
WHERE "confirmedAt" IS NULL;
