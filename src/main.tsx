import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Immediately purge legacy cache-first Service Worker cache ('apex-recomp-v1')
if (typeof window !== 'undefined' && 'caches' in window) {
  window.caches.delete('apex-recomp-v1').catch(() => {});
}

// Register & force-update PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        void registration.update();
      })
      .catch(() => {
        // Service worker registration optional in dev mode
      });
  });
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      errorMsg: error instanceof Error ? error.message : 'Error inesperado de renderizado',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#090D16',
            color: '#F9FAFB',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#10B981', marginBottom: '8px' }}>
            APEX RECOMP • Auto-Recuperación de Caché
          </h2>
          <p style={{ fontSize: '13px', color: '#9CA3AF', maxWidth: '400px', marginBottom: '16px' }}>
            Se detectó una versión anterior en la caché local ({this.state.errorMsg}).
          </p>
          <button
            onClick={async () => {
              try {
                localStorage.removeItem('apex_recomp_pwa_state_v1');
                if ('caches' in window) {
                  const keys = await caches.keys();
                  await Promise.all(keys.map((k) => caches.delete(k)));
                }
              } finally {
                window.location.reload();
              }
            }}
            style={{
              backgroundColor: '#10B981',
              color: '#090D16',
              fontWeight: 800,
              fontSize: '13px',
              padding: '10px 20px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Limpiar Caché y Recargar App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
