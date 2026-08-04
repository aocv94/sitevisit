import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { fitDimensions, sheetCanvasBounds } from '@/lib/image';
import {
  applyPinch,
  cachedPlanImage,
  drawPin,
  IDENTITY_VIEW,
  loadPlanImage,
  MISSING_PLAN_MESSAGE,
  normalizePinPosition,
  planImageToScreen,
  type PlanView,
} from '@/lib/plan';
import { useProject } from '@/state/projectContext';
import type { Point } from '@/types/markup';
import type { PlanPin } from '@/types/report';

const HINT = 'Pinch to zoom. Tap the plan to drop a pin.';

interface Props {
  initialPin: PlanPin | null;
  onCancel(): void;
  onSave(pin: PlanPin | null): void;
}

function touchDistance(touches: TouchList): number {
  const [a, b] = [touches[0], touches[1]];
  if (!a || !b) return 0;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function touchCenter(touches: TouchList): Point {
  const [a, b] = [touches[0], touches[1]];
  if (!a || !b) return { x: 0, y: 0 };
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

/** Punto del evento en coordenadas del canvas (no de pantalla). */
function toCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

export function PlanPinSheet({ initialPin, onCancel, onSave }: Props) {
  const { plans, planById } = useProject();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Zoom, encuadre y pin viven en refs: el pinch los actualiza a ritmo de
  // dedo y pasar por setState en cada frame haria el gesto pastoso.
  const viewRef = useRef<PlanView>({ ...IDENTITY_VIEW });
  const draftRef = useRef<PlanPin | null>(initialPin);
  const imageRef = useRef<HTMLImageElement | null>(null);
  /**
   * El pin se confirma al levantar el dedo: mientras el gesto sigue vivo no
   * se sabe si es un toque o el principio de un pinch. Si llega un segundo
   * puntero, el candidato se descarta.
   */
  const activePointersRef = useRef(new Set<number>());
  const candidatePinRef = useRef<PlanPin | null>(null);
  const gestureIsPinchRef = useRef(false);

  const [planId, setPlanId] = useState<string | null>(
    () => planById(initialPin?.id)?.id ?? plans[0]?.id ?? null
  );
  const [note, setNote] = useState(HINT);
  const [, repaintChips] = useReducer((n: number) => n + 1, 0);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas) return;
    if (!image) {
      canvas.width = 10;
      canvas.height = 10;
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { maxWidth, maxHeight } = sheetCanvasBounds();
    // El plano SI se agranda hasta llenar el hueco; la foto marcada no.
    const size = fitDimensions(image, maxWidth, maxHeight, true);
    canvas.width = size.width;
    canvas.height = size.height;

    const view = viewRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(view.scale, view.scale);
    ctx.translate(-canvas.width / 2 + view.offsetX, -canvas.height / 2 + view.offsetY);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    const draft = draftRef.current;
    if (draft && draft.id === planId) {
      const pos = planImageToScreen(
        { x: draft.x * canvas.width, y: draft.y * canvas.height },
        canvas,
        view
      );
      drawPin(ctx, pos.x, pos.y, Math.max(10, (canvas.width / 38) * view.scale), null);
    }
  }, [planId]);

  const selectPlan = useCallback(
    async (id: string) => {
      const plan = planById(id);
      viewRef.current = { ...IDENTITY_VIEW };
      setPlanId(id);
      if (!plan) {
        imageRef.current = null;
        setNote(MISSING_PLAN_MESSAGE);
        paint();
        return;
      }
      setNote(`Loading ${plan.label}…`);
      const image = await loadPlanImage(plan.storage_path);
      imageRef.current = image;
      repaintChips();
      setNote(image ? HINT : MISSING_PLAN_MESSAGE);
      paint();
    },
    [paint, planById]
  );

  useEffect(() => {
    if (planId) void selectPlan(planId);
    else setNote('This project has no plan sheets yet.');
    // Solo al montar: los cambios posteriores pasan por selectPlan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pinch-zoom. Va con addEventListener y passive:false porque hay que
  // llamar a preventDefault para que el navegador no haga su propio zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let lastDistance = 0;
    let lastCenter: Point = { x: 0, y: 0 };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      lastDistance = touchDistance(event.touches);
      const center = touchCenter(event.touches);
      lastCenter = toCanvasPoint(canvas, center.x, center.y);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      event.preventDefault();
      const distance = touchDistance(event.touches);
      const rawCenter = touchCenter(event.touches);
      const center = toCanvasPoint(canvas, rawCenter.x, rawCenter.y);
      if (lastDistance > 0) {
        viewRef.current = applyPinch(viewRef.current, distance / lastDistance, center, lastCenter);
        paint();
      }
      lastDistance = distance;
      lastCenter = center;
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) lastDistance = 0;
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [paint]);

  return (
    <div className="sheet" style={{ zIndex: 60 }}>
      <div className="sheet-top">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <h2>Location on plan</h2>
        <button type="button" onClick={() => onSave(draftRef.current)}>
          Save
        </button>
      </div>

      <div className="plchips">
        {plans.map((plan) => {
          const missing = cachedPlanImage(plan.storage_path) === null;
          const classes = ['chip'];
          if (plan.id === planId) classes.push('on');
          if (missing) classes.push('miss');
          return (
            <button
              key={plan.id}
              type="button"
              className={classes.join(' ')}
              onClick={() => void selectPlan(plan.id)}
            >
              {plan.label}
            </button>
          );
        })}
      </div>

      <div className="canvas-wrap" style={{ flex: 1 }}>
        <canvas
          ref={canvasRef}
          onPointerDown={(event) => {
            const canvas = canvasRef.current;
            if (!canvas || !imageRef.current || !planId) return;
            event.preventDefault();
            activePointersRef.current.add(event.pointerId);
            // Segundo dedo: esto es un pinch, no un toque.
            if (activePointersRef.current.size > 1) {
              gestureIsPinchRef.current = true;
              candidatePinRef.current = null;
              return;
            }
            const point = toCanvasPoint(canvas, event.clientX, event.clientY);
            const normalized = normalizePinPosition(point, canvas, viewRef.current);
            candidatePinRef.current = { id: planId, x: normalized.x, y: normalized.y };
          }}
          onPointerUp={(event) => {
            activePointersRef.current.delete(event.pointerId);
            if (activePointersRef.current.size > 0) return;
            if (!gestureIsPinchRef.current && candidatePinRef.current) {
              draftRef.current = candidatePinRef.current;
              paint();
            }
            gestureIsPinchRef.current = false;
            candidatePinRef.current = null;
          }}
          onPointerCancel={(event) => {
            activePointersRef.current.delete(event.pointerId);
            if (activePointersRef.current.size > 0) return;
            gestureIsPinchRef.current = false;
            candidatePinRef.current = null;
          }}
        />
      </div>

      <div className="tools">
        <button
          className="t"
          type="button"
          onClick={() => {
            draftRef.current = null;
            paint();
          }}
        >
          Remove pin
        </button>
      </div>

      <div className="note">{note}</div>
    </div>
  );
}
