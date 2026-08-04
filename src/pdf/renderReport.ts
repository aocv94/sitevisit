import { jsPDF } from 'jspdf';
import { formatTimestamp, itemZone } from '@/lib/report';
import type { Keyplan } from '@/lib/plan';
import type { PlanPin, ReportItem, ReportState } from '@/types/report';
import * as T from './theme';

export interface ReportDocumentInput {
  state: ReportState;
  /** Items ya agrupados por zona (ver orderItems). */
  items: readonly ReportItem[];
  /** Key plans ya rasterizados, indexados por id de item. */
  keyplans: ReadonlyMap<string, Keyplan>;
  logoPng: string | null;
  /**
   * Etiqueta de la lámina de un pin. Se inyecta en vez de importarla porque
   * las láminas ahora dependen del proyecto, y este módulo no debe saber
   * cuál está activo.
   */
  planLabel(pin: Pick<PlanPin, 'id'> | null | undefined): string;
}

const setFill = (doc: jsPDF, c: T.Rgb) => doc.setFillColor(c[0], c[1], c[2]);
const setText = (doc: jsPDF, c: T.Rgb) => doc.setTextColor(c[0], c[1], c[2]);
const setDraw = (doc: jsPDF, c: T.Rgb) => doc.setDrawColor(c[0], c[1], c[2]);

/**
 * Construye el documento completo: cabecera con metadatos, tabla resumen,
 * una ficha por item (dos por pagina) y el pie legal en todas.
 *
 * Es sincrona a proposito. Todo lo que necesita cargarse (laminas de plano
 * para los key plans) debe estar resuelto antes de llamar; ver
 * usePdfExport.
 */
