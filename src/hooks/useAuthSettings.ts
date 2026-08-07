import { useEffect, useState } from 'react';
import { fetchAuthSettings, type AuthSettings } from '@/api/authSettings';

/**
 * `null` mientras se resuelve. Las pantallas deben tratarlo como "todavía no
 * sé" y no como "cerrado": enseñar y esconder el enlace de registro daría un
 * parpadeo feo en cada carga.
 */
export function useAuthSettings(): AuthSettings | null {
  const [settings, setSettings] = useState<AuthSettings | null>(null);

  useEffect(() => {
    let active = true;
    void fetchAuthSettings().then((value) => {
      if (active) setSettings(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return settings;
}
