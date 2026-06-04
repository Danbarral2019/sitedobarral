/**
 * Flag de habilitação do PIX no checkout.
 *
 * PIX está DESABILITADO por padrão. O checkout de assinatura usa Pix Automático
 * (débito recorrente autorizado no app do banco), que é "invite only" no Brasil
 * e exige histórico de processamento na conta. Enquanto a Stripe não conceder o
 * acesso, o site oferece apenas cartão/boleto.
 *
 * Para religar quando o convite do Pix Automático chegar:
 *   1. Ativar a capability `pix_payments` no Stripe Dashboard (test e live)
 *   2. Setar `NEXT_PUBLIC_PIX_ENABLED=true` no Vercel (Preview + Production)
 *
 * Nada de código precisa mudar: o fluxo PIX em `lib/stripe.ts` e o seletor em
 * `/planos` voltam a aparecer/funcionar sozinhos quando a flag fica `true`.
 */
export const PIX_ENABLED = process.env.NEXT_PUBLIC_PIX_ENABLED === 'true';
