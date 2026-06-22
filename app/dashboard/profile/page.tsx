'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from '../page.module.css';
import { createClient } from '@/lib/supabase/client';
import { useClinic } from '../clinic-context';
import toast from 'react-hot-toast';

const LANG_SUGGESTIONS = [
  'English', 'Hindi', 'Kannada', 'Tamil', 'Telugu',
  'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi',
];
const MAX_LANGS = 8;
const BIO_MAX = 300;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export default function ProfilePage() {
  const { selected: clinic, userId: ctxUserId, refetch } = useClinic();
  const [clinicId, setClinicId] = useState('');
  const [userId, setUserId] = useState('');

  const [doctorName, setDoctorName] = useState('');
  const [doctorInitials, setDoctorInitials] = useState('');
  const [doctorRole, setDoctorRole] = useState('');

  // Editable, persisted-on-save clinic fields (clinics table — there is no
  // separate `profiles` table; clinic name/address reuse clinics.name/address).
  const [clinicName, setClinicName] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [bio, setBio] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [langInput, setLangInput] = useState('');
  const [langFocus, setLangFocus] = useState(false);
  const [saving, setSaving] = useState(false);

  // Avatar
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarVersion, setAvatarVersion] = useState(0); // cache-bust after re-upload
  const [avatarHover, setAvatarHover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // Account security
  const [userEmail, setUserEmail] = useState('');
  const [userProvider, setUserProvider] = useState('');
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // Sync user identity from context (no separate auth call needed).
  useEffect(() => {
    if (!ctxUserId) return;
    setUserId(ctxUserId);
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
      if (!user) return;
      if (user.email) setUserEmail(user.email);
      setUserProvider(user.app_metadata?.provider ?? '');
    });
  }, [ctxUserId]);

  // Populate form fields from the selected clinic.
  useEffect(() => {
    if (!clinic) return;
    setClinicId(clinic.id);
    if (clinic.doctor_name) {
      setDoctorName(clinic.doctor_name);
      setDoctorInitials(
        clinic.doctor_name
          .replace(/^dr\.?\s*/i, '')
          .split(' ')
          .map((w: string) => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      );
    }
    if (clinic.spec || clinic.qual) {
      setDoctorRole([clinic.qual, clinic.spec].filter(Boolean).join(' · '));
    }
    setClinicName(clinic.name || '');
    setClinicAddress(clinic.address || '');
    setBio(clinic.bio || '');
    setAvatarUrl(clinic.avatar_url || '');
    setLanguages(
      clinic.languages ? clinic.languages.split(',').map((s: string) => s.trim()).filter(Boolean) : []
    );
  }, [clinic?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Avatar upload ────────────────────────────────────────────────────────
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setAvatarError('');
    if (!file.type.startsWith('image/')) { setAvatarError('Please upload an image file'); return; }
    if (file.size > MAX_AVATAR_BYTES) { setAvatarError('Image must be under 2MB'); return; }
    if (!userId) { setAvatarError('You must be signed in'); return; }

    setUploading(true);
    const supabase = createClient();
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `${userId}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('doctor-avatars')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setUploading(false); toast.error(upErr.message); return; }

    const publicUrl = supabase.storage.from('doctor-avatars').getPublicUrl(path).data.publicUrl;
    if (clinicId) {
      const { error: updErr } = await supabase.from('clinics').update({ avatar_url: publicUrl }).eq('id', clinicId);
      if (updErr) { setUploading(false); toast.error(updErr.message); return; }
    }
    setAvatarUrl(publicUrl);
    setAvatarVersion(Date.now());
    setUploading(false);
    toast.success('Photo updated');
  }

  // ── Languages tag input ──────────────────────────────────────────────────
  function addLang(name: string) {
    const v = name.trim().replace(/,+$/, '').trim();
    if (!v) return;
    if (languages.length >= MAX_LANGS) { toast.error(`Up to ${MAX_LANGS} languages`); return; }
    if (languages.some(l => l.toLowerCase() === v.toLowerCase())) { setLangInput(''); return; }
    setLanguages([...languages, v]);
    setLangInput('');
  }
  function removeLang(i: number) {
    setLanguages(languages.filter((_, j) => j !== i));
  }
  function onLangKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addLang(langInput); }
    else if (e.key === 'Backspace' && !langInput && languages.length) removeLang(languages.length - 1);
  }
  const langSuggestions = LANG_SUGGESTIONS.filter(
    s => !languages.some(l => l.toLowerCase() === s.toLowerCase()) &&
         s.toLowerCase().includes(langInput.trim().toLowerCase())
  );

  // ── Save (single call for all profile fields) ────────────────────────────
  async function saveProfile() {
    if (!clinicId) { toast.error('Set up your clinic in Settings first.'); return; }
    if (!clinicName.trim()) { toast.error('Clinic name is required.'); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('clinics').update({
      name: clinicName.trim(),
      address: clinicAddress.trim() || null,
      bio: bio.trim() || null,
      languages: languages.join(', '),
      avatar_url: avatarUrl || null,
    }).eq('id', clinicId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    void refetch();
    toast.success('Profile updated');
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

  const avatarSrc = avatarVersion ? `${avatarUrl}?v=${avatarVersion}` : avatarUrl;
  const textareaStyle: React.CSSProperties = { width: '100%', resize: 'vertical', fontFamily: 'inherit' };

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
          <button className={`${styles.actionBtn} ${styles.primary}`} onClick={saveProfile} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,alignItems:'start'}}>
        <div className={styles.card}>
          <div className={styles.profileHero}>
            <div
              className={styles.profileAvatarLg}
              style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer', padding: 0 }}
              onClick={() => !uploading && fileRef.current?.click()}
              onMouseEnter={() => setAvatarHover(true)}
              onMouseLeave={() => setAvatarHover(false)}
              title="Change photo"
            >
              {avatarUrl
                ? <img src={avatarSrc} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (doctorInitials || '?')}
              {(avatarHover || uploading) && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  {uploading ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                      <path d="M21 12a9 9 0 0 0-9-9" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
                      </path>
                    </svg>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#fff' }}>Change photo</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} style={{ display: 'none' }} />
            <div>
              <div className={styles.profileName}>{doctorName}</div>
              <div className={styles.profileRole}>{doctorRole}</div>
              <div className={styles.profileBadges}>
                <span className={styles.profileBadge}>Verified</span>
                <span className={styles.profileBadge}>MCI Reg.</span>
              </div>
              {avatarError && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 8 }}>{avatarError}</div>}
            </div>
          </div>

          <div>
            {[
              ['Full name', doctorName],
              ['Qualification', 'MBBS, MD (General Medicine)'],
              ['Reg. number', 'KMC/2012/04821'],
              ['Specialisation', 'General Physician'],
              ['Experience', '13 years'],
            ].map(([label, val]) => (
              <div key={label} className={styles.formRow}>
                <span className={styles.formRowLabel}>{label}</span>
                <input className={styles.formRowInput} defaultValue={val} />
              </div>
            ))}

            {/* Languages — badges */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <label className={styles.fieldLabelBlock}>Languages</label>
              {languages.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {languages.map((lang, i) => (
                    <span key={lang} className={styles.langPill}>
                      {lang}
                      <button type="button" className={styles.langPillX} onClick={() => removeLang(i)} aria-label={`Remove ${lang}`}>×</button>
                    </span>
                  ))}
                </div>
              )}
              {languages.length < MAX_LANGS && (
                <div style={{ position: 'relative' }}>
                  <input
                    className={styles.formInput}
                    style={{ width: '100%' }}
                    placeholder="Add language…"
                    value={langInput}
                    onChange={e => setLangInput(e.target.value)}
                    onKeyDown={onLangKey}
                    onFocus={() => setLangFocus(true)}
                    onBlur={() => setTimeout(() => setLangFocus(false), 120)}
                  />
                  {langFocus && langSuggestions.length > 0 && (
                    <div className={styles.langSuggest}>
                      {langSuggestions.map(s => (
                        <div key={s} className={styles.langSuggestItem} onMouseDown={() => addLang(s)}>{s}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clinic name */}
            <div className={styles.formRow}>
              <span className={styles.formRowLabel}>Clinic name</span>
              <input
                className={styles.formRowInput}
                placeholder="e.g. Nair Healthcare Clinic"
                value={clinicName}
                onChange={e => setClinicName(e.target.value)}
              />
            </div>

            {/* Clinic address */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <label className={styles.fieldLabelBlock}>Clinic address</label>
              <textarea
                className={styles.formInput}
                style={textareaStyle}
                rows={3}
                placeholder="Full address with city and pincode"
                value={clinicAddress}
                onChange={e => setClinicAddress(e.target.value)}
              />
            </div>

            {/* Bio */}
            <div style={{ padding: '14px 20px' }}>
              <label className={styles.fieldLabelBlock}>Bio</label>
              <div style={{ position: 'relative' }}>
                <textarea
                  className={styles.formInput}
                  style={textareaStyle}
                  rows={4}
                  maxLength={BIO_MAX}
                  placeholder="Write a short introduction for your patients…"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                />
                <div style={{ position: 'absolute', right: 10, bottom: 8, fontSize: 11, color: bio.length > 280 ? 'var(--red)' : 'var(--muted)' }}>
                  {bio.length} / {BIO_MAX}
                </div>
              </div>
            </div>
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
                <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
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
      </div>
    </div>
  );
}
