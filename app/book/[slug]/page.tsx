'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import styles from './page.module.css';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

type BookStep = 1 | 2 | 3 | 'success';

interface ClinicData {
  name?: string;
  spec?: string;
  qual?: string;
  clinic?: string;
  addr?: string;
  slotDuration?: number;
  maxPatients?: number;
  days?: string[];
  hours?: { mStart?: string; mEnd?: string; eStart?: string; eEnd?: string };
}

interface SlotInfo {
  time: string;       // 12h display: "09:00 AM"
  time24: string;     // 24h DB key:  "09:00"
  period: 'morning' | 'evening';
  bookingCount: number;
  full: boolean;
  slotId: string | null;
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function tok(n: number) { return `#${String(n).padStart(2, '0')}`; }

function to12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

function generateTimeSlots(start: string, end: string, durationMin: number): string[] {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startTotal = sh * 60 + sm;
  const endTotal = eh * 60 + em;
  const times: string[] = [];
  for (let t = startTotal; t < endTotal; t += durationMin) {
    const h = Math.floor(t / 60);
    const mn = t % 60;
    times.push(`${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`);
  }
  return times;
}

function isWorkingDay(date: Date, workingDays: string[]): boolean {
  return workingDays.includes(DAY_ABBR[date.getDay()]);
}

// Build YYYY-MM-DD from local time (toISOString is UTC, wrong in IST)
function toLocalISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function BookPage() {
  const params = useParams();
  const urlSlug = params?.slug as string;
  const [step, setStep] = useState<BookStep>(1);
  const [clinic, setClinic] = useState<ClinicData>({});
  const [clinicId, setClinicId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedSlotTime24, setSelectedSlotTime24] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [tokenNumber, setTokenNumber] = useState(0);
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [mockOtp, setMockOtp] = useState('');
  const [otpStatus, setOtpStatus] = useState('');
  const [otpStatusColor, setOtpStatusColor] = useState('var(--teal)');
  const [otpBtnText, setOtpBtnText] = useState('Send OTP');
  const [otpBtnDisabled, setOtpBtnDisabled] = useState(false);
  const [otpToastVisible, setOtpToastVisible] = useState(false);
  const [displayedOtp, setDisplayedOtp] = useState('0000');
  const [successTokenDisplay, setSuccessTokenDisplay] = useState('#01');
  const [isCounting, setIsCounting] = useState(false);
  const [finalDateTime, setFinalDateTime] = useState('');
  const [finalToken, setFinalToken] = useState('');
  const [clinicNotFound, setClinicNotFound] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [realSlots, setRealSlots] = useState<SlotInfo[]>([]);
  const [noSchedule, setNoSchedule] = useState(false);
  const otpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  async function loadSlotsForDate(date: Date, cId: string, clinicData: ClinicData) {
    setSlotsLoading(true);
    setRealSlots([]);

    const hours = clinicData.hours;
    const duration = clinicData.slotDuration || 15;

    if (!hours?.mStart || !hours?.mEnd) {
      setNoSchedule(true);
      setSlotsLoading(false);
      return;
    }
    setNoSchedule(false);

    const morningTimes = generateTimeSlots(hours.mStart, hours.mEnd, duration);
    const eveningTimes = (hours.eStart && hours.eEnd)
      ? generateTimeSlots(hours.eStart, hours.eEnd, duration)
      : [];
    const allTimes = [...morningTimes, ...eveningTimes];

    const isoDate = toLocalISODate(date);

    // Fetch slot records for this clinic + date
    const { data: dbSlots } = await supabase
      .from('slots')
      .select('id, time, max_bookings')
      .eq('clinic_id', cId)
      .eq('date', isoDate);

    // Fetch booking counts per slot
    const slotIds = (dbSlots || []).map(s => s.id);
    const bookingCounts: Record<string, number> = {};
    if (slotIds.length > 0) {
      const { data: dbBookings } = await supabase
        .from('bookings')
        .select('slot_id')
        .in('slot_id', slotIds);
      (dbBookings || []).forEach(b => {
        if (b.slot_id) bookingCounts[b.slot_id] = (bookingCounts[b.slot_id] || 0) + 1;
      });
    }

    const slotMap: Record<string, { id: string; max_bookings: number }> = {};
    (dbSlots || []).forEach(s => { slotMap[s.time] = { id: s.id, max_bookings: s.max_bookings }; });

    const result: SlotInfo[] = allTimes.map(t24 => {
      const dbSlot = slotMap[t24];
      const bookingCount = dbSlot ? (bookingCounts[dbSlot.id] || 0) : 0;
      const maxBookings = dbSlot?.max_bookings ?? 1;
      return {
        time: to12h(t24),
        time24: t24,
        period: morningTimes.includes(t24) ? 'morning' : 'evening',
        bookingCount,
        full: bookingCount >= maxBookings,
        slotId: dbSlot?.id ?? null,
      };
    });

    setRealSlots(result);
    setSlotsLoading(false);
  }

  useEffect(() => {
    if (!urlSlug) return;
    supabase
      .from('clinics')
      .select('*')
      .eq('slug', urlSlug)
      .single()
      .then(({ data }) => {
        if (data) {
          const clinicData: ClinicData = {
            name: data.doctor_name,
            spec: data.spec,
            qual: data.qual,
            clinic: data.name,
            addr: data.address,
            slotDuration: data.slot_duration || 15,
            maxPatients: data.max_patients || 30,
            days: data.days || [],
            hours: data.hours || {},
          };
          setClinicId(data.id);
          setClinic(clinicData);
          if (data.doctor_name) document.title = `MyTurnApp — Book with ${data.doctor_name}`;

          // Select the first working day in the next 7 days
          const workingDays: string[] = data.days || [];
          let firstDate = new Date();
          for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            if (workingDays.includes(DAY_ABBR[d.getDay()])) {
              firstDate = d;
              break;
            }
          }
          setSelectedDate(firstDate);
          loadSlotsForDate(firstDate, data.id, clinicData);
        } else {
          setClinicNotFound(true);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSlug]);

  function selectDate(date: Date, working: boolean) {
    if (!working) return;
    setSelectedDate(date);
    setSelectedSlot(null);
    setSelectedSlotTime24(null);
    setSelectedSlotId(null);
    setTokenNumber(0);
    if (clinicId) loadSlotsForDate(date, clinicId, clinic);
  }

  function selectSlot(slot: SlotInfo) {
    if (slot.full) return;
    setSelectedSlot(slot.time);
    setSelectedSlotTime24(slot.time24);
    setSelectedSlotId(slot.slotId);
    setTokenNumber(slot.bookingCount + 1);
  }

  function sendOTP() {
    if (patientPhone.length !== 10) { toast.error('Enter a valid 10-digit number first'); return; }
    const otp = String(Math.floor(1000 + Math.random() * 9000));
    setMockOtp(otp);
    setDisplayedOtp(otp);
    setOtpBtnDisabled(true);
    setOtpStatus(`OTP sent to +91 ${patientPhone}`);
    setOtpStatusColor('var(--teal)');
    setOtpToastVisible(true);
    setTimeout(() => setOtpToastVisible(false), 5000);

    let seconds = 30;
    if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    otpTimerRef.current = setInterval(() => {
      seconds--;
      setOtpBtnText(`Resend (${seconds}s)`);
      if (seconds <= 0) {
        clearInterval(otpTimerRef.current!);
        setOtpBtnDisabled(false);
        setOtpBtnText('Resend OTP');
      }
    }, 1000);
  }

  useEffect(() => {
    if (otpInput && otpInput === mockOtp) {
      setOtpVerified(true);
      setOtpStatus('✓ Mobile verified');
      setOtpStatusColor('var(--green)');
    }
  }, [otpInput, mockOtp]);

  function goToStep2() {
    if (!selectedSlot) return;
    setStep(2);
  }

  function goToStep3() {
    if (!patientName.trim() || patientPhone.length !== 10) {
      toast.error('Please fill your name and a valid 10-digit mobile');
      return;
    }
    if (!otpVerified) {
      toast.error('Please verify your mobile number via OTP');
      return;
    }
    setStep(3);
  }

  async function confirmBooking() {
    const dateStr = `${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]} — ${selectedSlot}`;
    setFinalDateTime(dateStr);

    let assignedToken = tokenNumber;
    try {
      const isoDate = toLocalISODate(selectedDate);
      const slotTime = selectedSlotTime24 ?? selectedSlot ?? '';

      // Upsert the slot record (creates it if it doesn't exist yet)
      const { data: slot } = await supabase
        .from('slots')
        .upsert(
          { clinic_id: clinicId, date: isoDate, time: slotTime, max_bookings: 1 },
          { onConflict: 'clinic_id,date,time' }
        )
        .select()
        .single();

      // Server-side token assignment: highest existing token + 1
      const { data: maxRow } = await supabase
        .from('bookings')
        .select('token_number')
        .eq('clinic_id', clinicId)
        .order('token_number', { ascending: false })
        .limit(1);

      assignedToken = maxRow && maxRow.length > 0 ? maxRow[0].token_number + 1 : 1;

      let res: Response;
      try {
        res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slot_id: selectedSlotId ?? slot?.id ?? null,
            clinic_id: clinicId,
            patient_name: patientName,
            patient_phone: patientPhone,
            token_number: assignedToken,
          }),
        });
      } catch {
        toast.error('Could not reach server. Please check your connection and try again.');
        return;
      }

      if (!res.ok) {
        let message = 'Booking failed. Please try again.';
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {}
        toast.error(message);
        return;
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
      return;
    }

    setFinalToken(tok(assignedToken));
    setStep('success');
    animateCountUp(assignedToken);
  }

