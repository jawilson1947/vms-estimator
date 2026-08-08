import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { readSessionInfo } from '@/lib/project-access';
import { del } from '@vercel/blob';

type Params = { params: Promise<{ id: string; docId: string }> };

// DELETE /api/projects/[id]/documents/[docId] — blocked for PROJECT_VIEWER
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  const info = readSessionInfo(session);
  if (!info) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (info.role === 'PROJECT_VIEWER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, docId: docIdStr } = await params;
  const projectId = Number(id);
  const docId = parseInt(docIdStr);
  if (!Number.isFinite(projectId) || isNaN(docId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const doc = await prisma.projectDocument.findUnique({
    where:  { id: docId },
    select: { id: true, projectId: true, fileUrl: true },
  });
  // Ensure the document belongs to the project in the URL
  if (!doc || doc.projectId !== projectId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Delete from Vercel Blob (best-effort)
  try {
    if (doc.fileUrl) await del(doc.fileUrl);
  } catch { /* already gone */ }

  await prisma.projectDocument.delete({ where: { id: docId } });

  return NextResponse.json({ ok: true });
}
