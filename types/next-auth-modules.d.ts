// Stubs for next-auth v3 sub-path imports (moduleResolution: bundler compat)

declare module 'next-auth/react' {
  import type { Session } from 'next-auth';
  export interface SignInResponse {
    error: string | undefined;
    status: number;
    ok: boolean;
    url: string | null;
  }
  export function signIn(provider?: string, options?: Record<string, unknown>): Promise<SignInResponse | undefined>;
  export function signOut(options?: Record<string, unknown>): Promise<{ url: string }>;
  export function useSession(): { data: Session | null; status: 'loading' | 'authenticated' | 'unauthenticated' };
  export function getSession(): Promise<Session | null>;
  export function SessionProvider(props: { children: React.ReactNode; session?: Session | null }): JSX.Element;
}

declare module 'next-auth/providers/credentials' {
  const CredentialsProvider: (options: {
    name?: string;
    credentials?: Record<string, { label?: string; type?: string }>;
    authorize: (credentials: Record<string, string> | undefined) => Promise<any>;
  }) => any;
  export default CredentialsProvider;
}
