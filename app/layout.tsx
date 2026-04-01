import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Robo Kids MVP',
  description: 'A playful robot companion MVP for kids.',
  applicationName: 'Robo Kids MVP',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Robo',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
