// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPricesList = vi.fn()
const mockCustomersCreate = vi.fn()
const mockCheckoutSessionsCreate = vi.fn()
const mockBillingPortalSessionsCreate = vi.fn()

vi.mock('stripe', () => {
  function StripeMock() {
    return {
      prices: { list: mockPricesList },
      customers: { create: mockCustomersCreate },
      checkout: { sessions: { create: mockCheckoutSessionsCreate } },
      billingPortal: { sessions: { create: mockBillingPortalSessionsCreate } },
    }
  }
  return { default: StripeMock }
})

const mockPrismaUserFindUnique = vi.fn()
const mockPrismaUserUpdate = vi.fn()
const mockPrismaSubscriptionFindUnique = vi.fn()
const mockPrismaTransaction = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockPrismaUserFindUnique(...args),
      update: (...args: unknown[]) => mockPrismaUserUpdate(...args),
    },
    subscription: {
      findUnique: (...args: unknown[]) => mockPrismaSubscriptionFindUnique(...args),
    },
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
  },
}))

vi.mock('@/data/courses', () => ({
  courses: [
    { id: '2' },
    { id: '3' },
    { id: '4' },
  ],
}))

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

  // ── Task 5: ensureStripeCustomer ──────────────────────────────────────

  describe('ensureStripeCustomer', () => {
    it('creates customer when none exists and saves to DB', async () => {
      const { ensureStripeCustomer } = await import('../stripe')

      mockPrismaUserFindUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        stripeCustomerId: null,
      })
      mockCustomersCreate.mockResolvedValueOnce({ id: 'cus_new123' })
      mockPrismaUserUpdate.mockResolvedValueOnce({})

      const customerId = await ensureStripeCustomer('user-1')

      expect(customerId).toBe('cus_new123')
      expect(mockCustomersCreate).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user-1' },
      })
      expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { stripeCustomerId: 'cus_new123' },
      })
    })

    it('reuses existing customer and does not call Stripe API', async () => {
      const { ensureStripeCustomer } = await import('../stripe')

      mockPrismaUserFindUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        stripeCustomerId: 'cus_existing',
      })

      const customerId = await ensureStripeCustomer('user-1')

      expect(customerId).toBe('cus_existing')
      expect(mockCustomersCreate).not.toHaveBeenCalled()
      expect(mockPrismaUserUpdate).not.toHaveBeenCalled()
    })
  })

  // ── Task 6: createCheckoutSession + createBillingPortalSession ────────

  describe('createCheckoutSession', () => {
    beforeEach(() => {
      mockPricesList.mockResolvedValue({ data: [{ id: 'price_test' }] })
      mockPrismaUserFindUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        stripeCustomerId: 'cus_abc',
      })
    })

    it('creates card checkout session with correct params (no mandate)', async () => {
      const { createCheckoutSession } = await import('../stripe')
      mockCheckoutSessionsCreate.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/session123',
        id: 'cs_test_123',
      })

      const result = await createCheckoutSession({
        userId: 'user-1',
        plan: 'basico',
        billingCycle: 'monthly',
        method: 'card',
        baseUrl: 'https://example.com',
      })

      expect(result).toEqual({
        url: 'https://checkout.stripe.com/session123',
        sessionId: 'cs_test_123',
      })

      const createCall = mockCheckoutSessionsCreate.mock.calls[0][0]
      expect(createCall.mode).toBe('subscription')
      expect(createCall.customer).toBe('cus_abc')
      expect(createCall.payment_method_types).toEqual(['card'])
      expect(createCall.line_items).toEqual([{ price: 'price_test', quantity: 1 }])
      expect(createCall.payment_method_options).toBeUndefined()
      expect(createCall.success_url).toBe(
        'https://example.com/assinatura/sucesso?session_id={CHECKOUT_SESSION_ID}'
      )
      expect(createCall.cancel_url).toBe('https://example.com/assinatura/cancelado')
      expect(createCall.metadata.userId).toBe('user-1')
      expect(createCall.metadata.plan).toBe('basico')
      expect(createCall.metadata.billingCycle).toBe('monthly')
    })

    it('creates pix checkout session with mandate_options', async () => {
      const { createCheckoutSession } = await import('../stripe')
      mockCheckoutSessionsCreate.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/pix-session',
        id: 'cs_pix_123',
      })

      await createCheckoutSession({
        userId: 'user-1',
        plan: 'premium',
        billingCycle: 'yearly',
        method: 'pix',
        baseUrl: 'https://example.com',
      })

      const createCall = mockCheckoutSessionsCreate.mock.calls[0][0]
      expect(createCall.payment_method_types).toEqual(['pix'])
      expect(createCall.payment_method_options).toBeDefined()
      const pixOpts = createCall.payment_method_options.pix.mandate_options
      expect(pixOpts.amount).toBe(89900)
      expect(pixOpts.amount_type).toBe('fixed')
      expect(pixOpts.payment_schedule).toBe('yearly')
      expect(pixOpts.reference).toBe('Site do Barral - Premium Anual')
    })
  })

  describe('createBillingPortalSession', () => {
    it('returns url from billing portal session', async () => {
      const { createBillingPortalSession } = await import('../stripe')

      mockPrismaUserFindUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        stripeCustomerId: 'cus_portal',
      })
      mockBillingPortalSessionsCreate.mockResolvedValueOnce({
        url: 'https://billing.stripe.com/portal-session',
      })

      const result = await createBillingPortalSession(
        'user-1',
        'https://example.com/area-restrita'
      )

      expect(result).toEqual({ url: 'https://billing.stripe.com/portal-session' })
      expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith({
        customer: 'cus_portal',
        return_url: 'https://example.com/area-restrita',
      })
    })
  })

  // ── Task 7: Enrollment helpers ────────────────────────────────────────

  describe('createEnrollmentsForSubscription', () => {
    it('premium enrolls in ALL courses', async () => {
      const { createEnrollmentsForSubscription } = await import('../stripe')

      mockPrismaTransaction.mockImplementationOnce(async (cb: (tx: unknown) => Promise<void>) => {
        const tx = {
          enrollment: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({}),
            update: vi.fn().mockResolvedValue({}),
          },
        }
        await cb(tx)
        expect(tx.enrollment.findUnique).toHaveBeenCalledTimes(3)
        expect(tx.enrollment.create).toHaveBeenCalledTimes(3)
      })

      await createEnrollmentsForSubscription({
        userId: 'user-1',
        plan: 'premium',
      })

      expect(mockPrismaTransaction).toHaveBeenCalledTimes(1)
    })

    it('basico enrolls in single courseId only', async () => {
      const { createEnrollmentsForSubscription } = await import('../stripe')

      mockPrismaTransaction.mockImplementationOnce(async (cb: (tx: unknown) => Promise<void>) => {
        const tx = {
          enrollment: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({}),
            update: vi.fn().mockResolvedValue({}),
          },
        }
        await cb(tx)
        expect(tx.enrollment.findUnique).toHaveBeenCalledTimes(1)
        expect(tx.enrollment.create).toHaveBeenCalledTimes(1)
        expect(tx.enrollment.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            userId: 'user-1',
            courseId: '2',
            expiresAt: null,
          }),
        })
      })

      await createEnrollmentsForSubscription({
        userId: 'user-1',
        plan: 'basico',
        courseId: '2',
      })

      expect(mockPrismaTransaction).toHaveBeenCalledTimes(1)
    })
  })

  describe('removeEnrollmentsForSubscription', () => {
    it('preserves enrollment with qrCodeId', async () => {
      const { removeEnrollmentsForSubscription } = await import('../stripe')

      mockPrismaSubscriptionFindUnique.mockResolvedValueOnce({
        id: 'sub-1',
        userId: 'user-1',
        plan: 'basico',
        courseId: '2',
      })

      mockPrismaTransaction.mockImplementationOnce(async (cb: (tx: unknown) => Promise<void>) => {
        const tx = {
          enrollment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'enr-1',
              userId: 'user-1',
              courseId: '2',
              qrCodeId: 'qr-abc',
            }),
            delete: vi.fn(),
          },
        }
        await cb(tx)
        expect(tx.enrollment.delete).not.toHaveBeenCalled()
      })

      await removeEnrollmentsForSubscription('stripe_sub_123')

      expect(mockPrismaSubscriptionFindUnique).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'stripe_sub_123' },
      })
    })

    it('deletes enrollment without qrCodeId', async () => {
      const { removeEnrollmentsForSubscription } = await import('../stripe')

      mockPrismaSubscriptionFindUnique.mockResolvedValueOnce({
        id: 'sub-1',
        userId: 'user-1',
        plan: 'basico',
        courseId: '2',
      })

      mockPrismaTransaction.mockImplementationOnce(async (cb: (tx: unknown) => Promise<void>) => {
        const tx = {
          enrollment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'enr-1',
              userId: 'user-1',
              courseId: '2',
              qrCodeId: null,
            }),
            delete: vi.fn().mockResolvedValue({}),
          },
        }
        await cb(tx)
        expect(tx.enrollment.delete).toHaveBeenCalledWith({
          where: { id: 'enr-1' },
        })
      })

      await removeEnrollmentsForSubscription('stripe_sub_456')
    })
  })
})
