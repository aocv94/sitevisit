import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { autoRef, reconcileItemNumbers, todayLocal } from '@/lib/report';
import { USAGE_WARNING_BYTES } from '@/storage/localReportRepository';
import { StorageFullError, type ReportRepository } from '@/storage/reportRepository';
import { emptyReportState, type ReportItem, type ReportState } from '@/types/report';
import { ReportContext, type HeaderPatch, type ReportStore } from './reportContext';

const SAVE_DEBOUNCE_MS = 300;
const FLASH_MS = 3500;

interface Props {
  repository: ReportRepository;
  children: ReactNode;
}

export function ReportProvider({ repository, children }: Props) {
  const [state, setState] = useState<ReportState>(emptyReportState);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');

  const flashTimer = useRef<number | undefined>(undefined);
  const saveTimer = useRef<number | undefined>(undefined);

  const flash = useCallback((message: string) => {
    setStatus(message);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      // Solo limpia si nadie escribio otro mensaje encima.
      setStatus((current) => (current === message ? '' : current));
    }, FLASH_MS);
  }, []);

  const persist = useCallback(
    async (next: ReportState) => {
      try {
        await repository.save(next);
      } catch (error) {
        if (error instanceof StorageFullError) flash(error.message);
        else console.error('No se pudo guardar el reporte', error);
      }
    },
    [repository, flash]
  );

  /** Las ediciones de cabecera llegan pulsacion a pulsacion: se agrupan. */
  const persistDebounced = useCallback(
    (next: ReportState) => {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => void persist(next), SAVE_DEBOUNCE_MS);
    },
    [persist]
  );

  const warnIfStorageTight = useCallback(() => {
    const bytes = repository.usageBytes();
    if (bytes != null && bytes > USAGE_WARNING_BYTES) {
      const mb = (bytes / (1024 * 1024)).toFixed(1);
      flash(`Storage: ${mb}MB used. Export PDF and clear soon.`);
    }
  }, [repository, flash]);

  // Carga inicial: normaliza el estado guardado y lo reescribe ya reparado.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await repository.load();
      let next: ReportState = { ...emptyReportState(), ...(loaded ?? {}) };
      if (!next.date) next.date = todayLocal();
      next = reconcileItemNumbers(next);
      if (!next.ref) {
        next.ref = autoRef(next.date);
        next.refAuto = true;
      }
      if (cancelled) return;
      setState(next);
      setReady(true);
      void persist(next);
      warnIfStorageTight();
    })();
    return () => {
      cancelled = true;
    };
  }, [repository, persist, warnIfStorageTight]);

  useEffect(() => {
    return () => {
      window.clearTimeout(flashTimer.current);
      window.clearTimeout(saveTimer.current);
    };
  }, []);

  const updateHeader = useCallback(
    (patch: HeaderPatch) => {
      setState((prev) => {
        const next: ReportState = { ...prev, ...patch };
        // Tocar el numero de reporte a mano desactiva la autogeneracion; a
        // partir de ahi cambiar la fecha ya no lo pisa.
        if (patch.ref !== undefined) next.refAuto = false;
        if (next.refAuto) next.ref = autoRef(next.date);
        persistDebounced(next);
        return next;
      });
    },
    [persistDebounced]
  );

  const saveItem = useCallback(
    (item: ReportItem) => {
      setState((prev) => {
        const index = prev.items.findIndex((existing) => existing.id === item.id);
        let next: ReportState;
        if (index >= 0) {
          const items = [...prev.items];
          items[index] = item;
          next = { ...prev, items };
        } else {
          // El numero sale de seq, que solo sube: nunca se reutiliza uno
          // retirado aunque su item se haya borrado.
          const seq = (prev.seq || 0) + 1;
          next = { ...prev, seq, items: [...prev.items, { ...item, no: seq }] };
        }
        void persist(next);
        return next;
      });
      warnIfStorageTight();
    },
    [persist, warnIfStorageTight]
  );

  const removeItem = useCallback(
    (id: string) => {
      setState((prev) => {
        // seq NO baja: el hueco es intencional.
        const next = { ...prev, items: prev.items.filter((item) => item.id !== id) };
        void persist(next);
        return next;
      });
    },
    [persist]
  );

  const clearItems = useCallback(() => {
    setState((prev) => {
      const next: ReportState = {
        ...prev,
        items: [],
        seq: 0,
        refAuto: true,
        ref: autoRef(prev.date),
      };
      void persist(next);
      return next;
    });
  }, [persist]);

  const store = useMemo<ReportStore>(
    () => ({ state, ready, status, flash, updateHeader, saveItem, removeItem, clearItems }),
    [state, ready, status, flash, updateHeader, saveItem, removeItem, clearItems]
  );

  return <ReportContext.Provider value={store}>{children}</ReportContext.Provider>;
}
