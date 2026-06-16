'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from '../page.module.css';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

type QStatus = 'done' | 'current' | 'waiting' | 'skipped';
interface QItem { token: number; name: string; age: number; date: string; time: string; ts: number; status: QStatus; }

type SortKey = 'token' | 'age' | 'datetime' | 'status';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUS_MAP: Record<string, QStatus> = { waiting: 'waiting', called: 'current', done: 'done', skipped: 'skipped' };
// Sort order for the Status column: active patients first, finished last.
const STATUS_ORDER: Record<QStatus, number> = { current: 0, waiting: 1, skipped: 2, done: 3 };

function tok(n: number) { return String(n).padStart(2, '0'); }

function to12h(t24: string): string {
  const [h, m] = t24.split(':').map(Number);
  if (Number.isNaN(h)) return t24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

function fmtDate(iso: string): string {
  const [y, mo, d] = iso.split('-').map(Number);
  if (!y || !mo || !d) return '';
  return `${d} ${MONTHS[mo - 1]} ${y}`;
}

// Booked slot takes priority; fall back to when the booking was created (walk-ins).
function formatWhen(slot: { date?: string; time?: string } | null, createdAt?: string | null): { date: string; time: string } {
  if (slot?.date && slot?.time) return { date: fmtDate(slot.date), time: to12h(slot.time) };
  if (createdAt) {
    const dt = new Date(createdAt);
    if (!Number.isNaN(dt.getTime())) {
      return {
        date: `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`,
        time: to12h(`${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`),
      };
    }
  }
  return { date: '—', time: '—' };
}

// Sortable epoch for the booked slot date+time (or creation time for walk-ins).
function whenTs(slot: { date?: string; time?: string } | null, createdAt?: string | null): number {
  if (slot?.date && slot?.time) {
    const t = new Date(`${slot.date}T${slot.time}:00`).getTime();
    if (!Number.isNaN(t)) return t;
  }
  if (createdAt) {
    const t = new Date(createdAt).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

type SlotRel = { date?: string; time?: string };
interface BookingRow {
  token_number: number;
  patient_name: string | null;
  status: string | null;
  created_at: string | null;
  slots: SlotRel | SlotRel[] | null;
}

function mapBookings(rows: BookingRow[]): QItem[] {
  return rows.map(b => {
    const slot = (Array.isArray(b.slots) ? b.slots[0] : b.slots) ?? null;
    const when = formatWhen(slot, b.created_at);
    return {
      token: b.token_number,
      name: b.patient_name || 'Unknown Patient',
      age: 0,
      date: when.date,
      time: when.time,
      ts: whenTs(slot, b.created_at),
      status: STATUS_MAP[b.status ?? ''] ?? 'waiting',
    };
  });
}

type ClinicHours = { mStart?: string; mEnd?: string; eStart?: string; eEnd?: string };

function generateTimeSlots(start: string, end: string, durationMin: number): string[] {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return [];
  const out: string[] = [];
  for (let t = sh * 60 + sm; t < eh * 60 + em; t += durationMin) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return out;
}

// Build the time-slot dropdown options (24h value + 12h AM/PM label) from the
// clinic's configured hours; fall back to a generic range if none are set.
function buildSlotOptions(hours: ClinicHours | null, duration: number): { value: string; label: string }[] {
  const dur = duration || 15;
  let times: string[] = [];
  if (hours?.mStart && hours?.mEnd) times = times.concat(generateTimeSlots(hours.mStart, hours.mEnd, dur));
  if (hours?.eStart && hours?.eEnd) times = times.concat(generateTimeSlots(hours.eStart, hours.eEnd, dur));
  if (times.length === 0) times = generateTimeSlots('09:00', '20:00', 30);
  return times.map(t => ({ value: t, label: to12h(t) }));
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hlHtml(text: string, q: string) {
  const safe = escHtml(text);
  if (!q) return safe;
  const idx = safe.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return safe;
  return safe.slice(0, idx) + `<mark class="hl">${safe.slice(idx, idx + q.length)}</mark>` + safe.slice(idx + q.length);
}

export default function PatientsPage() {
  const [queue, setQueue] = useState<QItem[]>([]);
  const [clinicId, setClinicId] = useState('');
  const [patientFilter, setPatientFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('token');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDate, setNewDate] = useState(todayISO());
  const [newTime, setNewTime] = useState('');
  const [slotOptions, setSlotOptions] = useState<{ value: string; label: string }[]>([]);
  const [adding, setAdding] = useState(false);

  const loadPatients = useCallback(async (cId: string) => {
    const supabase = createClient();
    const { data: bookings } = await supabase
      .from('bookings')
      .select('token_number, patient_name, status, created_at, slots(date, time)')
      .eq('clinic_id', cId)
      .order('token_number');
    if (bookings) setQueue(mapBookings(bookings as BookingRow[]));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
      if (!user) return;
      supabase
        .from('clinics')
        .select('id, hours, slot_duration')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          setClinicId(data.id);
          const opts = buildSlotOptions(data.hours as ClinicHours | null, data.slot_duration || 15);
          setSlotOptions(opts);
          setNewTime(prev => prev || opts[0]?.value || '');
          loadPatients(data.id);
        });
    });
  }, [loadPatients]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAddPatientOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  async function addPatient() {
    if (!newName.trim()) { toast.error('Patient name is required.'); return; }
    if (newPhone.length !== 10) { toast.error('Enter a valid 10-digit phone number.'); return; }
    if (!newTime) { toast.error('Please pick a time slot.'); return; }
    if (!clinicId) return;
    setAdding(true);
    const supabase = createClient();

    // Find or create the slot for the chosen date + time so the booking carries
    // a real date/time and renders correctly after reload (supports booking ahead).
    let slotId: string | null = null;
    const { data: existing } = await supabase
      .from('slots')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('date', newDate)
      .eq('time', newTime)
      .maybeSingle();
    if (existing?.id) {
      slotId = existing.id;
    } else {
      const { data: created } = await supabase
        .from('slots')
        .insert({ clinic_id: clinicId, date: newDate, time: newTime, max_bookings: 1 })
        .select('id')
        .single();
      slotId = created?.id ?? null;
    }

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slot_id: slotId,
        clinic_id: clinicId,
        patient_name: newName.trim(),
        patient_phone: newPhone,
      }),
    });
    setAdding(false);

    if (!res.ok) {
      let message = 'Could not add patient. Please try again.';
      try { const body = await res.json(); if (body?.error) message = body.error; } catch {}
      toast.error(message);
      return;
    }

    toast.success(`${newName.trim()} added`);
    await loadPatients(clinicId);
    setNewName(''); setNewAge(''); setNewPhone('');
    setNewTime(slotOptions[0]?.value || '');
    setNewDate(todayISO());
    setAddPatientOpen(false);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }
  function sortArrow(key: SortKey) {
    if (sortKey !== key) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  const filteredPatients = queue.filter(p =>
    p.name.toLowerCase().includes(patientFilter.toLowerCase()) ||
    String(p.token).includes(patientFilter)
  );

  const dir = sortDir === 'asc' ? 1 : -1;
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    switch (sortKey) {
      case 'age': return (a.age - b.age) * dir;
      case 'datetime': return (a.ts - b.ts) * dir;
      case 'status': return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * dir;
      default: return (a.token - b.token) * dir;
    }
  });

  return (
    <div className={styles.routePage}>
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
        <input
          type="text"
          placeholder="Search by name, token or phone…"
          value={patientFilter}
          onChange={e => setPatientFilter(e.target.value)}
        />
      </div>

      <div className={styles.card}>
        <div className={`${styles.patientRow} ${styles.header}`}>
          <div></div>
          <div>Name</div>
          <div onClick={() => toggleSort('age')} style={{cursor:'pointer', userSelect:'none'}}>Age{sortArrow('age')}</div>
          <div onClick={() => toggleSort('datetime')} style={{cursor:'pointer', userSelect:'none'}}>Date &amp; time{sortArrow('datetime')}</div>
          <div onClick={() => toggleSort('status')} style={{cursor:'pointer', userSelect:'none'}}>Status{sortArrow('status')}</div>
        </div>
        {sortedPatients.map(p => {
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
              <div style={{color:'var(--muted)'}}>
                <div>{p.date}</div>
                <div style={{fontSize:12, opacity:0.75}}>{p.time}</div>
              </div>
              <div style={{color:statusColor,fontSize:12,fontWeight:500}}>{statusLabel}</div>
            </div>
          );
        })}
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
              <div><div className={styles.settingsRowLabel}>Phone <span style={{color:'var(--red)'}}>*</span></div><div className={styles.settingsRowSub}>For booking confirmation</div></div>
              <input className={styles.settingsInput} type="tel" inputMode="numeric" placeholder="10-digit number" value={newPhone} onChange={e => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} style={{width: 200}} />
            </div>
            <div className={styles.settingsRow} style={{border: 'none', padding: 0}}>
              <div><div className={styles.settingsRowLabel}>Age</div></div>
              <input className={styles.settingsInput} type="number" placeholder="e.g. 35" min={1} max={110} value={newAge} onChange={e => setNewAge(e.target.value)} style={{width: 100, textAlign: 'center'}} />
            </div>
            <div className={styles.settingsRow} style={{border: 'none', padding: 0}}>
              <div><div className={styles.settingsRowLabel}>Date</div><div className={styles.settingsRowSub}>Book for today or a future day</div></div>
              <input className={styles.settingsInput} type="date" value={newDate} min={todayISO()} onChange={e => setNewDate(e.target.value)} style={{width: 170}} />
            </div>
            <div className={styles.settingsRow} style={{border: 'none', padding: 0}}>
              <div><div className={styles.settingsRowLabel}>Time slot</div><div className={styles.settingsRowSub}>From clinic hours</div></div>
              <select className={styles.settingsInput} value={newTime} onChange={e => setNewTime(e.target.value)} style={{width: 170}}>
                {slotOptions.length === 0 && <option value="">No slots configured</option>}
                {slotOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{marginTop: 8, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, fontSize: 12, color: 'var(--muted)'}}>
            Token <strong style={{color: 'var(--text)'}}>#{String(Math.max(...queue.map(p => p.token), 0) + 1).padStart(2,'0')}</strong> will be assigned · Status: Waiting
          </div>
          <div style={{display: 'flex', gap: 8, marginTop: 20}}>
            <button className={styles.actionBtn} style={{flex: 1, justifyContent: 'center'}} onClick={() => { setAddPatientOpen(false); setNewName(''); setNewAge(''); setNewPhone(''); setNewTime(slotOptions[0]?.value || ''); setNewDate(todayISO()); }}>Cancel</button>
            <button className={`${styles.actionBtn} ${styles.primary}`} style={{flex: 1, justifyContent: 'center'}} onClick={addPatient} disabled={!newName.trim() || newPhone.length !== 10 || adding}>{adding ? 'Adding…' : 'Add to queue'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
