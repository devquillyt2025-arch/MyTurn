'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from '../auth.module.css';

interface FormState {
  doctorName: string;
  clinicName: string;
  phone: string;
  email: string;
  password: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    doctorName: '',
    clinicName: '',
    phone: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  function setField(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:     data.user.id,
          clinic_name: form.clinicName,
          doctor_name: form.doctorName,
          phone:       form.phone,
          email:       form.email,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        setError(error || 'Account created but profile setup failed. Please contact support.');
        setLoading(false);
        return;
      }
    }

    if (!data.session) {
      // Supabase project has email confirmation enabled
      setInfo('Check your inbox for a confirmation link, then sign in.');
      setLoading(false);
      return;
    }

    router.push('/onboarding');
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>MyTurnApp</div>
        <h1 className={styles.heading}>Create your account</h1>
        <p className={styles.sub}>
          Set up your clinic and start managing queues in minutes
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="doctorName">
                Doctor name
              </label>
              <input
                id="doctorName"
                className={styles.input}
                type="text"
                placeholder="Dr. Full Name"
                value={form.doctorName}
                onChange={e => setField('doctorName', e.target.value)}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="clinicName">
                Clinic name
              </label>
              <input
                id="clinicName"
                className={styles.input}
                type="text"
                placeholder="e.g. Nair Healthcare"
                value={form.clinicName}
                onChange={e => setField('clinicName', e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="phone">
              Phone / WhatsApp
            </label>
            <input
              id="phone"
              className={styles.input}
              type="tel"
              placeholder="10-digit number"
              value={form.phone}
              onChange={e => setField('phone', e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Email</label>
            <input
              id="email"
              className={styles.input}
              type="email"
              autoComplete="email"
              placeholder="doctor@clinic.com"
              value={form.email}
              onChange={e => setField('email', e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">Password</label>
            <input
              id="password"
              className={styles.input}
              type="password"
              autoComplete="new-password"
              placeholder="Min 6 characters"
              value={form.password}
              onChange={e => setField('password', e.target.value)}
              minLength={6}
              required
            />
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}
          {info  && <p className={styles.infoMsg}>{info}</p>}

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account →'}
          </button>
        </form>

        <p className={styles.foot}>
          Already have an account?{' '}
          <Link href="/auth/login" className={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
