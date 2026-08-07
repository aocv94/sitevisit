import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/authContext';
import { BUILD } from '@/config/project';
import { useReport } from '@/state/reportContext';
import { AccountMenu } from './AccountMenu';
import { ConstellationMark } from './ConstellationMark';

export function Masthead() {
  const { state } = useReport();
  const { isAppOwner, leaderOrgs } = useAuth();
  const canAdminister = isAppOwner || leaderOrgs.length > 0;

  return (
    <div className="mast">
      <div className="brandrow">
        <ConstellationMark />
        <span className="wm">Constellation</span>
        {/* Sin esto la captura es un callejón sin salida: ocupa la pantalla
            entera y no deja volver. La vuelta se queda a la vista; lo de la
            cuenta va dentro del engrane. */}
        <span className="mastlinks">
          {canAdminister && <Link to="/empresa">Administración</Link>}
          <AccountMenu />
        </span>
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
