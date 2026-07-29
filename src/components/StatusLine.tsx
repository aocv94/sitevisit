import { useReport } from '@/state/reportContext';

/** Barra de mensajes efimeros. Mantiene su alto para que el layout no salte. */
export function StatusLine() {
  const { status } = useReport();
  return (
    <div className="status" role="status" aria-live="polite">
      {status}
    </div>
  );
}
