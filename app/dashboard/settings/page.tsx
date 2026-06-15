'use client';

import { useState, useEffect, useRef } from 'react';
import styles from '../page.module.css';
import { useTheme } from '../../theme-provider';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SPECIALTIES = [
  'General Physician', 'Cardiologist', 'Dermatologist', 'Pediatrician',
  'Orthopaedic Surgeon', 'Gynaecologist', 'ENT Specialist', 'Ophthalmologist',
  'Neurologist', 'Gastroenterologist', 'Psychiatrist', 'Dentist',
  'Oncologist', 'Endocrinologist', 'Pulmonologist', 'Urologist',
  'Nephrologist', 'Rheumatologist', 'Other',
];

export default function SettingsPage() {
  const { theme } = useTheme();
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const [settingsTab, setSettingsTab] = useState<'profile' | 'schedule'>('profile');
  const [clinicId, setClinicId] = useState('');
  const [slug, setSlug] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userProvider, setUserProvider] = useState('');

  // Profile form fields
  const [editDocName, setEditDocName] = useState('');
  const [editSpec, setEditSpec] = useState('');
  const [editClinicName, setEditClinicName] = useState('');
  const [editQual, setEditQual] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editFee, setEditFee] = useState('');

  // Schedule form fields
  const [editDays, setEditDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [editMorningStart, setEditMorningStart] = useState('09:00');
  const [editMorningEnd, setEditMorningEnd] = useState('13:00');
  const [editEveningStart, setEditEveningStart] = useState('17:00');
  const [editEveningEnd, setEditEveningEnd] = useState('20:00');
  const [editSlotDuration, setEditSlotDuration] = useState('15');
  const [editMaxPatients, setEditMaxPatients] = useState('30');

  const [saving, setSaving] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);

  // Password fields
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const bookingUrl = `${process.env.NEXT_PUBLIC_BOOKING_BASE_URL ?? 'https://myturnapp.online'}/book/${slug}`;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      if (user.email) setUserEmail(user.email);
      setUserProvider(user.app_metadata?.provider ?? '');

      supabase
        .from('clinics')
        .select('*')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          setClinicId(data.id);
          if (data.slug) setSlug(data.slug);
          setEditDocName(data.doctor_name || '');
          setEditSpec(data.spec || '');
          setEditQual(data.qual || '');
          setEditClinicName(data.name || '');
          setEditAddress(data.address || '');
          setEditPhone(data.phone || '');
          setEditFee(data.fee ? String(data.fee) : '');
          if (Array.isArray(data.days) && data.days.length) setEditDays(data.days);
          if (data.hours) {
            if (data.hours.mStart) setEditMorningStart(data.hours.mStart);
            if (data.hours.mEnd) setEditMorningEnd(data.hours.mEnd);
            if (data.hours.eStart) setEditEveningStart(data.hours.eStart);
            if (data.hours.eEnd) setEditEveningEnd(data.hours.eEnd);
          }
          if (data.slot_duration) setEditSlotDuration(String(data.slot_duration));
          if (data.max_patients) setEditMaxPatients(String(data.max_patients));
        });
    });
  }, []);

  async function saveClinicProfile() {
    if (!editDocName.trim() || !editClinicName.trim()) {
      toast.error('Doctor name and clinic name are required.');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const newSlug = slug || editDocName.toLowerCase()
      .replace(/^dr\.?\s*/i, '').trim()
      .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'clinic';

    const payload = {
      user_id: user.id,
      name: editClinicName.trim(),
      doctor_name: editDocName.trim(),
      phone: editPhone.trim(),
      address: editAddress.trim(),
      slug: newSlug,
      spec: editSpec.trim(),
      qual: editQual.trim(),
      fee: editFee.trim(),
    };

    let err: { message: string } | null = null;
    if (clinicId) {
      const { error } = await supabase.from('clinics').update(payload).eq('id', clinicId);
      err = error;
    } else {
      const { data: newClinic, error } = await supabase.from('clinics').insert(payload).select('id').single();
      err = error;
      if (newClinic) setClinicId(newClinic.id);
    }

    if (err) {
      toast.error(err.message);
    } else {
      setSlug(newSlug);
      window.dispatchEvent(new CustomEvent('clinic:updated', { detail: { name: payload.name } }));
      toast.success('Clinic profile saved');
    }
    setSaving(false);
  }

  async function saveSchedule() {
    if (!clinicId) {
      toast.error('Save your clinic profile first.');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('clinics').update({
      days: editDays,
      hours: {
        mStart: editMorningStart,
        mEnd: editMorningEnd,
        eStart: editEveningStart,
        eEnd: editEveningEnd,
      },
      slot_duration: Number(editSlotDuration),
      max_patients: Number(editMaxPatients),
    }).eq('id', clinicId);

    if (error) toast.error(error.message);
    else toast.success('Schedule saved');
    setSaving(false);
  }

  async function changePassword() {
    setPwError('');
    if (!pwCurrent || !pwNew || !pwConfirm) { setPwError('All fields are required.'); return; }
    if (pwNew.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    if (pwNew !== pwConfirm) { setPwError('New passwords do not match.'); return; }
    setPwSaving(true);
    const supabase = createClient();
    const { error: reAuthError } = await supabase.auth.signInWithPassword({ email: userEmail, password: pwCurrent });
    if (reAuthError) {
      setPwError('Current password is incorrect.');
      setPwSaving(false);
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: pwNew });
    if (updateError) {
      setPwError(updateError.message);
      setPwSaving(false);
      return;
    }
    setPwCurrent(''); setPwNew(''); setPwConfirm('');
    toast.success('Password updated successfully');
    setPwSaving(false);
  }

  function copyQrLink() {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 2000);
    });
  }

  function downloadQrPng() {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || 'booking'}-qr.png`;
    a.click();
  }

  return (
    <div className={styles.routePage}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>QR &amp; Settings</div>
          <div className={styles.pageSub}>Clinic profile, schedule, and QR code</div>
        </div>
        {slug && (
          <button className={styles.actionBtn} onClick={() => window.open(`/book/${slug}`, '_blank')}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15"><path d="M6 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1v-3M9 2h5v5M14 2l-7 7"/></svg>
            Preview booking page ↗
          </button>
        )}
      </div>

      <div className={styles.settingsTabs}>
        <button
          className={`${styles.settingsTabBtn} ${settingsTab === 'profile' ? styles.activeTab : ''}`}
          onClick={() => setSettingsTab('profile')}
        >Clinic Profile</button>
        <button
          className={`${styles.settingsTabBtn} ${settingsTab === 'schedule' ? styles.activeTab : ''}`}
          onClick={() => setSettingsTab('schedule')}
        >Schedule</button>
      </div>

      {settingsTab === 'profile' && (
        <div>
          <div className={styles.card} style={{marginBottom: 20}}>
            <div className={styles.cardHeader}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5" r="2.5"/><path d="M2.5 13c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5"/></svg>
              <span className={styles.cardTitle}>Doctor information</span>
            </div>
            <div style={{padding: '20px 20px 0'}}>
              <div className={styles.settingsFormGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Doctor name</label>
                  <input className={styles.formInput} placeholder="Dr. Full Name" value={editDocName} onChange={e => setEditDocName(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Specialisation</label>
                  <select className={styles.formInput} value={editSpec} onChange={e => setEditSpec(e.target.value)}>
                    <option value="">Select specialisation</option>
                    {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Clinic name</label>
                  <input className={styles.formInput} placeholder="e.g. Nair Healthcare" value={editClinicName} onChange={e => setEditClinicName(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Qualifications</label>
                  <input className={styles.formInput} placeholder="e.g. MBBS, MD" value={editQual} onChange={e => setEditQual(e.target.value)} />
                </div>
              </div>
              <div className={styles.formGroup} style={{marginBottom: 16}}>
                <label className={styles.formLabel}>Clinic address</label>
                <input className={styles.formInput} placeholder="Street, City, State, PIN" value={editAddress} onChange={e => setEditAddress(e.target.value)} />
              </div>
              <div className={styles.settingsFormGrid} style={{marginBottom: 20}}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Phone / WhatsApp</label>
                  <input className={styles.formInput} type="tel" placeholder="10-digit number" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Consultation fee (₹)</label>
                  <input className={styles.formInput} type="number" placeholder="e.g. 300" value={editFee} onChange={e => setEditFee(e.target.value)} />
                </div>
              </div>
            </div>
            <div className={styles.settingsSaveRow} style={{padding: '16px 20px', borderTop: '1px solid var(--border)'}}>
              <button className={`${styles.actionBtn} ${styles.primary}`} onClick={saveClinicProfile} disabled={saving}>
                {saving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </div>

          {/* Security card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="7" width="10" height="7" rx="1.5"/>
                <path d="M5 7V5a3 3 0 016 0v2"/>
              </svg>
              <span className={styles.cardTitle}>Security</span>
            </div>
            <div style={{padding: 20}}>
              {userProvider === 'google' ? (
                <p style={{fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.6}}>
                  You signed in with Google. Password change is not available for Google accounts.
                </p>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400}}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Current password</label>
                    <input
                      className={styles.formInput}
                      type="password"
                      placeholder="Enter current password"
                      value={pwCurrent}
                      onChange={e => setPwCurrent(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>New password</label>
                    <input
                      className={styles.formInput}
                      type="password"
                      placeholder="Min 8 characters"
                      value={pwNew}
                      onChange={e => setPwNew(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Confirm new password</label>
                    <input
                      className={styles.formInput}
                      type="password"
                      placeholder="Repeat new password"
                      value={pwConfirm}
                      onChange={e => setPwConfirm(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  {pwError && (
                    <p style={{fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)', border: '1px solid rgba(255,94,94,0.25)', borderRadius: 8, padding: '10px 14px', margin: 0, lineHeight: 1.5}}>
                      {pwError}
                    </p>
                  )}
                  <div>
                    <button
                      className={`${styles.actionBtn} ${styles.primary}`}
                      onClick={changePassword}
                      disabled={pwSaving}
                    >
                      {pwSaving ? 'Updating…' : 'Update password'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {settingsTab === 'schedule' && (
        <div className={styles.scheduleLayout}>
          <div className={styles.scheduleLeft}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 5.5h11M5.5 2.5v2M10.5 2.5v2M3 2.5h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1v-9a1 1 0 011-1z"/></svg>
                <span className={styles.cardTitle}>Working days</span>
              </div>
              <div style={{padding: 20}}>
                <div className={styles.chipRow}>
                  {ALL_DAYS.map(day => (
                    <button
                      key={day}
                      className={`${styles.chip} ${editDays.includes(day) ? styles.chipActive : ''}`}
                      onClick={() => setEditDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                    >{day}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg>
                <span className={styles.cardTitle}>Clinic hours</span>
              </div>
              <div style={{padding: 20, display: 'flex', flexDirection: 'column', gap: 16}}>
                <div>
                  <div className={styles.formLabel} style={{marginBottom: 8}}>Morning</div>
                  <div className={styles.timeRangeRow}>
                    <input type="time" className={styles.formInput} style={{width: 130}} value={editMorningStart} onChange={e => setEditMorningStart(e.target.value)} />
                    <span>to</span>
                    <input type="time" className={styles.formInput} style={{width: 130}} value={editMorningEnd} onChange={e => setEditMorningEnd(e.target.value)} />
                  </div>
                </div>
                <div>
                  <div className={styles.formLabel} style={{marginBottom: 8}}>Evening</div>
                  <div className={styles.timeRangeRow}>
                    <input type="time" className={styles.formInput} style={{width: 130}} value={editEveningStart} onChange={e => setEditEveningStart(e.target.value)} />
                    <span>to</span>
                    <input type="time" className={styles.formInput} style={{width: 130}} value={editEveningEnd} onChange={e => setEditEveningEnd(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/></svg>
                <span className={styles.cardTitle}>Slot settings</span>
              </div>
              <div style={{padding: 20, display: 'flex', flexDirection: 'column', gap: 16}}>
                <div>
                  <div className={styles.formLabel} style={{marginBottom: 8}}>Slot duration</div>
                  <div className={styles.chipRow}>
                    {['10', '15', '20', '30'].map(d => (
                      <button
                        key={d}
                        className={`${styles.chip} ${editSlotDuration === d ? styles.chipActive : ''}`}
                        onClick={() => setEditSlotDuration(d)}
                      >{d} min</button>
                    ))}
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Max patients per day</label>
                  <input type="number" className={styles.formInput} style={{maxWidth: 120}} min={1} max={200} value={editMaxPatients} onChange={e => setEditMaxPatients(e.target.value)} />
                </div>
              </div>
            </div>

            <div className={styles.settingsSaveRow}>
              <button className={`${styles.actionBtn} ${styles.primary}`} onClick={saveSchedule} disabled={saving}>
                {saving ? 'Saving…' : 'Save schedule'}
              </button>
            </div>
          </div>

          {/* Sticky QR column */}
          <div className={styles.scheduleRight}>
            <div className={styles.qrSticky}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="11" y="11" width="3" height="3" rx="0.5"/><path d="M9 11h1.5M9 13.5h1"/></svg>
                  <span className={styles.cardTitle}>Booking QR</span>
                </div>
                <div style={{padding: 24}}>
                  {slug ? (
                    <>
                      <div style={{display: 'flex', justifyContent: 'center', marginBottom: 16}}>
                        <QRCodeSVG
                          value={bookingUrl}
                          size={176}
                          bgColor="transparent"
                          fgColor={theme === 'dark' ? '#e2e8f0' : '#0A0E14'}
                          level="M"
                        />
                      </div>
                      <div style={{position: 'absolute', left: -9999, top: -9999, pointerEvents: 'none'}}>
                        <QRCodeCanvas ref={qrCanvasRef} value={bookingUrl} size={512} level="M" fgColor="#0A0E14" bgColor="#ffffff" />
                      </div>
                      <div style={{fontSize: 12, color: 'var(--teal)', textAlign: 'center', wordBreak: 'break-all', marginBottom: 20, lineHeight: 1.5}}>
                        {bookingUrl}
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                        <button className={styles.qrSideBtn} onClick={copyQrLink}>
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 11V3h8"/></svg>
                          {qrCopied ? 'Copied!' : 'Copy link'}
                        </button>
                        <button className={`${styles.qrSideBtn} ${styles.qrSideBtnPrimary}`} onClick={downloadQrPng}>
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v7M5 7l3 3 3-3M3 12h10"/></svg>
                          Download QR
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '12px 0', lineHeight: 1.6}}>
                      Save your clinic profile first to generate a QR code.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
