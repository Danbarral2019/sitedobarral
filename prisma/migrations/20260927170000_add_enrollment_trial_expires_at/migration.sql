-- Prazo da matrícula presencial (trial por QR code) guardado enquanto há
-- assinatura; restaurado em removeEnrollmentsForSubscription (lib/stripe.ts).
ALTER TABLE "Enrollment" ADD COLUMN "trialExpiresAt" TIMESTAMP(3);
