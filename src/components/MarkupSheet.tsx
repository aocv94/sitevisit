import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  fitDimensions,
  flattenWithOverlay,
  loadImage,
  makeThumbnail,
  rotateDataUrl,
  sheetCanvasBounds,
} from '@/lib/image';
import { isMeaningfulMark, paintMarks } from '@/lib/marks';
import { useProject } from '@/state/projectContext';
import { useReport } from '@/state/reportContext';
import type { Mark, MarkupMode, Point } from '@/types/markup';
import type { PlanPin, ReportItem } from '@/types/report';
import { PlanPinSheet } from './PlanPinSheet';

interface Props {
  item: ReportItem;
  onCancel(): void;
  onSave(item: ReportItem): void;
}

export function MarkupSheet({ item, onCancel, onSave }: Props) {
  const { state, flash } = useReport();
  const { zones, planLabel } = useProject();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  // Las marcas viven en refs: se redibujan a ritmo de puntero y pasar cada
  // punto por setState tiraria el frame rate durante el trazo.
  const marksRef = useRef<Mark[]>([]);
  const currentRef = useRef<Mark | null>(null);
  const redrawPendingRef = useRef(false);
  /**
   * Imagen original sin rotar de esta sesion de edicion. Rotar siempre parte
   * de aqui aplicando el angulo acumulado; rotar sobre lo ya rotado
   * recomprimiria el JPEG en cada vuelta.
   */
  const originalSrcRef = useRef(item.src);

  const [src, setSrc] = useState(item.src);
  const [rotation, setRotation] = useState(0);
  const [mode, setMode] = useState<MarkupMode>('pen');
  const [zone, setZone] = useState(item.zone || '');
  const [comment, setComment] = useState(item.cmt || '');
  const [pin, setPin] = useState<PlanPin | null>(item.plan);
  const [planSheetOpen, setPlanSheetOpen] = useState(false);

  const redraw = useCallback(() => {
    if (redrawPendingRef.current) return;
    redrawPendingRef.current = true;
    requestAnimationFrame(() => {
      redrawPendingRef.current = false;
      const canvas = canvasRef.current;
      const base = baseImageRef.current;
      if (!canvas || !base) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
      const marks = currentRef.current
        ? [...marksRef.current, currentRef.current]
        : marksRef.current;
      paintMarks(ctx, marks, 1, canvas.width);
    });
  }, []);

  // Carga (o recarga tras rotar) la imagen y dimensiona el canvas.
  useEffect(() => {
    let cancelled = false;
    void loadImage(src).then((image) => {
      if (cancelled) return;
      baseImageRef.current = image;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { maxWidth, maxHeight } = sheetCanvasBounds();
      // allowUpscale=false: una foto pequeña no se agranda ni se pixela.
      const size = fitDimensions(image, maxWidth, maxHeight, false);
      canvas.width = size.width;
      canvas.height = size.height;
      redraw();
    });
    return () => {
      cancelled = true;
    };
  }, [src, redraw]);

  const zoneSuggestions = useMemo(() => {
    // Las del proyecto primero, y detrás las escritas a mano en items
    // anteriores: si alguien ya usó "Sótano", que no tenga que reescribirlo.
    const suggestions = [...zones];
    for (const existing of state.items) {
      if (existing.zone && !suggestions.includes(existing.zone)) suggestions.push(existing.zone);
    }
    return suggestions;
  }, [zones, state.items]);

  function eventPoint(event: PointerEvent<HTMLCanvasElement>): Point | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  async function handleRotate() {
    const next = (rotation + 90) % 360;
    const hadMarks = marksRef.current.length > 0;
    // Las marcas estan atadas a la orientacion anterior del canvas: se borran
    // en vez de repintarse torcidas.
    marksRef.current = [];
    currentRef.current = null;
    setRotation(next);
    const rotated = await rotateDataUrl(originalSrcRef.current, next);
    setSrc(rotated);
    if (hadMarks) flash('Rotated - marks were cleared, re-mark the photo');
  }

  function handleSave() {
    if (!comment.trim()) {
      commentRef.current?.focus();
      flash('Add an observation before saving');
      return;
    }
    const canvas = canvasRef.current;
    const base = baseImageRef.current;
    if (!canvas || !base) return;

    const marks = marksRef.current;
    const flattened = flattenWithOverlay(
      base,
      (ctx, scale) => paintMarks(ctx, marks, scale, canvas.width),
      canvas.width
    );

    onSave({
      ...item,
      src: flattened,
      // La miniatura sale de la foto SIN marcas: la tabla resumen es un
      // indice visual, el detalle marcado va en la ficha.
      thumb: makeThumbnail(base),
      zone: zone.trim(),
      cmt: comment.trim(),
      plan: pin ? { id: pin.id, x: pin.x, y: pin.y } : null,
    });
  }

  return (
    <>
      <div className="sheet">
        <div className="sheet-top">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <h2>Mark up</h2>
          <div>
            <button className="rotate-btn" type="button" onClick={() => void handleRotate()}>
              ↻ Rotate
            </button>
            <button type="button" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>

        <div className="canvas-wrap">
          <canvas
            ref={canvasRef}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              const p = eventPoint(event);
              if (!p) return;
              currentRef.current =
                mode === 'rect'
                  ? { type: 'rect', x: p.x, y: p.y, x2: p.x, y2: p.y }
                  : { type: 'pen', pts: [p] };
            }}
            onPointerMove={(event) => {
              const current = currentRef.current;
              if (!current) return;
              event.preventDefault();
              const p = eventPoint(event);
              if (!p) return;
              if (current.type === 'rect') {
                current.x2 = p.x;
                current.y2 = p.y;
              } else {
                current.pts.push(p);
              }
              redraw();
            }}
            onPointerUp={() => {
              const current = currentRef.current;
              if (current && isMeaningfulMark(current)) marksRef.current.push(current);
              currentRef.current = null;
              redraw();
            }}
            onPointerCancel={() => {
              currentRef.current = null;
              redraw();
            }}
          />
        </div>

        <div className="tools">
          <button
            className={`t${mode === 'pen' ? ' on' : ''}`}
            type="button"
            onClick={() => setMode('pen')}
          >
            Circle
          </button>
          <button
            className={`t blk${mode === 'rect' ? ' on' : ''}`}
            type="button"
            onClick={() => setMode('rect')}
          >
            Black out
          </button>
          <button
            className="t"
            type="button"
            onClick={() => {
              marksRef.current.pop();
              redraw();
            }}
          >
            Undo
          </button>
          <button
            className="t"
            type="button"
            onClick={() => {
              marksRef.current = [];
              redraw();
            }}
          >
            Clear
          </button>
        </div>

        <div className="form">
          <div>
            <label className="lbl" htmlFor="eZone">
              Zone / location
            </label>
            <input
              id="eZone"
              value={zone}
              placeholder="Building 12"
              onChange={(event) => setZone(event.target.value)}
            />
            <div className="chips">
              {zoneSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className={`chip${zone === suggestion ? ' on' : ''}`}
                  onClick={() => setZone(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="lbl">Location on plan</span>
            <button className="locbtn" type="button" onClick={() => setPlanSheetOpen(true)}>
              <span>{pin ? `${planLabel(pin)} - pin set` : 'Not set'}</span>
              <em>Set pin</em>
            </button>
          </div>

          <div>
            <label className="lbl" htmlFor="eCmt">
              Observation
            </label>
            <textarea
              id="eCmt"
              ref={commentRef}
              value={comment}
              placeholder="Palm needs to move approx 2ft east"
              onChange={(event) => setComment(event.target.value)}
            />
          </div>
        </div>
      </div>

      {planSheetOpen && (
        <PlanPinSheet
          initialPin={pin}
          onCancel={() => setPlanSheetOpen(false)}
          onSave={(next) => {
            setPin(next);
            setPlanSheetOpen(false);
          }}
        />
      )}
    </>
  );
}
