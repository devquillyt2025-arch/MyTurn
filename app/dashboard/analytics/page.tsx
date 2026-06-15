'use client';

import { useState, useEffect } from 'react';
import styles from '../page.module.css';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

const WEEK_DATA = [
  { day: 'Mon', count: 9 }, { day: 'Tue', count: 12 }, { day: 'Wed', count: 8 },
  { day: 'Thu', count: 14 }, { day: 'Fri', count: 11 }, { day: 'Sat', count: 7 }, { day: 'Sun', count: 13 },
];

const PEAK_DATA = [
  { label: '8–9 AM', count: 2 }, { label: '9–10 AM', count: 14 }, { label: '10–11 AM', count: 18 },
  { label: '11–12 PM', count: 12 }, { label: '12–1 PM', count: 6 },
  { label: '2–3 PM', count: 9 }, { label: '3–4 PM', count: 11 }, { label: '4–5 PM', count: 7 },
];

const weekMax = Math.max(...WEEK_DATA.map(d => d.count));
const peakMax = Math.max(...PEAK_DATA.map(d => d.count));

const SUMMARY = [
  { label: 'Total patients (7d)', val: '74',   cls: 'teal',  change: '↑ 12% vs last week',  changeColor: '' },
  { label: 'Avg patients/day',    val: '10.6', cls: 'green', change: '↑ On track',          changeColor: '' },
  { label: 'Avg wait time',       val: '18m',  cls: '',      change: '−3m vs usual',         changeColor: 'var(--teal)' },
  { label: 'No-shows',            val: '4',    cls: 'red',   change: '5.4% rate',            changeColor: 'var(--red)' },
] as const;

/** Quote a CSV cell if it contains a comma, quote, or newline. */
function csvCell(v: string | number): string {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function AnalyticsPage() {
  const [clinicName, setClinicName] = useState('');

  function exportCsv() {
    const rows: string[] = [];
    rows.push('MyTurn Analytics Export');
    rows.push(`Clinic,${csvCell(clinicName || '—')}`);
    rows.push(`Generated,${csvCell(new Date().toLocaleString('en-IN'))}`);
    rows.push('Range,Last 7 days');
    rows.push('');
    rows.push('Summary');
    rows.push('Metric,Value');
    SUMMARY.forEach(s => rows.push(`${csvCell(s.label)},${csvCell(s.val)}`));
    rows.push('');
    rows.push('Patients per day');
    rows.push('Day,Count');
    WEEK_DATA.forEach(d => rows.push(`${csvCell(d.day)},${d.count}`));
    rows.push('');
    rows.push('Peak hour distribution');
    rows.push('Hour,Count');
    PEAK_DATA.forEach(d => rows.push(`${csvCell(d.label)},${d.count}`));

    // Prepend a UTF-8 BOM so Excel renders the – / ↑ characters correctly.
    const csv = '﻿' + rows.join('\r\n');
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

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('clinics')
        .select('name')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.name) setClinicName(data.name);
        });
    });
  }, []);

  return (
    <div className={styles.routePage}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>Analytics</div>
          <div className={styles.pageSub}>Last 7 days · {clinicName}</div>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className={styles.actionBtn}>This week</button>
          <button className={styles.actionBtn} onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <div className={styles.analyticsGrid}>
        {SUMMARY.map(s => {
          const clsName = s.cls ? (styles[s.cls as keyof typeof styles] ?? '') : '';
          return (
            <div key={s.label} className={styles.statCard}>
              <div className={styles.statLabel}>{s.label}</div>
              <div className={`${styles.statVal} ${clsName}`} style={clsName ? {} : {fontSize:28}}>{s.val}</div>
              <div className={styles.statChange} style={s.changeColor ? {color:s.changeColor} : {}}>{s.change}</div>
            </div>
          );
        })}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:20,marginBottom:20,alignItems:'start'}}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1.5" y="8.5" width="3" height="6" rx="1"/><rect x="6.5" y="5.5" width="3" height="9" rx="1"/><rect x="11.5" y="2.5" width="3" height="12" rx="1"/></svg>
            <span className={styles.cardTitle}>Patients per day</span>
            <span className={styles.cardSub}>Mon – Sun</span>
          </div>
          <div style={{padding:'20px 20px 16px'}}>
            <div className={styles.weekChartRow}>
              {WEEK_DATA.map(d => {
                const h = Math.round((d.count / weekMax) * 100);
                return (
                  <div key={d.day} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
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
            <span className={styles.cardTitle}>Visit breakdown</span>
          </div>
          <div className={styles.donutWrap}>
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="38" fill="none" stroke="var(--surface2)" strokeWidth="18"/>
              <circle cx="50" cy="50" r="38" fill="none" stroke="var(--teal)" strokeWidth="18" strokeDasharray="143 95" strokeDashoffset="-24" strokeLinecap="round"/>
              <circle cx="50" cy="50" r="38" fill="none" stroke="var(--amber)" strokeWidth="18" strokeDasharray="57 181" strokeDashoffset="-167" strokeLinecap="round"/>
              <circle cx="50" cy="50" r="38" fill="none" stroke="var(--purple)" strokeWidth="18" strokeDasharray="38 200" strokeDashoffset="-224" strokeLinecap="round"/>
            </svg>
            <div className={styles.donutLegend}>
              <div className={styles.legendItem}><div className={styles.legendDot} style={{background:'var(--teal)'}}></div>Follow-up — 60%</div>
              <div className={styles.legendItem}><div className={styles.legendDot} style={{background:'var(--amber)'}}></div>New visit — 24%</div>
              <div className={styles.legendItem}><div className={styles.legendDot} style={{background:'var(--purple)'}}></div>Consultation — 16%</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12l3.5-4 3 3L12 5l2 2"/></svg>
          <span className={styles.cardTitle}>Peak hour distribution</span>
          <span className={styles.cardSub}>Avg across 7 days</span>
        </div>
        <div style={{padding:'8px 0'}}>
          {PEAK_DATA.map(d => (
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
