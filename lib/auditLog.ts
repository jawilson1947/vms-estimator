import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export interface AuditParams {
  action: string;
  entityType?: string;
  entityId?: number;
  detail?: string;
  userId?: number;
  userEmail?: string;
  ipAddress?: string;
}

/** Write an audit log entry. Swallows errors so it never breaks the calling request. */
export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    await (prisma as any).auditLog.create({
      data: {
        action:     params.action,
        entityType: params.entityType ?? null,
        entityId:   params.entityId   ?? null,
        detail:     params.detail     ?? null,
        userId:     params.userId     ?? null,
        userEmail:  params.userEmail  ?? null,
        ipAddress:  params.ipAddress  ?? null,
      },
    });
  } catch (_) {
    // Audit logging must never crash the caller
  }
}

/** Convenience: pull session + IP from a request and write a log entry. */
export async function auditFromRequest(
  req: NextRequest,
  action: string,
  opts?: { entityType?: string; entityId?: number; detail?: string },
): Promise<void> {
  try {
    const session  = await getServerSession(authOptions);
    const userId   = session ? Number((session.user as any)?.id) || undefined : undefined;
    const userEmail = session?.user?.email ?? undefined;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
             ?? req.headers.get('x-real-ip')
             ?? undefined;
    await writeAuditLog({ action, userId, userEmail, ipAddress: ip, ...opts });
  } catch (_) {}
}
