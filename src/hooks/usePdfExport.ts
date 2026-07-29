import { useCallback, useMemo } from 'react';
import { zonesForProject } from '@/config/project';
import { loadPlanImage, renderKeyplan, type Keyplan } from '@/lib/plan';
import { buildFilename, orderItems } from '@/lib/report';
import { renderLogoPng } from '@/pdf/logo';
import { useReport } from '@/state/reportContext';
import type { ReportItem } from '@/types/report';

/**
 * Margen para que el navegador pinte el mensaje "Building PDF..." antes de que
 * la generacion, que es sincrona y bloquea el hilo, se lo coma.
 */
const PAINT_DELAY_MS = 60;

const nextPaint = () => new Promise((resolve) => setTimeout(resolve, PAINT_DELAY_MS));

export function usePdfExport() {
  const { state, flash } = useReport();
  const logoPng = useMemo(() => renderLogoPng(), []);

  /** Rasteriza el key plan de cada item que tenga pin. */
  const buildKeyplans = useCallback(
    async (items: readonly ReportItem[]): Promise<Map<string, Keyplan>> => {
      const keyplans = new Map<string, Keyplan>();
      await Promise.all(
        items.map(async (item) => {
          if (!item.plan) return;
          const image = await loadPlanImage(item.plan.id);
          if (!image) return;
          const keyplan = renderKeyplan(image, item.plan, item.no);
          if (keyplan) keyplans.set(item.id, keyplan);
        })
      );
      return keyplans;
    },
    []
  );

  const build = useCallback(async () => {
    const items = orderItems(state.items, zonesForProject(state.proj));
    const keyplans = await buildKeyplans(items);
    // jsPDF (con html2canvas y dompurify detras) pesa mas que el resto de la
    // app junta y solo hace falta al exportar. Cargarlo aqui deja el arranque
    // en campo mucho mas ligero; ya esta en cache antes del primer export.
    const { renderReportDocument } = await import('@/pdf/renderReport');
    await nextPaint();
    return renderReportDocument({ state, items, keyplans, logoPng });
  }, [state, buildKeyplans, logoPng]);

  const exportPdf = useCallback(async () => {
    if (!state.items.length) {
      flash('Nothing to export yet');
      return;
    }
    flash('Building PDF...');
    try {
      const doc = await build();
      doc.save(buildFilename(state));
      flash('PDF exported');
    } catch (error) {
      console.error('Fallo la generacion del PDF', error);
      flash('PDF export failed');
    }
  }, [state, build, flash]);

  const sharePdf = useCallback(async () => {
    if (!state.items.length) {
      flash('Nothing to share yet');
      return;
    }
    flash('Building PDF for sharing...');
    let blob: Blob;
    const filename = buildFilename(state);
    try {
      const doc = await build();
      blob = doc.output('blob');
    } catch (error) {
      console.error('Fallo la generacion del PDF', error);
      flash('PDF export failed');
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: filename,
          files: [new File([blob], filename, { type: 'application/pdf' })],
        });
        flash('PDF shared');
      } catch (error) {
        // Cancelar la hoja de compartir no es un fallo que reportar.
        if ((error as Error).name !== 'AbortError') flash('Share cancelled or failed');
      }
      return;
    }

    // Sin Web Share (o sin soporte de ficheros): descarga directa.
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    flash('PDF downloaded (share not supported)');
  }, [state, build, flash]);

  return { exportPdf, sharePdf };
}
