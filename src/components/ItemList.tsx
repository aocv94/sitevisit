import { Fragment, useMemo } from 'react';
import { formatItemNo, formatTimestamp, itemZone, orderItems } from '@/lib/report';
import { useProject } from '@/state/projectContext';
import { useReport } from '@/state/reportContext';
import type { ReportItem } from '@/types/report';

interface Props {
  onEdit(item: ReportItem): void;
}

export function ItemList({ onEdit }: Props) {
  const { state, removeItem } = useReport();
  const { zones, planLabel } = useProject();

  const ordered = useMemo(() => orderItems(state.items, zones), [state.items, zones]);

  if (!state.items.length) {
    return (
      <div className="entries">
        <div className="empty">
          <strong>No items yet</strong>
          Take a photo, mark it up, write the note. Do it standing in front of the issue.
        </div>
      </div>
    );
  }

  let lastZone: string | null = null;

  return (
    <div className="entries">
      {ordered.map((item) => {
        const zone = itemZone(item);
        const showBand = zone !== lastZone;
        lastZone = zone;

        return (
          <Fragment key={item.id}>
            {showBand && <div className="zoneband">{zone}</div>}
            <div className="row">
              <div className="idx">{formatItemNo(item)}</div>
              <img src={item.src} alt={`Item ${formatItemNo(item)}`} onClick={() => onEdit(item)} />
              <div className="body">
                <div className="cmt">{item.cmt}</div>
                {item.plan && (
                  <div>
                    <span className="pin">{planLabel(item.plan)}</span>
                  </div>
                )}
                <div className="time">{formatTimestamp(item.ts)}</div>
                <button
                  className="kill"
                  type="button"
                  onClick={() => {
                    // El numero no se recicla: se avisa para que nadie espere
                    // que la lista se renumere sola.
                    const ok = window.confirm(
                      `Remove item ${formatItemNo(item)}? The number stays retired.`
                    );
                    if (ok) removeItem(item.id);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
