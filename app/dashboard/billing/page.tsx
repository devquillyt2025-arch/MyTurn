'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from '../page.module.css';
import { createClient } from '@/lib/supabase/client';
import { useClinic } from '../clinic-context';
import { CustomSelect } from '@/components/CustomSelect';
import toast from 'react-hot-toast';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type InvoiceStatus  = 'paid' | 'pending' | 'refunded';
type PaymentMethod  = 'cash' | 'upi' | 'razorpay';
type DateFilterKey  = 'today' | 'week' | 'month' | 'all';

interface Invoice {
  id: string;
  clinic_id: string;
  booking_id: string | null;
  patient_name: string;
  amount: number;
  consultation_fee: number;
  status: InvoiceStatus;
  payment_method: PaymentMethod | null;
  razorpay_payment_id: string | null;
  visit_date: string;
  created_at: string;
}

// ── Date helpers ────────────────────────────────────────────────────────────

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function weekStartIST(): string {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const dow = ist.getDay();
  ist.setDate(ist.getDate() - (dow === 0 ? 6 : dow - 1)); // Monday start
  return ist.toLocaleDateString('en-CA');
}

function monthStartIST(): string {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-01`;
}

function fmtDate(iso: string): string {
  const [, mo, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[mo - 1]}`;
}

function fmtRupee(n: number): string {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

function fmtDatetime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Constants ───────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<InvoiceStatus, { color: string; bg: string; label: string }> = {
  paid:     { color: 'var(--green)', bg: 'var(--green-dim)',  label: 'Paid'     },
  pending:  { color: 'var(--amber)', bg: 'var(--amber-dim)',  label: 'Pending'  },
  refunded: { color: 'var(--red)',   bg: 'var(--red-dim)',    label: 'Refunded' },
};

const METHOD_LABEL: Record<string, string> = { cash: 'Cash', upi: 'UPI', razorpay: 'Razorpay' };

const DATE_FILTER_OPTS: { key: DateFilterKey; label: string }[] = [
  { key: 'today', label: 'Today'      },
  { key: 'week',  label: 'This week'  },
  { key: 'month', label: 'This month' },
  { key: 'all',   label: 'All time'   },
];

// ── Table grid layout ────────────────────────────────────────────────────────
const GRID = '90px 1fr 100px 110px 110px 160px';

// ── Component ───────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { selected: clinic } = useClinic();

  const [invoices,    setInvoices]    = useState<Invoice[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [dateFilter,  setDateFilter]  = useState<DateFilterKey>('month');
  const [statusFilter,setStatusFilter]= useState<'all' | InvoiceStatus>('all');
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [markPayingId,setMarkPayingId]= useState<string | null>(null);
  const [payMethod,   setPayMethod]   = useState<PaymentMethod>('cash');
  const [marking,     setMarking]     = useState(false);

  const load = useCallback(async (clinicId: string) => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });
    if (!error && data) setInvoices(data as Invoice[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!clinic) return;
    void load(clinic.id);
  }, [clinic?.id, load]);

  // ── Derived values ──────────────────────────────────────────────────────

  const today      = todayIST();
  const weekStart  = weekStartIST();
  const monthStart = monthStartIST();

  const filtered = invoices.filter(inv => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (dateFilter === 'today') return inv.visit_date === today;
    if (dateFilter === 'week')  return inv.visit_date >= weekStart;
    if (dateFilter === 'month') return inv.visit_date >= monthStart;
    return true;
  });

  const todayRevenue  = invoices.filter(i => i.visit_date === today     && i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  const monthRevenue  = invoices.filter(i => i.visit_date >= monthStart && i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  const pendingCount  = invoices.filter(i => i.status === 'pending').length;
  const totalInvoices = invoices.length;

  // ── Actions ─────────────────────────────────────────────────────────────

  async function markAsPaid(invoiceId: string) {
    setMarking(true);
    const res = await fetch('/api/invoices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: invoiceId, status: 'paid', payment_method: payMethod }),
    });
    setMarking(false);
    if (!res.ok) { toast.error('Could not update invoice.'); return; }
    toast.success('Invoice marked as paid');
    setMarkPayingId(null);
    if (clinic) void load(clinic.id);
  }

  async function markAs(invoiceId: string, status: InvoiceStatus) {
    const res = await fetch('/api/invoices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: invoiceId, status }),
    });
    if (!res.ok) { toast.error('Could not update invoice.'); return; }
    toast.success(`Marked as ${status}`);
    setExpandedId(null);
    if (clinic) void load(clinic.id);
  }

  function exportCSV() {
    const header = 'Date,Patient,Amount,Consultation Fee,Payment Method,Status\n';
    const rows = filtered.map(i =>
      [`"${i.visit_date}"`, `"${i.patient_name}"`, i.amount, i.consultation_fee, i.payment_method ?? '', i.status].join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `invoices-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={styles.routePage}>

      {/* Page header */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>Billing &amp; Invoices</div>
          <div className={styles.pageSub}>
            {clinic?.name ?? ''} · {filtered.length} invoice{filtered.length !== 1 ? 's' : ''} shown
          </div>
        </div>
        <button
          className={styles.actionBtn}
          onClick={exportCSV}
          disabled={filtered.length === 0}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8 2v9M4 8l4 4 4-4"/><path d="M2 13.5h12"/>
          </svg>
          Export CSV
        </button>
      </div>

      {/* Stats row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Today&apos;s revenue</div>
          <div className={`${styles.statVal} ${styles.green}`} style={{ fontSize: 26 }}>{fmtRupee(todayRevenue)}</div>
          <div className={styles.statChange} style={{ color: 'var(--muted)' }}>Paid today</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>This month</div>
          <div className={`${styles.statVal} ${styles.teal}`} style={{ fontSize: 26 }}>{fmtRupee(monthRevenue)}</div>
          <div className={styles.statChange} style={{ color: 'var(--muted)' }}>{MONTHS[new Date().getMonth()]} earnings</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pending</div>
          <div className={`${styles.statVal} ${styles.amber}`} style={{ fontSize: 26 }}>{pendingCount}</div>
          <div className={styles.statChange} style={{ color: 'var(--muted)' }}>Awaiting payment</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total invoices</div>
          <div className={styles.statVal} style={{ fontSize: 26 }}>{totalInvoices}</div>
          <div className={styles.statChange} style={{ color: 'var(--muted)' }}>All time</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
          {DATE_FILTER_OPTS.map(o => (
            <button
              key={o.key}
              className={styles.actionBtn}
              style={{ background: dateFilter === o.key ? 'var(--border)' : 'transparent', border: 'none', padding: '4px 12px', minHeight: 28, fontSize: 13 }}
              onClick={() => setDateFilter(o.key)}
            >{o.label}</button>
          ))}
        </div>
        <CustomSelect
          value={statusFilter}
          onChange={v => setStatusFilter(v as typeof statusFilter)}
          options={[
            { value: 'all',      label: 'All statuses' },
            { value: 'pending',  label: 'Pending'      },
            { value: 'paid',     label: 'Paid'         },
            { value: 'refunded', label: 'Refunded'     },
          ]}
          style={{ width: 150, height: 36 }}
        />
      </div>

      {/* Invoice table */}
      <div className={styles.card}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: GRID,
          padding: '10px 20px',
          borderBottom: '1px solid var(--border)',
          fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--muted)',
        }}>
          <div>Date</div><div>Patient</div><div>Amount</div>
          <div>Method</div><div>Status</div><div>Actions</div>
        </div>

        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Loading invoices…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            {invoices.length === 0
              ? 'No invoices yet. Invoices are created automatically when you mark a patient as done.'
              : 'No invoices match the selected filters.'}
          </div>
        )}

        {filtered.map(inv => {
          const sc          = STATUS_STYLE[inv.status];
          const isExpanded  = expandedId  === inv.id;
          const isPaying    = markPayingId === inv.id;

          return (
            <div key={inv.id}>
              {/* Row */}
              <div
                role="button"
                style={{
                  display: 'grid', gridTemplateColumns: GRID,
                  padding: '14px 20px', alignItems: 'center',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer', transition: 'background 0.1s',
                  background: isExpanded ? 'rgba(20,184,166,0.04)' : 'transparent',
                }}
                onClick={() => {
                  setExpandedId(isExpanded ? null : inv.id);
                  if (isPaying) setMarkPayingId(null);
                }}
              >
                {/* Date */}
                <div style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 500 }}>{fmtDate(inv.visit_date)}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{inv.visit_date.slice(0, 4)}</div>
                </div>

                {/* Patient */}
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{inv.patient_name}</div>
                  {inv.booking_id && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Booking linked</div>
                  )}
                </div>

                {/* Amount */}
                <div style={{ fontWeight: 600, fontSize: 14 }}>{fmtRupee(Number(inv.amount))}</div>

                {/* Method */}
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {inv.payment_method ? METHOD_LABEL[inv.payment_method] : '—'}
                </div>

                {/* Status badge */}
                <div>
                  <span style={{
                    fontSize: 12, fontWeight: 500,
                    color: sc.color, background: sc.bg,
                    padding: '3px 10px', borderRadius: 20,
                  }}>{sc.label}</span>
                </div>

                {/* Actions — stop row click from propagating */}
                <div onClick={e => e.stopPropagation()}>
                  {inv.status === 'pending' && !isPaying && (
                    <button
                      className={`${styles.actionBtn} ${styles.primary}`}
                      style={{ fontSize: 12, padding: '4px 12px', height: 'auto' }}
                      onClick={() => { setMarkPayingId(inv.id); setExpandedId(null); }}
                    >Mark as paid</button>
                  )}

                  {isPaying && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <CustomSelect
                        value={payMethod}
                        onChange={v => setPayMethod(v as PaymentMethod)}
                        options={[
                          { value: 'cash', label: 'Cash' },
                          { value: 'upi',  label: 'UPI'  },
                        ]}
                        style={{ width: 82, height: 28, fontSize: 12 }}
                      />
                      <button
                        className={`${styles.actionBtn} ${styles.primary}`}
                        style={{ fontSize: 12, padding: '3px 10px', height: 'auto' }}
                        onClick={() => void markAsPaid(inv.id)}
                        disabled={marking}
                      >{marking ? '…' : 'Confirm'}</button>
                      <button
                        className={styles.actionBtn}
                        style={{ fontSize: 12, padding: '3px 8px', height: 'auto' }}
                        onClick={() => setMarkPayingId(null)}
                      >✕</button>
                    </div>
                  )}

                  {inv.status === 'paid' && (
                    <span style={{ fontSize: 12, color: 'var(--green)' }}>✓ Paid · {METHOD_LABEL[inv.payment_method ?? ''] ?? ''}</span>
                  )}

                  {inv.status === 'refunded' && (
                    <span style={{ fontSize: 12, color: 'var(--red)' }}>↩ Refunded</span>
                  )}
                </div>
              </div>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div style={{
                  padding: '16px 24px 20px',
                  background: 'rgba(20,184,166,0.03)',
                  borderLeft: '3px solid var(--teal)',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 20, marginBottom: inv.status === 'pending' ? 20 : 0,
                  }}>
                    {[
                      { label: 'Invoice ref',       value: `#${inv.id.slice(0, 8).toUpperCase()}` },
                      { label: 'Visit date',         value: `${fmtDate(inv.visit_date)} ${inv.visit_date.slice(0, 4)}` },
                      { label: 'Consultation fee',   value: fmtRupee(Number(inv.consultation_fee)) },
                      { label: 'Amount charged',     value: fmtRupee(Number(inv.amount)) },
                      { label: 'Payment method',     value: inv.payment_method ? METHOD_LABEL[inv.payment_method] : 'Not yet recorded' },
                      { label: 'Status',             value: sc.label },
                      { label: 'Created',            value: fmtDatetime(inv.created_at) },
                    ].map(f => (
                      <div key={f.label}>
                        <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{f.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{f.value}</div>
                      </div>
                    ))}
                  </div>

                  {inv.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className={`${styles.actionBtn} ${styles.primary}`}
                        style={{ fontSize: 13 }}
                        onClick={() => { setMarkPayingId(inv.id); setExpandedId(null); }}
                      >Mark as paid</button>
                      <button
                        className={styles.actionBtn}
                        style={{ fontSize: 13, color: 'var(--red)', borderColor: 'rgba(239,68,68,0.4)' }}
                        onClick={() => void markAs(inv.id, 'refunded')}
                      >Mark as refunded</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
