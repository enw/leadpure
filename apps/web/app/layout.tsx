import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LeadPure — Email enrichment. No lock-in.',
  description:
    'Open-source lead enrichment API. Works with any CRM. Self-host or use our cloud.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
