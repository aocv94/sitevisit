import { usePdfExport } from '@/hooks/usePdfExport';
import { useReport } from '@/state/reportContext';

export function FooterActions() {
  const { state, clearItems } = useReport();
  const { exportPdf, sharePdf } = usePdfExport();

  function handleClear() {
    if (!state.items.length) return;
    const ok = window.confirm(
      `Delete all ${state.items.length} items? Export first if you need the PDF.`
    );
    if (ok) clearItems();
  }

  return (
    <div className="foot">
      <div className="btn-row">
        <button className="btn btn-dark" type="button" onClick={() => void exportPdf()}>
          Export PDF
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          style={{ flex: '0 0 80px' }}
          onClick={() => void sharePdf()}
        >
          Share
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          style={{ flex: '0 0 80px' }}
          onClick={handleClear}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