  function animateCountUp(target: number) {
    setIsCounting(true);
    setSuccessTokenDisplay('#01');
    let current = 1;
    const delay = Math.max(40, Math.floor(400 / target));
    const iv = setInterval(() => {
      current++;
      setSuccessTokenDisplay(tok(current));
      if (current >= target) {
        clearInterval(iv);
        setIsCounting(false);
      }
    }, delay);
  }

  function shareWhatsApp() {
    const tokenStr = tok(tokenNumber);
    const docName = clinic.name || 'the doctor';
    const clinicStr = [clinic.clinic, clinic.addr?.split(',').pop()?.trim()].filter(Boolean).join(', ') || 'the clinic';
    const msg = `Your appointment is confirmed!\n\nDoctor: ${docName}\nDate: ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}\nTime: ${selectedSlot}\nToken: ${tokenStr}\n\n${clinicStr}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  }

  const ctaDisabled = step === 1 ? !selectedSlot : step === 2 ? (!patientName.trim() || patientPhone.length !== 10) : false;
  const ctaText = step === 1
    ? (selectedSlot ? `Continue with ${selectedSlot}` : 'Select a slot to continue')
    : step === 2 ? (otpVerified ? 'Review booking' : 'Verify OTP to continue')
    : 'Confirm booking';

  function handleCTA() {
    if (step === 1) goToStep2();
    else if (step === 2) goToStep3();
    else if (step === 3) confirmBooking();
  }

  if (clinicNotFound) {
    return (
      <div className={styles.page} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 56, fontWeight: 700, color: 'var(--muted)' }}>404</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>Clinic not found</div>
        <div style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 320 }}>
          The booking link you followed does not match any registered clinic.
        </div>
        <a href="/" style={{ marginTop: 8, color: 'var(--teal)', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>
          ← Back to MyTurnApp
        </a>
      </div>
    );
  }

  const hdrSpec = [clinic.spec, clinic.qual].filter(Boolean).join(' · ') || 'General Physician · MBBS, MD';
  const hdrDays = clinic.days && clinic.days.length ? `${clinic.days[0]} – ${clinic.days[clinic.days.length - 1]}` : 'Mon – Sat';
  const hdrAddr = clinic.addr ? (clinic.addr.split(',').pop()?.trim() || clinic.addr) : '';
  const confirmDoctor = clinic.name || '';
  const successClinic = [clinic.clinic, clinic.addr?.split(',').pop()?.trim()].filter(Boolean).join(', ');
  const slotDuration = clinic.slotDuration || 15;
  const isToday = (d: Date) => d.toDateString() === dates[0].toDateString();

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.clinicBadge}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 1.5a4 4 0 100 8 4 4 0 000-8z"/><path d="M2 14.5c0-2.21 2.686-4 6-4s6 1.79 6 4"/>
          </svg>
          <span>{clinic.clinic}</span>
        </div>
        <div className={styles.doctorName}>{clinic.name}</div>
        <div className={styles.doctorSpec}>{hdrSpec}</div>
        <div className={styles.headerMeta}>
          <div className={styles.metaPill}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l2.5 1.5"/></svg>
            Slot: {slotDuration} min
          </div>
          <div className={styles.metaPill}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 5.5h11M5.5 2.5v2M10.5 2.5v2M3 2.5h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1v-9a1 1 0 011-1z"/></svg>
            {hdrDays}
          </div>
          <div className={styles.metaPill}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 14s-5.5-4.5-5.5-8a5.5 5.5 0 0111 0c0 3.5-5.5 8-5.5 8z"/><circle cx="8" cy="6" r="1.5"/></svg>
            {hdrAddr}
          </div>
        </div>
      </div>

      {step !== 'success' && (
        <>
          {/* Steps bar */}
          <div className={styles.stepsBar}>
            <div className={`${styles.stepDot} ${step === 1 ? styles.active : styles.done}`}>{step === 1 ? '1' : '✓'}</div>
            <div className={`${styles.stepLine} ${step > 1 ? styles.done : ''}`}></div>
            <div className={`${styles.stepDot} ${step === 2 ? styles.active : step > 2 ? styles.done : ''}`}>{step === 2 ? '2' : step > 2 ? '✓' : '2'}</div>
            <div className={`${styles.stepLine} ${step > 2 ? styles.done : ''}`}></div>
            <div className={`${styles.stepDot} ${step === 3 ? styles.active : ''}`}>3</div>
          </div>

          {/* Step 1 — Date + Slot */}
          {step === 1 && (
            <div>
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Select date</div>
                <div className={styles.dateStrip}>
                  {dates.map((d, i) => {
                    const working = isWorkingDay(d, clinic.days || []);
                    const active = selectedDate.toDateString() === d.toDateString();
                    return (
                      <div
                        key={i}
                        className={`${styles.dateChip} ${isToday(d) ? styles.today : ''} ${active ? styles.active : ''} ${!working ? styles.closed : ''}`}
                        onClick={() => selectDate(d, working)}
                      >
                        <span className={styles.dayName}>{isToday(d) ? 'Today' : DAY_ABBR[d.getDay()]}</span>
                        <span className={styles.dayNum}>{d.getDate()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={styles.divider}></div>

              <div className={styles.section}>
                <div className={styles.sectionLabel}>
                  Available slots — {isToday(selectedDate) ? 'Today' : `${DAY_ABBR[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}`}
                </div>
                {slotsLoading ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 14 }}>
                    Loading available slots…
                  </div>
                ) : noSchedule ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 14 }}>
                    This clinic hasn&apos;t set up their schedule yet
                  </div>
                ) : !isWorkingDay(selectedDate, clinic.days || []) ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 14 }}>
                    Clinic is closed on this day
                  </div>
                ) : realSlots.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 14 }}>
                    No slots available this day
                  </div>
                ) : (
                  <div className={styles.slotsGrid}>
                    {realSlots.map(s => (
                      <div
                        key={s.time24}
                        className={`${styles.slotChip} ${s.full ? styles.booked : ''} ${selectedSlot === s.time ? styles.selected : ''}`}
                        onClick={() => selectSlot(s)}
                      >
                        <span className={styles.slotTime}>{s.time}</span>
                        <span className={styles.slotAvail}>{s.full ? 'Full' : 'Available'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2 — Patient details */}
          {step === 2 && (
            <div className={`${styles.section} ${styles.anim}`}>
              <div className={styles.sectionLabel}>Your details</div>
              <div className={styles.formCard}>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Full name</label>
                  <input className={styles.formInput} type="text" placeholder="Enter your name" autoComplete="name" value={patientName} onChange={e => setPatientName(e.target.value)} />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Age</label>
                  <input className={styles.formInput} type="number" placeholder="e.g. 32" min={1} max={110} style={{maxWidth:120}} value={patientAge} onChange={e => setPatientAge(e.target.value)} />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Mobile number</label>
                  <div className={styles.phoneRow}>
                    <input className={`${styles.formInput} ${styles.countryCode}`} value="+91" readOnly />
                    <input className={styles.formInput} type="tel" placeholder="98765 43210" maxLength={10} inputMode="numeric" value={patientPhone} onChange={e => setPatientPhone(e.target.value.replace(/\D/g,'').slice(0,10))} />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>OTP verification</label>
                  <div className={styles.otpRow}>
                    <input className={styles.formInput} type="text" placeholder="• • • •" maxLength={4} inputMode="numeric" value={otpInput} onChange={e => setOtpInput(e.target.value)} />
                    <button className={styles.sendOtpBtn} onClick={sendOTP} disabled={otpBtnDisabled}>{otpBtnText}</button>
                  </div>
                  {otpStatus && <div style={{fontSize:12,color:otpStatusColor,marginTop:6}}>{otpStatus}</div>}
                </div>
              </div>

              <div style={{marginTop:16,padding:'14px 16px',background:'var(--teal-light)',borderRadius:'var(--radius-sm)',border:'1px solid rgba(13,115,119,0.15)',display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:40,height:40,background:'var(--teal)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l2.5 1.5"/></svg>
                </div>
                <div>
                  <div style={{fontSize:13,fontWeight:500,color:'var(--teal)'}}>{selectedSlot}</div>
                  <div style={{fontSize:12,color:'var(--muted)'}}>{selectedDate.getDate()} {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}</div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Confirm */}
          {step === 3 && (
            <div className={`${styles.section} ${styles.anim}`}>
              <div className={styles.sectionLabel}>Confirm booking</div>
              <div className={styles.formCard} style={{textAlign:'center',padding:'28px 20px'}}>
                <div style={{fontSize:13,color:'var(--muted)',marginBottom:4}}>Your token number</div>
                <span className={styles.tokenBig}>{tok(tokenNumber)}</span>
                <div className={styles.tokenLabel}>Estimated wait: ~{(tokenNumber - 1) * slotDuration} min</div>
              </div>
              <div className={styles.formCard} style={{marginTop:14}}>
                {[
                  ['Doctor', confirmDoctor],
                  ['Date', `${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`],
                  ['Time slot', selectedSlot ?? ''],
                  ['Patient', patientName + (patientAge ? `, ${patientAge} yrs` : '')],
                  ['Mobile', `+91 ${patientPhone}`],
                ].map(([label, val]) => (
                  <div key={label} className={styles.confirmRow}>
                    <span className="label" style={{color:'var(--muted)'}}>{label}</span>
                    <span className="val" style={{fontWeight:500}}>{val}</span>
                  </div>
                ))}
              </div>
              <div style={{marginTop:12,padding:'12px 14px',background:'var(--amber-light)',borderRadius:'var(--radius-sm)',fontSize:13,color:'var(--amber)',display:'flex',gap:8,alignItems:'flex-start'}}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{flexShrink:0,marginTop:1}}><circle cx="8" cy="8" r="6.5"/><path d="M8 5v3M8 10.5v.5"/></svg>
                Please arrive 5 mins before your slot. Bring any previous prescriptions.
              </div>
            </div>
          )}

          {/* CTA bar */}
          <div className={styles.ctaBar}>
            <button className={styles.ctaBtn} onClick={handleCTA} disabled={ctaDisabled}>
              <span>{ctaText}</span>
              {!ctaDisabled && step !== 2 && (
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M4 10h12M10 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </div>
        </>
      )}

      {/* Success screen */}
      {step === 'success' && (
        <div className={styles.successScreen}>
          <div className={styles.successIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <div style={{fontSize:13,color:'var(--muted)',letterSpacing:1,textTransform:'uppercase',marginBottom:4}}>Booking confirmed</div>
          <div className={`${styles.successToken} ${isCounting ? styles.counting : ''}`}>{successTokenDisplay}</div>
          <div className={styles.successTitle}>You&apos;re all set!</div>
          <div className={styles.successSub}>A confirmation has been sent to your WhatsApp. Show token number at the clinic.</div>

          <div className={styles.successCard}>
            {[
              ['Doctor', confirmDoctor],
              ['Date & time', finalDateTime],
              ['Token', finalToken],
              ['Clinic', successClinic],
            ].map(([key, val]) => (
              <div key={key} className={styles.successRow}>
                <span className="key" style={{color:'var(--muted)'}}>{key}</span>
                <span className="val" style={{fontWeight:500}}>{val}</span>
              </div>
            ))}
          </div>

          <button className={styles.whatsappBtn} onClick={shareWhatsApp}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Share on WhatsApp
          </button>
        </div>
      )}

      {/* OTP Toast */}
      <div className={`${styles.otpToast} ${otpToastVisible ? styles.show : ''}`}>
        Demo OTP:<span className={styles.otpCode}>{displayedOtp}</span>
      </div>
    </div>
  );
}
