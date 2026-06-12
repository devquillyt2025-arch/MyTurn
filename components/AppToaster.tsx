'use client';

import { Toaster } from 'react-hot-toast';

export function AppToaster() {
  return (
    <Toaster
      position="bottom-center"
      gutter={8}
      toastOptions={{
        duration: 3000,
        style: {
          background: '#1E1E2E',
          color: '#E2E2F0',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px',
          fontSize: '14px',
          fontWeight: '500',
          padding: '12px 16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          maxWidth: '380px',
        },
        success: {
          iconTheme: { primary: '#14A89E', secondary: '#1E1E2E' },
        },
        error: {
          duration: 4000,
          iconTheme: { primary: '#D64045', secondary: '#1E1E2E' },
        },
      }}
    />
  );
}
