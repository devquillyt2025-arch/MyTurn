'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';
import { useTheme } from '../theme-provider';
import { BookingQRCode } from '../../components/BookingQRCode';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

type DashPage = 'dashboard' | 'patients' | 'schedule' | 'analytics' | 'settings' | 'profile';
type QStatus = 'done' | 'current' | 'waiting' | 'skipped';

interface QItem { token: number; name: string; age: number; time: string; status: QStatus; }

const INITIAL_QUEUE: QItem[] = [
  { token: 1,  name: 'Ramesh Babu',    age: 55, time: '9:00 AM',  status: 'done' },
  { token: 2,  name: 'Sunita Rao',     age: 28, time: '9:15 AM',  status: 'done' },
  { token: 3,  name: 'Kiran Mehta',    age: 41, time: '9:30 AM',  status: 'done' },
  { token: 4,  name: 'Priya Krishnan', age: 32, time: '9:45 AM',  status: 'current' },
  { token: 5,  name: 'Vikram Sharma',  age: 19, time: '10:00 AM', status: 'waiting' },
  { token: 6,  name: 'Ananya Pillai',  age: 60, time: '10:15 AM', status: 'waiting' },
  { token: 7,  name: 'Deepak Nair',    age: 45, time: '10:30 AM', status: 'waiting' },
  { token: 8,  name: 'Meghna Joshi',   age: 34, time: '10:45 AM', status: 'waiting' },
  { token: 9,  name: 'Suresh Kumar',   age: 72, time: '11:00 AM', status: 'waiting' },
  { token: 10, name: 'Lavanya S.',     age: 25, time: '11:15 AM', status: 'waiting' },
  { token: 11, name: 'Ravi Teja',      age: 38, time: '11:30 AM', status: 'waiting' },
  { token: 12, name: 'Nalini Iyer',    age: 50, time: '12:00 PM', status: 'waiting' },
];

const SLOT_DATA = [
  { label: '9–10 AM',  booked: 4, total: 4 },
  { label: '10–11 AM', booked: 4, total: 4 },
  { label: '11–12 PM', booked: 2, total: 4 },
  { label: '12–1 PM',  booked: 1, total: 3 },
  { label: '4–5 PM',   booked: 1, total: 4 },
];

const SCHEDULE_SLOTS = [
  { time: '9:00 AM',  events: [{ name: 'Ramesh Babu', status: 'done' }, { name: 'Sunita Rao', status: 'done' }] },
  { time: '9:30 AM',  events: [{ name: 'Kiran Mehta', status: 'done' }] },
  { time: '9:45 AM',  events: [{ name: 'Priya Krishnan', status: 'current' }] },
  { time: '10:00 AM', events: [{ name: 'Vikram Sharma', status: 'upcoming' }] },
  { time: '10:15 AM', events: [{ name: 'Ananya Pillai', status: 'upcoming' }] },
  { time: '10:30 AM', events: [{ name: 'Deepak Nair', status: 'upcoming' }] },
  { time: '10:45 AM', events: [{ name: 'Meghna Joshi', status: 'upcoming' }] },
  { time: '11:00 AM', events: [{ name: 'Suresh Kumar', status: 'upcoming' }] },
  { time: '11:15 AM', events: [{ name: 'Lavanya S.', status: 'upcoming' }] },
  { time: '11:30 AM', events: [{ name: 'Ravi Teja', status: 'upcoming' }] },
  { time: '12:00 PM', events: [{ name: 'Nalini Iyer', status: 'upcoming' }] },
  { time: '1:00 PM',  events: [] },
  { time: '2:00 PM',  events: [{ name: '—', status: 'empty' }] },
];

const WEEK_DATA = [
  { day: 'Mon', count: 9 }, { day: 'Tue', count: 12 }, { day: 'Wed', count: 8 },
  { day: 'Thu', count: 14 }, { day: 'Fri', count: 11 }, { day: 'Sat', count: 7 }, { day: 'Sun', count: 13 },
];

const PEAK_DATA = [
  { label: '8–9 AM', count: 2 }, { label: '9–10 AM', count: 14 }, { label: '10–11 AM', count: 18 },
  { label: '11–12 PM', count: 12 }, { label: '12–1 PM', count: 6 },
  { label: '2–3 PM', count: 9 }, { label: '3–4 PM', count: 11 }, { label: '4–5 PM', count: 7 },
];

function tok(n: number) { return String(n).padStart(2, '0'); }

function hlHtml(text: string, q: string) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return text.slice(0, idx) + `<mark class="hl">${text.slice(idx, idx + q.length)}</mark>` + text.slice(idx + q.length);
}

