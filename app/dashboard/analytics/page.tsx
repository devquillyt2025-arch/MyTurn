'use client';

import { useState, useEffect } from 'react';
import styles from '../page.module.css';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hourLabel(h: number): string {
  const h12 = (x: number) => x % 12 || 12;
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h12(h)}–${h12(h + 1)} ${ap}`;
}

/** Quote a CSV cell if it contains a comma, quote, or newline. */
function csvCell(v: string | number): string {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type Row = { dateIso: string; hour: number; status: string };
type SlotRel = { date?: string; time?: string };
type RawBooking = { status: string | null; created_at: string; slots?: SlotRel | SlotRel[] | null };

// Each booking's day/hour comes from its linked slot; walk-ins fall back to creation time.
function toRow(b: RawBooking): Row {
  const slot = (Array.isArray(b.slots) ? b.slots[0] : b.slots) ?? null;
  if (slot?.date) {
    const h = slot.time ? Number(slot.time.split(':')[0]) : new Date(b.created_at).getHours();
    return { dateIso: slot.date, hour: Number.isNaN(h) ? 0 : h, status: b.status ?? 'waiting' };
  }
  const d = new Date(b.created_at);
  return { dateIso: toLocalIso(d), hour: d.getHours(), status: b.status ?? 'waiting' };
}

export default function AnalyticsPage() {
  const [clinicName, setClinicName] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
      if (!user) { setLoading(false); return; }
      supabase
        .from('clinics')
        .select('id, name')
        .eq('user_id', user.id)
        .single()
        .then(async ({ data }) => {
          if (!data) { setLoading(false); return; }
          if (data.name) setClinicName(data.name);

          const today = new Date();
          const start = new Date(today);
          start.setDate(today.getDate() - 6);
          const from = toLocalIso(start);
          const to = toLocalIso(today);

          const [booked, walkins] = await Promise.all([
            supabase.from('bookings').select('status, created_at, slots!inner(date, time)')
              .eq('clinic_id', data.id).gte('slots.date', from).lte('slots.date', to),
            supabase.from('bookings').select('status, created_at, slots(date, time)')
              .eq('clinic_id', data.id).is('slot_id', null)
              .gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`),
          ]);

          const all = [...(booked.data ?? []), ...(walkins.data ?? [])] as RawBooking[];
          setRows(all.map(toRow));
          setLoading(false);
        });
    });
  }, []);

  // ── Derived stats ──────────────────────────────────────────────────────
  const today = new Date();
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 6 + i);
    const iso = toLocalIso(d);
    return { day: DAY_ABBR[d.getDay()], count: rows.filter(r => r.dateIso === iso).length };
  });

  const total = rows.length;
  const avgPerDay = total ? total / 7 : 0;
  const done = rows.filter(r => r.status === 'done').length;
  const skipped = rows.filter(r => r.status === 'skipped').length;
  const waiting = rows.filter(r => r.status === 'waiting').length;
  const inSession = rows.filter(r => r.status === 'called').length;
  const completedPct = total ? Math.round((done / total) * 100) : 0;
  const noShowRate = total ? Math.round((skipped / total) * 100) : 0;

  const hourCounts: Record<number, number> = {};
  rows.forEach(r => { hourCounts[r.hour] = (hourCounts[r.hour] || 0) + 1; });
  const peak = Object.keys(hourCounts).map(Number).sort((a, b) => a - b)
    .map(h => ({ label: hourLabel(h), count: hourCounts[h] }));

  const weekMax = Math.max(1, ...perDay.map(d => d.count));
  const peakMax = Math.max(1, ...peak.map(p => p.count));

  const summary = [
    { label: 'Total patients (7d)', val: String(total), cls: 'teal', change: 'Last 7 days', color: '' },
    { label: 'Avg patients/day', val: total ? avgPerDay.toFixed(1) : '0', cls: 'green', change: 'Across 7 days', color: '' },
    { label: 'Completed', val: String(done), cls: '', change: `${completedPct}% of total`, color: 'var(--teal)' },
    { label: 'No-shows', val: String(skipped), cls: 'red', change: `${noShowRate}% rate`, color: 'var(--red)' },
  ] as const;

  // Status breakdown donut segments
  const statusSegs = [
    { label: 'Done', val: done, color: 'var(--teal)' },
    { label: 'Waiting', val: waiting, color: 'var(--amber)' },
    { label: 'In session', val: inSession, color: 'var(--purple)' },
    { label: 'Skipped', val: skipped, color: 'var(--red)' },
  ].filter(s => s.val > 0);
  const C = 2 * Math.PI * 38;
  let acc = 0;
  const arcs = statusSegs.map(s => {
    const dash = (total ? s.val / total : 0) * C;
    const arc = { ...s, dash, offset: -acc, pct: total ? Math.round((s.val / total) * 100) : 0 };
    acc += dash;
    return arc;
  });

  function exportCsv() {
    const rowsOut: string[] = [];
    rowsOut.push('MyTurn Analytics Export');
    rowsOut.push(`Clinic,${csvCell(clinicName || '—')}`);
    rowsOut.push(`Generated,${csvCell(new Date().toLocaleString('en-IN'))}`);
    rowsOut.push('Range,Last 7 days');
    rowsOut.push('');
    rowsOut.push('Summary');
    rowsOut.push('Metric,Value');
    summary.forEach(s => rowsOut.push(`${csvCell(s.label)},${csvCell(s.val)}`));
    rowsOut.push('');
    rowsOut.push('Patients per day');
    rowsOut.push('Day,Count');
    perDay.forEach(d => rowsOut.push(`${csvCell(d.day)},${d.count}`));
    rowsOut.push('');
    rowsOut.push('Peak hour distribution');
    rowsOut.push('Hour,Count');
    peak.forEach(d => rowsOut.push(`${csvCell(d.label)},${d.count}`));

    // Prepend a UTF-8 BOM so Excel renders the – character correctly.
    const csv = '﻿' + rowsOut.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (clinicName || 'clinic').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `myturn-analytics-${safeName || 'clinic'}-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Analytics exported');
  }

  return (
    <div className={styles.routePage}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>Analytics</div>
          <div className={styles.pageSub}>Last 7 days · {clinicName}</div>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className={styles.actionBtn}>This week</button>
          <button className={styles.actionBtn} onClick={exportCsv} disabled={total === 0}>Export CSV</button>
        </div>
      </div>

      {!loading && total === 0 && (
        <div className={styles.card} style={{padding:'40px 20px',textAlign:'center',color:'var(--muted)',fontSize:14,marginBottom:20}}>
          No patients in the last 7 days yet — stats will appear here as bookings come in.
        </div>
      )}

      <div className={styles.analyticsGrid}>
        {summary.map(s => {
          const clsName = s.cls ? (styles[s.cls as keyof typeof styles] ?? '') : '';
          return (
            <div key={s.label} className={styles.statCard}>
              <div className={styles.statLabel}>{s.label}</div>
              <div className={`${styles.statVal} ${clsName}`} style={clsName ? {} : {fontSize:28}}>{s.val}</div>
              <div className={styles.statChange} style={s.color ? {color:s.color} : {}}>{s.change}</div>
            </div>
          );
        })}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:20,marginBottom:20,alignItems:'start'}}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1.5" y="8.5" width="3" height="6" rx="1"/><rect x="6.5" y="5.5" width="3" height="9" rx="1"/><rect x="11.5" y="2.5" width="3" height="12" rx="1"/></svg>
            <span className={styles.cardTitle}>Patients per day</span>
            <span className={styles.cardSub}>Last 7 days</span>
          </div>
          <div style={{padding:'20px 20px 16px'}}>
            <div className={styles.weekChartRow}>
              {perDay.map((d, i) => {
                const h = Math.round((d.count / weekMax) * 100);
                return (
                  <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                    <div style={{fontSize:11,color:'var(--text)',fontWeight:500}}>{d.count}</div>
                    <div style={{width:'100%',height:`${h}px`,background:'var(--teal)',opacity:0.75,borderRadius:'4px 4px 0 0',minHeight:4}}></div>
                    <div style={{fontSize:11,color:'var(--muted)'}}>{d.day}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v5.5l3.5 3.5"/></svg>
            <span className={styles.cardTitle}>Status breakdown</span>
          </div>
          <div className={styles.donutWrap}>
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="38" fill="none" stroke="var(--surface2)" strokeWidth="18"/>
              {arcs.map(a => (
                <circle key={a.label} cx="50" cy="50" r="38" fill="none" stroke={a.color} strokeWidth="18"
                  strokeDasharray={`${a.dash} ${C - a.dash}`} strokeDashoffset={a.offset}
                  transform="rotate(-90 50 50)" />
              ))}
            </svg>
            <div className={styles.donutLegend}>
              {arcs.length === 0 ? (
                <div style={{fontSize:13,color:'var(--muted)'}}>No data yet</div>
              ) : arcs.map(a => (
                <div key={a.label} className={styles.legendItem}>
                  <div className={styles.legendDot} style={{background:a.color}}></div>{a.label} — {a.val} ({a.pct}%)
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12l3.5-4 3 3L12 5l2 2"/></svg>
          <span className={styles.cardTitle}>Peak hour distribution</span>
          <span className={styles.cardSub}>Last 7 days</span>
        </div>
        <div style={{padding:'8px 0'}}>
          {peak.length === 0 ? (
            <div style={{padding:'24px 20px',textAlign:'center',color:'var(--muted)',fontSize:13}}>No bookings yet</div>
          ) : peak.map(d => (
            <div key={d.label} className={styles.slotBarRow}>
              <span className={styles.slotTimeLabel} style={{width:80}}>{d.label}</span>
              <div className={styles.slotBarTrack}>
                <div className={styles.slotBarFill} style={{width:`${Math.round((d.count/peakMax)*100)}%`,background:'var(--purple)'}}></div>
              </div>
              <span className={styles.slotBarCount}>{d.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
