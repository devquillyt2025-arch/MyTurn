'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';
import { useTheme } from '../theme-provider';
import { createClient } from '@/lib/supabase/client';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [clinicName, setClinicName] = useState('');
  const [doctorPlan, setDoctorPlan] = useState('free');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('clinics')
        .select('name')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.name) setClinicName(data.name);
        });
      supabase
        .from('doctors')
        .select('plan')
        .eq('id', user.id)
        .single()
        .then(({ data: doctor }) => {
          if (doctor?.plan) setDoctorPlan(doctor.plan);
        });
    });
  }, []);

  // Live-update the topbar clinic name when it's changed in Settings
  useEffect(() => {
    function onClinicUpdated(e: Event) {
      const name = (e as CustomEvent<{ name: string }>).detail?.name;
      if (typeof name === 'string') setClinicName(name);
    }
    window.addEventListener('clinic:updated', onClinicUpdated);
    return () => window.removeEventListener('clinic:updated', onClinicUpdated);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <div className={styles.page}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <div className={styles.logo} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/logo.png" alt="MyTurn Logo" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
          <span>My<span className={styles.logoTurn}>Turn</span></span> <span className={styles.logoSlash}>/</span>
        </div>
        <div className={styles.topbarSep}></div>
        <div className={styles.topbarClinic}>{clinicName || 'Set up your clinic'}</div>
        <div className={styles.topbarRight}>
          <div className={styles.liveBadge}><div className={styles.liveDot}></div>Live</div>
          {doctorPlan !== 'pro' && (
            <Link href="/pricing" className={styles.upgradeLink}>Upgrade →</Link>
          )}
          <button
            className={styles.themeBtn}
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="8" cy="8" r="3.5"/>
                <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.1 3.1l1.05 1.05M11.85 11.85l1.05 1.05M12.9 3.1l-1.05 1.05M4.15 11.85l-1.05 1.05"/>
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M13.5 9.5A6 6 0 016.5 2.5 6.5 6.5 0 1013.5 9.5z"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarNav}>
          <div className={styles.sidebarSection}>
            {([
              ['/dashboard', <svg key="d" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1.5"/><rect x="9" y="2" width="5" height="5" rx="1.5"/><rect x="2" y="9" width="5" height="5" rx="1.5"/><rect x="9" y="9" width="5" height="5" rx="1.5"/></svg>, 'Dashboard', true],
              ['/dashboard/patients', <svg key="p" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1.5a4 4 0 100 8 4 4 0 000-8z"/><path d="M2 14.5c0-2.21 2.686-4 6-4s6 1.79 6 4"/></svg>, 'Patients', false],
              ['/dashboard/schedule', <svg key="s" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 5.5h11M5.5 2.5v2M10.5 2.5v2M3 2.5h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1v-9a1 1 0 011-1z"/></svg>, 'Schedule', false],
              ['/dashboard/analytics', <svg key="a" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 8A6 6 0 102 8M8 2v2M12.24 3.76l-1.42 1.42M14 8h-2"/></svg>, 'Analytics', false],
            ] as [string, React.ReactNode, string, boolean][]).map(([href, icon, label, exact]) => (
              <Link
                key={href}
                href={href}
                className={`${styles.navItem} ${isActive(href, exact) ? styles.active : ''}`}
              >
                {icon}{label}
              </Link>
            ))}
          </div>
          <div className={styles.sidebarLabel}>Settings</div>
          <div className={styles.sidebarSection}>
            {([
              ['/dashboard/settings', <svg key="st" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.54 11.54l1.41 1.41M3.05 12.95l1.42-1.42M11.54 4.46l1.41-1.41"/></svg>, 'QR & Settings'],
              ['/dashboard/profile', <svg key="pr" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 10.5a4 4 0 10-8 0M10 3.5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>, 'My Profile'],
            ] as [string, React.ReactNode, string][]).map(([href, icon, label]) => (
              <Link
                key={href}
                href={href}
                className={`${styles.navItem} ${isActive(href) ? styles.active : ''}`}
              >
                {icon}{label}
              </Link>
            ))}
          </div>
        </div>
        <div className={styles.sidebarSignOut}>
          <div className={`${styles.navItem} ${styles.navSignOut}`} onClick={handleLogout}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3"/>
              <polyline points="11 11 14 8 11 5"/>
              <line x1="14" y1="8" x2="6" y2="8"/>
            </svg>
            Sign out
          </div>
        </div>
      </div>

      {/* Main content area — each child route renders here */}
      <div className={styles.main}>
        {children}
      </div>
    </div>
  );
}
