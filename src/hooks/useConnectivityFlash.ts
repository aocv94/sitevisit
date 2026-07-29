import { useEffect } from 'react';

/**
 * Avisa de los cambios de conectividad. El mensaje de offline es
 * tranquilizador a proposito: capturar y exportar siguen funcionando, que es
 * justo lo que el usuario necesita saber en un sotano.
 */
export function useConnectivityFlash(flash: (message: string) => void): void {
  useEffect(() => {
    const onOffline = () => flash('Offline - capture and export still work');
    const onOnline = () => flash('Back online');
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [flash]);
}
