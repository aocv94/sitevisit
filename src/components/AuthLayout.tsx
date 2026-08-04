import type { ReactNode } from 'react';
import { ConstellationMark } from './ConstellationMark';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Marco comun de login, registro, recuperacion e invitacion. */
export function AuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <div className="adm-auth">
      <div className="adm-auth-card">
        <div className="adm-auth-brand">
          <ConstellationMark />
          <span>Constellation</span>
        </div>
        <h1>{title}</h1>
        {subtitle && <p className="adm-muted">{subtitle}</p>}
        {children}
        {footer && <div className="adm-auth-footer">{footer}</div>}
      </div>
    </div>
  );
}
