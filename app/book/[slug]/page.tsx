'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';

type BookStep = 1 | 2 | 3 | 'success';

interface ClinicData {
  name?: string; spec?: string; qual?: string; clinic?: string;
  addr?: string; slotDuration?: string; days?: string[];
}

const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const SLOT_DATA: Record<number, { time: string; booked: boolean }[]> = {
  0: [
    { time: '09:00 AM', booked: true }, { time: '09:15 AM', booked: true },
    { time: '09:30 AM', booked: true }, { time: '09:45 AM', booked: false },
    { time: '10:00 AM', booked: false }, { time: '10:15 AM', booked: false },
    { time: '10:30 AM', booked: false }, { time: '10:45 AM', booked: false },
    { time: '11:00 AM', booked: false }, { time: '11:15 AM', booked: true },
    { time: '11:30 AM', booked: false }, { time: '12:00 PM', booked: false },
  ],
  1: [
    { time: '09:00 AM', booked: false }, { time: '09:15 AM', booked: false },
    { time: '09:30 AM', booked: false }, { time: '09:45 AM', booked: false },
    { time: '10:00 AM', booked: false }, { time: '10:15 AM', booked: true },
    { time: '10:30 AM', booked: false }, { time: '11:00 AM', booked: false },
  ],
  2: [
    { time: '09:00 AM', booked: false }, { time: '09:30 AM', booked: false },
    { time: '10:00 AM', booked: false }, { time: '10:30 AM', booked: false },
    { time: '11:00 AM', booked: true },  { time: '11:30 AM', booked: false },
  ],
  3: [],
  4: [
    { time: '09:00 AM', booked: false }, { time: '09:30 AM', booked: false },
    { time: '10:00 AM', booked: false }, { time: '11:00 AM', booked: false },
  ],
  5: [
    { time: '09:00 AM', booked: false }, { time: '09:30 AM', booked: false },
    { time: '10:00 AM', booked: false },
  ],
};

function tok(n: number) { return `#${String(n).padStart(2, '0')}`; }

export default function BookPage() {
  const [step, setStep] = useState<BookStep>(1);
  const [clinic, setClinic] = useState<ClinicData>({});
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
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
  const otpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dates = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem('qtokenClinic') || 'null');
      if (data) {
        setClinic(data);
        if (data.name) document.title = `QToken — Book with ${data.name}`;
      } else {
        document.title = 'QToken — Book Appointment';
      }
    } catch {
      document.title = 'QToken — Book Appointment';
    }
  }, []);

  function selectDate(idx: number, date: Date) {
    setSelectedDateIdx(idx);
    setSelectedDate(date);
    setSelectedSlot(null);
    setTokenNumber(0);
  }

  function selectSlot(time: string, slotIdx: number, dayIdx: number) {
    const slots = SLOT_DATA[dayIdx] || [];
    if (slots[slotIdx]?.booked) return;
    setSelectedSlot(time);
    const bookedCount = slots.filter(s => s.booked).length;
    const freeSlots = slots.filter(s => !s.booked);
    const pos = freeSlots.findIndex(s => s.time === time) + 1;
    setTokenNumber(bookedCount + pos);
  }

  function sendOTP() {
    if (patientPhone.length !== 10) { alert('Enter a valid 10-digit number first'); return; }
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
      alert('Please fill name and valid 10-digit mobile');
      return;
    }
    if (!otpVerified) {
      alert('Please verify your mobile number via OTP');
      return;
    }
    setStep(3);
  }

  function confirmBooking() {
    const dateStr = `${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]} — ${selectedSlot}`;
    setFinalDateTime(dateStr);
    setFinalToken(tok(tokenNumber));
    setStep('success');
    animateCountUp(tokenNumber);
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

  const hdrSpec = [clinic.spec, clinic.qual].filter(Boolean).join(' · ') || 'General Physician · MBBS, MD';
  const hdrDays = clinic.days && clinic.days.length ? `${clinic.days[0]} – ${clinic.days[clinic.days.length - 1]}` : 'Mon – Sat';
  const hdrAddr = clinic.addr ? (clinic.addr.split(',').pop()?.trim() || clinic.addr) : 'Koramangala';
  const confirmDoctor = clinic.name || 'Dr. Meera Nair';
  const successClinic = [clinic.clinic, clinic.addr?.split(',').pop()?.trim()].filter(Boolean).join(', ') || 'Nair Healthcare, Koramangala';

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.clinicBadge}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 1.5a4 4 0 100 8 4 4 0 000-8z"/><path d="M2 14.5c0-2.21 2.686-4 6-4s6 1.79 6 4"/>
          </svg>
          <span>{clinic.clinic || 'Nair Healthcare Clinic'}</span>
        </div>
        <div className={styles.doctorName}>{clinic.name || 'Dr. Meera Nair'}</div>
        <div className={styles.doctorSpec}>{hdrSpec}</div>
        <div className={styles.headerMeta}>
          <div className={styles.metaPill}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l2.5 1.5"/></svg>
            Slot: {clinic.slotDuration || '15'} min
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
                  {dates.map((d, i) => (
                    <div
                      key={i}
                      className={`${styles.dateChip} ${i === 0 ? styles.today : ''} ${selectedDateIdx === i ? styles.active : ''}`}
                      onClick={() => selectDate(i, d)}
                    >
                      <span className={styles.dayName}>{i === 0 ? 'Today' : DAYS_SHORT[d.getDay()]}</span>
                      <span className={styles.dayNum}>{d.getDate()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.divider}></div>

              <div className={styles.section}>
                <div className={styles.sectionLabel}>
                  Available slots — {selectedDateIdx === 0 ? 'Today' : `${DAYS_SHORT[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}`}
                </div>
                {(SLOT_DATA[selectedDateIdx] || []).length === 0 ? (
                  <div style={{textAlign:'center',padding:'32px 0',color:'var(--muted)',fontSize:14}}>No slots available this day</div>
                ) : (
                  <div className={styles.slotsGrid}>
                    {(SLOT_DATA[selectedDateIdx] || []).map((s, i) => (
                      <div
                        key={s.time}
                        className={`${styles.slotChip} ${s.booked ? styles.booked : ''} ${selectedSlot === s.time ? styles.selected : ''}`}
                        onClick={() => selectSlot(s.time, i, selectedDateIdx)}
                      >
                        <span className={styles.slotTime}>{s.time}</span>
                        <span className={styles.slotAvail}>{s.booked ? 'Full' : 'Available'}</span>
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
                <div className={styles.tokenLabel}>Estimated wait: ~{(tokenNumber - 1) * 15} min</div>
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
