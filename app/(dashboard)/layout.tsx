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

  return (
    <VoiceShell>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar />
          <main className="flex-1 p-3 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </VoiceShell>
  );
}
