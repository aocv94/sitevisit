import { useCallback, useEffect, useState } from 'react';

export interface AsyncData<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Carga con estados de espera y error, que en los paneles se repiten en cada
 * listado.
 *
 * `deps` funciona como el array de useEffect: cambiarlo relanza la carga.
 * Descarta el resultado si el componente se desmontó o si llegó otra carga
 * mas nueva, para que una respuesta lenta no pise a una reciente.
 */
export function useAsyncData<T>(loader: () => Promise<T>, deps: readonly unknown[]): AsyncData<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableLoader = useCallback(loader, deps);

  const run = useCallback(
    async (isCurrent: () => boolean) => {
      setLoading(true);
      setError(null);
      try {
        const result = await stableLoader();
        if (isCurrent()) setData(result);
      } catch (cause) {
        if (isCurrent()) {
          setError(cause instanceof Error ? cause.message : 'Algo ha fallado');
          setData(null);
        }
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [stableLoader]
  );

  useEffect(() => {
    let active = true;
    void run(() => active);
    return () => {
      active = false;
    };
  }, [run]);

  const reload = useCallback(async () => {
    await run(() => true);
  }, [run]);

  return { data, loading, error, reload };
}
