import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './pwa/register';
import { ReportProvider } from './state/ReportProvider';
import { LocalReportRepository } from './storage/localReportRepository';
import './styles/tokens.css';
import './styles/app.css';

const repository = new LocalReportRepository();

const container = document.getElementById('root');
if (!container) throw new Error('Falta el nodo #root en index.html');

createRoot(container).render(
  <StrictMode>
    <ReportProvider repository={repository}>
      <App />
    </ReportProvider>
  </StrictMode>
);

registerServiceWorker();
