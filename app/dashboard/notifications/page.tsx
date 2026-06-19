'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from '../page.module.css';
import { createClient } from '@/lib/supabase/client';
import { useClinic } from '../clinic-context';
import { CustomSelect } from '@/components/CustomSelect';
import toast from 'react-hot-toast';

type Channel     = 'sms' | 'whatsapp';
type MsgStatus   = 'sent' | 'failed' | 'pending';
type MsgType     = 'token_issued' | 'turn_approaching' | 'appointment_reminder' | 'appointment_confirmed';

interface NotifEntry {
  id: string;
  clinic_id: string;
  booking_id: string | null;
  patient_name: string;
  patient_phone: string;
  channel: Channel;
  message_type: MsgType;
  message_content: string;
  status: MsgStatus;
  sent_at: string;
  created_at: string;
}

// ── Display maps ─────────────────────────────────────────────────────────────

const TYPE_META: Record<MsgType, { label: string; color: string; bg: string }> = {
  token_issued:           { label: 'Token Issued',     color: 'var(--teal)',   bg: 'rgba(20,184,166,0.12)'  },
  appointment_confirmed:  { label: 'Appt. Confirmed',  color: '#a78bfa',       bg: 'rgba(167,139,250,0.12)' },
  appointment_reminder:   { label: 'Appt. Reminder',   color: 'var(--amber)',  bg: 'var(--amber-dim)'       },
  turn_approaching:       { label: 'Turn Approaching', color: '#fb923c',       bg: 'rgba(251,146,60,0.12)'  },
};

const STATUS_META: Record<MsgStatus, { label: string; color: string; bg: string }> = {
  sent:    { label: 'Sent',    color: 'var(--green)', bg: 'var(--green-dim)'  },
  failed:  { label: 'Failed',  color: 'var(--red)',   bg: 'var(--red-dim)'    },
  pending: { label: 'Pending', color: 'var(--amber)', bg: 'var(--amber-dim)'  },
};

function fmtDatetime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Table grid ────────────────────────────────────────────────────────────────
const GRID = '140px 1fr 80px 160px 90px 1fr 80px';

