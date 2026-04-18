'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouting } from '@/context/RoutingContext';
import { Sun, Moon } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/routes': 'Route Comparison',
  '/analytics': 'Network Analytics',
  '/settings': 'Settings',
};

export function TopNavBar() {
  const pathname = usePathname();
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const { theme, toggleTheme } = useRouting();

  useEffect(() => {
    const check = async () => {
      const ok = await api.healthCheck();
      setIsHealthy(ok);
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const title = pageTitles[pathname] || 'CNAR';

  return (
    <header className="top-nav">
      <div className="top-nav-left">
        <h1 className="top-nav-title">{title}</h1>
        <span className="top-nav-breadcrumb">CNAR / {title}</span>
      </div>
      <div className="top-nav-right">
        <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <div className={`status-indicator ${isHealthy === true ? 'online' : isHealthy === false ? 'offline' : 'checking'}`}>
          <span className="status-dot" />
          <span className="status-label">
            {isHealthy === true ? 'Connected' : isHealthy === false ? 'Offline' : 'Checking...'}
          </span>
        </div>
      </div>
    </header>
  );
}
