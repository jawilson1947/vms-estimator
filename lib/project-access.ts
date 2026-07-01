import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Server-only helpers for the restricted PROJECT_VIEWER role.
//
// A PROJECT_VIEWER may only see/act on the projects granted to them through the
// ProjectAccess table. Every other role is unrestricted at this layer (their
// permissions are governed elsewhere).

export interface SessionInfo {
  userId: number;
  role:   UserRole;
}

export function readSessionInfo(session: unknown): SessionInfo | null {
  const user = (session as { user?: { id?: string; role?: UserRole } } | null)?.user;
  if (!user?.id) return null;
  return { userId: Number(user.id), role: (user.role ?? UserRole.VIEWER) as UserRole };
}

// The set of project ids a PROJECT_VIEWER may access. Returns null for
// unrestricted roles (meaning "all projects").
export async function accessibleProjectIds(info: SessionInfo): Promise<Set<number> | null> {
  if (info.role !== UserRole.PROJECT_VIEWER) return null;
  const rows = await prisma.projectAccess.findMany({
    where:  { userId: info.userId },
    select: { projectId: true },
  });
  return new Set(rows.map(r => r.projectId));
}

export async function canViewProject(info: SessionInfo, projectId: number): Promise<boolean> {
  if (info.role !== UserRole.PROJECT_VIEWER) return true;
  const row = await prisma.projectAccess.findUnique({
    where: { userId_projectId: { userId: info.userId, projectId } },
    select: { id: true },
  });
  return !!row;
}

// Route-handler guard: ensures there is a session and (for PROJECT_VIEWER) that
// the project is one they have been granted. Returns a NextResponse to short-
// circuit on failure, or null to proceed.
export async function guardProjectRead(projectId: number): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  const info = readSessionInfo(session);
  if (!info) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!Number.isFinite(projectId)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const ok = await canViewProject(info, projectId);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return null;
}
