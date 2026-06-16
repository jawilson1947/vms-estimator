import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { put } from '@vercel/blob';

type Params = { params: Promise<{ id: string }> };

const MAX_DOCS_PER_SITE = 5;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

// Allowed upload types: PDF + common docs/images
const ALLOWED: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};
const ALLOWED_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg'];

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

// GET /api/sites/[id]/documents
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const siteId = parseInt(id);
  if (isNaN(siteId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const rows = await prisma.$queryRaw<DocumentRow[]>`
    SELECT document_id, site_id, file_name, original_file_name,
           file_path, file_url, mime_type, file_size_bytes, uploaded_by, uploaded_at
    FROM   site_documents
    WHERE  site_id = ${siteId}
    ORDER  BY uploaded_at ASC
  `;

  return NextResponse.json(rows.map(normalise));
}

// POST /api/sites/[id]/documents
// form-data: file (File)
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const siteId = parseInt(id);
  if (isNaN(siteId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  // Validate type (by MIME or extension)
  const ext = extOf(file.name);
  const typeOk = (file.type && ALLOWED[file.type]) || ALLOWED_EXT.includes(ext);
  if (!typeOk) {
    return NextResponse.json(
      { error: 'Unsupported file type. Allowed: PDF, Word, Excel, PNG, JPG.' },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 25 MB limit.' }, { status: 400 });
  }

  // Enforce per-site cap
  const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM site_documents WHERE site_id = ${siteId}
  `;
  if (Number(n) >= MAX_DOCS_PER_SITE) {
    return NextResponse.json(
      { error: `Limit reached: a site can have at most ${MAX_DOCS_PER_SITE} documents.` },
      { status: 400 }
    );
  }

  // Upload to Vercel Blob
  const safeExt = ALLOWED_EXT.includes(ext) ? ext : 'bin';
  const fileName = `doc-${siteId}-${Date.now()}.${safeExt}`;
  const contentType = file.type || 'application/octet-stream';

  const blob = await put(`site-documents/${fileName}`, file, {
    access: 'public',
    contentType,
  });

  await prisma.$executeRaw`
    INSERT INTO site_documents
      (site_id, file_name, original_file_name, file_path, file_url,
       mime_type, file_size_bytes, uploaded_by, uploaded_at)
    VALUES
      (${siteId}, ${fileName}, ${file.name}, ${blob.url}, ${blob.url},
       ${contentType}, ${BigInt(file.size)}, ${session.user?.email ?? 'unknown'}, NOW(3))
  `;

  const [row] = await prisma.$queryRaw<DocumentRow[]>`
    SELECT document_id, site_id, file_name, original_file_name,
           file_path, file_url, mime_type, file_size_bytes, uploaded_by, uploaded_at
    FROM   site_documents
    WHERE  site_id = ${siteId} AND file_name = ${fileName}
    LIMIT  1
  `;

  return NextResponse.json(normalise(row), { status: 201 });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface DocumentRow {
  document_id:        number;
  site_id:            number;
  file_name:          string;
  original_file_name: string | null;
  file_path:          string;
  file_url:           string | null;
  mime_type:          string | null;
  file_size_bytes:    bigint | null;
  uploaded_by:        string | null;
  uploaded_at:        Date;
}

function normalise(r: DocumentRow) {
  return {
    id:               r.document_id,
    siteId:           r.site_id,
    fileName:         r.file_name,
    originalFileName: r.original_file_name,
    fileUrl:          r.file_url,
    mimeType:         r.mime_type,
    fileSizeBytes:    r.file_size_bytes ? Number(r.file_size_bytes) : null,
    uploadedBy:       r.uploaded_by,
    uploadedAt:       r.uploaded_at instanceof Date ? r.uploaded_at.toISOString() : String(r.uploaded_at),
  };
}
