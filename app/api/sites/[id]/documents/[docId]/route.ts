import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { del } from '@vercel/blob';

type Params = { params: Promise<{ id: string; docId: string }> };

// DELETE /api/sites/[id]/documents/[docId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { docId: docIdStr } = await params;
  const docId = parseInt(docIdStr);
  if (isNaN(docId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const rows = await prisma.$queryRaw<{ file_url: string | null }[]>`
    SELECT file_url FROM site_documents WHERE document_id = ${docId} LIMIT 1
  `;
  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Delete from Vercel Blob (best-effort)
  try {
    if (rows[0].file_url) await del(rows[0].file_url);
  } catch { /* already gone */ }

  await prisma.$executeRaw`DELETE FROM site_documents WHERE document_id = ${docId}`;

  return NextResponse.json({ ok: true });
}
