import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { guardProjectRead, readSessionInfo } from '@/lib/project-access';
import { put } from '@vercel/blob';

type Params = { params: Promise<{ id: string }> };

const MAX_DOCS_PER_PROJECT = 5;
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

// Serialize a ProjectDocument row (BigInt → number for JSON)
function serialize(d: {
  id: number; projectId: number; fileName: string;
  originalFileName: string | null; fileUrl: string | null;
  mimeType: string | null; fileSizeBytes: bigint | null;
  uploadedBy: string | null; uploadedAt: Date;
}) {
  return {
    id:               d.id,
    projectId:        d.projectId,
    fileName:         d.fileName,
    originalFileName: d.originalFileName,
    fileUrl:          d.fileUrl,
    mimeType:         d.mimeType,
    fileSizeBytes:    d.fileSizeBytes != null ? Number(d.fileSizeBytes) : null,
    uploadedBy:       d.uploadedBy,
    uploadedAt:       d.uploadedAt.toISOString(),
  };
}

// GET /api/projects/[id]/documents — list documents (viewers allowed on granted projects)
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const projectId = Number(id);

  const denied = await guardProjectRead(projectId);
  if (denied) return denied;

  const docs = await prisma.projectDocument.findMany({
    where:   { projectId },
    orderBy: { uploadedAt: 'asc' },
  });

  return NextResponse.json(docs.map(serialize));
}

// POST /api/projects/[id]/documents — upload (form-data: file); blocked for PROJECT_VIEWER
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  const info = readSessionInfo(session);
  if (!info) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (info.role === 'PROJECT_VIEWER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId }, select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

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

  // Enforce per-project cap
  const count = await prisma.projectDocument.count({ where: { projectId } });
  if (count >= MAX_DOCS_PER_PROJECT) {
    return NextResponse.json(
      { error: `Limit reached: a project can have at most ${MAX_DOCS_PER_PROJECT} documents.` },
      { status: 400 }
    );
  }

  // Upload to Vercel Blob
  const safeExt = ALLOWED_EXT.includes(ext) ? ext : 'bin';
  const fileName = `doc-${projectId}-${Date.now()}.${safeExt}`;
  const contentType = file.type || 'application/octet-stream';

  const blob = await put(`project-documents/${fileName}`, file, {
    access: 'public',
    contentType,
  });

  const doc = await prisma.projectDocument.create({
    data: {
      projectId,
      fileName,
      originalFileName: file.name,
      filePath:      blob.url,
      fileUrl:       blob.url,
      mimeType:      contentType,
      fileSizeBytes: BigInt(file.size),
      uploadedBy:    session?.user?.email ?? 'unknown',
    },
  });

  return NextResponse.json(serialize(doc), { status: 201 });
}
