// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPricesList = vi.fn()

vi.mock('stripe', () => {
  function StripeMock() {
    return {
      prices: { list: mockPricesList },
    }
  }
  return { default: StripeMock }
})

vi.mock('@/lib/logger', () => ({
  apiLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// ── Tests ──────────────────────────────────────────────────────────────────

describe('lib/stripe', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
    const { resetStripeClient } = await import('../stripe')
    resetStripeClient()
  })

  // ── Task 4: Pure helpers + resolvePriceId ─────────────────────────────

  describe('priceAmountInCents', () => {
    it('returns correct values for all 4 plan/cycle combos', async () => {
      const { priceAmountInCents } = await import('../stripe')
      expect(priceAmountInCents('basico', 'monthly')).toBe(4990)
      expect(priceAmountInCents('basico', 'yearly')).toBe(49900)
      expect(priceAmountInCents('premium', 'monthly')).toBe(8990)
      expect(priceAmountInCents('premium', 'yearly')).toBe(89900)
    })
  })

  describe('calculatePeriodEnd', () => {
    it('adds 1 month for monthly', async () => {
      const { calculatePeriodEnd } = await import('../stripe')
      const start = new Date('2026-01-15T00:00:00Z')
      const end = calculatePeriodEnd(start, 'monthly')
      expect(end.getUTCMonth()).toBe(1) // February
      expect(end.getUTCDate()).toBe(15)
      expect(end.getUTCFullYear()).toBe(2026)
    })

    it('adds 1 year for yearly', async () => {
      const { calculatePeriodEnd } = await import('../stripe')
      const start = new Date('2026-01-15T00:00:00Z')
      const end = calculatePeriodEnd(start, 'yearly')
      expect(end.getUTCFullYear()).toBe(2027)
      expect(end.getUTCMonth()).toBe(0) // January
      expect(end.getUTCDate()).toBe(15)
    })
  })

  describe('resolvePriceId', () => {
    it('returns correct price ID via lookup_key', async () => {
      const { resolvePriceId } = await import('../stripe')
      mockPricesList.mockResolvedValueOnce({
        data: [{ id: 'price_abc123' }],
      })

      const priceId = await resolvePriceId('basico', 'monthly')

      expect(mockPricesList).toHaveBeenCalledWith({
        lookup_keys: ['basico_monthly'],
        limit: 1,
        active: true,
      })
      expect(priceId).toBe('price_abc123')
    })

    it('throws when lookup_key not found', async () => {
      const { resolvePriceId } = await import('../stripe')
      mockPricesList.mockResolvedValueOnce({ data: [] })

      await expect(resolvePriceId('premium', 'yearly')).rejects.toThrow(
        'Stripe price not found for lookup_key: premium_yearly'
      )
    })
  })
})
