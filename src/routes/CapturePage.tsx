import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CaptureBar } from '@/components/CaptureBar';
import { FooterActions } from '@/components/FooterActions';
import { ItemList } from '@/components/ItemList';
import { MarkupSheet } from '@/components/MarkupSheet';
import { Masthead } from '@/components/Masthead';
import { ReportHeaderForm } from '@/components/ReportHeaderForm';
import { StatusLine } from '@/components/StatusLine';
import { useConnectivityFlash } from '@/hooks/useConnectivityFlash';
import { downscaleToDataUrl, loadImage, readFileAsDataUrl } from '@/lib/image';
import { createItemId } from '@/lib/report';
import { useAuth } from '@/auth/authContext';
import { ReportProvider } from '@/state/ReportProvider';
import { useReport } from '@/state/reportContext';
import { LocalReportRepository } from '@/storage/localReportRepository';
import type { ReportItem } from '@/types/report';

function newDraft(src: string, ts: number): ReportItem {
  return { id: createItemId(), no: null, src, ts, zone: '', cmt: '', plan: null };
}

/**
 * La pantalla de campo. Sigue guardando en el dispositivo: la sincronizacion
 * con Supabase es el paso siguiente, y hasta entonces el PDF es el unico
 * entregable. Que este detras del login no cambia eso.
 */
export function CapturePage() {
  // Una instancia por montaje basta: la clave de localStorage es fija.
  const repository = useMemo(() => new LocalReportRepository(), []);
  return (
    <ReportProvider repository={repository}>
      <CaptureScreen />
    </ReportProvider>
  );
}

function CaptureScreen() {
  const { flash, saveItem } = useReport();
  const { isAppOwner, leaderOrgs } = useAuth();
  const canLeaveToAdmin = isAppOwner || leaderOrgs.length > 0;
  const [editing, setEditing] = useState<ReportItem | null>(null);
  /**
   * Cola de fotos pendientes cuando se eligen varias de la galeria. Se
   * procesan de una en una: cada foto necesita su propia observacion, y
   * abrir seis editores a la vez no ayuda a nadie en obra.
   */
  const pendingRef = useRef<File[]>([]);

  useConnectivityFlash(flash);

  const openFromFile = useCallback(
    async (file: File) => {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const image = await loadImage(dataUrl);
        setEditing(newDraft(downscaleToDataUrl(image), file.lastModified || Date.now()));
      } catch {
        flash('That file would not open as an image');
        const next = pendingRef.current.shift();
        if (next) void openFromFile(next);
      }
    },
    [flash]
  );

  const nextPending = useCallback(() => {
    const next = pendingRef.current.shift();
    if (next) void openFromFile(next);
  }, [openFromFile]);

  const handleFiles = useCallback(
    (files: FileList) => {
      const list = Array.from(files);
      const [first, ...rest] = list;
      if (!first) return;
      if (list.length > 1) flash(`Adding ${list.length} photos, one at a time`);
      pendingRef.current = rest;
      void openFromFile(first);
    },
    [flash, openFromFile]
  );

  return (
    <div className="svr">
      <Masthead />
      <ReportHeaderForm />
      <CaptureBar onFiles={handleFiles} />
      <StatusLine />
      <ItemList onEdit={setEditing} />

      <div className="note">
        Data stays on this device. Export the PDF and file it before clearing. Item numbers are
        permanent - deleting an item leaves a gap rather than renumbering.
        {canLeaveToAdmin && (
          <>
            {' '}
            <Link to="/empresa">Volver a la administración</Link>.
          </>
        )}
      </div>

      <FooterActions />

      {editing && (
        <MarkupSheet
          key={editing.id}
          item={editing}
          onCancel={() => {
            setEditing(null);
            nextPending();
          }}
          onSave={(updated) => {
            saveItem(updated);
            setEditing(null);
            nextPending();
          }}
        />
      )}
    </div>
  );
}
