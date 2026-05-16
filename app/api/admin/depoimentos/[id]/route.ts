import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteTestimonial } from '@/lib/depoimentos';
import { CacheInvalidation } from '@/lib/cache/redis-client';
import { apiLogger } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const testimonial = await prisma.testimonial.findUnique({ where: { id } });

    if (!testimonial) {
      return NextResponse.json({ error: 'Depoimento não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ testimonial });
  } catch (error) {
    apiLogger.error({ err: error }, 'Error fetching testimonial:');
    return NextResponse.json({ error: 'Failed to fetch testimonial' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json();

    const { name, email, phone, role, text, rating, avatar, color, status, rejectionReason } = body;

    if (!name || !email || !role || !text) {
      return NextResponse.json({ error: 'Nome, email, cargo e texto são obrigatórios' }, { status: 400 });
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
    apiLogger.error({ err: error }, 'Error updating testimonial:');
    return NextResponse.json({ error: 'Failed to update testimonial' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    await deleteTestimonial(id);

    CacheInvalidation.testimonials().catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    apiLogger.error({ err: error }, 'Error deleting testimonial:');
    return NextResponse.json({ error: 'Failed to delete testimonial' }, { status: 500 });
  }
}
