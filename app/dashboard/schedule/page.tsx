'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import styles from '../page.module.css';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

// ── Static day-view data ───────────────────────────────────────────────────

const SLOT_DATA = [
  { label: '9–10 AM',  booked: 4, total: 4 },
  { label: '10–11 AM', booked: 4, total: 4 },
  { label: '11–12 PM', booked: 2, total: 4 },
  { label: '12–1 PM',  booked: 1, total: 3 },
  { label: '4–5 PM',   booked: 1, total: 4 },
];

// ── Constants ──────────────────────────────────────────────────────────────

const DAY_NAMES  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DEFAULT_CAPACITY = 15;

// Time grid: 9 AM → 8 PM, 30-min rows, 48 px each
const GRID_START = 9 * 60;
const GRID_END   = 20 * 60;
const ROW_H      = 48;

const TIME_LABELS: string[] = [];
for (let m = GRID_START; m <= GRID_END; m += 30) {
  const h    = Math.floor(m / 60);
  const min  = m % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h > 12 ? h - 12 : h === 0 ? 12 : h;
  TIME_LABELS.push(`${h12}:${min === 0 ? '00' : '30'} ${ampm}`);
}

// ── Types ──────────────────────────────────────────────────────────────────

type Booking = {
  id: string;
  date?: string;            // YYYY-MM-DD explicit date column (preferred)
  patient_name?: string;
  phone?: string;
  token_number?: number;
  status?: string;
  appointment_time?: string;
  created_at: string;
};

type PopoverData = { booking: Booking; x: number; y: number };

// ── Helpers ────────────────────────────────────────────────────────────────

/** Local-timezone YYYY-MM-DD — avoids UTC-shift bugs with .toISOString() */
function toLocalIsoDate(d: Date): string {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}

/** ISO date of a booking — uses explicit `date` column if present, else local parse of created_at */
function bookingDate(b: Booking): string {
  if (b.date) return b.date;
  const t = b.appointment_time ?? b.created_at;
  return toLocalIsoDate(new Date(t));
}

function SlotBars({ data }: { data: typeof SLOT_DATA }) {
  return (
    <>
      {data.map(s => (
        <div key={s.label} className={styles.slotBarRow}>
          <span className={styles.slotTimeLabel}>{s.label}</span>
          <div className={styles.slotBarTrack}>
            <div className={styles.slotBarFill} style={{ width: `${Math.round((s.booked / s.total) * 100)}%` }} />
          </div>
          <span className={styles.slotBarCount}>{s.booked}</span>
        </div>
      ))}
    </>
  );
}

function getWeekDays(offset: number): Date[] {
  const today = new Date();
  const dow = today.getDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMon + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getMonthCalendar(offset: number): { date: Date; inMonth: boolean }[][] {
  const now   = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last  = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const startDow = first.getDay();
  const start    = new Date(first);
  start.setDate(1 - (startDow === 0 ? 6 : startDow - 1));
  const tMonth = first.getMonth();
  const tYear  = first.getFullYear();
  const weeks: { date: Date; inMonth: boolean }[][] = [];
  const cur = new Date(start);
  while (cur <= last || weeks.length < 4) {
    const week: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: new Date(cur), inMonth: cur.getMonth() === tMonth && cur.getFullYear() === tYear });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
    if (weeks.length >= 6) break;
  }
  return weeks;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function bookingMinutes(b: Booking): number {
  const d = new Date(b.appointment_time ?? b.created_at);
  return d.getHours() * 60 + d.getMinutes();
}

