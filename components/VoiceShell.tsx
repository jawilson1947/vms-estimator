'use client';
import { VoiceProvider } from '@/context/VoiceContext';
import { ReactNode } from 'react';

export function VoiceShell({ children }: { children: ReactNode }) {
  return <VoiceProvider>{children}</VoiceProvider>;
}
