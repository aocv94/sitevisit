import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './AppRoutes';
import { AuthProvider } from './auth/AuthProvider';
import { isSupabaseConfigured } from './lib/supabase';
import { registerServiceWorker } from './pwa/register';
import { SetupRequiredPage } from './routes/SetupRequiredPage';
import './styles/tokens.css';
import './styles/app.css';
import './styles/admin.css';

const container = document.getElementById('root');
if (!container) throw new Error('Falta el nodo #root en index.html');

// Sin claves no se monta ni el AuthProvider: crear el cliente reventaria y
// la pantalla de configuracion es justo lo que hay que enseñar.
createRoot(container).render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    ) : (
      <SetupRequiredPage />
    )}
  </StrictMode>
);

registerServiceWorker();