/** "9:45 AM" style label for a booking's time */
function bookingTimeLabel(b: Booking): string {
  const d   = new Date(b.appointment_time ?? b.created_at);
  const h   = d.getHours();
  const m   = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Map a DB status to the day-view event CSS class */
function dayStatusClass(s?: string): 'done' | 'current' | 'upcoming' {
  if (s === 'current' || s === 'in_session') return 'current';
  if (s === 'done'    || s === 'completed')  return 'done';
  return 'upcoming';
}

/** "9–10 AM" style label for an hour bucket (h in 0–23) */
function hourRangeLabel(h: number): string {
  const ampm  = h >= 12 ? 'PM' : 'AM';
  const lo    = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const hiH   = h + 1;
  const hi    = hiH > 12 ? hiH - 12 : hiH === 0 ? 12 : hiH;
  return `${lo}–${hi} ${ampm}`;
}

function patientName(b: Booking) { return b.patient_name ?? 'Patient'; }

function statusLabel(s?: string) {
  if (s === 'current' || s === 'in_session') return 'In session';
  if (s === 'done'    || s === 'completed')  return 'Done';
  if (s === 'skipped') return 'Skipped';
  return 'Waiting';
}

function barColor(pct: number) {
  return pct >= 0.9 ? 'var(--red)' : pct >= 0.6 ? 'var(--amber)' : 'var(--green)';
}

// ── Schedule component ─────────────────────────────────────────────────────

function ScheduleContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const view = (searchParams.get('view') ?? 'day') as 'day' | 'week' | 'month';

  // Day-view slot state
  const [slotConfig,   setSlotConfig]   = useState(SLOT_DATA.map(s => ({ ...s, blocked: false })));
  const [slotsOpen,    setSlotsOpen]    = useState(false);
  const [newSlotTime,  setNewSlotTime]  = useState('');

  // Navigation
  const [weekOffset,   setWeekOffset]   = useState(0);
  const [monthOffset,  setMonthOffset]  = useState(0);

  // Clinic
  const [clinicId,      setClinicId]      = useState('');
  const [dailyCapacity, setDailyCapacity] = useState(DEFAULT_CAPACITY);

  // Day data (selected date from ?date=, else today)
  const [dayBookings,  setDayBookings]  = useState<Booking[]>([]);
  const [dayLoading,   setDayLoading]   = useState(false);
  const [dayFetched,   setDayFetched]   = useState(false);

  // Week data
  const [bookings,     setBookings]     = useState<Booking[]>([]);

  // Month data — date-string → count
  const [monthCounts,  setMonthCounts]  = useState<Record<string, number>>({});
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthFetched, setMonthFetched] = useState(false); // has first fetch completed?

  // UI
  const [popover,    setPopover]    = useState<PopoverData | null>(null);
  const [addOpen,    setAddOpen]    = useState(false);
  const [newPatient, setNewPatient] = useState({ name: '', phone: '' });

  const popoverRef = useRef<HTMLDivElement>(null);

  // ── Fetch clinic ID + capacity ─────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('clinics').select('id, max_patients').eq('user_id', user.id).single()
        .then(({ data }) => {
          if (data?.id) setClinicId(data.id);
          if (data?.max_patients) setDailyCapacity(Number(data.max_patients));
        });
    });
  }, []);

  // ── Fetch the selected day's bookings ──────────────────────────────────
  const dateParam = searchParams.get('date');
  useEffect(() => {
    if (view !== 'day' || !clinicId) return;
    let cancelled = false;
    const iso = dateParam ?? toLocalIsoDate(new Date());
    setDayLoading(true);
    setDayFetched(false);
    const supabase = createClient();
    supabase.from('bookings').select('*')
      .eq('clinic_id', clinicId)
      .gte('created_at', `${iso}T00:00:00`)
      .lte('created_at', `${iso}T23:59:59`)
      .then(({ data }) => {
        if (cancelled) return;
        setDayBookings((data ?? []).filter(b => bookingDate(b) === iso));
        setDayLoading(false);
        setDayFetched(true);
      });
    return () => { cancelled = true; };
  }, [view, clinicId, dateParam]);

  // ── Fetch week bookings (full objects needed for event blocks) ─────────
  useEffect(() => {
    if (view !== 'week' || !clinicId) return;
    let cancelled = false;
    const days = getWeekDays(weekOffset);
    const fromD = new Date(days[0]); fromD.setDate(fromD.getDate() - 1);
    const toD   = new Date(days[6]); toD.setDate(toD.getDate() + 1);
    const supabase = createClient();
    supabase.from('bookings').select('*')
      .eq('clinic_id', clinicId)
      .gte('created_at', `${toLocalIsoDate(fromD)}T00:00:00`)
      .lte('created_at', `${toLocalIsoDate(toD)}T23:59:59`)
      .then(({ data }) => { if (!cancelled) setBookings(data ?? []); });
    return () => { cancelled = true; };
  }, [view, clinicId, weekOffset]);

  // ── Fetch month counts (lightweight — date/count only) ─────────────────
  useEffect(() => {
    if (view !== 'month' || !clinicId) return;
    let cancelled = false;
    const cal = getMonthCalendar(monthOffset);
    const fromD = new Date(cal[0][0].date); fromD.setDate(fromD.getDate() - 1);
    const toD   = new Date(cal[cal.length - 1][6].date); toD.setDate(toD.getDate() + 1);

    setMonthLoading(true);
    setMonthFetched(false);
    const supabase = createClient();
    supabase.from('bookings')
      .select('date, created_at')
      .eq('clinic_id', clinicId)
      .gte('created_at', `${toLocalIsoDate(fromD)}T00:00:00`)
      .lte('created_at', `${toLocalIsoDate(toD)}T23:59:59`)
      .then(({ data }) => {
        if (cancelled) return;
        const counts: Record<string, number> = {};
        (data ?? []).forEach(b => {
          const key = (b as Booking).date ?? toLocalIsoDate(new Date(b.created_at));
          counts[key] = (counts[key] ?? 0) + 1;
        });
        setMonthCounts(counts);
        setMonthLoading(false);
        setMonthFetched(true);
      });
    return () => { cancelled = true; };
  }, [view, clinicId, monthOffset]);

  // ── ESC / outside-click ────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setPopover(null); setSlotsOpen(false); setAddOpen(false); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!popover) return;
    function onDown(e: PointerEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node))
        setPopover(null);
    }
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [popover]);

  // ── Navigation ─────────────────────────────────────────────────────────
  function setView(v: 'day' | 'week' | 'month') {
    const p = new URLSearchParams(searchParams.toString());
    p.set('view', v);
    router.replace(`/dashboard/schedule?${p.toString()}`);
  }

  function navigateToDay(date: Date) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('view', 'day');
    p.set('date', toLocalIsoDate(date));
    router.replace(`/dashboard/schedule?${p.toString()}`);
  }

  // ── Derived ────────────────────────────────────────────────────────────
  const today     = new Date();

  // Day view — selected date + grouped timetable + hourly slot fill
  const selectedDate    = dateParam ? new Date(`${dateParam}T00:00:00`) : today;
  const isSelectedToday = isSameDay(selectedDate, today);
  const dayDateLabel    = isSelectedToday
    ? 'Today'
    : `${DAY_NAMES[(selectedDate.getDay() + 6) % 7]}, ${selectedDate.getDate()} ${MONTH_SHORT[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;

  const dayTimetable: { time: string; events: { name: string; status: string }[] }[] = [];
  [...dayBookings].sort((a, b) => bookingMinutes(a) - bookingMinutes(b)).forEach(b => {
    const label = bookingTimeLabel(b);
    let group = dayTimetable.find(g => g.time === label);
    if (!group) { group = { time: label, events: [] }; dayTimetable.push(group); }
    group.events.push({ name: patientName(b), status: dayStatusClass(b.status) });
  });

  const hourBuckets: Record<number, number> = {};
  dayBookings.forEach(b => {
    const h = Math.floor(bookingMinutes(b) / 60);
    hourBuckets[h] = (hourBuckets[h] ?? 0) + 1;
  });
  const maxHourCount = Math.max(1, ...Object.values(hourBuckets));
  const slotFill = Object.keys(hourBuckets).map(Number).sort((a, b) => a - b)
    .map(h => ({ label: hourRangeLabel(h), booked: hourBuckets[h], total: maxHourCount }));

  function shiftDay(delta: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    navigateToDay(d);
  }

  const weekDays  = getWeekDays(weekOffset);
  const weekLabel = `${weekDays[0].getDate()} ${MONTH_SHORT[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${MONTH_SHORT[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`;

  const monthFirst = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthCal   = getMonthCalendar(monthOffset);
  const monthLabel = `${MONTH_FULL[monthFirst.getMonth()]} ${monthFirst.getFullYear()}`;

  // For week view: filter full booking objects by local date
  function bookingsForDay(date: Date): Booking[] {
    const iso = toLocalIsoDate(date);
    return bookings.filter(b => bookingDate(b) === iso);
  }

  // For month view: lookup count from the pre-grouped map
  function countForDay(date: Date): number {
    return monthCounts[toLocalIsoDate(date)] ?? 0;
  }

  const totalMonthBookings = Object.values(monthCounts).reduce((s, n) => s + n, 0);
  const gridH = ((GRID_END - GRID_START) / 30) * ROW_H;

  // ── Add patient ────────────────────────────────────────────────────────
  async function handleAddPatient() {
    if (!newPatient.name.trim()) { toast.error('Name required'); return; }
    const supabase = createClient();
    const { error } = await supabase.from('bookings').insert({
      clinic_id: clinicId,
      patient_name: newPatient.name.trim(),
      phone: newPatient.phone.trim(),
      status: 'waiting',
    });
    if (error) { toast.error('Failed to add'); return; }
    toast.success('Patient added');
    setNewPatient({ name: '', phone: '' });
    setAddOpen(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.routePage}>

      {/* Page header */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>Schedule</div>
          <div className={styles.pageSub}>
            {view === 'day' ? `${dayDateLabel} · Slot capacity: ${dailyCapacity}` :
             view === 'week' ? weekLabel : monthLabel}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className={styles.viewToggleGroup}>
            {(['day', 'week', 'month'] as const).map(v => (
              <button key={v}
                className={`${styles.viewToggleBtn} ${view === v ? styles.activeToggle : ''}`}
                onClick={() => setView(v)}
              >{v[0].toUpperCase() + v.slice(1)}</button>
            ))}
          </div>
          {view === 'day' && (
            <button className={styles.actionBtn} onClick={() => setSlotsOpen(true)}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
                <path d="M2.5 5.5h11M5.5 2.5v2M10.5 2.5v2M3 2.5h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1v-9a1 1 0 011-1z"/>
              </svg>
              Manage slots
            </button>
          )}
        </div>
      </div>

      {/* ══ DAY VIEW ══════════════════════════════════════════════════════ */}
      {view === 'day' && (
        <>
        <div className={styles.weekNav}>
          <button className={styles.actionBtn} onClick={() => shiftDay(-1)}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14"><path d="M10 3L5 8l5 5"/></svg>
            Prev day
          </button>
          <span className={styles.weekNavLabel}>{dayDateLabel}</span>
          <button className={styles.actionBtn} onClick={() => shiftDay(1)}>
            Next day
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14"><path d="M6 3l5 5-5 5"/></svg>
          </button>
        </div>
        <div className={styles.scheduleGrid}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2.5 5.5h11M5.5 2.5v2M10.5 2.5v2M3 2.5h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1v-9a1 1 0 011-1z"/>
              </svg>
              <span className={styles.cardTitle}>{isSelectedToday ? "Today's timetable" : 'Timetable'}</span>
              <span className={styles.cardSub}>{dayBookings.length} booked / {dailyCapacity} capacity</span>
            </div>
            {dayLoading ? (
              <div className={`${styles.slotEvent} ${styles.empty}`} style={{ margin: '16px 20px' }}>Loading…</div>
            ) : dayTimetable.length === 0 ? (
              <div className={`${styles.slotEvent} ${styles.empty}`} style={{ margin: '16px 20px' }}>
                {dayFetched ? 'No appointments for this day' : ''}
              </div>
            ) : dayTimetable.map(slot => (
              <div key={slot.time} className={styles.timeSlotRow}>
                <div className={styles.timeCol}>{slot.time}</div>
                <div className={styles.slotEvents}>
                  {slot.events.map((e, i) => (
                    <div key={i} className={`${styles.slotEvent} ${styles[e.status as keyof typeof styles]}`}>
                      {e.name}{e.status === 'done' ? ' ✓' : e.status === 'current' ? ' · In session' : ''}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className={styles.card} style={{ marginBottom: 16 }}>
              <div className={styles.cardHeader}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/>
                </svg>
                <span className={styles.cardTitle}>Break time</span>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 16, fontSize: 13 }}><span style={{ color: 'var(--muted)', width: 80 }}>Lunch</span><span>1:00 PM – 2:00 PM</span></div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13 }}><span style={{ color: 'var(--muted)', width: 80 }}>Evening</span><span>5:00 PM – 6:00 PM</span></div>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1.5" y="8.5" width="3" height="6" rx="1"/><rect x="6.5" y="5.5" width="3" height="9" rx="1"/><rect x="11.5" y="2.5" width="3" height="12" rx="1"/>
                </svg>
                <span className={styles.cardTitle}>Slot fill</span>
                <span className={styles.cardSub}>{dayDateLabel}</span>
              </div>
              {slotFill.length === 0
                ? <div className={`${styles.slotEvent} ${styles.empty}`} style={{ margin: '16px 20px' }}>No bookings</div>
                : <SlotBars data={slotFill} />}
            </div>
          </div>
        </div>
        </>
      )}

      {/* ══ WEEK VIEW (time-grid) ══════════════════════════════════════════ */}
      {view === 'week' && (
        <>
          <div className={styles.weekNav}>
            <button className={styles.actionBtn} onClick={() => setWeekOffset(o => o - 1)}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14"><path d="M10 3L5 8l5 5"/></svg>
              Prev week
            </button>
            <span className={styles.weekNavLabel}>{weekLabel}</span>
            <button className={styles.actionBtn} onClick={() => setWeekOffset(o => o + 1)}>
              Next week
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14"><path d="M6 3l5 5-5 5"/></svg>
            </button>
          </div>

          <div className={styles.calWrap}>
            <div className={styles.calHeaderRow}>
              <div className={styles.calTimeGutter} />
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, today);
                const count   = bookingsForDay(day).length;
                const pct     = count / dailyCapacity;
                const isSun   = day.getDay() === 0;
                return (
                  <div key={i}
                    className={`${styles.calDayHeader} ${isToday ? styles.calTodayHeader : ''} ${isSun ? styles.calSunHeader : ''}`}
                  >
                    <div className={styles.calDayName}>{DAY_NAMES[i]}</div>
                    <div className={`${styles.calDayNum} ${isToday ? styles.calTodayCircle : ''}`}>{day.getDate()}</div>
                    <div className={styles.calDots}>
                      {Array.from({ length: Math.min(count, 5) }).map((_, j) => (
                        <div key={j} className={`${styles.calDot} ${pct >= 1 ? styles.calDotFull : ''}`} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={styles.calBodyWrap}>
              <div className={styles.calTimeCol}>
                {TIME_LABELS.map((label, i) => (
                  <div key={i} className={styles.calTimeLabel} style={{ height: ROW_H }}>{label}</div>
                ))}
              </div>

              {weekDays.map((day, di) => {
                const isToday     = isSameDay(day, today);
                const isSun       = day.getDay() === 0;
                const dayBookings = bookingsForDay(day);
                return (
                  <div key={di}
                    className={`${styles.calDayCol} ${isToday ? styles.calTodayCol : ''} ${isSun ? styles.calSundayCol : ''}`}
                    style={{ height: gridH }}
                    onClick={() => setAddOpen(true)}
                  >
                    {TIME_LABELS.map((_, ri) => (
                      <div key={ri}
                        className={`${styles.calGridLine} ${ri % 2 === 0 ? styles.calGridHour : ''}`}
                        style={{ top: ri * ROW_H, height: ROW_H }}
                      />
                    ))}

                    <div className={styles.calBreakBlock} style={{
                      top:    ((13 * 60 - GRID_START) / 30) * ROW_H,
                      height: (60 / 30) * ROW_H,
                    }}>Lunch break</div>

                    {dayBookings.map(b => {
                      const mins = bookingMinutes(b);
                      if (mins < GRID_START || mins >= GRID_END) return null;
                      const top       = ((mins - GRID_START) / 30) * ROW_H;
                      const isCurrent = b.status === 'current' || b.status === 'in_session';
                      return (
                        <div key={b.id}
                          className={`${styles.calEvent} ${isCurrent ? styles.calEventBright : ''}`}
                          style={{ top, height: ROW_H - 4 }}
                          onClick={e => {
                            e.stopPropagation();
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setPopover({ booking: b, x: r.right + 8, y: r.top });
                          }}
                        >
                          <div className={styles.calEventName}>{patientName(b)}</div>
                          <div className={styles.calEventStatus}>{statusLabel(b.status)}</div>
                        </div>
                      );
                    })}

                    {isSun && <div className={styles.calClosedOverlay}>Closed</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ══ MONTH VIEW ════════════════════════════════════════════════════ */}
      {view === 'month' && (
        <>
          {/* Nav — both buttons identical structure: icon · label */}
          <div className={styles.weekNav}>
            <button className={styles.actionBtn} onClick={() => setMonthOffset(o => o - 1)}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14"><path d="M10 3L5 8l5 5"/></svg>
              Prev month
            </button>
            <span className={styles.weekNavLabel}>{monthLabel}</span>
            <button className={styles.actionBtn} onClick={() => setMonthOffset(o => o + 1)}>
              Next month
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14"><path d="M6 3l5 5-5 5"/></svg>
            </button>
          </div>

          {/* Day-of-week header */}
          <div className={styles.monthDowHeader}>
            {DAY_NAMES.map(d => <div key={d} className={styles.monthDowCell}>{d}</div>)}
          </div>

          {/* Calendar grid + empty-state wrapper */}
          <div className={styles.monthGridWrap}>
            <div className={styles.monthGrid}>
              {monthCal.map((week, wi) => week.map(({ date, inMonth }) => {
                const isToday = isSameDay(date, today);
                const isSun   = date.getDay() === 0;
                const count   = countForDay(date);
                const pct     = count / dailyCapacity;

                return (
                  <div
                    key={`${wi}-${date.getTime()}`}
                    className={[
                      styles.monthCell,
                      !inMonth     ? styles.monthCellOther : '',
                      isToday      ? styles.monthCellToday : '',
                      isSun        ? styles.monthCellSun   : '',
                      monthLoading ? styles.monthCellSkel  : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => inMonth && navigateToDay(date)}
                  >
                    {/* Date number + booking count badge */}
                    <div className={styles.monthCellTop}>
                      <div className={`${styles.monthCellNum} ${isToday ? styles.monthTodayNum : ''}`}>
                        {date.getDate()}
                      </div>
                      {!monthLoading && inMonth && count > 0 && (
                        <div className={styles.monthCellBadge}>{count}</div>
                      )}
                    </div>

                    {/* Mini fill bar */}
                    {!monthLoading && inMonth && count > 0 && (
                      <div className={styles.monthMiniTrack}>
                        <div className={styles.monthMiniFill} style={{
                          width: `${Math.min(Math.round(pct * 100), 100)}%`,
                          background: barColor(pct),
                        }} />
                      </div>
                    )}
                  </div>
                );
              }))}
            </div>

            {/* Empty state — sibling of grid, not a grid child */}
            {monthFetched && !monthLoading && totalMonthBookings === 0 && (
              <div className={styles.monthEmpty}>No appointments this month</div>
            )}
          </div>
        </>
      )}

      {/* ── Event popover ─────────────────────────────────────────────── */}
      {popover && (
        <div ref={popoverRef} className={styles.calPopover}
          style={{
            left: Math.min(popover.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 240),
            top:  popover.y,
          }}
        >
          <button className={styles.calPopoverClose} onClick={() => setPopover(null)}>✕</button>
          <div className={styles.calPopoverName}>{patientName(popover.booking)}</div>
          {popover.booking.token_number != null && (
            <div className={styles.calPopoverRow}><span>Token</span><span>#{popover.booking.token_number}</span></div>
          )}
          {popover.booking.phone && (
            <div className={styles.calPopoverRow}><span>Phone</span><span>{popover.booking.phone}</span></div>
          )}
          <div className={styles.calPopoverRow}>
            <span>Status</span>
            <span className={styles.calPopoverStatus}>{statusLabel(popover.booking.status)}</span>
          </div>
        </div>
      )}

      {/* ── Add Patient modal ─────────────────────────────────────────── */}
      {addOpen && (
        <div className={`${styles.modalOverlay} ${styles.open}`}
          onClick={e => { if (e.target === e.currentTarget) setAddOpen(false); }}
        >
          <div className={styles.modalBox} style={{ textAlign: 'left' }}>
            <button className={styles.modalClose} onClick={() => setAddOpen(false)}>✕</button>
            <div className={styles.modalTitle}>Add Patient</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Patient name</div>
                <input className={styles.settingsInput} style={{ width: '100%' }} placeholder="Full name"
                  value={newPatient.name} onChange={e => setNewPatient(p => ({ ...p, name: e.target.value }))} autoFocus />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Phone</div>
                <input className={styles.settingsInput} style={{ width: '100%' }} placeholder="+91 ..."
                  value={newPatient.phone} onChange={e => setNewPatient(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className={styles.actionBtn} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setAddOpen(false)}>Cancel</button>
              <button className={`${styles.actionBtn} ${styles.primary}`} style={{ flex: 1, justifyContent: 'center' }} onClick={handleAddPatient}>Add patient</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manage Slots modal (day view) ─────────────────────────────── */}
      {view === 'day' && (
        <div className={`${styles.modalOverlay} ${slotsOpen ? styles.open : ''}`}
          onClick={e => { if (e.target === e.currentTarget) setSlotsOpen(false); }}
        >
          <div className={styles.modalBox} style={{ width: 480, textAlign: 'left', maxHeight: '80vh', overflowY: 'auto' }}>
            <button className={styles.modalClose} onClick={() => setSlotsOpen(false)}>✕</button>
            <div className={styles.modalTitle}>Manage Slots</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Adjust capacity and block time slots for today.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 56px', gap: 8, fontSize: 11, color: 'var(--muted)', padding: '0 4px', marginBottom: 6 }}>
              <span>Time</span><span style={{ textAlign: 'center' }}>Capacity</span><span style={{ textAlign: 'center' }}>Booked</span><span style={{ textAlign: 'center' }}>Block</span>
            </div>
            {slotConfig.map((slot, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 56px', gap: 8, alignItems: 'center', padding: '10px 4px', borderTop: '1px solid var(--border2)', opacity: slot.blocked ? 0.45 : 1, transition: 'opacity 0.15s' }}>
                <span style={{ fontSize: 13 }}>{slot.label}</span>
                <input type="number" min={slot.booked} max={99} value={slot.total} disabled={slot.blocked}
                  onChange={e => setSlotConfig(prev => prev.map((s, j) => j === i ? { ...s, total: Math.max(s.booked, Number(e.target.value) || s.booked) } : s))}
                  className={styles.settingsInput} style={{ width: '100%', textAlign: 'center', padding: '6px 8px' }} />
                <span style={{ fontSize: 13, textAlign: 'center', color: 'var(--muted)' }}>{slot.booked}</span>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div className={`${styles.toggle} ${slot.blocked ? styles.on : ''}`}
                    style={slot.blocked ? { background: 'var(--red, #e5534b)' } : {}}
                    onClick={() => setSlotConfig(prev => prev.map((s, j) => j === i ? { ...s, blocked: !s.blocked } : s))} />
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border2)', alignItems: 'center' }}>
              <input type="text" placeholder="Add slot, e.g. 3–4 PM" value={newSlotTime}
                onChange={e => setNewSlotTime(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newSlotTime.trim()) {
                    setSlotConfig(prev => [...prev, { label: newSlotTime.trim(), booked: 0, total: 4, blocked: false }]);
                    setNewSlotTime('');
                  }
                }}
                className={styles.settingsInput} style={{ flex: 1 }} />
              <button className={styles.actionBtn} onClick={() => {
                if (!newSlotTime.trim()) return;
                setSlotConfig(prev => [...prev, { label: newSlotTime.trim(), booked: 0, total: 4, blocked: false }]);
                setNewSlotTime('');
              }}>+ Add</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className={styles.actionBtn} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setSlotsOpen(false)}>Cancel</button>
              <button className={`${styles.actionBtn} ${styles.primary}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setSlotsOpen(false)}>Save changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense>
      <ScheduleContent />
    </Suspense>
  );
}
