import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { VoiceShell } from '@/components/VoiceShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const role = (session.user as { role?: string })?.role;

  return (
    <VoiceShell>
      <div className="flex min-h-screen">
        <Sidebar role={role} />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar />
          <main className="flex-1 p-3 overflow-auto">
            {children}
          </main>
          <footer className="px-4 py-3 border-t border-gray-200 text-xs text-gray-400 flex items-center justify-between">
            <span>&copy; {new Date().getFullYear()} Digital Support Systems</span>
            <span className="flex items-center gap-4">
              <a href="/about" className="hover:text-gray-600 hover:underline">
                About
              </a>
              <a href="/privacy-policy" className="hover:text-gray-600 hover:underline">
                Privacy Policy
              </a>
            </span>
          </footer>
        </div>
      </div>
    </VoiceShell>
  );
}
