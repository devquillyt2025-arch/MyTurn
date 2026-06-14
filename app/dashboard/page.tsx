'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { BookingQRCode } from '../../components/BookingQRCode';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

type QStatus = 'done' | 'current' | 'waiting' | 'skipped';
interface QItem { token: number; name: string; age: number; time: string; status: QStatus; }

const SLOT_DATA = [
  { label: '9–10 AM',  booked: 4, total: 4 },
  { label: '10–11 AM', booked: 4, total: 4 },
  { label: '11–12 PM', booked: 2, total: 4 },
  { label: '12–1 PM',  booked: 1, total: 3 },
  { label: '4–5 PM',   booked: 1, total: 4 },
];

function tok(n: number) { return String(n).padStart(2, '0'); }

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

  useEffect(() => {
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

  async function addPatient() {
    if (!newName.trim()) return;
    const nextToken = Math.max(...queue.map(p => p.token), 0) + 1;
    const timeStr = newTime.trim() || '—';
    const entry: QItem = { token: nextToken, name: newName.trim(), age: parseInt(newAge) || 0, time: timeStr, status: 'waiting' };
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
          <Link href="/pricing" className={styles.upgradeCta}>Upgrade to Basic for unlimited bookings →</Link>
        </div>
      )}

      {!slug && (
        <Link href="/dashboard/settings" className={styles.setupBanner}>
          Your clinic isn&apos;t set up yet. Complete setup to get your QR code →
        </Link>
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
