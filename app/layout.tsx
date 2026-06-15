import type { Metadata } from 'next';
import { DM_Sans, DM_Serif_Display } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from './theme-provider';
import { AppToaster } from '../components/AppToaster';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-dm-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MyTurn — Skip the Queue, Book Your Slot',
  description:
    'Book clinic appointments instantly by scanning a QR code. No waiting, no counters. MyTurn for doctors and patients.',
  keywords: ['clinic booking', 'doctor appointment', 'queue management', 'QR booking India'],
  openGraph: {
    title: 'MyTurn — Skip the Queue, Book Your Slot',
    description:
      'Book clinic appointments instantly by scanning a QR code. No waiting, no counters. MyTurn for doctors and patients.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable}`} suppressHydrationWarning>
      <head>
        {/* Anti-FOUC: apply saved theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('myturnapp-theme');document.documentElement.setAttribute('data-theme',t||'dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <AppToaster />
      </body>
    </html>
  );
}
