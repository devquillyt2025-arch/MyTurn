'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from '../page.module.css';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const [doctorName, setDoctorName] = useState('');
  const [doctorInitials, setDoctorInitials] = useState('');
  const [doctorRole, setDoctorRole] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
      if (!user) return;
      supabase
        .from('clinics')
        .select('doctor_name, spec, qual')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          if (data.doctor_name) {
            setDoctorName(data.doctor_name);
            const ini = data.doctor_name
              .replace(/^dr\.?\s*/i, '')
              .split(' ')
              .map((w: string) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();
            setDoctorInitials(ini);
          }
          if (data.spec || data.qual) {
            setDoctorRole([data.qual, data.spec].filter(Boolean).join(' · '));
          }
        });
    });
  }, []);

  return (
    <div className={styles.routePage}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>My Profile</div>
          <div className={styles.pageSub}>Doctor and clinic information</div>
        </div>
        <div style={{display:'flex',gap:10}}>
          <Link href="/dashboard/settings" className={styles.actionBtn}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/></svg>
            View QR &amp; Settings
          </Link>
          <button className={`${styles.actionBtn} ${styles.primary}`} onClick={() => toast.success('Profile saved')}>Save changes</button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,alignItems:'start'}}>
        <div className={styles.card}>
          <div className={styles.profileHero}>
            <div className={styles.profileAvatarLg}>{doctorInitials || '?'}</div>
            <div>
              <div className={styles.profileName}>{doctorName}</div>
              <div className={styles.profileRole}>{doctorRole}</div>
              <div className={styles.profileBadges}>
                <span className={styles.profileBadge}>Verified</span>
                <span className={styles.profileBadge}>MCI Reg.</span>
              </div>
            </div>
          </div>
          <div>
            {[
              ['Full name', doctorName],
              ['Qualification', 'MBBS, MD (General Medicine)'],
              ['Reg. number', 'KMC/2012/04821'],
              ['Specialisation', 'General Physician'],
              ['Experience', '13 years'],
              ['Languages', 'English, Malayalam, Hindi'],
            ].map(([label, val]) => (
              <div key={label} className={styles.formRow}>
                <span className={styles.formRowLabel}>{label}</span>
                <input className={styles.formRowInput} defaultValue={val} />
              </div>
            ))}
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:20}}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 4h11M2.5 8h7M2.5 12h5"/></svg>
              <span className={styles.cardTitle}>Contact</span>
            </div>
            {[
              ['Email', 'meera.nair@nairhealthcare.in'],
              ['Phone', '+91 98400 12345'],
              ['WhatsApp', '+91 98400 12345'],
            ].map(([label, val]) => (
              <div key={label} className={styles.formRow}>
                <span className={styles.formRowLabel}>{label}</span>
                <input className={styles.formRowInput} defaultValue={val} />
              </div>
            ))}
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg>
              <span className={styles.cardTitle}>Working hours</span>
            </div>
            {[
              ['Monday–Friday', '9:00 AM – 5:00 PM'],
              ['Saturday', '9:00 AM – 1:00 PM'],
              ['Sunday', 'Closed'],
            ].map(([label, val]) => (
              <div key={label} className={styles.formRow}>
                <span className={styles.formRowLabel}>{label}</span>
                <span className={styles.formRowVal} style={val === 'Closed' ? {color:'var(--red)'} : {}}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
