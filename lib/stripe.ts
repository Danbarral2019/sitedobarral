import Stripe from 'stripe'
import { apiLogger } from '@/lib/logger'

// ── Types ──────────────────────────────────────────────────────────────────

export type PlanType = 'basico' | 'premium'
export type BillingCycle = 'monthly' | 'yearly'
export type PaymentMethod = 'card' | 'pix'

// ── Price table ────────────────────────────────────────────────────────────

const PRICE_TABLE: Record<PlanType, Record<BillingCycle, number>> = {
  basico: { monthly: 4990, yearly: 49900 },
  premium: { monthly: 8990, yearly: 89900 },
}

export function priceAmountInCents(plan: PlanType, billingCycle: BillingCycle): number {
  return PRICE_TABLE[plan][billingCycle]
}

// ── Stripe client (lazy singleton) ─────────────────────────────────────────

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  stripeInstance = new Stripe(key)
  return stripeInstance
}

export function resetStripeClient(): void {
  stripeInstance = null
}

// ── Price resolution via lookup_key ────────────────────────────────────────

export async function resolvePriceId(plan: PlanType, billingCycle: BillingCycle): Promise<string> {
  const stripe = getStripe()
  const lookupKey = `${plan}_${billingCycle}`

  const { data } = await stripe.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
    active: true,
  })

  if (data.length === 0) {
    throw new Error(`Stripe price not found for lookup_key: ${lookupKey}`)
  }

  apiLogger.info({ lookupKey, priceId: data[0].id }, 'Resolved Stripe price')
  return data[0].id
}

// ── Period calculation ─────────────────────────────────────────────────────

export function calculatePeriodEnd(start: Date, billingCycle: BillingCycle): Date {
  const end = new Date(start)
  if (billingCycle === 'monthly') {
    end.setUTCMonth(end.getUTCMonth() + 1)
  } else {
    end.setUTCFullYear(end.getUTCFullYear() + 1)
  }
  return end
}
