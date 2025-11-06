import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { deleteLegislativeAct } from '@/lib/legislacao';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    await deleteLegislativeAct(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting legislative act:', error);
    return NextResponse.json({ error: 'Failed to delete legislative act' }, { status: 500 });
  }
}
