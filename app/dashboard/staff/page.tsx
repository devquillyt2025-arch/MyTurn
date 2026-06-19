'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from '../page.module.css';
import { createClient } from '@/lib/supabase/client';
import { useClinic } from '../clinic-context';
import { CustomSelect } from '@/components/CustomSelect';
import toast from 'react-hot-toast';

type StaffRole   = 'doctor' | 'receptionist' | 'admin';
type StaffStatus = 'invited' | 'active' | 'disabled';

interface StaffMember {
  id: string;
  clinic_id: string;
  user_id: string | null;
  name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  invited_at: string;
  joined_at: string | null;
}

// ── Display maps ──────────────────────────────────────────────────────────────

const ROLE_META: Record<StaffRole, { label: string; color: string; bg: string }> = {
  doctor:       { label: 'Doctor',       color: 'var(--teal)',  bg: 'rgba(20,184,166,0.12)'  },
  admin:        { label: 'Admin',        color: '#a78bfa',      bg: 'rgba(167,139,250,0.12)' },
  receptionist: { label: 'Receptionist', color: 'var(--amber)', bg: 'var(--amber-dim)'       },
};

const STATUS_META: Record<StaffStatus, { label: string; color: string }> = {
  invited:  { label: 'Invited',  color: 'var(--amber)' },
  active:   { label: 'Active',   color: 'var(--green)' },
  disabled: { label: 'Disabled', color: 'var(--muted)' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Table grid ────────────────────────────────────────────────────────────────
const GRID = '1fr 1fr 130px 100px 130px 220px';

// ── Component ─────────────────────────────────────────────────────────────────
export default function StaffPage() {
  const { selected: clinic, userId } = useClinic();

  const [members,     setMembers]     = useState<StaffMember[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [inviteOpen,  setInviteOpen]  = useState(false);
  const [invName,     setInvName]     = useState('');
  const [invEmail,    setInvEmail]    = useState('');
  const [invRole,     setInvRole]     = useState<StaffRole>('receptionist');
  const [inviting,    setInviting]    = useState(false);
  const [savingId,    setSavingId]    = useState<string | null>(null);

  const load = useCallback(async (clinicId: string) => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('staff_members')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('invited_at', { ascending: false });
    if (!error && data) setMembers(data as StaffMember[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!clinic) return;
    void load(clinic.id);
  }, [clinic?.id, load]);

  // Check if current user is the clinic owner
  const isOwner = !!(userId && (clinic as { user_id?: string } | null)?.user_id === userId);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleInvite() {
    if (!clinic) return;
    if (!invName.trim() || !invEmail.trim()) {
      toast.error('Name and email are required.');
      return;
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(invEmail.trim())) {
      toast.error('Enter a valid email address.');
      return;
    }
    setInviting(true);
    const supabase = createClient();
    const { error } = await supabase.from('staff_members').insert({
      clinic_id: clinic.id,
      name:      invName.trim(),
      email:     invEmail.trim().toLowerCase(),
      role:      invRole,
      status:    'invited',
    });
    setInviting(false);
    if (error?.code === '23505') {
      toast.error('This email is already on your team.');
      return;
    }
    if (error) {
      toast.error('Could not send invite. Please try again.');
      return;
    }
    toast.success(`${invName.trim()} invited as ${ROLE_META[invRole].label}.`);
    setInviteOpen(false);
    setInvName(''); setInvEmail(''); setInvRole('receptionist');
    void load(clinic.id);
  }

  async function changeRole(member: StaffMember, newRole: StaffRole) {
    setSavingId(member.id);
    const supabase = createClient();
    const { error } = await supabase
      .from('staff_members')
      .update({ role: newRole })
      .eq('id', member.id);
    setSavingId(null);
    if (error) { toast.error('Could not update role.'); return; }
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, role: newRole } : m));
    toast.success('Role updated.');
  }

  async function toggleDisable(member: StaffMember) {
    const newStatus: StaffStatus = member.status === 'disabled' ? 'active' : 'disabled';
    setSavingId(member.id);
    const supabase = createClient();
    const { error } = await supabase
      .from('staff_members')
      .update({ status: newStatus })
      .eq('id', member.id);
    setSavingId(null);
    if (error) { toast.error('Could not update status.'); return; }
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, status: newStatus } : m));
    toast.success(`${member.name} ${newStatus === 'disabled' ? 'disabled' : 're-enabled'}.`);
  }

  async function removeMember(member: StaffMember) {
    if (!window.confirm(`Remove ${member.name} from your team? This cannot be undone.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('staff_members').delete().eq('id', member.id);
    if (error) { toast.error('Could not remove staff member.'); return; }
    setMembers(prev => prev.filter(m => m.id !== member.id));
    toast.success(`${member.name} removed from team.`);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.routePage}>

      {/* Page header */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>Staff &amp; Team</div>
          <div className={styles.pageSub}>
            {clinic?.name ?? ''} · {members.length} team member{members.length !== 1 ? 's' : ''}
          </div>
        </div>
        {isOwner && (
          <button
            className={`${styles.actionBtn} ${styles.primary}`}
            onClick={() => setInviteOpen(true)}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M8 2v12M2 8h12"/>
            </svg>
            Invite member
          </button>
        )}
      </div>

      {/* Simulated invite notice */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(20,184,166,0.06)',
        border: '1px solid rgba(20,184,166,0.2)',
        borderRadius: 10, padding: '12px 16px',
        marginBottom: 24, fontSize: 13,
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <path d="M14 11H2a1 1 0 01-1-1V4a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1z"/>
          <path d="M1 4l7 5 7-5"/>
        </svg>
        <span style={{ color: 'var(--muted)' }}>
          <strong style={{ color: 'var(--text)' }}>Invites are simulated</strong> — no real email is sent yet.
          The invited person must sign up at <strong style={{ color: 'var(--teal)' }}>myturnapp.in</strong> with the same email address to get access.
        </span>
      </div>

      {/* Stats row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total members</div>
          <div className={styles.statVal} style={{ fontSize: 26 }}>{members.length}</div>
          <div className={styles.statChange} style={{ color: 'var(--muted)' }}>Across all roles</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active</div>
          <div className={`${styles.statVal} ${styles.green}`} style={{ fontSize: 26 }}>
            {members.filter(m => m.status === 'active').length}
          </div>
          <div className={styles.statChange} style={{ color: 'var(--muted)' }}>Joined & linked</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Invited</div>
          <div className={`${styles.statVal} ${styles.amber}`} style={{ fontSize: 26 }}>
            {members.filter(m => m.status === 'invited').length}
          </div>
          <div className={styles.statChange} style={{ color: 'var(--muted)' }}>Awaiting sign-up</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Disabled</div>
          <div className={styles.statVal} style={{ fontSize: 26, color: 'var(--muted)' }}>
            {members.filter(m => m.status === 'disabled').length}
          </div>
          <div className={styles.statChange} style={{ color: 'var(--muted)' }}>Access revoked</div>
        </div>
      </div>

      {/* Team table */}
      <div className={styles.card}>

        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: GRID,
          padding: '10px 20px',
          borderBottom: '1px solid var(--border)',
          fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--muted)',
        }}>
          <div>Name</div><div>Email</div><div>Role</div>
          <div>Status</div><div>Invited</div><div>Actions</div>
        </div>

        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Loading team…
          </div>
        )}

        {!loading && members.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>No team members yet</div>
            {isOwner
              ? <div>Click <strong>Invite member</strong> to add your first receptionist or admin.</div>
              : <div>Your clinic owner hasn&apos;t added any staff members yet.</div>}
          </div>
        )}

        {members.map(m => {
          const rm = ROLE_META[m.role];
          const sm = STATUS_META[m.status];
          const isSaving = savingId === m.id;
          return (
            <div
              key={m.id}
              style={{
                display: 'grid', gridTemplateColumns: GRID,
                padding: '14px 20px', alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                opacity: m.status === 'disabled' ? 0.55 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {/* Name */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                {m.joined_at && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Joined {fmtDate(m.joined_at)}</div>
                )}
              </div>

              {/* Email */}
              <div style={{ fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.email}
              </div>

              {/* Role — editable for owner */}
              <div>
                {isOwner ? (
                  <CustomSelect
                    value={m.role}
                    disabled={isSaving}
                    onChange={v => void changeRole(m, v as StaffRole)}
                    options={[
                      { value: 'receptionist', label: 'Receptionist' },
                      { value: 'admin',        label: 'Admin' },
                      { value: 'doctor',       label: 'Doctor' },
                    ]}
                    style={{ width: 120, height: 30, fontSize: 12 }}
                    triggerStyle={{ color: rm.color, borderColor: rm.color, background: rm.bg }}
                  />
                ) : (
                  <span style={{
                    fontSize: 12, fontWeight: 500,
                    color: rm.color, background: rm.bg,
                    padding: '3px 10px', borderRadius: 20,
                  }}>{rm.label}</span>
                )}
              </div>

              {/* Status */}
              <div>
                <span style={{ fontSize: 12, fontWeight: 500, color: sm.color }}>
                  {sm.label}
                </span>
              </div>

              {/* Invited date */}
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {fmtDate(m.invited_at)}
              </div>

              {/* Actions */}
              {isOwner ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    className={styles.actionBtn}
                    style={{ fontSize: 12, padding: '3px 10px', height: 'auto' }}
                    disabled={isSaving}
                    onClick={() => void toggleDisable(m)}
                  >
                    {m.status === 'disabled' ? 'Re-enable' : 'Disable'}
                  </button>
                  <button
                    className={styles.actionBtn}
                    style={{ fontSize: 12, padding: '3px 10px', height: 'auto', color: 'var(--red)', borderColor: 'rgba(239,68,68,0.4)' }}
                    disabled={isSaving}
                    onClick={() => void removeMember(m)}
                  >Remove</button>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>—</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Invite modal */}
      {inviteOpen && (
        <div
          className={`${styles.modalOverlay} ${styles.open}`}
          onClick={e => { if (e.target === e.currentTarget) setInviteOpen(false); }}
        >
          <div className={styles.modalBox} style={{ width: 420, textAlign: 'left' }}>
            <button className={styles.modalClose} onClick={() => setInviteOpen(false)}>✕</button>
            <div className={styles.modalTitle}>Invite team member</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
              <div className={styles.settingsRow} style={{ border: 'none', padding: 0 }}>
                <div>
                  <div className={styles.settingsRowLabel}>Full name <span style={{ color: 'var(--red)' }}>*</span></div>
                </div>
                <input
                  className={styles.settingsInput}
                  placeholder="e.g. Priya Sharma"
                  value={invName}
                  onChange={e => setInvName(e.target.value)}
                  style={{ width: 220 }}
                  autoFocus
                />
              </div>
              <div className={styles.settingsRow} style={{ border: 'none', padding: 0 }}>
                <div>
                  <div className={styles.settingsRowLabel}>Email address <span style={{ color: 'var(--red)' }}>*</span></div>
                </div>
                <input
                  className={styles.settingsInput}
                  type="email"
                  placeholder="priya@example.com"
                  value={invEmail}
                  onChange={e => setInvEmail(e.target.value)}
                  style={{ width: 220 }}
                />
              </div>
              <div className={styles.settingsRow} style={{ border: 'none', padding: 0 }}>
                <div>
                  <div className={styles.settingsRowLabel}>Role</div>
                  <div className={styles.settingsRowSub}>Controls dashboard access</div>
                </div>
                <CustomSelect
                  value={invRole}
                  onChange={v => setInvRole(v as StaffRole)}
                  options={[
                    { value: 'receptionist', label: 'Receptionist' },
                    { value: 'admin',        label: 'Admin' },
                    { value: 'doctor',       label: 'Doctor' },
                  ]}
                  style={{ width: 160, height: 38 }}
                />
              </div>
              <div style={{
                fontSize: 12, color: 'var(--muted)',
                background: 'var(--surface2)', borderRadius: 8,
                padding: '10px 14px', lineHeight: 1.5,
              }}>
                <strong style={{ color: 'var(--text)' }}>Access granted to {ROLE_META[invRole].label}:</strong><br />
                {invRole === 'receptionist' && 'Dashboard, Patients, Schedule · Cannot access Analytics, Billing, or Settings.'}
                {invRole === 'admin'        && 'Full access to all sections, except QR & Settings.'}
                {invRole === 'doctor'       && 'Full access — same as clinic owner.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <button
                className={styles.actionBtn}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => { setInviteOpen(false); setInvName(''); setInvEmail(''); setInvRole('receptionist'); }}
              >Cancel</button>
              <button
                className={`${styles.actionBtn} ${styles.primary}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={handleInvite}
                disabled={!invName.trim() || !invEmail.trim() || inviting}
              >{inviting ? 'Inviting…' : 'Send invite'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
