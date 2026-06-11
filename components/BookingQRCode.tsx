'use client';

import { useRef, useState } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';

interface BookingQRCodeProps {
  slug: string;
  clinicName?: string;
  size?: number;
}

export function BookingQRCode({ slug, clinicName = 'clinic', size = 160 }: BookingQRCodeProps) {
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const base = process.env.NEXT_PUBLIC_BOOKING_BASE_URL ?? 'https://myturnapp.online';
  const bookingUrl = `${base}/book/${slug}`;

  function copyLink() {
    function succeed() {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
    function fallback() {
      const el = document.createElement('textarea');
      el.value = bookingUrl;
      el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      succeed();
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(bookingUrl).then(succeed).catch(fallback);
    } else {
      fallback();
    }
  }

  function downloadQR() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const safe = (clinicName || 'clinic')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `booking-qr-${safe}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <>
      {copied && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0D7377',
            color: '#fff',
            padding: '10px 22px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            zIndex: 10000,
            pointerEvents: 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          Link copied to clipboard!
        </div>
      )}

      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            background: '#ffffff',
            padding: 14,
            borderRadius: 10,
            display: 'inline-block',
            marginBottom: 14,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
        >
          <QRCodeSVG
            value={bookingUrl}
            size={size}
            bgColor="#ffffff"
            fgColor="#0a0a0a"
            level="H"
          />
        </div>

        {/* Off-screen high-res canvas used only for PNG download */}
        <div
          aria-hidden="true"
          style={{ position: 'fixed', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}
        >
          <QRCodeCanvas
            ref={canvasRef}
            value={bookingUrl}
            size={size * 4}
            bgColor="#ffffff"
            fgColor="#0a0a0a"
            level="H"
          />
        </div>

        <div
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            marginBottom: 14,
            fontFamily: 'monospace',
            wordBreak: 'break-all',
          }}
        >
          {bookingUrl.replace(/^https?:\/\//, '')}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={copyLink}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '9px 16px',
              borderRadius: 8,
              border: '1px solid var(--border2)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--surface2)';
              e.currentTarget.style.borderColor = 'var(--teal-border)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--surface)';
              e.currentTarget.style.borderColor = 'var(--border2)';
            }}
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <button
            onClick={downloadQR}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '9px 16px',
              borderRadius: 8,
              border: '1px solid transparent',
              background: 'var(--teal)',
              color: 'var(--bg)',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            Download QR
          </button>
        </div>
      </div>
    </>
  );
}
