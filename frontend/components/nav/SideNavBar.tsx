'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Route, Signal, Settings } from 'lucide-react';

const navItems = [
  { href: '/', icon: Map, label: 'Dashboard' },
  { href: '/routes', icon: Route, label: 'Routes' },
  { href: '/analytics', icon: Signal, label: 'Analytics' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export function SideNavBar() {
  const pathname = usePathname();

  return (
    <nav className="side-nav">
      <div className="side-nav-logo">
        <div className="logo-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="logo-text">CN</span>
      </div>
      <div className="side-nav-items">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href} className={`side-nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={20} strokeWidth={1.8} />
              <span className="side-nav-tooltip">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
