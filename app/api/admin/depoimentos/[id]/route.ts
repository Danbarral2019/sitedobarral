import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteTestimonial } from '@/lib/depoimentos';
import { CacheInvalidation } from '@/lib/cache/redis-client';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, NotFoundError, ValidationError } from '@/lib/errors/api-error';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      throw new AuthenticationError('Unauthorized');
    }
    const { id } = await params;
    const testimonial = await prisma.testimonial.findUnique({ where: { id } });

    if (!testimonial) {
      throw new NotFoundError('Depoimento');
    }

    return NextResponse.json({ testimonial });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      throw new AuthenticationError('Unauthorized');
    }
    const { id } = await params;
    const body = await request.json();

    const { name, email, phone, role, text, rating, avatar, color, status, rejectionReason } = body;

    if (!name || !email || !role || !text) {
      throw new ValidationError('Nome, email, cargo e texto são obrigatórios');
    }

    const testimonial = await prisma.testimonial.update({
      where: { id },
      data: {
        name,
        email,
        phone: phone || null,
        role,
        text,
        rating: Math.min(5, Math.max(1, parseInt(rating) || 5)),
        avatar: avatar || name.charAt(0).toUpperCase(),
        color: color || 'from-blue-400 to-blue-600',
        status: status || 'pending',
        rejectionReason: rejectionReason || null,
        ...(status && status !== 'pending' ? {
          moderatedBy: authResult.user?.userId,
          moderatedAt: new Date(),
        } : {}),
      },
    });

    CacheInvalidation.testimonials().catch(console.error);

    return NextResponse.json({ success: true, testimonial });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      throw new AuthenticationError('Unauthorized');
    }
    const { id } = await params;
    await deleteTestimonial(id);

    CacheInvalidation.testimonials().catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
