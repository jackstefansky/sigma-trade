import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'StockPilot AI',
  description: 'Paper trading with AI agent team',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" className={`dark ${jetbrainsMono.variable}`}>
      <body className="font-mono bg-bg-base text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
