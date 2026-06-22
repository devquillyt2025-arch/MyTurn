'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';
import { useTheme } from '../theme-provider';
import { createClient } from '@/lib/supabase/client';
import { ClinicProvider, useClinic } from './clinic-context';
import toast from 'react-hot-toast';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClinicProvider>
      <DashboardInner>{children}</DashboardInner>
    </ClinicProvider>
  );
}

function DashboardInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { clinics, selected, switchClinic, createClinic, userId } = useClinic();
  const [doctorPlan, setDoctorPlan] = useState('free');
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'receptionist'>('owner');

  // Clinic switcher dropdown
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  // New clinic modal
  const [newClinicOpen, setNewClinicOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDoctorName, setNewDoctorName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
      if (!user) return;
      supabase.from('doctors').select('plan').eq('id', user.id).single()
        .then(({ data }) => { if (data?.plan) setDoctorPlan(data.plan); });
    });
  }, []);

  // Determine access role: owner has full access; staff members may be restricted.
  useEffect(() => {
    if (!selected || !userId) { setUserRole('owner'); return; }
    const ownerId = (selected as Record<string, unknown>).user_id as string | undefined;
    if (ownerId === userId) { setUserRole('owner'); return; }
    const supabase = createClient();
    supabase
      .from('staff_members')
      .select('role, status')
      .eq('clinic_id', selected.id)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.status === 'active') {
          setUserRole(data.role as 'admin' | 'receptionist');
        } else {
          setUserRole('owner');
        }
      });
  }, [selected?.id, userId]);

  // Close switcher on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Close switcher on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setSwitcherOpen(false); setNewClinicOpen(false); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  async function handleCreateClinic() {
    if (!newName.trim() || !newDoctorName.trim()) {
      toast.error('Clinic name and doctor name are required.');
      return;
    }
    setCreating(true);
    const result = await createClinic(newName.trim(), newDoctorName.trim(), newPhone.trim());
    setCreating(false);
    if (!result) { toast.error('Could not create clinic. Please try again.'); return; }
    toast.success(`${newName.trim()} created and selected.`);
    setNewClinicOpen(false);
    setNewName(''); setNewDoctorName(''); setNewPhone('');
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  }

  const clinicName     = selected?.name || '';
  const isReceptionist = userRole === 'receptionist';

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

          {/* Clinic switcher */}
          <div ref={switcherRef} className={styles.clinicSwitcherWrap}>
            <button
              className={styles.clinicSwitcher}
              onClick={() => setSwitcherOpen(o => !o)}
              title="Switch clinic"
            >
              <span className={styles.clinicSwitcherDot} />
              <span className={styles.clinicSwitcherName}>{clinicName || 'Select clinic'}</span>
              <svg
                width="12" height="12" viewBox="0 0 12 12" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                style={{ marginLeft: 'auto', flexShrink: 0, transition: 'transform 0.15s', transform: switcherOpen ? 'rotate(180deg)' : 'none' }}
              >
                <path d="M2 4l4 4 4-4" />
              </svg>
            </button>

            {switcherOpen && (
              <div className={styles.clinicDropdown}>
                {clinics.map(c => (
                  <button
                    key={c.id}
                    className={`${styles.clinicOption} ${c.id === selected?.id ? styles.clinicOptionActive : ''}`}
                    onClick={() => { switchClinic(c.id); setSwitcherOpen(false); }}
                  >
                    <span className={styles.clinicOptionCheck}>
                      {c.id === selected?.id && (
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </span>
                    <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  </button>
                ))}
                <div className={styles.clinicDropdownDivider} />
                <button
                  className={styles.clinicOptionAdd}
                  onClick={() => { setSwitcherOpen(false); setNewClinicOpen(true); }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M6 2v8M2 6h8" />
                  </svg>
                  New clinic
                </button>
              </div>
            )}
          </div>

          <div className={styles.sidebarSection} style={{ marginTop: 8 }}>
            {([
              ['/dashboard',              <svg key="d"  viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1.5"/><rect x="9" y="2" width="5" height="5" rx="1.5"/><rect x="2" y="9" width="5" height="5" rx="1.5"/><rect x="9" y="9" width="5" height="5" rx="1.5"/></svg>, 'Dashboard',      true,  false],
              ['/dashboard/patients',     <svg key="p"  viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1.5a4 4 0 100 8 4 4 0 000-8z"/><path d="M2 14.5c0-2.21 2.686-4 6-4s6 1.79 6 4"/></svg>, 'Patients',        false, false],
              ['/dashboard/schedule',     <svg key="s"  viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 5.5h11M5.5 2.5v2M10.5 2.5v2M3 2.5h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1v-9a1 1 0 011-1z"/></svg>, 'Schedule',        false, false],
              ['/dashboard/analytics',    <svg key="a"  viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 8A6 6 0 102 8M8 2v2M12.24 3.76l-1.42 1.42M14 8h-2"/></svg>, 'Analytics',       false, true],
              ['/dashboard/billing',      <svg key="b"  viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 2h8a1 1 0 011 1v10l-1.5-1L10 13l-1.5-1L7 13l-1.5-1L4 13V3a1 1 0 011-1z"/><path d="M6.5 6h3M6.5 9h3"/></svg>, 'Billing',         false, true],
              ['/dashboard/notifications', <svg key="n" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1.5a5.5 5.5 0 00-5.5 5.5v2.5L1 11h14l-1.5-1.5V7A5.5 5.5 0 008 1.5z"/><path d="M6.5 13a1.5 1.5 0 003 0"/></svg>, 'Notifications',   false, true],
            ] as [string, React.ReactNode, string, boolean, boolean][])
              .filter(([,,,, ownerOnly]) => !ownerOnly || !isReceptionist)
              .map(([href, icon, label, exact]) => (
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
              ['/dashboard/settings', <svg key="st" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.54 11.54l1.41 1.41M3.05 12.95l1.42-1.42M11.54 4.46l1.41-1.41"/></svg>, 'QR & Settings', true],
              ['/dashboard/staff',    <svg key="sf" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5.5 2a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"/><path d="M1 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"/><path d="M11 5.5h4M13 3.5v4"/></svg>, 'Staff',          false],
              ['/dashboard/profile',  <svg key="pr" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 10.5a4 4 0 10-8 0M10 3.5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>, 'My Profile',     false],
            ] as [string, React.ReactNode, string, boolean][])
              .filter(([,, , ownerOnly]) => !ownerOnly || !isReceptionist)
              .map(([href, icon, label]) => (
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

      {/* Main content */}
      <div className={styles.main}>
        {children}
      </div>

      {/* New clinic modal */}
      {newClinicOpen && (
        <div
          className={`${styles.modalOverlay} ${styles.open}`}
          onClick={e => { if (e.target === e.currentTarget) setNewClinicOpen(false); }}
        >
          <div className={styles.modalBox} style={{ width: 400, textAlign: 'left' }}>
            <button className={styles.modalClose} onClick={() => setNewClinicOpen(false)}>✕</button>
            <div className={styles.modalTitle}>New Clinic</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
              <div className={styles.settingsRow} style={{ border: 'none', padding: 0 }}>
                <div><div className={styles.settingsRowLabel}>Clinic name <span style={{ color: 'var(--red)' }}>*</span></div></div>
                <input
                  className={styles.settingsInput}
                  placeholder="e.g. City Health Clinic"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  style={{ width: 200 }}
                  autoFocus
                />
              </div>
              <div className={styles.settingsRow} style={{ border: 'none', padding: 0 }}>
                <div><div className={styles.settingsRowLabel}>Doctor name <span style={{ color: 'var(--red)' }}>*</span></div></div>
                <input
                  className={styles.settingsInput}
                  placeholder="e.g. Dr. Sharma"
                  value={newDoctorName}
                  onChange={e => setNewDoctorName(e.target.value)}
                  style={{ width: 200 }}
                />
              </div>
              <div className={styles.settingsRow} style={{ border: 'none', padding: 0 }}>
                <div><div className={styles.settingsRowLabel}>Phone</div><div className={styles.settingsRowSub}>Optional</div></div>
                <input
                  className={styles.settingsInput}
                  type="tel"
                  inputMode="numeric"
                  placeholder="10-digit number"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  style={{ width: 200 }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <button
                className={styles.actionBtn}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => { setNewClinicOpen(false); setNewName(''); setNewDoctorName(''); setNewPhone(''); }}
              >Cancel</button>
              <button
                className={`${styles.actionBtn} ${styles.primary}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={handleCreateClinic}
                disabled={!newName.trim() || !newDoctorName.trim() || creating}
              >{creating ? 'Creating…' : 'Create clinic'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
