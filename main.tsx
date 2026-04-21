import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@/css/index.css'

const isDev = import.meta.env.DEV;

// 1. Diagnostics: Show logs and UI error box
// Always log the startup even in production so we can see it in the console
console.log('APP: Starting deployment bundle...');

const hasElectron = !!window.electronAPI;
console.log(`RENDERER: Environment: ${hasElectron ? 'ELECTRON' : 'BROWSER'}`);

if (isDev) {
  console.log('RENDERER: Bootstrapping in development mode...');

  window.onerror = function(message, source, lineno, colno, error) {
    console.error('RENDERER ERROR:', message, 'at', source, ':', lineno, ':', colno);
    const root = document.getElementById('root');
    if (root && root.innerHTML === '') {
      root.innerHTML = `
        <div style="padding:20px; color:red; font-family:sans-serif; background:white; position:fixed; inset:0; z-index:9999;">
          <h1>Development Error</h1>
          <p>${message}</p>
          <p>Line: ${lineno}</p>
          <pre>${error?.stack || ''}</pre>
        </div>`;
    }
  };

  window.onunhandledrejection = event => {
    console.error('UNHANDLED PROMISE REJECTION:', event.reason);
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (isDev) {
  console.log('RENDERER: Mounting React completed.');
}