export function renderReportDocument({
  state,
  items,
  keyplans,
  logoPng,
  planLabel,
}: ReportDocumentInput): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const projectName = state.proj || 'Site Visit Report';

  /** Banda superior. `full` solo en la primera pagina. */
  function brandbar(full: boolean): void {
    setFill(doc, T.INK);
    doc.rect(0, 0, T.PAGE_WIDTH, full ? 96 : 54, 'F');
    if (logoPng) {
      try {
        doc.addImage(logoPng, 'PNG', T.MARGIN, full ? 30 : 18, 19, 17.5);
      } catch {
        // Sin logo se sigue adelante: el reporte importa mas que la marca.
      }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    setText(doc, T.MARK);
    doc.text('CONSTELLATION', T.MARGIN + 28, full ? 43.5 : 31.5, { charSpace: 3.2 });

    if (full) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      setText(doc, T.PAPER);
      doc.text('Site Visit Report', T.MARGIN, 78);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      setText(doc, T.MARK);
      doc.text('FIELD OBSERVATION RECORD', T.PAGE_WIDTH - T.MARGIN, 78, {
        align: 'right',
        charSpace: 1.6,
      });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      setText(doc, T.SUBHEAD_TEXT);
      const running = projectName + (state.ref ? `   /   ${state.ref}` : '');
      doc.text(running, T.PAGE_WIDTH - T.MARGIN, 31.5, { align: 'right' });
    }
  }

  /** Bloque de metadatos de la portada. Devuelve la Y donde sigue el contenido. */
  function metaBlock(startY: number): number {
    let y = startY;
    const cols: Array<[string, string]> = [
      ['PROJECT', projectName],
      ['VISIT DATE', state.date || ''],
      ['OBSERVED BY', state.by || ''],
      ['REPORT NO.', state.ref || '-'],
    ];
    const colWidth = (T.PAGE_WIDTH - 2 * T.MARGIN) / 4;
    cols.forEach(([label, value], i) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      setText(doc, T.MID);
      doc.text(label, T.MARGIN + i * colWidth, y, { charSpace: 1.1 });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      setText(doc, T.INK);
      doc.text(
        doc.splitTextToSize(value || '-', colWidth - 10).slice(0, 1),
        T.MARGIN + i * colWidth,
        y + 13
      );
    });
    y += 26;

    if (state.to) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      setText(doc, T.MID);
      doc.text('ISSUED TO', T.MARGIN, y, { charSpace: 1.1 });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      setText(doc, T.INK);
      doc.text(
        doc.splitTextToSize(state.to, T.PAGE_WIDTH - 2 * T.MARGIN).slice(0, 1),
        T.MARGIN,
        y + 13
      );
      y += 26;
    }

    setDraw(doc, T.HAIR);
    doc.line(T.MARGIN, y, T.PAGE_WIDTH - T.MARGIN, y);
    return y + 18;
  }

  function tableHead(atY: number): number {
    setFill(doc, T.TABLE_HEAD_FILL);
    doc.rect(T.MARGIN, atY, T.PAGE_WIDTH - 2 * T.MARGIN, 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    setText(doc, T.MID);
    doc.text('#', T.MARGIN + 8, atY + 12, { charSpace: 1.1 });
    doc.text('PHOTO', T.MARGIN + 30, atY + 12, { charSpace: 1.1 });
    doc.text('OBSERVATION', T.MARGIN + 124, atY + 12, { charSpace: 1.1 });
    return atY + 18;
  }

  brandbar(true);
  let y = metaBlock(122);
  y = tableHead(y);

  // ---------------------------------------------------------------- resumen
  let lastZone: string | null = null;
  for (const item of items) {
    const zone = itemZone(item);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(item.cmt || '', T.PAGE_WIDTH - T.MARGIN - T.SUMMARY_TEXT_X);
    const textHeight = Math.max(T.SUMMARY_THUMB_H, lines.length * T.SUMMARY_LINE_HEIGHT + 4);
    const rowHeight = textHeight + 20;
    let needsBand = zone !== lastZone;

    if (y + rowHeight + (needsBand ? 21 : 0) > T.PAGE_HEIGHT - T.FOOTER_RESERVE) {
      doc.addPage();
      brandbar(false);
      y = 78;
      lastZone = null;
      needsBand = true;
    }

    if (needsBand) {
      setFill(doc, T.INK);
      doc.rect(T.MARGIN, y, T.PAGE_WIDTH - 2 * T.MARGIN, 16, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      setText(doc, T.MARK);
      doc.text(zone.toUpperCase(), T.MARGIN + 8, y + 11, { charSpace: 1.8 });
      y += 21;
      lastZone = zone;
    }

    setDraw(doc, T.HAIR);
    doc.line(T.MARGIN, y, T.PAGE_WIDTH - T.MARGIN, y);

    const rowTop = y + 11;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setText(doc, T.INK);
    doc.text(String(item.no ?? '-'), T.MARGIN + 8, rowTop + 8);

    try {
      doc.addImage(
        item.thumb || item.src,
        'JPEG',
        T.MARGIN + 30,
        rowTop,
        T.SUMMARY_THUMB_W,
        T.SUMMARY_THUMB_H
      );
    } catch (error) {
      console.warn('No se pudo incrustar la miniatura del item', item.no, error);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    setText(doc, T.BODY_TEXT);
    doc.text(lines, T.SUMMARY_TEXT_X, rowTop + 9, { lineHeightFactor: 1.21 });

    doc.setFontSize(7);
    setText(doc, T.META_TEXT);
    const meta = formatTimestamp(item.ts) + (item.plan ? `    PLAN ${planLabel(item.plan)}` : '');
    doc.text(meta, T.SUMMARY_TEXT_X, rowTop + textHeight + 1);

    y += rowHeight;
  }

  // ---------------------------------------------------------------- fichas
  const slotHeight = (T.PAGE_HEIGHT - T.DETAIL_TOP - T.FOOTER_RESERVE) / T.DETAIL_SLOTS_PER_PAGE;

  items.forEach((item, index) => {
    const slot = index % T.DETAIL_SLOTS_PER_PAGE;
    if (slot === 0) {
      doc.addPage();
      brandbar(false);
    }
    const top = T.DETAIL_TOP + slot * slotHeight;
    if (slot === 1) {
      setDraw(doc, T.HAIR);
      doc.line(T.MARGIN, top - 12, T.PAGE_WIDTH - T.MARGIN, top - 12);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setText(doc, T.KEYPLAN_LABEL);
    doc.text(`ITEM ${item.no ?? '-'}`, T.MARGIN, top + 2, { charSpace: 1.4 });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    setText(doc, T.INK);
    doc.text(itemZone(item), T.MARGIN + 52, top + 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setText(doc, T.META_TEXT);
    doc.text(
      formatTimestamp(item.ts) + (item.plan ? `   /   PLAN ${planLabel(item.plan)}` : ''),
      T.PAGE_WIDTH - T.MARGIN,
      top + 2,
      { align: 'right' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    setText(doc, T.BODY_TEXT);
    let lines: string[] = doc.splitTextToSize(item.cmt || '', T.PAGE_WIDTH - 2 * T.MARGIN);
    const clipped = lines.length > T.DETAIL_MAX_LINES;
    if (clipped) lines = lines.slice(0, T.DETAIL_MAX_LINES);
    doc.text(lines, T.MARGIN, top + 18, { lineHeightFactor: 1.21 });

    if (clipped) {
      doc.setFontSize(6.5);
      setText(doc, T.META_TEXT);
      doc.text(
        '(observation continues in the summary table)',
        T.MARGIN,
        top + 18 + lines.length * T.SUMMARY_LINE_HEIGHT + 2
      );
    }

    const imgTop = top + 18 + lines.length * T.SUMMARY_LINE_HEIGHT + (clipped ? 12 : 6);
    const availableHeight = top + slotHeight - 16 - imgTop;
    const keyplan = item.plan ? (keyplans.get(item.id) ?? null) : null;
    const keyplanWidth = keyplan ? T.KEYPLAN_WIDTH : 0;
    const gap = keyplan ? T.KEYPLAN_GAP : 0;
    const availableWidth = T.PAGE_WIDTH - 2 * T.MARGIN - keyplanWidth - gap;

    let props: { width: number; height: number };
    try {
      props = doc.getImageProperties(item.src);
    } catch {
      props = { width: 4, height: 3 };
    }
    const k = Math.min(availableWidth / props.width, availableHeight / props.height);
    const width = props.width * k;
    const height = props.height * k;
    try {
      doc.addImage(
        item.src,
        'JPEG',
        T.MARGIN + (availableWidth - width) / 2,
        imgTop,
        width,
        height
      );
    } catch (error) {
      console.warn('No se pudo incrustar la foto del item', item.no, error);
    }

    if (keyplan && item.plan) {
      const kk = Math.min(keyplanWidth / keyplan.width, availableHeight / keyplan.height);
      const kw = keyplan.width * kk;
      const kh = keyplan.height * kk;
      const kx = T.PAGE_WIDTH - T.MARGIN - keyplanWidth + (keyplanWidth - kw) / 2;
      setFill(doc, [255, 255, 255]);
      doc.rect(kx - 3, imgTop - 3, kw + 6, kh + 6, 'F');
      setDraw(doc, T.HAIR);
      doc.rect(kx - 3, imgTop - 3, kw + 6, kh + 6);
      try {
        doc.addImage(keyplan.url, 'JPEG', kx, imgTop, kw, kh);
      } catch (error) {
        console.warn('No se pudo incrustar el key plan del item', item.no, error);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      setText(doc, T.MID);
      doc.text(`KEY PLAN - ${planLabel(item.plan).toUpperCase()}`, kx, imgTop + kh + 11, {
        charSpace: 1,
      });
    }
  });

  // ------------------------------------------------------------- pie legal
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    setDraw(doc, T.HAIR);
    doc.line(T.MARGIN, T.PAGE_HEIGHT - 50, T.PAGE_WIDTH - T.MARGIN, T.PAGE_HEIGHT - 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    setText(doc, T.FOOTER_TEXT);
    doc.text(T.LEGAL_LINES[0], T.MARGIN, T.PAGE_HEIGHT - 38);
    doc.text(T.LEGAL_LINES[1], T.MARGIN, T.PAGE_HEIGHT - 29);
    doc.text(`Page ${page} of ${total}`, T.PAGE_WIDTH - T.MARGIN, T.PAGE_HEIGHT - 29, {
      align: 'right',
    });
  }

  return doc;
}
