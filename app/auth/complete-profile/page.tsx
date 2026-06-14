'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from '../auth.module.css';

export default function CompleteProfilePage() {
  const router = useRouter();
  const [doctorName, setDoctorName] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/auth/login');
        return;
      }
      setEmail(user.email ?? '');
      // Pre-fill name from Google profile if available
      const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? '';
      if (fullName) setDoctorName(fullName);
      setChecking(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!doctorName.trim() || !clinicName.trim() || !phone.trim()) return;
    if (!/^\d{10}$/.test(phone.replace(/\s/g, ''))) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setError('');

    // SECURITY FIX: Pass the verified session token so the server can authenticate
    // this request without trusting user_id from the body.
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Session expired. Please sign in again.');
      setLoading(false);
      return;
    }

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        clinic_name: clinicName,
        doctor_name: doctorName,
        phone,
        email,
      }),
    });

    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({}));
      setError(msg || 'Profile setup failed. Please try again.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  }

  if (checking) {
    return (
      <div className={styles.page}>
        <div className={styles.card} style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand} style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
          <img src="/logo.png" alt="MyTurn Logo" style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
          MyTurn
        </div>
        <h1 className={styles.heading}>Complete your profile</h1>
        <p className={styles.sub}>
          Just a few details to set up your clinic — you only do this once.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="doctorName">Doctor name</label>
            <input
              id="doctorName"
              className={styles.input}
              type="text"
              placeholder="Dr. Full Name"
              value={doctorName}
              onChange={e => setDoctorName(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="clinicName">Clinic name</label>
            <input
              id="clinicName"
              className={styles.input}
              type="text"
              placeholder="e.g. Nair Healthcare"
              value={clinicName}
              onChange={e => setClinicName(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="phone">Mobile / WhatsApp</label>
            <input
              id="phone"
              className={styles.input}
              type="tel"
              placeholder="10-digit number"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Email (from Google)</label>
            <input
              className={styles.input}
              type="email"
              value={email}
              disabled
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Continue to dashboard →'}
          </button>
        </form>
      </div>
    </div>
  );
}
