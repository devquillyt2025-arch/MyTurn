'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from '../page.module.css';
import { createClient } from '@/lib/supabase/client';
import { CustomSelect } from '@/components/CustomSelect';
import { StatusBadge } from '@/components/StatusBadge';
import { useClinic } from '../clinic-context';
import toast from 'react-hot-toast';

type QStatus = 'done' | 'current' | 'waiting' | 'skipped';
type BookingSource = 'walkin' | 'appointment';
interface QItem {
  id: string;
  token: number;
  name: string;
  ts: number;
  status: QStatus;
  isoDate?: string;
  source: BookingSource;
  assignedAt: string | null;
  completedAt: string | null;
}

type SortKey = 'token' | 'assigned' | 'completed' | 'status';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUS_MAP: Record<string, QStatus> = { waiting: 'waiting', called: 'current', done: 'done', skipped: 'skipped' };
const Q_TO_DB: Record<QStatus, string> = { waiting: 'waiting', current: 'called', done: 'done', skipped: 'skipped' };
const DB_STATUS_LABEL: Record<string, string> = { waiting: 'Waiting', called: 'In session', done: 'Done', skipped: 'No-show' };
const STATUS_ORDER: Record<QStatus, number> = { current: 0, waiting: 1, skipped: 2, done: 3 };

function tok(n: number) { return String(n).padStart(2, '0'); }

function to12h(t24: string): string {
  const [h, m] = t24.split(':').map(Number);
  if (Number.isNaN(h)) return t24;
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// Format a UTC timestamptz in IST as "19 Jun, 9:00 AM".
function fmtIST(iso: string | null): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).replace(/\b(am|pm)\b/gi, s => s.toUpperCase());
}

// Duration between two ISO timestamps, in whole minutes.
function diffMins(from: string, to: string): number {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
}

// "18 min" / "1 h 5 min"
function fmtDuration(mins: number): string {
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

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
  id: string;
  token_number: number;
  patient_name: string | null;
  status: string | null;
  created_at: string | null;
  assigned_at: string | null;
  completed_at: string | null;
  slots: SlotRel | SlotRel[] | null;
  source: string | null;
}