export default function DashboardPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [activePage, setActivePage] = useState<DashPage>('dashboard');
  const [queue, setQueue] = useState<QItem[]>(INITIAL_QUEUE);
  const [qrOpen, setQrOpen] = useState(false);
  const [clock, setClock] = useState('');
  const [clinicName, setClinicName] = useState('Nair Healthcare Clinic');
  const [doctorInitials, setDoctorInitials] = useState('MN');
  const [doctorName, setDoctorName] = useState('Dr. Meera Nair');
  const [doctorRole, setDoctorRole] = useState('MBBS, MD · General Physician');
  const [slug, setSlug] = useState('dr-meera-nair');
  const [patientFilter, setPatientFilter] = useState('');
  const [isFlipping, setIsFlipping] = useState(false);
  const [notifications, setNotifications] = useState({ smsBooking: true, smsReminder: true, noShow: false, dailySummary: true });
  const [slotsOpen, setSlotsOpen] = useState(false);
  const [slotConfig, setSlotConfig] = useState(SLOT_DATA.map(s => ({ ...s, blocked: false })));
  const [newSlotTime, setNewSlotTime] = useState('');
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newTime, setNewTime] = useState('');
  const [skipTarget, setSkipTarget] = useState<QItem | null>(null);
  const [clinicId, setClinicId] = useState('');
  const [doctorPlan, setDoctorPlan] = useState('free');
  const [todayBookingCount, setTodayBookingCount] = useState(0);

  useEffect(() => {
    document.title = 'MyTurnApp';
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      supabase
        .from('clinics')
        .select('*')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          setClinicId(data.id);
          if (data.name) setClinicName(data.name);
          if (data.slug) setSlug(data.slug);
          if (data.doctor_name) {
            const ini = data.doctor_name.replace(/^dr\.?\s*/i, '').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
            setDoctorInitials(ini);
            setDoctorName(data.doctor_name);
          }
          if (data.spec || data.qual) {
            setDoctorRole([data.qual, data.spec].filter(Boolean).join(' · '));
          }

          supabase
            .from('doctors')
            .select('plan')
            .eq('id', user.id)
            .single()
            .then(({ data: doctor }) => {
              const plan = doctor?.plan ?? 'free';
              setDoctorPlan(plan);
              if (plan === 'free') {
                const today = new Date().toISOString().split('T')[0];
                supabase
                  .from('usage_logs')
                  .select('booking_count')
                  .eq('clinic_id', data.id)
                  .eq('date', today)
                  .single()
                  .then(({ data: log }) => {
                    setTodayBookingCount(log?.booking_count ?? 0);
                  });
              }
            });

          supabase
            .from('bookings')
            .select('token_number, patient_name, status')
            .eq('clinic_id', data.id)
            .then(({ data: bookings }) => {
              if (!bookings || bookings.length === 0) return;
              setQueue(prev => {
                const existing = new Set(prev.map(p => p.token));
                const incoming = bookings
                  .filter(b => !existing.has(b.token_number))
                  .map(b => ({
                    token: b.token_number,
                    name: b.patient_name || 'Unknown Patient',
                    age: 0,
                    time: '—',
                    status: 'waiting' as QStatus,
                  }));
                return [...prev, ...incoming];
              });
            });
        });
    });
  }, []);

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const h = now.getHours(), m = now.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hh = h % 12 || 12;
      const mm = String(m).padStart(2, '0');
      setClock(`${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} · ${hh}:${mm} ${ampm}`);
    }
    updateClock();
    const iv = setInterval(updateClock, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { setQrOpen(false); setSlotsOpen(false); setAddPatientOpen(false); setSkipTarget(null); } }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgraded') === '1') {
      toast.success('Plan upgraded successfully!');
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  const current = queue.find(p => p.status === 'current');
  const waiting = queue.filter(p => p.status === 'waiting');
  const done = queue.filter(p => p.status === 'done');

  function callNext() {
    setIsFlipping(true);
    setTimeout(() => {
      setQueue(prev => {
        const next = [...prev];
        const ci = next.findIndex(p => p.status === 'current');
        const ni = next.findIndex(p => p.status === 'waiting');
        if (ci !== -1) next[ci] = { ...next[ci], status: 'done' };
        if (ni !== -1) next[ni] = { ...next[ni], status: 'current' };
        return next;
      });
      setIsFlipping(false);
    }, 160);
  }

  function markDone() {
    setQueue(prev => {
      const next = [...prev];
      const ci = next.findIndex(p => p.status === 'current');
      if (ci !== -1) next[ci] = { ...next[ci], status: 'done' };
      return next;
    });
  }

  function skipCurrent() {
    if (!current) return;
    setSkipTarget(current);
  }

  function confirmSkip() {
    if (!skipTarget) return;
    setQueue(prev => {
      const next = [...prev];
      const ci = next.findIndex(p => p.status === 'current');
      if (ci !== -1) next[ci] = { ...next[ci], status: 'skipped' };
      const ni = next.findIndex(p => p.status === 'waiting');
      if (ni !== -1) next[ni] = { ...next[ni], status: 'current' };
      return next;
    });
    toast(`Skipped ${skipTarget.name}`);
    setSkipTarget(null);
  }

  const weekMax = Math.max(...WEEK_DATA.map(d => d.count));
  const peakMax = Math.max(...PEAK_DATA.map(d => d.count));

  function SlotBars({ data }: { data: typeof SLOT_DATA }) {
    return (
      <>
        {data.map(s => (
          <div key={s.label} className={styles.slotBarRow}>
            <span className={styles.slotTimeLabel}>{s.label}</span>
            <div className={styles.slotBarTrack}>
              <div className={styles.slotBarFill} style={{ width: `${Math.round((s.booked / s.total) * 100)}%` }}></div>
            </div>
            <span className={styles.slotBarCount}>{s.booked}</span>
          </div>
        ))}
      </>
    );
  }

  async function addPatient() {
    if (!newName.trim()) return;
    const nextToken = Math.max(...queue.map(p => p.token), 0) + 1;
    const timeStr = newTime.trim() || '—';
    const entry: QItem = { token: nextToken, name: newName.trim(), age: parseInt(newAge) || 0, time: timeStr, status: 'waiting' };
    setQueue(prev => [...prev, entry]);
    if (clinicId) {
      const supabase = createClient();
      await supabase.from('bookings').insert({
        clinic_id: clinicId,
        patient_name: entry.name,
        patient_phone: '',
        token_number: nextToken,
        status: 'waiting',
      });
    }
    setNewName(''); setNewAge(''); setNewTime('');
    setAddPatientOpen(false);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  const filteredPatients = queue.filter(p =>
    p.name.toLowerCase().includes(patientFilter.toLowerCase()) ||
    String(p.token).includes(patientFilter)
  );

  return (
    <div className={styles.page}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <div className={styles.logo}>MyTurnApp <span>/</span></div>
        <div className={styles.topbarSep}></div>
        <div className={styles.topbarClinic}>{clinicName}</div>
        <div className={styles.topbarRight}>
          <div className={styles.liveBadge}><div className={styles.liveDot}></div>Live</div>
          {doctorPlan !== 'pro' && (
            <Link href="/pricing" className={styles.upgradeLink}>
              Upgrade →
            </Link>
          )}
          <button className={styles.themeBtn} onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
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
            ['dashboard', <svg key="d" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1.5"/><rect x="9" y="2" width="5" height="5" rx="1.5"/><rect x="2" y="9" width="5" height="5" rx="1.5"/><rect x="9" y="9" width="5" height="5" rx="1.5"/></svg>, 'Dashboard', true],
            ['patients',  <svg key="p" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1.5a4 4 0 100 8 4 4 0 000-8z"/><path d="M2 14.5c0-2.21 2.686-4 6-4s6 1.79 6 4"/></svg>, 'Patients', false],
            ['schedule',  <svg key="s" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 5.5h11M5.5 2.5v2M10.5 2.5v2M3 2.5h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1v-9a1 1 0 011-1z"/></svg>, 'Schedule', false],
            ['analytics', <svg key="a" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 8A6 6 0 102 8M8 2v2M12.24 3.76l-1.42 1.42M14 8h-2"/></svg>, 'Analytics', false],
          ] as [DashPage, React.ReactNode, string, boolean][]).map(([page, icon, label, showBadge]) => (
            <div
              key={page}
              className={`${styles.navItem} ${activePage === page ? styles.active : ''}`}
              onClick={() => setActivePage(page)}
            >
              {icon}{label}
              {showBadge && <span className={styles.navBadge}>{waiting.length}</span>}
            </div>
          ))}
        </div>
        <div className={styles.sidebarLabel}>Settings</div>
        <div className={styles.sidebarSection}>
          {([
            ['settings', <svg key="st" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.54 11.54l1.41 1.41M3.05 12.95l1.42-1.42M11.54 4.46l1.41-1.41"/></svg>, 'QR & Settings'],
            ['profile',  <svg key="pr" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 10.5a4 4 0 10-8 0M10 3.5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>, 'My Profile'],
          ] as [DashPage, React.ReactNode, string][]).map(([page, icon, label]) => (
            <div
              key={page}
              className={`${styles.navItem} ${activePage === page ? styles.active : ''}`}
              onClick={() => setActivePage(page)}
            >{icon}{label}</div>
          ))}
        </div>
        </div>{/* /sidebarNav */}
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

      {/* Main */}
      <div className={styles.main}>

        {/* ── Dashboard panel ── */}
        <div className={`${styles.pagePanel} ${activePage === 'dashboard' ? styles.active : ''}`}>
          <div className={styles.pageHeader}>
            <div>
              <div className={styles.pageTitle}>Today&apos;s Queue</div>
              <div className={styles.pageSub}>{clock}</div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button className={styles.actionBtn} onClick={() => toast('Queue paused — new bookings will see "Queue paused" message.')}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="2.5" width="3.5" height="11" rx="1"/><rect x="9.5" y="2.5" width="3.5" height="11" rx="1"/></svg>
                Pause queue
              </button>
              <button className={`${styles.actionBtn} ${styles.primary}`} onClick={() => setQrOpen(true)}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="11" y="11" width="3" height="3" rx="0.5"/><path d="M9 11h1.5M9 13.5h1"/></svg>
                View QR code
              </button>
            </div>
          </div>

          {doctorPlan === 'free' && (
            <div className={styles.usageBanner}>
              <div className={styles.usageBannerLeft}>
                <div className={styles.usageText}>
                  <span className={styles.usageCount}>{todayBookingCount} / 20</span> bookings used today
                </div>
                <div className={styles.usageBar}>
                  <div
                    className={styles.usageBarFill}
                    style={{ width: `${Math.min((todayBookingCount / 20) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <a href="#" className={styles.upgradeCta}>Upgrade to Basic for unlimited bookings →</a>
            </div>
          )}

          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Waiting</div>
              <div className={`${styles.statVal} ${styles.amber}`}>{waiting.length}</div>
              <div className={styles.statChange}>In queue now</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Seen today</div>
              <div className={`${styles.statVal} ${styles.green}`}>{done.length}</div>
              <div className={styles.statChange}>↑ On track</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total booked</div>
              <div className={`${styles.statVal} ${styles.teal}`}>{queue.length}</div>
              <div className={styles.statChange}>+4 vs yesterday</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Avg wait time</div>
              <div className={styles.statVal} style={{fontSize:28}}>18m</div>
              <div className={styles.statChange} style={{color:'var(--teal)'}}>−3m vs usual</div>
            </div>
          </div>

          <div className={styles.grid2col}>
            <div>
              <div className={styles.currentTokenCard}>
                <div className={styles.currentLabel}>Now seeing</div>
                <div className={styles.currentNum}>
                  <span className={`${styles.tokenFlip} ${isFlipping ? styles.flipping : ''}`}>
                    {current ? `#${tok(current.token)}` : '—'}
                  </span>
                </div>
                <div className={styles.currentName}>{current?.name ?? 'Queue complete'}</div>
                <div className={styles.currentTime}>{current ? `${current.age} yrs · Booked ${current.time}` : 'All patients seen for today'}</div>
                <div className={styles.currentActions}>
                  <button className={styles.tokenAction} onClick={skipCurrent}>Skip</button>
                  <button className={styles.tokenAction} onClick={markDone}>Mark done</button>
                  <button className={`${styles.tokenAction} ${styles.nextBtn}`} onClick={callNext}>Call next →</button>
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 4h11M2.5 8h7M2.5 12h5"/></svg>
                  <span className={styles.cardTitle}>Queue</span>
                  <span className={styles.cardSub}>{queue.length} total · {waiting.length} waiting</span>
                </div>
                <div>
                  {queue.map(p => (
                    <div key={p.token} className={`${styles.queueItem} ${styles[p.status]}`}>
                      <div className={styles.queueToken}>{tok(p.token)}</div>
                      <div className={styles.qInfo}>
                        <div className={styles.qName}>{p.name}</div>
                        <div className={styles.qMeta}>{p.age} yrs · {p.time}</div>
                      </div>
                      <span className={`${styles.qStatus} ${styles[p.status]}`}>
                        {{ done: 'Done', current: 'In', waiting: 'Waiting', skipped: 'Skipped' }[p.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className={styles.card} style={{marginBottom:16}}>
                <div className={styles.cardHeader}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1.5" y="8.5" width="3" height="6" rx="1"/><rect x="6.5" y="5.5" width="3" height="9" rx="1"/><rect x="11.5" y="2.5" width="3" height="12" rx="1"/></svg>
                  <span className={styles.cardTitle}>Slot fill</span>
                  <span className={styles.cardSub}>Today</span>
                </div>
                <SlotBars data={slotConfig.filter(s => !s.blocked)} />
              </div>

              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/></svg>
                  <span className={styles.cardTitle}>Booking QR</span>
                </div>
                <div style={{padding:20}}>
                  <BookingQRCode slug={slug} clinicName={clinicName} size={140} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Patients panel ── */}
        <div className={`${styles.pagePanel} ${activePage === 'patients' ? styles.active : ''}`}>
          <div className={styles.pageHeader}>
            <div>
              <div className={styles.pageTitle}>Patients</div>
              <div className={styles.pageSub}>All registered patients · {queue.length} total today</div>
            </div>
            <button className={`${styles.actionBtn} ${styles.primary}`} onClick={() => setAddPatientOpen(true)}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15"><path d="M8 2v12M2 8h12"/></svg>
              Add patient
            </button>
          </div>
          <div className={styles.searchBar}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/></svg>
            <input type="text" placeholder="Search by name, token or phone…" value={patientFilter} onChange={e => setPatientFilter(e.target.value)} />
          </div>
          <div className={styles.card}>
            <div className={`${styles.patientRow} ${styles.header}`}>
              <div></div><div>Name</div><div>Age</div><div>Time</div><div>Status</div>
            </div>
            {filteredPatients.map(p => {
              const initials = p.name.split(' ').map(w => w[0]).slice(0,2).join('');
              const statusColor = { done: 'var(--green)', current: 'var(--teal)', waiting: 'var(--amber)', skipped: 'var(--red)' }[p.status];
              const statusLabel = { done: 'Done', current: 'In session', waiting: 'Waiting', skipped: 'Skipped' }[p.status];
              const tokenStr = `Token #${tok(p.token)}`;
              return (
                <div key={p.token} className={styles.patientRow}>
                  <div className={styles.patientAvatar}>{initials}</div>
                  <div>
                    <div style={{fontWeight:500}} dangerouslySetInnerHTML={{__html: hlHtml(p.name, patientFilter)}} />
                    <div style={{fontSize:12,color:'var(--muted)'}} dangerouslySetInnerHTML={{__html: hlHtml(tokenStr, patientFilter)}} />
                  </div>
                  <div style={{color:'var(--muted)'}}>{p.age} yrs</div>
                  <div style={{color:'var(--muted)'}}>{p.time}</div>
                  <div style={{color:statusColor,fontSize:12,fontWeight:500}}>{statusLabel}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Schedule panel ── */}
        <div className={`${styles.pagePanel} ${activePage === 'schedule' ? styles.active : ''}`}>
          <div className={styles.pageHeader}>
            <div>
              <div className={styles.pageTitle}>Schedule</div>
              <div className={styles.pageSub}>Today · Slot capacity: 15</div>
            </div>
            <button className={styles.actionBtn} onClick={() => setSlotsOpen(true)}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15"><path d="M2.5 5.5h11M5.5 2.5v2M10.5 2.5v2M3 2.5h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1v-9a1 1 0 011-1z"/></svg>
              Manage slots
            </button>
          </div>
          <div className={styles.scheduleGrid}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 5.5h11M5.5 2.5v2M10.5 2.5v2M3 2.5h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1v-9a1 1 0 011-1z"/></svg>
                <span className={styles.cardTitle}>Today&apos;s timetable</span>
                <span className={styles.cardSub}>12 booked / 15 capacity</span>
              </div>
              {SCHEDULE_SLOTS.map(slot => (
                <div key={slot.time} className={styles.timeSlotRow}>
                  <div className={styles.timeCol}>{slot.time}</div>
                  <div className={styles.slotEvents}>
                    {slot.events.length === 0
                      ? <div className={`${styles.slotEvent} ${styles.empty}`}>No appointments</div>
                      : slot.events.map((e, i) => (
                        <div key={i} className={`${styles.slotEvent} ${styles[e.status as keyof typeof styles]}`}>
                          {e.name}{e.status === 'done' ? ' ✓' : e.status === 'current' ? ' · In session' : ''}
                        </div>
                      ))
                    }
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className={styles.card} style={{marginBottom:16}}>
                <div className={styles.cardHeader}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg>
                  <span className={styles.cardTitle}>Break time</span>
                </div>
                <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:10}}>
                  <div style={{display:'flex',gap:16,fontSize:13}}><span style={{color:'var(--muted)',width:80}}>Lunch</span><span>1:00 PM – 2:00 PM</span></div>
                  <div style={{display:'flex',gap:16,fontSize:13}}><span style={{color:'var(--muted)',width:80}}>Evening</span><span>5:00 PM – 6:00 PM</span></div>
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1.5" y="8.5" width="3" height="6" rx="1"/><rect x="6.5" y="5.5" width="3" height="9" rx="1"/><rect x="11.5" y="2.5" width="3" height="12" rx="1"/></svg>
                  <span className={styles.cardTitle}>Slot fill</span>
                  <span className={styles.cardSub}>Today</span>
                </div>
                <SlotBars data={slotConfig.filter(s => !s.blocked)} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Analytics panel ── */}
        <div className={`${styles.pagePanel} ${activePage === 'analytics' ? styles.active : ''}`}>
          <div className={styles.pageHeader}>
            <div>
              <div className={styles.pageTitle}>Analytics</div>
              <div className={styles.pageSub}>Last 7 days · {clinicName}</div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button className={styles.actionBtn}>This week</button>
              <button className={styles.actionBtn}>Export CSV</button>
            </div>
          </div>
          <div className={styles.analyticsGrid}>
            {[
              { label: 'Total patients (7d)', val: '74', cls: styles.teal, change: '↑ 12% vs last week' },
              { label: 'Avg patients/day', val: '10.6', cls: styles.green, change: '↑ On track' },
              { label: 'Avg wait time', val: '18m', cls: '', change: '−3m vs usual', changeColor: 'var(--teal)' },
              { label: 'No-shows', val: '4', cls: styles.red, change: '5.4% rate', changeColor: 'var(--red)' },
            ].map(s => (
              <div key={s.label} className={styles.statCard}>
                <div className={styles.statLabel}>{s.label}</div>
                <div className={`${styles.statVal} ${s.cls}`} style={s.cls ? {} : {fontSize:28}}>{s.val}</div>
                <div className={styles.statChange} style={s.changeColor ? {color:s.changeColor} : {}}>{s.change}</div>
              </div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:20,marginBottom:20,alignItems:'start'}}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1.5" y="8.5" width="3" height="6" rx="1"/><rect x="6.5" y="5.5" width="3" height="9" rx="1"/><rect x="11.5" y="2.5" width="3" height="12" rx="1"/></svg>
                <span className={styles.cardTitle}>Patients per day</span>
                <span className={styles.cardSub}>Mon – Sun</span>
              </div>
              <div style={{padding:'20px 20px 16px'}}>
                <div className={styles.weekChartRow}>
                  {WEEK_DATA.map(d => {
                    const h = Math.round((d.count / weekMax) * 100);
                    return (
                      <div key={d.day} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                        <div style={{fontSize:11,color:'var(--text)',fontWeight:500}}>{d.count}</div>
                        <div style={{width:'100%',height:`${h}px`,background:'var(--teal)',opacity:0.75,borderRadius:'4px 4px 0 0',minHeight:4}}></div>
                        <div style={{fontSize:11,color:'var(--muted)'}}>{d.day}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v5.5l3.5 3.5"/></svg>
                <span className={styles.cardTitle}>Visit breakdown</span>
              </div>
              <div className={styles.donutWrap}>
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="var(--surface2)" strokeWidth="18"/>
                  <circle cx="50" cy="50" r="38" fill="none" stroke="var(--teal)" strokeWidth="18" strokeDasharray="143 95" strokeDashoffset="-24" strokeLinecap="round"/>
                  <circle cx="50" cy="50" r="38" fill="none" stroke="var(--amber)" strokeWidth="18" strokeDasharray="57 181" strokeDashoffset="-167" strokeLinecap="round"/>
                  <circle cx="50" cy="50" r="38" fill="none" stroke="var(--purple)" strokeWidth="18" strokeDasharray="38 200" strokeDashoffset="-224" strokeLinecap="round"/>
                </svg>
                <div className={styles.donutLegend}>
                  <div className={styles.legendItem}><div className={styles.legendDot} style={{background:'var(--teal)'}}></div>Follow-up — 60%</div>
                  <div className={styles.legendItem}><div className={styles.legendDot} style={{background:'var(--amber)'}}></div>New visit — 24%</div>
                  <div className={styles.legendItem}><div className={styles.legendDot} style={{background:'var(--purple)'}}></div>Consultation — 16%</div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12l3.5-4 3 3L12 5l2 2"/></svg>
              <span className={styles.cardTitle}>Peak hour distribution</span>
              <span className={styles.cardSub}>Avg across 7 days</span>
            </div>
            <div style={{padding:'8px 0'}}>
              {PEAK_DATA.map(d => (
                <div key={d.label} className={styles.slotBarRow}>
                  <span className={styles.slotTimeLabel} style={{width:80}}>{d.label}</span>
                  <div className={styles.slotBarTrack}>
                    <div className={styles.slotBarFill} style={{width:`${Math.round((d.count/peakMax)*100)}%`,background:'var(--purple)'}}></div>
                  </div>
                  <span className={styles.slotBarCount}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Settings panel ── */}
        <div className={`${styles.pagePanel} ${activePage === 'settings' ? styles.active : ''}`}>
          <div className={styles.pageHeader}>
            <div>
              <div className={styles.pageTitle}>QR &amp; Settings</div>
              <div className={styles.pageSub}>Clinic configuration and notifications</div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button className={styles.actionBtn} onClick={() => window.open(`/book/${slug}`, '_blank')}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15"><path d="M6 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1v-3M9 2h5v5M14 2l-7 7"/></svg>
                Preview booking page ↗
              </button>
              <button className={`${styles.actionBtn} ${styles.primary}`} onClick={() => toast.success('Settings saved')}>Save changes</button>
            </div>
          </div>
          <div className={styles.settingsGrid}>
            <div style={{display:'flex',flexDirection:'column',gap:20}}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/></svg>
                  <span className={styles.cardTitle}>Booking QR</span>
                </div>
                <div style={{padding:24}}>
                  <BookingQRCode slug={slug} clinicName={clinicName} size={160} />
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 5.5h11M5.5 2.5v2M10.5 2.5v2M3 2.5h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1v-9a1 1 0 011-1z"/></svg>
                  <span className={styles.cardTitle}>Slot settings</span>
                </div>
                {[['Slot duration','Time per patient','15 min'],['Max patients/day',null,'20'],['Start time',null,'09:00'],['End time',null,'17:00']].map(([label,sub,val],i) => (
                  <div key={i} className={styles.settingsRow}>
                    <div><div className={styles.settingsRowLabel}>{label}</div>{sub && <div className={styles.settingsRowSub}>{sub}</div>}</div>
                    <input className={styles.settingsInput} defaultValue={val!} type={label?.includes('time') ? 'time' : 'text'} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:20}}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 6c0 4-5 7-5 7S3 10 3 6a5 5 0 1110 0z"/><circle cx="8" cy="6" r="1.5"/></svg>
                  <span className={styles.cardTitle}>Clinic details</span>
                </div>
                {[['Clinic name', clinicName],['Address','12 MG Road, Kochi'],['Phone','+91 98400 12345']].map(([label,val]) => (
                  <div key={label} className={styles.settingsRow}>
                    <div><div className={styles.settingsRowLabel}>{label}</div></div>
                    <input className={styles.settingsInput} defaultValue={val} style={{width:180}} />
                  </div>
                ))}
              </div>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 2H3a1 1 0 00-1 1v9a1 1 0 001 1h2l3 2 3-2h2a1 1 0 001-1V3a1 1 0 00-1-1z"/></svg>
                  <span className={styles.cardTitle}>Notifications</span>
                </div>
                {([
                  ['SMS on booking','Send confirmation to patient','smsBooking'],
                  ['SMS reminders','1 hr before appointment','smsReminder'],
                  ['No-show alerts','Notify when patient skips','noShow'],
                  ['Daily summary email','End-of-day report','dailySummary'],
                ] as [string,string,keyof typeof notifications][]).map(([label,sub,key]) => (
                  <div key={key} className={styles.settingsRow}>
                    <div><div className={styles.settingsRowLabel}>{label}</div><div className={styles.settingsRowSub}>{sub}</div></div>
                    <div
                      className={`${styles.toggle} ${notifications[key] ? styles.on : ''}`}
                      onClick={() => setNotifications(prev => ({...prev, [key]: !prev[key]}))}
                    ></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Profile panel ── */}
        <div className={`${styles.pagePanel} ${activePage === 'profile' ? styles.active : ''}`}>
          <div className={styles.pageHeader}>
            <div>
              <div className={styles.pageTitle}>My Profile</div>
              <div className={styles.pageSub}>Doctor and clinic information</div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button className={styles.actionBtn} style={{color:'var(--red)'}} onClick={() => router.push('/onboarding?step=3')}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15"><path d="M10 8H3M6 5l-3 3 3 3M10 3h2a1 1 0 011 1v8a1 1 0 01-1 1h-2"/></svg>
                Back to setup
              </button>
              <button className={`${styles.actionBtn} ${styles.primary}`} onClick={() => toast.success('Profile saved')}>Save changes</button>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,alignItems:'start'}}>
            <div className={styles.card}>
              <div className={styles.profileHero}>
                <div className={styles.profileAvatarLg}>{doctorInitials}</div>
                <div>
                  <div className={styles.profileName}>{doctorName}</div>
                  <div className={styles.profileRole}>{doctorRole}</div>
                  <div className={styles.profileBadges}>
                    <span className={styles.profileBadge}>Verified</span>
                    <span className={styles.profileBadge}>MCI Reg.</span>
                  </div>
                </div>
              </div>
              <div>
                {[['Full name',doctorName],['Qualification','MBBS, MD (General Medicine)'],['Reg. number','KMC/2012/04821'],['Specialisation','General Physician'],['Experience','13 years'],['Languages','English, Malayalam, Hindi']].map(([label,val]) => (
                  <div key={label} className={styles.formRow}>
                    <span className={styles.formRowLabel}>{label}</span>
                    <input className={styles.formRowInput} defaultValue={val} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:20}}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 4h11M2.5 8h7M2.5 12h5"/></svg>
                  <span className={styles.cardTitle}>Contact</span>
                </div>
                {[['Email','meera.nair@nairhealthcare.in'],['Phone','+91 98400 12345'],['WhatsApp','+91 98400 12345']].map(([label,val]) => (
                  <div key={label} className={styles.formRow}>
                    <span className={styles.formRowLabel}>{label}</span>
                    <input className={styles.formRowInput} defaultValue={val} />
                  </div>
                ))}
              </div>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg>
                  <span className={styles.cardTitle}>Working hours</span>
                </div>
                {[['Monday–Friday','9:00 AM – 5:00 PM'],['Saturday','9:00 AM – 1:00 PM'],['Sunday','Closed']].map(([label,val]) => (
                  <div key={label} className={styles.formRow}>
                    <span className={styles.formRowLabel}>{label}</span>
                    <span className={styles.formRowVal} style={val === 'Closed' ? {color:'var(--red)'} : {}}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Manage Slots Modal */}
      <div className={`${styles.modalOverlay} ${slotsOpen ? styles.open : ''}`} onClick={e => { if (e.target === e.currentTarget) setSlotsOpen(false); }}>
        <div className={styles.modalBox} style={{width: 480, textAlign: 'left', maxHeight: '80vh', overflowY: 'auto'}}>
          <button className={styles.modalClose} onClick={() => setSlotsOpen(false)}>✕</button>
          <div className={styles.modalTitle}>Manage Slots</div>
          <div style={{fontSize: 12, color: 'var(--muted)', marginBottom: 20}}>Adjust capacity and block time slots for today.</div>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 80px 70px 56px', gap: 8, fontSize: 11, color: 'var(--muted)', padding: '0 4px', marginBottom: 6}}>
            <span>Time</span><span style={{textAlign:'center'}}>Capacity</span><span style={{textAlign:'center'}}>Booked</span><span style={{textAlign:'center'}}>Block</span>
          </div>
          {slotConfig.map((slot, i) => (
            <div key={i} style={{display: 'grid', gridTemplateColumns: '1fr 80px 70px 56px', gap: 8, alignItems: 'center', padding: '10px 4px', borderTop: '1px solid var(--border2)', opacity: slot.blocked ? 0.45 : 1, transition: 'opacity 0.15s'}}>
              <span style={{fontSize: 13}}>{slot.label}</span>
              <input
                type="number"
                min={slot.booked}
                max={99}
                value={slot.total}
                disabled={slot.blocked}
                onChange={e => setSlotConfig(prev => prev.map((s, j) => j === i ? { ...s, total: Math.max(s.booked, Number(e.target.value) || s.booked) } : s))}
                className={styles.settingsInput}
                style={{width: '100%', textAlign: 'center', padding: '6px 8px'}}
              />
              <span style={{fontSize: 13, textAlign: 'center', color: 'var(--muted)'}}>{slot.booked}</span>
              <div style={{display: 'flex', justifyContent: 'center'}}>
                <div
                  className={`${styles.toggle} ${slot.blocked ? styles.on : ''}`}
                  style={slot.blocked ? {background: 'var(--red, #e5534b)'} : {}}
                  onClick={() => setSlotConfig(prev => prev.map((s, j) => j === i ? { ...s, blocked: !s.blocked } : s))}
                />
              </div>
            </div>
          ))}
          <div style={{display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border2)', alignItems: 'center'}}>
            <input
              type="text"
              placeholder="Add slot, e.g. 3–4 PM"
              value={newSlotTime}
              onChange={e => setNewSlotTime(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newSlotTime.trim()) {
                  setSlotConfig(prev => [...prev, { label: newSlotTime.trim(), booked: 0, total: 4, blocked: false }]);
                  setNewSlotTime('');
                }
              }}
              className={styles.settingsInput}
              style={{flex: 1}}
            />
            <button
              className={styles.actionBtn}
              onClick={() => {
                if (!newSlotTime.trim()) return;
                setSlotConfig(prev => [...prev, { label: newSlotTime.trim(), booked: 0, total: 4, blocked: false }]);
                setNewSlotTime('');
              }}
            >+ Add</button>
          </div>
          <div style={{display: 'flex', gap: 8, marginTop: 20}}>
            <button className={styles.actionBtn} style={{flex: 1, justifyContent: 'center'}} onClick={() => setSlotsOpen(false)}>Cancel</button>
            <button className={`${styles.actionBtn} ${styles.primary}`} style={{flex: 1, justifyContent: 'center'}} onClick={() => setSlotsOpen(false)}>Save changes</button>
          </div>
        </div>
      </div>

      {/* Add Patient Modal */}
      <div className={`${styles.modalOverlay} ${addPatientOpen ? styles.open : ''}`} onClick={e => { if (e.target === e.currentTarget) setAddPatientOpen(false); }}>
        <div className={styles.modalBox} style={{width: 420, textAlign: 'left'}}>
          <button className={styles.modalClose} onClick={() => setAddPatientOpen(false)}>✕</button>
          <div className={styles.modalTitle}>Add Patient</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            <div className={styles.settingsRow} style={{border: 'none', padding: 0}}>
              <div><div className={styles.settingsRowLabel}>Full name <span style={{color:'var(--red)'}}>*</span></div></div>
              <input className={styles.settingsInput} placeholder="e.g. Arjun Sharma" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPatient()} style={{width: 200}} autoFocus />
            </div>
            <div className={styles.settingsRow} style={{border: 'none', padding: 0}}>
              <div><div className={styles.settingsRowLabel}>Age</div></div>
              <input className={styles.settingsInput} type="number" placeholder="e.g. 35" min={1} max={110} value={newAge} onChange={e => setNewAge(e.target.value)} style={{width: 100, textAlign: 'center'}} />
            </div>
            <div className={styles.settingsRow} style={{border: 'none', padding: 0}}>
              <div><div className={styles.settingsRowLabel}>Time slot</div><div className={styles.settingsRowSub}>Walk-in time or booked slot</div></div>
              <input className={styles.settingsInput} placeholder="e.g. 11:30 AM" value={newTime} onChange={e => setNewTime(e.target.value)} style={{width: 140}} />
            </div>
          </div>
          <div style={{marginTop: 8, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, fontSize: 12, color: 'var(--muted)'}}>
            Token <strong style={{color: 'var(--text)'}}>#{String(Math.max(...queue.map(p => p.token), 0) + 1).padStart(2,'0')}</strong> will be assigned · Status: Waiting
          </div>
          <div style={{display: 'flex', gap: 8, marginTop: 20}}>
            <button className={styles.actionBtn} style={{flex: 1, justifyContent: 'center'}} onClick={() => { setAddPatientOpen(false); setNewName(''); setNewAge(''); setNewTime(''); }}>Cancel</button>
            <button className={`${styles.actionBtn} ${styles.primary}`} style={{flex: 1, justifyContent: 'center'}} onClick={addPatient} disabled={!newName.trim()}>Add to queue</button>
          </div>
        </div>
      </div>

      {/* QR Modal */}
      <div className={`${styles.modalOverlay} ${qrOpen ? styles.open : ''}`} onClick={e => { if (e.target === e.currentTarget) setQrOpen(false); }}>
        <div className={styles.modalBox}>
          <button className={styles.modalClose} onClick={() => setQrOpen(false)}>✕</button>
          <div className={styles.modalTitle}>Booking QR Code</div>
          <BookingQRCode slug={slug} clinicName={clinicName} size={180} />
          <div className={styles.modalUrlSub} style={{marginTop:12}}>
            <span style={{color:'var(--teal)',cursor:'pointer'}} onClick={() => window.open(`/book/${slug}`, '_blank')}>Preview booking page ↗</span>
          </div>
        </div>
      </div>

      {/* Skip confirmation modal */}
      <div className={`${styles.modalOverlay} ${skipTarget ? styles.open : ''}`} onClick={e => { if (e.target === e.currentTarget) setSkipTarget(null); }}>
        <div className={styles.modalBox} style={{width: 340, textAlign: 'left'}}>
          <div className={styles.modalTitle}>Skip patient?</div>
          <p style={{fontSize: 14, color: 'var(--muted)', margin: '8px 0 24px', lineHeight: 1.5}}>
            <strong style={{color: 'var(--text)', fontWeight: 500}}>{skipTarget?.name}</strong>
            {' '}(Token #{skipTarget ? tok(skipTarget.token) : ''}) will be moved to skipped and the next patient will be called.
          </p>
          <div style={{display: 'flex', gap: 8}}>
            <button
              className={styles.actionBtn}
              style={{flex: 1, justifyContent: 'center'}}
              onClick={() => setSkipTarget(null)}
            >
              Cancel
            </button>
            <button
              className={styles.actionBtn}
              style={{flex: 1, justifyContent: 'center', background: 'var(--red)', color: '#fff', border: 'none'}}
              onClick={confirmSkip}
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
