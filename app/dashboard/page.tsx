'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { BookingQRCode } from '../../components/BookingQRCode';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

type QStatus = 'done' | 'current' | 'waiting' | 'skipped';
interface QItem { id: string; token: number; name: string; age: number; time: string; status: QStatus; source: string; slotTime: string; }
interface PendingAppt { id: string; name: string; slotTime: string; slotTimeRaw: string; assignedToken: number | null; }

// DB stores 'called' for the patient currently being seen; the UI calls it 'current'.
const DB_TO_Q: Record<string, QStatus> = { waiting: 'waiting', called: 'current', done: 'done', skipped: 'skipped' };
const Q_TO_DB: Record<QStatus, string> = { waiting: 'waiting', current: 'called', done: 'done', skipped: 'skipped' };

const SLOT_DATA = [
  { label: '9–10 AM',  booked: 4, total: 4 },
  { label: '10–11 AM', booked: 4, total: 4 },
  { label: '11–12 PM', booked: 2, total: 4 },
  { label: '12–1 PM',  booked: 1, total: 3 },
  { label: '4–5 PM',   booked: 1, total: 4 },
];

function tok(n: number) { return String(n).padStart(2, '0'); }
function to12h(t: string) {
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return t;
  return `${h % 12 || 12}:${String(m || 0).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

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

export default function DashboardPage() {
  const [queue, setQueue] = useState<QItem[]>([]);
  const [qrOpen, setQrOpen] = useState(false);
  const [clock, setClock] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [slug, setSlug] = useState('');
  const [isFlipping, setIsFlipping] = useState(false);
  const [slotConfig, setSlotConfig] = useState(SLOT_DATA.map(s => ({ ...s, blocked: false })));
  const [slotsOpen, setSlotsOpen] = useState(false);
  const [newSlotTime, setNewSlotTime] = useState('');
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newTime, setNewTime] = useState('');
  const [skipTarget, setSkipTarget] = useState<QItem | null>(null);
  const [clinicId, setClinicId] = useState('');
  const [doctorPlan, setDoctorPlan] = useState('free');
  const [todayBookingCount, setTodayBookingCount] = useState(0);

  // Walk-ins tab
  const [activeTab, setActiveTab] = useState<'walkins' | 'appointments'>('walkins');
  const [wiName, setWiName] = useState('');
  const [wiPhone, setWiPhone] = useState('');
  const [wiAdding, setWiAdding] = useState(false);
  const [wiResult, setWiResult] = useState<{ token: number; aheadCount: number } | null>(null);
  const [walkinList, setWalkinList] = useState<{ id: string; token: number; name: string; status: string }[]>([]);
  const [pendingAppts, setPendingAppts] = useState<PendingAppt[]>([]);
  const [checkingInIds, setCheckingInIds] = useState<Set<string>>(new Set());

  // Tracks which booking IDs are already in the live queue; used by the realtime
  // UPDATE handler to distinguish check-ins (new row) from status changes (existing row).
  const queueIdsRef = useRef<Set<string>>(new Set());

  async function loadQueue(cId: string) {
    const supabase = createClient();
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const startUTC = new Date(`${todayIST}T00:00:00+05:30`).toISOString();
    const endUTC   = new Date(`${todayIST}T23:59:59.999+05:30`).toISOString();
    const { data } = await supabase
      .from('bookings')
      .select('id, token_number, patient_name, status, source, slots(time)')
      .eq('clinic_id', cId)
      .not('token_number', 'is', null)
      .gte('checked_in_at', startUTC)
      .lte('checked_in_at', endUTC)
      .order('token_number');
    if (!data) return;
    setQueue(data.map(b => {
      const slot = (Array.isArray(b.slots) ? b.slots[0] : b.slots) as { time?: string } | null;
      return {
        id: b.id,
        token: b.token_number as number,
        name: b.patient_name || 'Unknown Patient',
        age: 0,
        time: '—',
        status: DB_TO_Q[b.status as string] ?? 'waiting',
        source: (b.source as string) ?? 'walkin',
        slotTime: slot?.time ? to12h(slot.time) : '',
      };
    }));
  }

  async function loadPendingAppts(cId: string) {
    const supabase = createClient();
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const { data } = await supabase
      .from('bookings')
      .select('id, patient_name, slots(date, time)')
      .eq('clinic_id', cId)
      .eq('source', 'appointment')
      .is('token_number', null);
    if (!data) return;
    setPendingAppts(
      data
        .map(b => {
          const slot = (Array.isArray(b.slots) ? b.slots[0] : b.slots) as { date?: string; time?: string } | null;
          return {
            id: b.id,
            name: b.patient_name || 'Unknown Patient',
            slotDate: slot?.date ?? '',
            slotTimeRaw: slot?.time ?? '',
            slotTime: slot?.time ? to12h(slot.time) : '—',
            assignedToken: null as number | null,
          };
        })
        .filter(a => a.slotDate === todayIST)
        .sort((a, b) => a.slotTimeRaw.localeCompare(b.slotTimeRaw))
        .map(({ id, name, slotTimeRaw, slotTime, assignedToken }) => ({ id, name, slotTimeRaw, slotTime, assignedToken }))
    );
  }

  async function loadWalkins(cId: string) {
    const supabase = createClient();
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const startUTC = new Date(`${todayIST}T00:00:00+05:30`).toISOString();
    const endUTC   = new Date(`${todayIST}T23:59:59.999+05:30`).toISOString();
    const { data } = await supabase
      .from('bookings')
      .select('id, token_number, patient_name, status')
      .eq('clinic_id', cId)
      .eq('source', 'walkin')
      .gte('created_at', startUTC)
      .lte('created_at', endUTC)
      .order('token_number');
    if (data) {
      setWalkinList(data.map(b => ({
        id: b.id,
        token: b.token_number,
        name: b.patient_name || 'Unknown',
        status: b.status || 'waiting',
      })));
    }
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
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
          void loadWalkins(data.id);
          void loadPendingAppts(data.id);

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

          void loadQueue(data.id);
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
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setQrOpen(false);
        setSlotsOpen(false);
        setAddPatientOpen(false);
        setSkipTarget(null);
      }
    }
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

  // Keep the ref in sync so the realtime UPDATE handler can check queue membership.
  useEffect(() => {
    queueIdsRef.current = new Set(queue.map(p => p.id));
  }, [queue]);

  // Realtime: INSERT fires when a walk-in gets a token; UPDATE fires when an
  // appointment is checked in (token_number: null → non-null). We detect the
  // latter by checking whether the row is already tracked in queueIdsRef —
  // this avoids full reloads on every status-change UPDATE (markDone, skip, etc.)
  // without requiring REPLICA IDENTITY FULL on the bookings table.
  useEffect(() => {
    if (!clinicId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`queue:${clinicId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bookings', filter: `clinic_id=eq.${clinicId}` },
        (payload) => {
          const nw = payload.new as { token_number: number | null };
          if (nw.token_number !== null) void loadQueue(clinicId);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `clinic_id=eq.${clinicId}` },
        (payload) => {
          const nw  = payload.new as { id: string; token_number: number | null };
          const old = payload.old as { token_number?: number | null };
          // Row not yet in queue but now has a token → appointment just checked in.
          // Also catches the explicit null→non-null transition when REPLICA IDENTITY FULL is on.
          const justCheckedIn = nw.token_number !== null && !queueIdsRef.current.has(nw.id);
          const explicitTransition = old.token_number === null && nw.token_number !== null;
          if (justCheckedIn || explicitTransition) void loadQueue(clinicId);
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [clinicId]);

  const current = queue.find(p => p.status === 'current');
  const waiting = queue.filter(p => p.status === 'waiting');
  const done = queue.filter(p => p.status === 'done');

  // Persist status changes to the DB so they survive reload and show on the
  // patients page. RLS ("bookings: owner manage") restricts this to the owner.
  async function persistStatus(updates: { id: string; status: QStatus }[]) {
    const supabase = createClient();
    const results = await Promise.all(
      updates
        .filter(u => u.id)
        .map(u => supabase.from('bookings').update({ status: Q_TO_DB[u.status] }).eq('id', u.id))
    );
    if (results.some(r => r.error)) toast.error('Could not save the change. Please retry.');
  }

  function callNext() {
    const cur = queue.find(p => p.status === 'current');
    const nxt = queue.find(p => p.status === 'waiting');
    if (!cur && !nxt) return;
    setIsFlipping(true);
    setTimeout(() => {
      setQueue(prev => prev.map(p => {
        if (cur && p.id === cur.id) return { ...p, status: 'done' as QStatus };
        if (nxt && p.id === nxt.id) return { ...p, status: 'current' as QStatus };
        return p;
      }));
      setIsFlipping(false);
    }, 160);
    const updates: { id: string; status: QStatus }[] = [];
    if (cur) updates.push({ id: cur.id, status: 'done' });
    if (nxt) updates.push({ id: nxt.id, status: 'current' });
    void persistStatus(updates);
  }

  function markDone() {
    const cur = queue.find(p => p.status === 'current');
    if (!cur) return;
    setQueue(prev => prev.map(p => (p.id === cur.id ? { ...p, status: 'done' } : p)));
    void persistStatus([{ id: cur.id, status: 'done' }]);
  }

  function skipCurrent() {
    if (!current) return;
    setSkipTarget(current);
  }

  function confirmSkip() {
    if (!skipTarget) return;
    const cur = skipTarget;
    const nxt = queue.find(p => p.status === 'waiting');
    setQueue(prev => prev.map(p => {
      if (p.id === cur.id) return { ...p, status: 'skipped' as QStatus };
      if (nxt && p.id === nxt.id) return { ...p, status: 'current' as QStatus };
      return p;
    }));
    const updates: { id: string; status: QStatus }[] = [{ id: cur.id, status: 'skipped' }];
    if (nxt) updates.push({ id: nxt.id, status: 'current' });
    void persistStatus(updates);
    toast(`Skipped ${cur.name}`);
    setSkipTarget(null);
  }

  async function addPatient() {
    if (!newName.trim()) return;
    const nextToken = Math.max(...queue.map(p => p.token), 0) + 1;
    const timeStr = newTime.trim() || '—';
    const entry: QItem = { id: '', token: nextToken, name: newName.trim(), age: parseInt(newAge) || 0, time: timeStr, status: 'waiting', source: 'walkin', slotTime: '' };
    setQueue(prev => [...prev, entry]);
    if (clinicId) {
      await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: null,
          clinic_id: clinicId,
          patient_name: entry.name,
          patient_phone: '',
          token_number: nextToken,
        }),
      });
    }
    setNewName(''); setNewAge(''); setNewTime('');
    setAddPatientOpen(false);
  }

  async function addWalkin() {
    if (!wiName.trim() || !clinicId) return;
    setWiAdding(true);
    const aheadCount = walkinList.filter(w => w.status === 'waiting').length;
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinic_id: clinicId,
        patient_name: wiName.trim(),
        patient_phone: wiPhone.trim(),
        slot_id: null,
        source: 'walkin',
      }),
    });
    setWiAdding(false);
    if (!res.ok) {
      let message = 'Could not register walk-in. Please try again.';
      try { const b = await res.json(); if (b?.error) message = b.error; } catch {}
      toast.error(message);
      return;
    }
    const { booking } = await res.json();
    setWiResult({ token: booking.token_number as number, aheadCount });
    setWiName('');
    setWiPhone('');
    void loadWalkins(clinicId);
  }

  async function checkIn(bookingId: string) {
    setCheckingInIds(prev => new Set([...prev, bookingId]));
    const res = await fetch('/api/bookings/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bookingId }),
    });
    setCheckingInIds(prev => { const s = new Set(prev); s.delete(bookingId); return s; });
    if (!res.ok) {
      let message = 'Check-in failed. Please try again.';
      try { const b = await res.json(); if (b?.error) message = b.error; } catch {}
      toast.error(message);
      return;
    }
    const { booking } = await res.json();
    setPendingAppts(prev =>
      prev.map(a => a.id === bookingId ? { ...a, assignedToken: booking.token_number as number } : a)
    );
    void loadQueue(clinicId);
  }

  return (
    <div className={styles.routePage}>
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

      {!slug && (
        <Link href="/dashboard/settings" className={styles.setupBanner}>
          Your clinic isn&apos;t set up yet. Complete setup to get your QR code →
        </Link>
      )}

      <div className={styles.settingsTabs}>
        <button
          className={`${styles.settingsTabBtn} ${activeTab === 'walkins' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('walkins')}
        >Walk-ins</button>
        <button
          className={`${styles.settingsTabBtn} ${activeTab === 'appointments' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('appointments')}
        >Appointments</button>
      </div>

      {activeTab === 'walkins' && (
        <div style={{maxWidth: 560}}>
          {wiResult ? (
            <div className={styles.card} style={{textAlign: 'center', padding: '40px 24px'}}>
              <div style={{fontSize: 72, fontWeight: 700, color: 'var(--teal)', lineHeight: 1, letterSpacing: '-2px'}}>
                #{tok(wiResult.token)}
              </div>
              <div style={{fontSize: 18, fontWeight: 600, color: 'var(--text)', marginTop: 12}}>
                Token #{tok(wiResult.token)} assigned
              </div>
              <div style={{fontSize: 14, color: 'var(--muted)', marginTop: 6}}>
                {wiResult.aheadCount === 0
                  ? 'Next up — no one ahead'
                  : `${wiResult.aheadCount} ${wiResult.aheadCount === 1 ? 'person' : 'people'} ahead`}
              </div>
              <button
                className={`${styles.actionBtn} ${styles.primary}`}
                style={{marginTop: 24}}
                onClick={() => setWiResult(null)}
              >
                Register another patient →
              </button>
            </div>
          ) : (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v12M2 8h12"/></svg>
                <span className={styles.cardTitle}>Take Token</span>
                <span className={styles.cardSub}>Walk-in registration</span>
              </div>
              <div style={{padding: '0 20px 20px'}}>
                <div style={{display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 16px'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                    <div style={{flexShrink: 0, width: 88}}>
                      <div className={styles.settingsRowLabel}>Full name <span style={{color:'var(--red)'}}>*</span></div>
                    </div>
                    <input
                      className={styles.settingsInput}
                      placeholder="e.g. Arjun Sharma"
                      value={wiName}
                      onChange={e => setWiName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !wiAdding && addWalkin()}
                      style={{flex: 1}}
                      autoFocus
                    />
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                    <div style={{flexShrink: 0, width: 88}}>
                      <div className={styles.settingsRowLabel}>Phone</div>
                      <div className={styles.settingsRowSub}>Optional</div>
                    </div>
                    <input
                      className={styles.settingsInput}
                      type="tel"
                      inputMode="numeric"
                      placeholder="10-digit number"
                      value={wiPhone}
                      onChange={e => setWiPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      style={{flex: 1}}
                    />
                  </div>
                </div>
                <button
                  className={`${styles.actionBtn} ${styles.primary}`}
                  style={{width: '100%', justifyContent: 'center'}}
                  onClick={addWalkin}
                  disabled={!wiName.trim() || wiAdding}
                >
                  {wiAdding ? 'Assigning token…' : 'Take Token'}
                </button>
              </div>
            </div>
          )}

          <div className={styles.card} style={{marginTop: 16}}>
            <div className={styles.cardHeader}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 4h11M2.5 8h7M2.5 12h5"/></svg>
              <span className={styles.cardTitle}>Today&apos;s Walk-ins</span>
              <span className={styles.cardSub}>{walkinList.length} total</span>
            </div>
            {walkinList.length === 0 ? (
              <div style={{padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13}}>
                No walk-ins yet today
              </div>
            ) : walkinList.map(w => {
              const statusColor = ({ done: 'var(--green)', called: 'var(--teal)', waiting: 'var(--amber)', skipped: 'var(--red)' } as Record<string,string>)[w.status] ?? 'var(--muted)';
              const statusLabel = ({ done: 'Done', called: 'In session', waiting: 'Waiting', skipped: 'Skipped' } as Record<string,string>)[w.status] ?? w.status;
              return (
                <div key={w.id} className={`${styles.queueItem} ${styles[w.status as keyof typeof styles] ?? ''}`}>
                  <div className={styles.queueToken}>{tok(w.token)}</div>
                  <div className={styles.qInfo}>
                    <div className={styles.qName}>{w.name}</div>
                  </div>
                  <span style={{fontSize: 12, fontWeight: 500, color: statusColor}}>{statusLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'appointments' && (<>
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
                    <div className={styles.qMeta}>
                      {p.source === 'appointment' ? (
                        <span style={{fontSize:10,fontWeight:600,letterSpacing:0.3,padding:'1px 6px',borderRadius:4,background:'var(--teal-dim)',color:'var(--teal)',border:'1px solid var(--teal-border)'}}>
                          Appt {p.slotTime || '—'}
                        </span>
                      ) : (
                        <span style={{fontSize:10,fontWeight:600,letterSpacing:0.3,padding:'1px 6px',borderRadius:4,background:'rgba(251,191,36,0.12)',color:'var(--amber)',border:'1px solid rgba(251,191,36,0.3)'}}>
                          Walk-in
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`${styles.qStatus} ${styles[p.status]}`}>
                    {{ done: 'Done', current: 'In', waiting: 'Waiting', skipped: 'Skipped' }[p.status]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.card} style={{marginTop: 16}}>
            <div className={styles.cardHeader}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="1.5" width="12" height="13" rx="1.5" /><path d="M5 1.5v3M11 1.5v3M2 7.5h12"/></svg>
              <span className={styles.cardTitle}>Today&apos;s Appointments</span>
              <span className={styles.cardSub}>{pendingAppts.filter(a => a.assignedToken === null).length} pending check-in</span>
            </div>
            {pendingAppts.length === 0 ? (
              <div style={{padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13}}>
                No appointments scheduled for today
              </div>
            ) : pendingAppts.map(appt => (
              <div key={appt.id} className={styles.queueItem}>
                <div style={{minWidth: 56, fontSize: 12, fontWeight: 600, color: 'var(--teal)'}}>
                  {appt.slotTime}
                </div>
                <div className={styles.qInfo}>
                  <div className={styles.qName}>{appt.name}</div>
                </div>
                {appt.assignedToken !== null ? (
                  <span style={{fontSize: 12, fontWeight: 600, color: 'var(--teal)', whiteSpace: 'nowrap'}}>
                    Token #{tok(appt.assignedToken)} ✓
                  </span>
                ) : (
                  <button
                    className={`${styles.actionBtn} ${styles.primary}`}
                    style={{padding: '4px 12px', fontSize: 12, height: 'auto'}}
                    onClick={() => void checkIn(appt.id)}
                    disabled={checkingInIds.has(appt.id)}
                  >
                    {checkingInIds.has(appt.id) ? 'Checking in…' : 'Check In'}
                  </button>
                )}
              </div>
            ))}
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
      </>)}

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
            <span style={{color:'var(--teal)',cursor:'pointer'}} onClick={() => window.open(`/walkin/${slug}`, '_blank')}>Preview patient page ↗</span>
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
            <button className={styles.actionBtn} style={{flex: 1, justifyContent: 'center'}} onClick={() => setSkipTarget(null)}>Cancel</button>
            <button
              className={styles.actionBtn}
              style={{flex: 1, justifyContent: 'center', background: 'var(--red)', color: '#fff', border: 'none'}}
              onClick={confirmSkip}
            >Skip</button>
          </div>
        </div>
      </div>
    </div>
  );
}