// ── Icons ─────────────────────────────────────────────────────────────────────
function SmsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M14 2H2a1 1 0 00-1 1v8a1 1 0 001 1h5l3 3v-3h4a1 1 0 001-1V3a1 1 0 00-1-1z"/>
    </svg>
  );
}
function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M8 1.5a6.5 6.5 0 016.5 6.5A6.5 6.5 0 018 14.5c-1.1 0-2.15-.28-3.05-.77L1.5 14.5l.77-3.45A6.47 6.47 0 011.5 8 6.5 6.5 0 018 1.5z"/>
      <path d="M6 6.5c0 2 3.5 5 5.5 5"/>
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const { selected: clinic } = useClinic();

  const [entries,       setEntries]       = useState<NotifEntry[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [channelFilter, setChannelFilter] = useState<'all' | Channel>('all');
  const [statusFilter,  setStatusFilter]  = useState<'all' | MsgStatus>('all');
  const [resendingId,   setResendingId]   = useState<string | null>(null);

  const load = useCallback(async (clinicId: string) => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('notifications_log')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error && data) setEntries(data as NotifEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!clinic) return;
    void load(clinic.id);
  }, [clinic?.id, load]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = entries.filter(e => {
    if (channelFilter !== 'all' && e.channel !== channelFilter)   return false;
    if (statusFilter  !== 'all' && e.status  !== statusFilter)    return false;
    return true;
  });

  const sentCount    = entries.filter(e => e.status === 'sent').length;
  const failedCount  = entries.filter(e => e.status === 'failed').length;
  const pendingCount = entries.filter(e => e.status === 'pending').length;

  // ── Actions ────────────────────────────────────────────────────────────────

  async function resend(notif: NotifEntry) {
    if (!clinic) return;
    setResendingId(notif.id);
    const supabase = createClient();
    const { error } = await supabase.from('notifications_log').insert({
      clinic_id:       clinic.id,
      booking_id:      notif.booking_id,
      patient_name:    notif.patient_name,
      patient_phone:   notif.patient_phone,
      channel:         notif.channel,
      message_type:    notif.message_type,
      message_content: notif.message_content,
      status:          'sent',
      sent_at:         new Date().toISOString(),
    });
    setResendingId(null);
    if (error) { toast.error('Could not log resend.'); return; }
    toast.success('Notification resent (simulated)');
    void load(clinic.id);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.routePage}>

      {/* Page header */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>Notifications</div>
          <div className={styles.pageSub}>
            {clinic?.name ?? ''} · {filtered.length} log entr{filtered.length !== 1 ? 'ies' : 'y'} shown
          </div>
        </div>
      </div>

      {/* Simulated mode banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(251,146,60,0.08)',
        border: '1px solid rgba(251,146,60,0.25)',
        borderRadius: 10, padding: '12px 16px',
        marginBottom: 24, fontSize: 13,
      }}>
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13z"/>
          <path d="M8 5v4M8 11v.5"/>
        </svg>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 600, color: '#fb923c' }}>Notifications are simulated </span>
          <span style={{ color: 'var(--muted)' }}>— no real SMS or WhatsApp messages are being sent. Connect a provider to enable live delivery.</span>
        </div>
        <button
          className={styles.actionBtn}
          disabled
          style={{ opacity: 0.4, cursor: 'not-allowed', whiteSpace: 'nowrap', fontSize: 12 }}
        >Connect provider</button>
      </div>

      {/* Stats row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total logged</div>
          <div className={styles.statVal} style={{ fontSize: 26 }}>{entries.length}</div>
          <div className={styles.statChange} style={{ color: 'var(--muted)' }}>All time</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Sent</div>
          <div className={`${styles.statVal} ${styles.green}`} style={{ fontSize: 26 }}>{sentCount}</div>
          <div className={styles.statChange} style={{ color: 'var(--muted)' }}>Simulated deliveries</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Failed</div>
          <div className={`${styles.statVal} ${styles.red}`} style={{ fontSize: 26 }}>{failedCount}</div>
          <div className={styles.statChange} style={{ color: 'var(--muted)' }}>Need resend</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pending</div>
          <div className={`${styles.statVal} ${styles.amber}`} style={{ fontSize: 26 }}>{pendingCount}</div>
          <div className={styles.statChange} style={{ color: 'var(--muted)' }}>Queued</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <CustomSelect
          value={channelFilter}
          onChange={v => setChannelFilter(v as typeof channelFilter)}
          options={[
            { value: 'all',       label: 'All channels' },
            { value: 'sms',       label: 'SMS'          },
            { value: 'whatsapp',  label: 'WhatsApp'     },
          ]}
          style={{ width: 140, height: 36 }}
        />
        <CustomSelect
          value={statusFilter}
          onChange={v => setStatusFilter(v as typeof statusFilter)}
          options={[
            { value: 'all',     label: 'All statuses' },
            { value: 'sent',    label: 'Sent'         },
            { value: 'failed',  label: 'Failed'       },
            { value: 'pending', label: 'Pending'      },
          ]}
          style={{ width: 140, height: 36 }}
        />
      </div>

      {/* Log table */}
      <div className={styles.card}>

        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: GRID,
          padding: '10px 20px',
          borderBottom: '1px solid var(--border)',
          fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--muted)',
        }}>
          <div>Time</div>
          <div>Patient</div>
          <div>Channel</div>
          <div>Type</div>
          <div>Status</div>
          <div>Message</div>
          <div>Actions</div>
        </div>

        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Loading notifications…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            {entries.length === 0
              ? 'No notifications yet. Issue a walk-in token or create an appointment to generate the first log entry.'
              : 'No entries match the selected filters.'}
          </div>
        )}

        {filtered.map(e => {
          const tm = TYPE_META[e.message_type];
          const sm = STATUS_META[e.status];
          return (
            <div
              key={e.id}
              style={{
                display: 'grid', gridTemplateColumns: GRID,
                padding: '13px 20px', alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                fontSize: 13,
              }}
            >
              {/* Time */}
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtDatetime(e.sent_at)}</div>

              {/* Patient */}
              <div>
                <div style={{ fontWeight: 500 }}>{e.patient_name || '—'}</div>
                {e.patient_phone && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{e.patient_phone}</div>
                )}
              </div>

              {/* Channel */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)' }}>
                {e.channel === 'sms' ? <SmsIcon /> : <WhatsAppIcon />}
                <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{e.channel}</span>
              </div>

              {/* Type */}
              <div>
                <span style={{
                  fontSize: 12, fontWeight: 500,
                  color: tm.color, background: tm.bg,
                  padding: '3px 9px', borderRadius: 20,
                }}>{tm.label}</span>
              </div>

              {/* Status */}
              <div>
                <span style={{
                  fontSize: 12, fontWeight: 500,
                  color: sm.color, background: sm.bg,
                  padding: '3px 9px', borderRadius: 20,
                }}>{sm.label}</span>
              </div>

              {/* Message preview */}
              <div style={{ color: 'var(--muted)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.message_content.slice(0, 70)}{e.message_content.length > 70 ? '…' : ''}
              </div>

              {/* Resend */}
              <div>
                <button
                  className={styles.actionBtn}
                  style={{ fontSize: 12, padding: '3px 10px', height: 'auto' }}
                  onClick={() => void resend(e)}
                  disabled={resendingId === e.id}
                >
                  {resendingId === e.id ? '…' : 'Resend'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
