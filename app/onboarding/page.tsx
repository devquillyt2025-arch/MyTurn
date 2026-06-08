'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import styles from './page.module.css';

type Step = 1 | 2 | 3;

interface FormState {
  docName: string;
  docSpec: string;
  clinicName: string;
  docQual: string;
  clinicAddr: string;
  docPhone: string;
  docFee: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DURATIONS = ['10', '15', '20', '30'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<FormState>({
    docName: '', docSpec: '', clinicName: '', docQual: '',
    clinicAddr: '', docPhone: '', docFee: ''
  });
  const [errors, setErrors] = useState({
    docName: false, docSpec: false, clinicName: false, docPhone: false, days: false
  });
  const [selectedDays, setSelectedDays] = useState(['Mon','Tue','Wed','Thu','Fri','Sat']);
  const [duration, setDuration] = useState('15');
  const [morningStart, setMorningStart] = useState('09:00');
  const [morningEnd, setMorningEnd] = useState('13:00');
  const [eveningStart, setEveningStart] = useState('17:00');
  const [eveningEnd, setEveningEnd] = useState('20:00');
  const [maxPatients, setMaxPatients] = useState('30');
  const [slug, setSlug] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');

  useEffect(() => {
    setMounted(true);
    document.title = 'QToken — Register Your Clinic';
  }, []);

  function setField(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field in errors) setErrors(prev => ({ ...prev, [field]: false }));
  }

  function toggleDay(day: string) {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
    setErrors(prev => ({ ...prev, days: false }));
  }

  function validateStep1() {
    const e = {
      docName: !form.docName.trim(),
      docSpec: !form.docSpec,
      clinicName: !form.clinicName.trim(),
      docPhone: !form.docPhone.trim() || !/^\d{10}$/.test(form.docPhone.replace(/\s/g, '')),
    };
    setErrors(prev => ({ ...prev, ...e }));
    return !Object.values(e).some(Boolean);
  }

  function validateStep2() {
    if (selectedDays.length === 0) {
      setErrors(prev => ({ ...prev, days: true }));
      return false;
    }
    return true;
  }

