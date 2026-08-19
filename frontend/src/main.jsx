import './amplify-config';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { HelmetProvider } from 'react-helmet-async';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>,
);