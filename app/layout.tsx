import type { Metadata } from 'next';
import { DM_Sans, DM_Serif_Display } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from './theme-provider';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
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
  title: 'MyTurnApp',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable}`} suppressHydrationWarning>
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='3' fill='%2314D8C8'/><text x='8' y='12' text-anchor='middle' font-family='sans-serif' font-weight='700' font-size='11' fill='%230F1117'>M</text></svg>"
        />
        {/* Anti-FOUC: apply saved theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('myturnapp-theme');document.documentElement.setAttribute('data-theme',t||'dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
