import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

// Type augmentation is in types/next-auth.d.ts

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials: Record<string, string> | undefined) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.isActive) return null;

        const passwordValid = await compare(credentials.password, user.passwordHash);
        if (!passwordValid) return null;

        // Update last login (fire-and-forget)
        prisma.user.update({
          where: { id: user.id },
          data:  { lastLogin: new Date() },
        }).catch(() => {});

        return {
          id:    String(user.id),
          name:  [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username,
          email: user.email,
          role:  user.role ?? UserRole.VIEWER,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        token.id   = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        (session.user as any).id   = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
};

// Role helpers

export function canEdit(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.PROJECT_MANAGER || role === UserRole.TECHNICIAN;
}

export function canManageProjects(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.PROJECT_MANAGER;
}

export function isAdmin(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

// A PROJECT_VIEWER is a restricted user who can only access the Projects
// subsystem, and only the specific projects granted to them (via ProjectAccess).
export function isProjectViewer(role: UserRole | null | undefined): boolean {
  return role === UserRole.PROJECT_VIEWER;
}
