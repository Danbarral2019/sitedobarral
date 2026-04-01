import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ResendWebhookEvent {
  type: string;
  data: {
    email_id?: string;
    to?: string[];
    from?: string;
    subject?: string;
    created_at?: string;
  };
}

/**
 * Resend Webhook Handler
 * Processes email events: delivered, opened, clicked, bounced
 */
export async function POST(request: NextRequest) {
  try {
    const event: ResendWebhookEvent = await request.json();

    console.log(`[Resend Webhook] Event: ${event.type}`);

    switch (event.type) {
      case 'email.bounced': {
        const bouncedEmails = event.data.to || [];
        for (const email of bouncedEmails) {
          await prisma.newsletterSubscriber.updateMany({
            where: { email, isActive: true },
            data: { isActive: false },
          });
          console.log(`[Resend Webhook] Deactivated bounced subscriber: ${email}`);
        }
        break;
      }

      case 'email.clicked': {
        // Increment clicks on the most recent newsletter send matching the subject
        const clickSubject = event.data.subject;
        if (clickSubject) {
          await prisma.newsletterSend.updateMany({
            where: { subject: clickSubject },
            data: { clicks: { increment: 1 } },
          });
        }
        console.log(`[Resend Webhook] ${event.type} for ${event.data.to?.join(', ')}`);
        break;
      }

      case 'email.delivered':
      case 'email.opened':
        console.log(`[Resend Webhook] ${event.type} for ${event.data.to?.join(', ')}`);
        break;

      default:
        console.log(`[Resend Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Resend Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
