'use client';

import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import { useRef, useEffect, useState, CSSProperties } from 'react';
import { Smartphone, Zap, Wifi, LayoutDashboard, type LucideIcon } from 'lucide-react';

/* ─── Animated counter ─────────────────────────────────────────────────── */
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const dur = 2200;
    function tick(now: number) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [inView, to]);

  return <span ref={ref}>{val.toLocaleString('en-IN')}{suffix}</span>;
}

/* ─── Scroll reveal (whileInView) ─────────────────────────────────────── */
function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: CSSProperties }) {
  return (
    <motion.div style={style}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >{children}</motion.div>
  );
}

/* ─── Glass base style ─────────────────────────────────────────────────── */
const glass: CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  borderRadius: 18,
};

/* ─── How-It-Works step card (whileInView + hover left-border) ────────── */
function StepCard({ step, Icon, title, desc, delay }: {
  step: string; Icon: React.FC; title: string; desc: string; delay: number;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        style={{
          ...glass,
          padding: '36px 30px',
          height: '100%',
          cursor: 'pointer',
          transition: 'border-color .2s, background .2s, transform .2s, box-shadow .2s',
          borderLeft: hovered ? '2px solid #0D9488' : '2px solid rgba(255,255,255,0.09)',
          transform: hovered ? 'scale(1.02)' : 'scale(1)',
          boxShadow: hovered ? '0 8px 40px rgba(13,148,136,.12)' : 'none',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={{ fontSize: 56, fontWeight: 900, color: 'rgba(255,255,255,.05)', letterSpacing: '-3px', lineHeight: 1, marginBottom: 24 }}>{step}</div>
        <div style={{ color: '#14D8C8', marginBottom: 16 }}><Icon /></div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.75 }}>{desc}</div>
      </div>
    </motion.div>
  );
}

/* ─── Feature card (hover lift + teal border + scale) ─────────────────── */
function FeatureCard({ Icon, title, desc, delay }: {
  Icon: LucideIcon; title: string; desc: string; delay: number;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Reveal delay={delay}>
      <div
        style={{
          ...glass,
          padding: '28px 28px',
          display: 'flex',
          gap: 22,
          alignItems: 'flex-start',
          cursor: 'pointer',
          transition: 'border-color .2s, transform .2s, box-shadow .2s',
          borderColor: hovered ? 'rgba(20,216,200,.3)' : 'rgba(255,255,255,.09)',
          transform: hovered ? 'translateY(-4px) scale(1.01)' : 'none',
          boxShadow: hovered ? '0 12px 40px rgba(13,148,136,.1)' : 'none',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 12, flexShrink: 0,
          background: 'rgba(13,148,136,.12)', border: '1px solid rgba(20,216,200,.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={22} color="#14D8C8" />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{title}</div>
          <div style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.7 }}>{desc}</div>
        </div>
      </div>
    </Reveal>
  );
}

/* ─── Scroll-aware nav ─────────────────────────────────────────────────── */
function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 64,
      borderBottom: '1px solid rgba(255,255,255,.06)',
      background: scrolled ? 'rgba(8,11,20,.88)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
      transition: 'background .3s, backdrop-filter .3s',
    }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px', height: '100%', display: 'flex', alignItems: 'center', gap: 40 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.5px', userSelect: 'none', color: '#14D8C8' }}>
          my<span style={{ color: '#fff' }}>turn</span>
        </div>
        <div style={{ display: 'flex', gap: 32, flex: 1 }}>
          {(['#features', '#how-it-works', '#pricing'] as const).map((href, i) => {
            const labels = ['Features', 'How it Works', 'Pricing'];
            return (
              <a key={href} href={href} style={{ fontSize: 14, color: '#94A3B8', textDecoration: 'none', fontWeight: 500, transition: 'color .15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
              >{labels[i]}</a>
            );
          })}
        </div>
        <Link href="/auth/login" style={{
          background: '#0D9488', color: '#fff', borderRadius: 9, padding: '9px 20px',
          fontSize: 14, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
          boxShadow: '0 0 24px rgba(13,148,136,.3)', transition: 'box-shadow .2s, opacity .15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '.88'; e.currentTarget.style.boxShadow = '0 0 32px rgba(13,148,136,.55)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.boxShadow = '0 0 24px rgba(13,148,136,.3)'; }}
        >Get Started Free</Link>
      </div>
    </nav>
  );
}

