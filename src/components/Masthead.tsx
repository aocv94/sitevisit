import { BUILD } from '@/config/project';
import { useReport } from '@/state/reportContext';
import { ConstellationMark } from './ConstellationMark';

export function Masthead() {
  const { state } = useReport();

  return (
    <div className="mast">
      <div className="brandrow">
        <ConstellationMark />
        <span className="wm">Constellation</span>
      </div>
      <div className="btm">
        <div>
          <h1>{state.proj || 'Site Visit Report'}</h1>
          {/* La etiqueta de build permite confirmar en obra que version
              trae el telefono antes de reportar un fallo. */}
          <div className="sub">Field observation record &nbsp;/&nbsp; Build {BUILD}</div>
        </div>
        <div className="tally">
          <b>{state.items.length}</b>
          <span>Items</span>
        </div>
      </div>
    </div>
  );
}
