import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import MeuPlanoClient from './MeuPlanoClient';

export const metadata = {
 title: 'Meu plano',
 description: 'Gerencie sua assinatura e veja seus cursos ativos.',
};

export default async function MeuPlanoPage() {
 const cookieStore = await cookies();
 const token = cookieStore.get('auth-token')?.value;
 if (!token) redirect('/login');

 const payload = await verifyToken(token);
 if (!payload) redirect('/login');

 const [subscription, enrollments] = await Promise.all([
 prisma.subscription.findFirst({
 where: {
 userId: payload.userId,
 status: { in: ['active', 'past_due', 'processing'] },
 },
 orderBy: { createdAt: 'desc' },
 select: {
 id: true,
 plan: true,
 billingCycle: true,
 status: true,
 currentPeriodStart: true,
 currentPeriodEnd: true,
 cancelAtPeriodEnd: true,
 paymentMethod: true,
 courseId: true,
 },
 }),
 prisma.enrollment.findMany({
 where: {
 userId: payload.userId,
 OR: [{ expiresAt: { gte: new Date() } }, { isLifetime: true }],
 },
 select: {
 id: true,
 courseId: true,
 expiresAt: true,
 isLifetime: true,
 enrolledAt: true,
 },
 orderBy: { enrolledAt: 'desc' },
 }),
 ]);

 return (
 <MeuPlanoClient
 subscription={
 subscription
 ? {
 ...subscription,
 currentPeriodStart: subscription.currentPeriodStart.toISOString(),
 currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
 }
 : null
 }
 enrollments={enrollments.map(e => ({
 ...e,
 expiresAt: e.expiresAt ? e.expiresAt.toISOString() : null,
 enrolledAt: e.enrolledAt.toISOString(),
 }))}
 />
 );
}
