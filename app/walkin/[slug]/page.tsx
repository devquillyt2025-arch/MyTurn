'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './page.module.css';

interface Clinic {
  id: string;
  name: string;
  doctor_name: string;
  slug: string;
}

type WalkinState = 'choose' | 'form' | 'submitting' | 'confirmed';

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function tok(n: number): string {
  return `#${String(n).padStart(2, '0')}`;
}

export default function WalkinPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [uiState, setUiState] = useState<WalkinState>('choose');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [assignedToken, setAssignedToken] = useState(0);
  const [aheadCount, setAheadCount] = useState(0);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!slug) return;
    const supabase = createClient();
    supabase
      .from('clinics')
      .select('id, name, doctor_name, slug')
      .eq('slug', slug)
      .single()
      .then(({ data }) => {
        if (data) setClinic(data as Clinic);
        else setNotFound(true);
      });
  }, [slug]);

  async function submitWalkin() {
    if (!name.trim()) {
      setFormError('Please enter your name');
      return;
    }
    if (!clinic) return;

    setFormError('');
    setUiState('submitting');

    let res: Response;
    try {
      res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_id: clinic.id,
          patient_name: name.trim(),
          patient_phone: phone.trim() || '',
          source: 'walkin',
        }),
      });
    } catch {
      setFormError('Could not reach server. Check your connection and try again.');
      setUiState('form');
      return;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setFormError(body?.error || 'Something went wrong. Please try again.');
      setUiState('form');
      return;
    }

    const data = await res.json() as { booking?: { token_number: number } };
    const token = data.booking?.token_number ?? 0;
    setAssignedToken(token);

    // Count patients currently waiting ahead of this token
    const todayStr = todayIST();
    const startOfDay = new Date(`${todayStr}T00:00:00+05:30`).toISOString();
    const endOfDay = new Date(`${todayStr}T23:59:59+05:30`).toISOString();

    const supabase = createClient();
    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinic.id)
      .eq('status', 'waiting')
      .lt('token_number', token)
      .gte('checked_in_at', startOfDay)
      .lte('checked_in_at', endOfDay);

    setAheadCount(count ?? 0);
    setUiState('confirmed');
  }

  if (notFound) {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <div className={styles.notFoundCode}>404</div>
          <div className={styles.notFoundTitle}>Clinic not found</div>
          <div className={styles.notFoundSub}>
            The QR code you scanned doesn&apos;t match any registered clinic.
          </div>
        </div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading…</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.clinicBadge}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
            <path d="M8 1.5a4 4 0 100 8 4 4 0 000-8z"/>
            <path d="M2 14.5c0-2.21 2.686-4 6-4s6 1.79 6 4"/>
          </svg>
          <span>{clinic.name}</span>
        </div>
        <div className={styles.doctorName}>{clinic.doctor_name}</div>
        <div className={styles.headerSub}>MyTurn Queue</div>
      </div>

      {/* Choose */}
      {uiState === 'choose' && (
        <div className={styles.body}>
          <div className={styles.sectionLabel}>How would you like to continue?</div>

          <button className={styles.optCard} onClick={() => setUiState('form')}>
            <div className={styles.optIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#14A89E" strokeWidth="2" width="22" height="22">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 8v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className={styles.optText}>
              <div className={styles.optTitle}>Take a Token</div>
              <div className={styles.optDesc}>Walk in now — get your place in the queue immediately</div>
            </div>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className={styles.chevron}>
              <path d="M8 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <button
            className={styles.optCard}
            onClick={() => { window.location.href = `/book/${slug}`; }}
          >
            <div className={`${styles.optIcon} ${styles.optIconAlt}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#0D7377" strokeWidth="2" width="22" height="22">
                <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round"/>
                <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className={styles.optText}>
              <div className={styles.optTitle}>Book an Appointment</div>
              <div className={styles.optDesc}>Choose a date and time slot in advance</div>
            </div>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className={styles.chevron}>
              <path d="M8 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* Form / Submitting */}
      {(uiState === 'form' || uiState === 'submitting') && (
        <div className={styles.body}>
          <button
            className={styles.backBtn}
            onClick={() => { setUiState('choose'); setFormError(''); }}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M12 5l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>

          <div className={styles.sectionLabel}>Enter your details</div>

          <div className={styles.formCard}>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                Full name <span className={styles.required}>*</span>
              </label>
              <input
                className={styles.formInput}
                type="text"
                placeholder="Your name"
                autoComplete="name"
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={uiState === 'submitting'}
              />
            </div>
            <div className={styles.formRow} style={{ marginBottom: 0 }}>
              <label className={styles.formLabel}>
                Phone number <span className={styles.optional}>Optional</span>
              </label>
              <input
                className={styles.formInput}
                type="tel"
                placeholder="98765 43210"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                disabled={uiState === 'submitting'}
              />
            </div>
          </div>

          {formError && <div className={styles.errorMsg}>{formError}</div>}

          <button
            className={styles.ctaBtn}
            onClick={submitWalkin}
            disabled={uiState === 'submitting' || !name.trim()}
          >
            {uiState === 'submitting' ? 'Getting your token…' : 'Take Token'}
          </button>
        </div>
      )}

      {/* Confirmed */}
      {uiState === 'confirmed' && (
        <div className={styles.body}>
          <div className={styles.confirmedWrap}>
            <div className={styles.confirmedCheck}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <div className={styles.confirmedLabel}>Your token number</div>
            <div className={styles.tokenBig}>{tok(assignedToken)}</div>
            <div className={styles.aheadText}>
              {aheadCount === 0
                ? "You're next — please head to the clinic."
                : `${aheadCount} ${aheadCount === 1 ? 'person' : 'people'} ahead of you`}
            </div>
            <div className={styles.closeNote}>
              You can close this page. Your token is <strong>{tok(assignedToken)}</strong>.
            </div>
          </div>

          <div className={styles.clinicInfoCard}>
            <div className={styles.clinicInfoRow}>
              <span className={styles.clinicInfoLabel}>Clinic</span>
              <span className={styles.clinicInfoVal}>{clinic.name}</span>
            </div>
            <div className={styles.clinicInfoRow}>
              <span className={styles.clinicInfoLabel}>Doctor</span>
              <span className={styles.clinicInfoVal}>{clinic.doctor_name}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
