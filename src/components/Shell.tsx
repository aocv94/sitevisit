import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/auth/authContext';
import { ConstellationMark } from './ConstellationMark';

interface Props {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** Marco de los paneles de administracion. La captura tiene el suyo propio. */
export function Shell({ title, actions, children }: Props) {
  const { profile, isAppOwner, leaderOrgs, memberships, signOut } = useAuth();

  return (
    <div className="adm">
      <header className="adm-top">
        <div className="adm-top-brand">
          <ConstellationMark />
          <span>Constellation</span>
        </div>
        <nav className="adm-nav">
          {isAppOwner && <NavLink to="/admin">Plataforma</NavLink>}
          {(isAppOwner || leaderOrgs.length > 0) && <NavLink to="/empresa">Mi empresa</NavLink>}
          {memberships.length > 0 && <NavLink to="/captura">Captura</NavLink>}
        </nav>
        <div className="adm-top-user">
          <span className="adm-muted">{profile?.email}</span>
          <button className="adm-linklike" type="button" onClick={() => void signOut()}>
            Salir
          </button>
        </div>
      </header>

      <main className="adm-main">
        <div className="adm-head">
          <h1>{title}</h1>
          {actions && <div className="adm-head-actions">{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}
