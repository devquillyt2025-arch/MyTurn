'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from '../auth.module.css';

function Eye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) setGoogleLoading(false);
    }
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  function setField(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError('');
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (authError) {
      setError(authError.message);
      setGoogleLoading(false);
    }
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

    if (!data.session) {
      // Email confirmation is enabled — the doctor row will be created via
      // /auth/complete-profile after the user confirms and signs in.
      setInfo('Check your inbox for a confirmation link, then sign in.');
      setLoading(false);
      return;
    }

    // SECURITY FIX: Pass the verified session token in the Authorization header.
    // The server validates this token and extracts user_id from it — the body
    // no longer carries user_id.
    if (data.user) {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({
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

    router.push('/dashboard');
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

        <button
          className={styles.googleBtn}
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          type="button"
        >
          <GoogleIcon />
          {googleLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <div className={styles.divider}>or sign up with email</div>

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
            <div className={styles.inputWrapper}>
              <input
                id="password"
                className={styles.input}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Min 6 characters"
                value={form.password}
                onChange={e => setField('password', e.target.value)}
                minLength={6}
                required
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}
          {info  && <p className={styles.infoMsg}>{info}</p>}

          <button className={styles.btn} type="submit" disabled={loading || googleLoading}>
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
