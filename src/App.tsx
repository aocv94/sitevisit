import { useCallback, useRef, useState } from 'react';
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
import { useReport } from '@/state/reportContext';
import type { ReportItem } from '@/types/report';

function newDraft(src: string, ts: number): ReportItem {
  return { id: createItemId(), no: null, src, ts, zone: '', cmt: '', plan: null };
}

export function App() {
  const { flash, saveItem } = useReport();
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