/* ─── Icons ────────────────────────────────────────────────────────────── */
const IconQR = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h2v2h-2zM18 14h3M14 18h1M17 18h1v1M19 20h2"/>
  </svg>
);
const IconPhone = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <rect x="5" y="2" width="14" height="20" rx="2.5"/><circle cx="12" cy="18" r="0.8" fill="currentColor"/>
  </svg>
);
const IconBell = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);
const IconCheck = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 8l3 3 7-7"/></svg>
);
const IconArrow = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
);

/* ═══════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  return (
    <>
      <style>{`
        @keyframes blob1{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(60px,-80px) scale(1.12)}66%{transform:translate(-45px,55px) scale(.94)}}
        @keyframes blob2{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(-70px,65px) scale(1.08)}66%{transform:translate(55px,-55px) scale(.96)}}
        @keyframes blob3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(35px,-60px) scale(1.15)}}
        @keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.8)}}
        @keyframes cardFloat{0%,100%{transform:translateY(0px)}50%{transform:translateY(-12px)}}
        .lp-blob{animation-timing-function:ease-in-out;animation-iteration-count:infinite;pointer-events:none;position:absolute;border-radius:50%;filter:blur(80px)}
        .lp-b1{animation-name:blob1;animation-duration:28s}
        .lp-b2{animation-name:blob2;animation-duration:24s}
        .lp-b3{animation-name:blob3;animation-duration:20s}
        .live-dot{animation:livePulse 1.8s ease infinite;display:inline-block;width:7px;height:7px;border-radius:50%;background:#14D8C8;flex-shrink:0}
        .card-float-0{animation:cardFloat 5s ease-in-out infinite;animation-delay:0s}
        .card-float-1{animation:cardFloat 5s ease-in-out infinite;animation-delay:0.8s}
        .card-float-2{animation:cardFloat 5s ease-in-out infinite;animation-delay:1.6s}
        .card-float-3{animation:cardFloat 5s ease-in-out infinite;animation-delay:2.4s}
        html{scroll-behavior:smooth}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px;background:#080B14}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
      `}</style>

      <div style={{
        background: `
          radial-gradient(ellipse at 20% 50%, rgba(124,58,237,.15) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(13,148,136,.15) 0%, transparent 50%),
          #080B14
        `,
        minHeight: '100vh',
        color: '#fff',
        fontFamily: "var(--font-dm-sans,'DM Sans',system-ui,sans-serif)",
        overflowX: 'hidden',
      }}>

        <Nav />

        {/* ═══ HERO ═════════════════════════════════════════════════ */}
        <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', padding: '100px 28px 80px' }}>
          {/* Blobs */}
          <div className="lp-blob lp-b1" style={{ top: '5%', left: '-10%', width: 700, height: 700, background: 'radial-gradient(circle, rgba(124,58,237,.2) 0%, transparent 70%)' }} />
          <div className="lp-blob lp-b2" style={{ top: '10%', right: '-14%', width: 780, height: 780, background: 'radial-gradient(circle, rgba(20,216,200,.12) 0%, transparent 70%)' }} />
          <div className="lp-blob lp-b3" style={{ bottom: '2%', left: '30%', width: 440, height: 440, background: 'radial-gradient(circle, rgba(124,58,237,.1) 0%, transparent 70%)' }} />

          {/* Grid overlay */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: 'linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }} />

          <div style={{ maxWidth: 1180, margin: '0 auto', width: '100%', position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>

              {/* ── Left copy ── */}
              <div>
                {/* Badge — delay 0 */}
                <motion.div
                  initial={{ opacity: 0, y: -14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: .5, delay: 0 }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(20,216,200,.07)', border: '1px solid rgba(20,216,200,.2)', borderRadius: 99, padding: '6px 14px', marginBottom: 32 }}
                >
                  <span className="live-dot" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#14D8C8', letterSpacing: '.5px' }}>Now live for Indian clinics</span>
                </motion.div>

                {/* Headline — delay 0.2 */}
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: .65, delay: .2, ease: [.22, 1, .36, 1] }}
                >
                  <h1 style={{ fontSize: 'clamp(44px,4.8vw,76px)', fontWeight: 900, lineHeight: 1.04, letterSpacing: '-2.5px', marginBottom: 28, margin: 0 }}>
                    No More Chaotic<br />
                    {/* Pill — delay 0.4 */}
                    <motion.span
                      initial={{ opacity: 0, scale: .95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: .5, delay: .4, ease: [.22, 1, .36, 1] }}
                      style={{ display: 'inline-block', marginTop: 10, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.13)', borderRadius: 18, padding: '2px 22px 8px', color: '#14D8C8' }}
                    >Waiting Rooms</motion.span>
                  </h1>
                </motion.div>

                {/* Subheadline — delay 0.6 */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: .65, delay: .6 }}
                  style={{ fontSize: 18, lineHeight: 1.75, color: '#94A3B8', marginTop: 24, marginBottom: 44, maxWidth: 460, fontWeight: 300 }}
                >
                  QR-based queue management built for Indian clinics.<br />Patients wait smarter, doctors run on time.
                </motion.p>

                {/* CTAs — delay 0.8 */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: .6, delay: .8 }}
                  style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}
                >
                  <Link href="/auth/login" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 9,
                    background: '#0D9488', color: '#fff', borderRadius: 11, padding: '15px 30px',
                    fontSize: 15, fontWeight: 700, textDecoration: 'none',
                    boxShadow: '0 0 50px rgba(13,148,136,.4)', transition: 'all .2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '.88'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 0 36px rgba(13,148,136,.6)'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 0 50px rgba(13,148,136,.4)'; }}
                  >Get Started Free <IconArrow /></Link>

                  <a href="#how-it-works" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 9,
                    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.13)',
                    color: '#fff', borderRadius: 11, padding: '15px 28px', fontSize: 15, fontWeight: 500, textDecoration: 'none', transition: 'all .2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.09)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.24)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.13)'; }}
                  >See How It Works</a>
                </motion.div>

                {/* Social proof — delay 1 */}
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: .6, delay: 1 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 36 }}
                >
                  <div style={{ display: 'flex' }}>
                    {(['#0D9488', '#7C3AED', '#F5A623', '#4DFFB4'] as const).map((c, i) => (
                      <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: '2px solid #080B14', marginLeft: i > 0 ? -8 : 0, zIndex: 4 - i }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 13, color: '#94A3B8' }}><strong style={{ color: '#fff' }}>500+</strong> clinics already on MyTurn</span>
                </motion.div>
              </div>

              {/* ── Right: floating cards ── */}
              <div style={{ position: 'relative', height: 500 }}>
                {/* Queue Live */}
                <div className="card-float-0" style={{ position: 'absolute', top: 20, left: 0, width: 258 }}>
                  <div style={{ ...glass, padding: '20px 22px', boxShadow: '0 0 30px rgba(13,148,136,.2), 0 24px 64px rgba(0,0,0,.55)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4DFFB4', display: 'inline-block', animation: 'livePulse 1.8s ease infinite' }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#4DFFB4', letterSpacing: '.8px', textTransform: 'uppercase' }}>Queue Live</span>
                    </div>
                    {([
                      { n: 1, name: 'Priya Krishnan', tag: 'In session', color: '#14D8C8' },
                      { n: 2, name: 'Ravi Sharma',    tag: 'Next up',    color: '#F5A623' },
                      { n: 3, name: 'Ananya Pillai',  tag: 'Waiting',    color: '#475569' },
                    ] as const).map(p => (
                      <div key={p.n} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <span style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#94A3B8', flexShrink: 0 }}>{p.n}</span>
                        <span style={{ fontSize: 13, flex: 1, color: '#E2E8F0', fontWeight: 500 }}>{p.name}</span>
                        <span style={{ fontSize: 10, color: p.color, fontWeight: 700 }}>{p.tag}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Avg Wait */}
                <div className="card-float-1" style={{ position: 'absolute', top: 10, right: 0, width: 212 }}>
                  <div style={{ ...glass, padding: '20px 22px', boxShadow: '0 24px 64px rgba(0,0,0,.55)' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>Avg Wait Time</div>
                    <div style={{ fontSize: 42, fontWeight: 900, color: '#14D8C8', letterSpacing: '-2px', lineHeight: 1, marginBottom: 4 }}>12</div>
                    <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 16 }}>minutes today</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 44 }}>
                      {[55, 72, 42, 88, 65, 50, 78, 60].map((h, i) => (
                        <div key={i} style={{ flex: 1, borderRadius: 4, height: `${h}%`, background: i === 3 ? '#14D8C8' : 'rgba(255,255,255,.1)' }} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* 47 patients */}
                <div className="card-float-2" style={{ position: 'absolute', bottom: 80, left: 24, width: 224 }}>
                  <div style={{ ...glass, background: 'rgba(13,148,136,.1)', border: '1px solid rgba(20,216,200,.22)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 20px 56px rgba(0,0,0,.55)' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(20,216,200,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#14D8C8" strokeWidth="2.2" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>47</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>patients served today</div>
                    </div>
                  </div>
                </div>

                {/* QR preview */}
                <div className="card-float-3" style={{ position: 'absolute', bottom: 0, right: 16, width: 186 }}>
                  <div style={{ ...glass, padding: '16px 18px', boxShadow: '0 20px 56px rgba(0,0,0,.55)' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 }}>Your QR code</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 3, marginBottom: 10 }}>
                      {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} style={{ height: 13, borderRadius: 3, background: [0, 1, 4, 5, 10, 11, 14, 15].includes(i) ? '#14D8C8' : 'rgba(255,255,255,.12)' }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: '#14D8C8', fontWeight: 600, textAlign: 'center' }}>Scan to join queue</div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═════════════════════════════════════════ */}
        <section id="how-it-works" style={{ padding: '110px 28px', borderTop: '1px solid rgba(255,255,255,.05)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <Reveal>
              <div style={{ textAlign: 'center', marginBottom: 72 }}>
                <motion.div
                  initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                  transition={{ duration: .5 }}
                  style={{ fontSize: 11, fontWeight: 700, color: '#0D9488', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 14 }}
                >How it works</motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ duration: .65, delay: .1, ease: [.22, 1, .36, 1] }}
                  style={{ fontSize: 'clamp(30px,3.8vw,54px)', fontWeight: 900, letterSpacing: '-1.8px', lineHeight: 1.08 }}
                >
                  Three steps to<br /><span style={{ color: '#94A3B8', fontWeight: 300, fontStyle: 'italic' }}>zero waiting room chaos</span>
                </motion.h2>
              </div>
            </Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
              <StepCard step="01" Icon={IconQR}    title="Clinic generates a QR"       desc="Doctor sets up a clinic profile and generates a unique QR code in under 2 minutes. No hardware required." delay={0} />
              <StepCard step="02" Icon={IconPhone} title="Patient scans & joins queue"  desc="Patient scans the code with any phone camera — no app, no sign-up. They're added to the live queue instantly." delay={0.15} />
              <StepCard step="03" Icon={IconBell}  title="Notified when it's their turn" desc="Live token updates on their phone. Wait comfortably — outside, in their car, or at a nearby café." delay={0.3} />
            </div>
          </div>
        </section>

        {/* ═══ FEATURES ═════════════════════════════════════════════ */}
        <section id="features" style={{ padding: '110px 28px', borderTop: '1px solid rgba(255,255,255,.05)', position: 'relative', overflow: 'hidden' }}>
          <div className="lp-blob lp-b2" style={{ top: '-20%', right: '-15%', width: 560, height: 560, background: 'radial-gradient(circle, rgba(124,58,237,.1) 0%, transparent 70%)' }} />
          <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <Reveal>
              <div style={{ textAlign: 'center', marginBottom: 72 }}>
                <motion.div
                  initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                  transition={{ duration: .5 }}
                  style={{ fontSize: 11, fontWeight: 700, color: '#0D9488', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 14 }}
                >Features</motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ duration: .65, delay: .1, ease: [.22, 1, .36, 1] }}
                  style={{ fontSize: 'clamp(30px,3.8vw,54px)', fontWeight: 900, letterSpacing: '-1.8px' }}
                >Built for how clinics<br />actually work</motion.h2>
              </div>
            </Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>
              <FeatureCard Icon={Smartphone}     title="No App Download Needed"   desc="Patients join by scanning a QR code. Works instantly in any smartphone browser — no install, no friction." delay={0} />
              <FeatureCard Icon={Zap}            title="Real-time Queue Updates"   desc="Live token numbers, estimated wait time, and status updates that refresh automatically." delay={0.09} />
              <FeatureCard Icon={Wifi}           title="Works on Any Phone"         desc="Optimised for Indian networks and low-end Android devices. Fast and lightweight on 2G." delay={0.18} />
              <FeatureCard Icon={LayoutDashboard} title="Doctor Dashboard"          desc="Manage the live queue, view daily stats, generate QR codes, and configure schedules — all in one place." delay={0.27} />
            </div>
          </div>
        </section>

        {/* ═══ STATS BAR ════════════════════════════════════════════ */}
        <section style={{
          padding: '80px 28px',
          background: 'linear-gradient(135deg, rgba(13,148,136,.1), rgba(124,58,237,.1))',
          borderTop: '1px solid rgba(255,255,255,.05)',
          borderBottom: '1px solid rgba(255,255,255,.05)',
        }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 40, textAlign: 'center' }}>
              {([
                { to: 500,   suffix: '+',    label: 'Clinics using MyTurn', note: 'and growing every day' },
                { to: 10000, suffix: '+',    label: 'Patients served',       note: 'across India' },
                { to: 12,    suffix: ' min', label: 'Avg wait reduction',    note: 'vs paper token systems' },
              ] as const).map(({ to, suffix, label, note }, i) => (
                <Reveal key={label} delay={i * 0.1}>
                  <div>
                    <div style={{ fontSize: 'clamp(40px,5vw,64px)', fontWeight: 900, letterSpacing: '-2.5px', color: '#14D8C8', lineHeight: 1 }}>
                      <Counter to={to} suffix={suffix} />
                    </div>
                    <div style={{ fontSize: 15, color: '#fff', fontWeight: 600, marginTop: 8 }}>{label}</div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{note}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ PRICING ══════════════════════════════════════════════ */}
        <section id="pricing" style={{ padding: '110px 28px', borderTop: '1px solid rgba(255,255,255,.05)' }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <Reveal>
              <div style={{ textAlign: 'center', marginBottom: 72 }}>
                <motion.div
                  initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                  transition={{ duration: .5 }}
                  style={{ fontSize: 11, fontWeight: 700, color: '#0D9488', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 14 }}
                >Pricing</motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ duration: .65, delay: .1, ease: [.22, 1, .36, 1] }}
                  style={{ fontSize: 'clamp(30px,3.8vw,54px)', fontWeight: 900, letterSpacing: '-1.8px' }}
                >Simple, honest pricing</motion.h2>
                <p style={{ fontSize: 16, color: '#94A3B8', marginTop: 16, fontWeight: 300 }}>Start free. Upgrade when you&apos;re ready. No contracts.</p>
              </div>
            </Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 22 }}>
              {/* Free */}
              <Reveal delay={0.05}>
                <div style={{ ...glass, padding: '40px 36px', height: '100%', cursor: 'pointer', transition: 'transform .2s, box-shadow .2s' }}
                  onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'scale(1.02)'; d.style.boxShadow = '0 8px 40px rgba(0,0,0,.3)'; }}
                  onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'none'; d.style.boxShadow = 'none'; }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', letterSpacing: '.5px', marginBottom: 10 }}>Free</div>
                  <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-2.5px', color: '#fff', lineHeight: 1, marginBottom: 4 }}>₹0</div>
                  <div style={{ fontSize: 14, color: '#475569', marginBottom: 32 }}>Forever free — no credit card needed</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {['1 doctor', 'Up to 20 patients / day', 'QR code for your clinic', 'Live queue dashboard', 'Basic analytics'].map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#CBD5E1' }}>
                        <span style={{ color: '#0D9488', flexShrink: 0 }}><IconCheck /></span>{f}
                      </div>
                    ))}
                  </div>
                  <Link href="/auth/login" style={{
                    display: 'block', textAlign: 'center', marginTop: 36,
                    border: '1px solid rgba(255,255,255,.15)', borderRadius: 11, padding: 14,
                    fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none', transition: 'all .15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.3)'; e.currentTarget.style.background = 'rgba(255,255,255,.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)'; e.currentTarget.style.background = 'transparent'; }}
                  >Get Started Free</Link>
                </div>
              </Reveal>

              {/* Pro */}
              <Reveal delay={0.12}>
                <div style={{
                  background: 'rgba(13,148,136,.09)', border: '1px solid rgba(20,216,200,.35)',
                  borderRadius: 18, padding: '40px 36px', height: '100%', position: 'relative',
                  boxShadow: '0 0 80px rgba(13,148,136,.18)',
                  cursor: 'pointer', transition: 'transform .2s, box-shadow .2s',
                }}
                  onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'scale(1.02)'; d.style.boxShadow = '0 0 100px rgba(13,148,136,.3)'; }}
                  onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'none'; d.style.boxShadow = '0 0 80px rgba(13,148,136,.18)'; }}
                >
                  <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg,#0D9488,#14D8C8)', borderRadius: 99, padding: '5px 18px', fontSize: 11, fontWeight: 800, color: '#080B14', whiteSpace: 'nowrap' }}>✦ Most Popular</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#14D8C8', letterSpacing: '.5px', marginBottom: 10 }}>Pro</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-2.5px', color: '#fff', lineHeight: 1 }}>₹999</span>
                    <span style={{ fontSize: 14, color: '#94A3B8' }}>/month</span>
                  </div>
                  <div style={{ fontSize: 14, color: '#475569', marginBottom: 32 }}>Billed monthly — cancel anytime</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {['Unlimited doctors', 'Unlimited patients / day', 'Advanced analytics dashboard', 'WhatsApp appointment alerts', 'Multi-doctor support', 'Priority support'].map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#E2E8F0' }}>
                        <span style={{ color: '#14D8C8', flexShrink: 0 }}><IconCheck /></span>{f}
                      </div>
                    ))}
                  </div>
                  <Link href="/auth/login" style={{
                    display: 'block', textAlign: 'center', marginTop: 36,
                    background: '#0D9488', borderRadius: 11, padding: 14,
                    fontSize: 14, fontWeight: 700, color: '#fff', textDecoration: 'none',
                    boxShadow: '0 0 36px rgba(13,148,136,.45)', transition: 'box-shadow .2s, opacity .15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '.85'; e.currentTarget.style.boxShadow = '0 0 50px rgba(13,148,136,.65)'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.boxShadow = '0 0 36px rgba(13,148,136,.45)'; }}
                  >Start Pro Trial</Link>
                </div>
              </Reveal>
            </div>
            <Reveal delay={0.2}>
              <p style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: '#475569' }}>
                All plans include SSL, 99.9% uptime, and Indian data residency.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ═══ FOOTER ═══════════════════════════════════════════════ */}
        <footer style={{ padding: '52px 28px', borderTop: '1px solid rgba(255,255,255,.05)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#14D8C8', letterSpacing: '-.5px', marginBottom: 5 }}>my<span style={{ color: '#fff' }}>turn</span></div>
              <div style={{ fontSize: 13, color: '#475569' }}>Built for Bharat&apos;s clinics</div>
            </div>
            <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
              {([['#', 'Privacy Policy'], ['mailto:support@myturnapp.online', 'Contact']] as const).map(([href, label]) => (
                <a key={label} href={href} style={{ fontSize: 13, color: '#475569', textDecoration: 'none', transition: 'color .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#94A3B8')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
                >{label}</a>
              ))}
              <span style={{ fontSize: 13, color: '#2D3748' }}>© {new Date().getFullYear()} MyTurn</span>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
