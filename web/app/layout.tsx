import '@/app/globals.css';
import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import { Providers } from './providers';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

const outfit = Outfit({ 
  subsets: ['latin'],
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: 'TrekRiderz - Plan Your Next Adventure',
  description: 'The ultimate platform for planning treks, finding homestays, connecting with guides, and exploring outdoor adventures.',
  keywords: 'trekking, adventure, homestays, travel planning, outdoor activities, guides, hiking',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${outfit.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
