import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
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

// ── Customer management ────────────────────────────────────────────────────

export async function ensureStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  if (user.stripeCustomerId) {
    apiLogger.debug({ userId, customerId: user.stripeCustomerId }, 'Reusing existing Stripe customer')
    return user.stripeCustomerId
  }

  const stripe = getStripe()
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId },
  })

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  })

  apiLogger.info({ userId, customerId: customer.id }, 'Created Stripe customer')
  return customer.id
}
