import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './plugins';
import { App } from '@si-beaver/web/app';
import '@si-beaver/web/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