function mapBookings(rows: BookingRow[]): QItem[] {
  return rows.map(b => {
    const slot = (Array.isArray(b.slots) ? b.slots[0] : b.slots) ?? null;

    // isoDate for date-filter: prefer slot.date (appointment booked date),
    // then assigned_at date in IST, then created_at.
    let isoDate = '';
    if (slot?.date) {
      isoDate = slot.date;
    } else if (b.assigned_at) {
      isoDate = new Date(b.assigned_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    } else if (b.created_at) {
      isoDate = new Date(b.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    }

    return {
      id: b.id,
      token: b.token_number,
      name: b.patient_name || 'Unknown Patient',
      ts: b.assigned_at ? new Date(b.assigned_at).getTime() : whenTs(slot, b.created_at),
      status: STATUS_MAP[b.status ?? ''] ?? 'waiting',
      isoDate,
      source: (b.source === 'appointment' ? 'appointment' : 'walkin') as BookingSource,
      assignedAt: b.assigned_at,
      completedAt: b.completed_at,
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

function getRelativeDateISO(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
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
  const { selected: clinic } = useClinic();
  const [queue, setQueue] = useState<QItem[]>([]);
  const [clinicId, setClinicId] = useState('');
  const [patientFilter, setPatientFilter] = useState('');
  const [viewDate, setViewDate] = useState(todayISO());
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
      .select('id, token_number, patient_name, status, created_at, assigned_at, completed_at, source, slots(date, time)')
      .eq('clinic_id', cId)
      .order('token_number');
    if (bookings) setQueue(mapBookings(bookings as BookingRow[]));
  }, []);

  async function updateStatus(item: QItem, newDbStatus: string) {
    const supabase = createClient();
    const now = new Date().toISOString();
    const fields: Record<string, unknown> = { status: newDbStatus };
    if (newDbStatus === 'done') fields.completed_at = now;
    else fields.completed_at = null;

    const { error } = await supabase.from('bookings').update(fields).eq('id', item.id);
    if (error) { toast.error('Could not update status.'); return; }

    const newQStatus = STATUS_MAP[newDbStatus] ?? 'waiting';
    setQueue(prev => prev.map(p => p.id === item.id ? {
      ...p,
      status: newQStatus,
      completedAt: newDbStatus === 'done' ? now : null,
    } : p));
    toast.success(`Status updated to ${DB_STATUS_LABEL[newDbStatus] ?? newDbStatus}`);
  }

  useEffect(() => {
    if (!clinic) return;
    setClinicId(clinic.id);
    setQueue([]);
    const opts = buildSlotOptions(clinic.hours as ClinicHours | null, clinic.slot_duration || 15);
    setSlotOptions(opts);
    setNewTime(prev => prev || opts[0]?.value || '');
    loadPatients(clinic.id);
  }, [clinic?.id, loadPatients]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const filteredPatients = queue.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(patientFilter.toLowerCase()) || String(p.token).includes(patientFilter);
    const matchesDate = p.isoDate === viewDate;
    return matchesSearch && matchesDate;
  });

  const dir = sortDir === 'asc' ? 1 : -1;
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    switch (sortKey) {
      case 'assigned': return (a.ts - b.ts) * dir;
      case 'completed': {
        const at = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const bt = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return (at - bt) * dir;
      }
      case 'status': return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * dir;
      default: return (a.token - b.token) * dir;
    }
  });

  return (
    <div className={styles.routePage}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>Patients</div>
          <div className={styles.pageSub}>All registered patients · {filteredPatients.length} total for selected date</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
            <button 
              className={styles.actionBtn} 
              style={{ background: viewDate === getRelativeDateISO(-1) ? 'var(--border)' : 'transparent', border: 'none', padding: '4px 12px', height: '100%', minHeight: 28 }} 
              onClick={() => setViewDate(getRelativeDateISO(-1))}
            >Yesterday</button>
            <button 
              className={styles.actionBtn} 
              style={{ background: viewDate === getRelativeDateISO(0) ? 'var(--border)' : 'transparent', border: 'none', padding: '4px 12px', height: '100%', minHeight: 28 }} 
              onClick={() => setViewDate(getRelativeDateISO(0))}
            >Today</button>
            <button 
              className={styles.actionBtn} 
              style={{ background: viewDate === getRelativeDateISO(1) ? 'var(--border)' : 'transparent', border: 'none', padding: '4px 12px', height: '100%', minHeight: 28 }} 
              onClick={() => setViewDate(getRelativeDateISO(1))}
            >Tomorrow</button>
          </div>
          <input
            type="date"
            value={viewDate}
            onChange={e => setViewDate(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text)',
              colorScheme: 'dark',
            }}
          />
          <button className={`${styles.actionBtn} ${styles.primary}`} onClick={() => setAddPatientOpen(true)}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15"><path d="M8 2v12M2 8h12"/></svg>
            Add patient
          </button>
        </div>
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
          <div onClick={() => toggleSort('assigned')} style={{cursor:'pointer', userSelect:'none'}}>Assigned{sortArrow('assigned')}</div>
          <div onClick={() => toggleSort('completed')} style={{cursor:'pointer', userSelect:'none'}}>Completed{sortArrow('completed')}</div>
          <div onClick={() => toggleSort('status')} style={{cursor:'pointer', userSelect:'none'}}>Status{sortArrow('status')}</div>
        </div>
        {sortedPatients.map(p => {
          const initials = p.name.split(' ').map(w => w[0]).slice(0,2).join('');
          const tokenStr = `Token #${tok(p.token)}`;
          const sourceTag = p.source === 'walkin'
            ? { label: 'Walk-in',     bg: 'rgba(139,92,246,0.12)', color: 'var(--purple, #8b5cf6)' }
            : { label: 'Appointment', bg: 'rgba(20,184,166,0.12)', color: 'var(--teal, #14b8a6)'   };

          // Duration badge: only when ≥ 1 min (suppresses backfilled same-timestamp rows).
          const durationMins = p.status === 'done' && p.assignedAt && p.completedAt
            ? diffMins(p.assignedAt, p.completedAt)
            : -1;
          const duration = durationMins >= 1 ? fmtDuration(durationMins) : null;

          return (
            <div key={p.token} className={styles.patientRow}>
              <div className={styles.patientAvatar}>{initials}</div>

              {/* Name + token + source badge */}
              <div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontWeight:500}} dangerouslySetInnerHTML={{__html: hlHtml(p.name, patientFilter)}} />
                  <span style={{fontSize:10,fontWeight:600,letterSpacing:'0.04em',padding:'2px 7px',borderRadius:20,background:sourceTag.bg,color:sourceTag.color,lineHeight:1.6,whiteSpace:'nowrap'}}>{sourceTag.label}</span>
                </div>
                <div style={{fontSize:12,color:'var(--muted)'}} dangerouslySetInnerHTML={{__html: hlHtml(tokenStr, patientFilter)}} />
              </div>

              {/* Assigned timestamp */}
              <div style={{color:'var(--text)', fontSize:13}}>
                {fmtIST(p.assignedAt)}
              </div>

              {/* Completed timestamp — or state label when not yet done */}
              <div style={{fontSize:13}}>
                {p.completedAt ? (
                  <span style={{color:'var(--green)'}}>{fmtIST(p.completedAt)}</span>
                ) : p.status === 'skipped' ? (
                  <span style={{color:'var(--red)', fontSize:12}}>Skipped</span>
                ) : (
                  <span style={{color:'var(--amber)', fontSize:12}}>In progress</span>
                )}
              </div>

              {/* Editable status badge + optional duration */}
              <div style={{display:'flex', alignItems:'center', gap:6, flexWrap:'wrap'}}>
                <StatusBadge
                  dbStatus={Q_TO_DB[p.status]}
                  onUpdate={newDb => updateStatus(p, newDb)}
                />
                {duration && (
                  <span style={{color:'var(--muted)', fontSize:11}}>· {duration}</span>
                )}
              </div>
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
              <CustomSelect
                value={newTime}
                onChange={v => setNewTime(v)}
                options={slotOptions.length === 0
                  ? [{ value: '', label: 'No slots configured' }]
                  : slotOptions}
                style={{ width: 170, height: 40 }}
              />
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
