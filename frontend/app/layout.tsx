import type { Metadata } from 'next';
import './globals.css';
import { RoutingProvider } from '@/context/RoutingContext';
import { SideNavBar } from '@/components/nav/SideNavBar';
import { TopNavBar } from '@/components/nav/TopNavBar';

export const metadata: Metadata = {
  title: 'CNAR — Cellular Network-Aware Routing',
  description: 'Route vehicles by cellular signal quality. Compare fastest vs most connected routes with real-time tower coverage analysis.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RoutingProvider>
          <div style={{ display: 'flex', height: '100vh' }}>
            <SideNavBar />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <TopNavBar />
              <main style={{ flex: 1, overflow: 'hidden' }}>
                {children}
              </main>
            </div>
          </div>
        </RoutingProvider>
      </body>
    </html>
  );
}