  function goStep(next: Step) {
    if (step === 1 && next === 2 && !validateStep1()) return;
    if (step === 2 && next === 3 && !validateStep2()) return;

    if (next === 3) {
      const generatedSlug = form.docName.toLowerCase().replace(/^dr\.?\s*/i, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'your-clinic';
      setSlug(generatedSlug);
      const url = mounted ? `${window.location.origin}/book/${generatedSlug}` : `/book/${generatedSlug}`;
      setBookingUrl(url);
      const clinicData = {
        name: form.docName, spec: form.docSpec, clinic: form.clinicName,
        qual: form.docQual, addr: form.clinicAddr, phone: form.docPhone, fee: form.docFee,
        slug: generatedSlug, maxPatients, slotDuration: duration, days: selectedDays,
        hours: { mStart: morningStart, mEnd: morningEnd, eStart: eveningStart, eEnd: eveningEnd }
      };
      localStorage.setItem('qtokenClinic', JSON.stringify(clinicData));
    }

    setStep(next);
    window.scrollTo(0, 0);
  }

  function stepCls(n: number) {
    if (n < step) return `${styles.progStep} ${styles.done}`;
    if (n === step) return `${styles.progStep} ${styles.active}`;
    return styles.progStep;
  }

  return (
    <div className={styles.page}>
      {/* Left panel */}
      <div className={styles.leftPanel}>
        <div className={styles.brand}>QToken <span>/</span></div>
        <div className={styles.leftHeadline}>Replace paper tokens with a QR code</div>
        <div className={styles.leftSub}>Set up in 3 minutes. Patients scan, pick a slot, and show up on time — no counter queues, no manual tokens.</div>
        <div className={styles.featureList}>
          {[
            {
              icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="11" y="11" width="3" height="3" rx="0.5"/><path d="M9 11h1.5M9 13.5h1"/></svg>,
              title: 'One QR, all bookings',
              desc: 'Print and stick it anywhere — patients scan and self-book 24/7.'
            },
            {
              icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l2.5 1.5"/></svg>,
              title: 'Live queue dashboard',
              desc: "See who’s next, call token, skip or mark done — all from one screen."
            },
            {
              icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 13.5C3 11.015 5.239 9 8 9s5 2.015 5 4.5M8 7a3 3 0 100-6 3 3 0 000 6z"/></svg>,
              title: 'WhatsApp confirmations',
              desc: 'Patients get a token with slot time — they arrive on time, not early.'
            },
            {
              icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1.5" y="8.5" width="3" height="6" rx="1"/><rect x="6.5" y="5.5" width="3" height="9" rx="1"/><rect x="11.5" y="2.5" width="3" height="12" rx="1"/></svg>,
              title: 'Zero setup on patient side',
              desc: 'No app, no sign-up. Just scan and book in under a minute.'
            },
          ].map(f => (
            <div key={f.title} className={styles.featureItem}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <div className={styles.featureText}><strong>{f.title}</strong>{f.desc}</div>
            </div>
          ))}
        </div>
        <div className={styles.leftBottom}>© 2025 QToken · Made for Indian clinics</div>
      </div>

      {/* Right panel */}
      <div className={styles.rightPanel}>
        {/* Progress */}
        <div className={styles.progressSteps}>
          <div className={stepCls(1)}><div className={styles.progNum}>{step > 1 ? '✓' : '1'}</div>Clinic info</div>
          <div className={`${styles.progLine} ${step > 1 ? styles.done : ''}`}></div>
          <div className={stepCls(2)}><div className={styles.progNum}>{step > 2 ? '✓' : '2'}</div>Schedule</div>
          <div className={`${styles.progLine} ${step > 2 ? styles.done : ''}`}></div>
          <div className={stepCls(3)}><div className={styles.progNum}>3</div>Your QR</div>
        </div>

        {/* Step 1 — Clinic info */}
        {step === 1 && (
          <div>
            <div className={styles.formHeading}>Clinic details</div>
            <div className={styles.formSub}>This appears on the patient booking page.</div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Doctor name</label>
                <input
                  className={`${styles.formInput} ${errors.docName ? styles.error : ''}`}
                  type="text" placeholder="Dr. Full Name"
                  value={form.docName}
                  onChange={e => setField('docName', e.target.value)}
                />
                <span className={`${styles.errorMsg} ${errors.docName ? styles.visible : ''}`}>Doctor name is required</span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Specialization</label>
                <select
                  className={`${styles.formSelect} ${errors.docSpec ? styles.error : ''}`}
                  value={form.docSpec}
                  onChange={e => setField('docSpec', e.target.value)}
                >
                  <option value="">Select specialty</option>
                  {['General Physician','Paediatrician','Gynaecologist','Dermatologist','Orthopaedic','ENT Specialist','Cardiologist','Neurologist','Dentist','Ophthalmologist','Psychiatrist','Other'].map(s => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <span className={`${styles.errorMsg} ${errors.docSpec ? styles.visible : ''}`}>Please select a specialization</span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Clinic name</label>
                <input
                  className={`${styles.formInput} ${errors.clinicName ? styles.error : ''}`}
                  type="text" placeholder="e.g. Nair Healthcare"
                  value={form.clinicName}
                  onChange={e => setField('clinicName', e.target.value)}
                />
                <span className={`${styles.errorMsg} ${errors.clinicName ? styles.visible : ''}`}>Clinic name is required</span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Qualifications</label>
                <input
                  className={styles.formInput}
                  type="text" placeholder="e.g. MBBS, MD"
                  value={form.docQual}
                  onChange={e => setField('docQual', e.target.value)}
                />
              </div>
              <div className={`${styles.formGroup} ${styles.full}`}>
                <label className={styles.formLabel}>Clinic address</label>
                <input
                  className={styles.formInput}
                  type="text" placeholder="Street, Area, City"
                  value={form.clinicAddr}
                  onChange={e => setField('clinicAddr', e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Mobile / WhatsApp</label>
                <input
                  className={`${styles.formInput} ${errors.docPhone ? styles.error : ''}`}
                  type="tel" placeholder="10-digit number"
                  value={form.docPhone}
                  onChange={e => setField('docPhone', e.target.value)}
                />
                <span className={`${styles.errorMsg} ${errors.docPhone ? styles.visible : ''}`}>Enter a valid 10-digit mobile number</span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Consultation fee (₹)</label>
                <input
                  className={styles.formInput}
                  type="number" placeholder="e.g. 300"
                  value={form.docFee}
                  onChange={e => setField('docFee', e.target.value)}
                />
              </div>
            </div>
            <div className={styles.btnRow}>
              <button className={styles.btnNext} onClick={() => goStep(2)}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 2 — Schedule */}
        {step === 2 && (
          <div>
            <div className={styles.formHeading}>Set your schedule</div>
            <div className={styles.formSub}>Patients will only see slots within these hours.</div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Working days</label>
              <div className={styles.daysGroup}>
                {DAYS.map(day => (
                  <div
                    key={day}
                    className={`${styles.dayChip} ${selectedDays.includes(day) ? styles.selected : ''}`}
                    onClick={() => toggleDay(day)}
                  >{day}</div>
                ))}
              </div>
              <span className={`${styles.daysError} ${errors.days ? styles.visible : ''}`}>Select at least one working day</span>
            </div>

            <div className={`${styles.formGroup} ${styles.formMt}`}>
              <label className={styles.formLabel}>Clinic hours</label>
              <div className={styles.timeRow}>
                <input className={styles.formInput} type="time" value={morningStart} onChange={e => setMorningStart(e.target.value)} style={{width:140}} />
                <span className={styles.timeSep}>to</span>
                <input className={styles.formInput} type="time" value={morningEnd} onChange={e => setMorningEnd(e.target.value)} style={{width:140}} />
              </div>
            </div>

            <div className={`${styles.formGroup} ${styles.formMt4}`}>
              <div className={styles.timeRow}>
                <span style={{fontSize:13,color:'var(--muted)',width:80,flexShrink:0}}>Evening</span>
                <input className={styles.formInput} type="time" value={eveningStart} onChange={e => setEveningStart(e.target.value)} style={{width:140}} />
                <span className={styles.timeSep}>to</span>
                <input className={styles.formInput} type="time" value={eveningEnd} onChange={e => setEveningEnd(e.target.value)} style={{width:140}} />
              </div>
            </div>

            <div className={`${styles.formGroup} ${styles.formMt}`}>
              <label className={styles.formLabel}>Slot duration</label>
              <div className={styles.slotDurationGroup}>
                {DURATIONS.map(d => (
                  <div
                    key={d}
                    className={`${styles.durationChip} ${duration === d ? styles.selected : ''}`}
                    onClick={() => setDuration(d)}
                  >
                    <span className={styles.mins}>{d}</span>
                    <span className={styles.labelSm}>minutes</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${styles.formGroup} ${styles.formMt}`}>
              <label className={styles.formLabel}>Max patients per day</label>
              <input
                className={styles.formInput}
                type="number" value={maxPatients} min={1} max={100}
                onChange={e => setMaxPatients(e.target.value)}
                style={{maxWidth:140}}
              />
            </div>

            <div className={styles.btnRow}>
              <button className={styles.btnBack} onClick={() => goStep(1)}>← Back</button>
              <button className={styles.btnNext} onClick={() => goStep(3)}>Generate QR →</button>
            </div>
          </div>
        )}

        {/* Step 3 — QR */}
        {step === 3 && (
          <div>
            <div className={styles.formHeading}>Your QR code is ready</div>
            <div className={styles.formSub}>Print it and paste it at your clinic entrance, reception desk, or waiting area. Patients scan and self-book.</div>

            <div className={styles.qrSuccess}>
              <div className={styles.qrBox}>
                {mounted && bookingUrl && (
                  <QRCodeSVG
                    value={bookingUrl}
                    size={176}
                    fgColor="#0D7377"
                    bgColor="#ffffff"
                    level="M"
                  />
                )}
              </div>

              <div className={styles.urlBox} onClick={() => window.open(`/book/${slug}`, '_blank')} title="Click to preview booking page">
                qtoken.in/book/{slug}
              </div>
              <div style={{fontSize:12,color:'var(--muted)',marginBottom:0}}>Click link to preview patient booking page ↗</div>

              <div className={styles.successActions}>
                <button className={styles.secBtn} onClick={() => window.print()}>🖨 Print QR</button>
                <button className={styles.secBtn} onClick={() => alert('PNG downloaded')}>↓ Download PNG</button>
                <button className={`${styles.secBtn} ${styles.primary}`} onClick={() => router.push('/dashboard')}>Open dashboard →</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
