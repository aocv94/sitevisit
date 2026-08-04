import { removeMember, updateMemberRole } from '@/api/members';
import { ROLE_LABELS, type OrgMember, type OrgRole } from '@/types/db';

interface Props {
  orgId: string;
  members: OrgMember[];
  /** Roles asignables por quien está mirando. */
  assignableRoles: OrgRole[];
  /** Para no dejar que alguien se quite a sí mismo el acceso sin querer. */
  currentUserId: string | null;
  onChanged(): void;
}

export function MemberTable({ orgId, members, assignableRoles, currentUserId, onChanged }: Props) {
  if (!members.length) {
    return <p className="adm-muted">Todavía no hay nadie en esta empresa.</p>;
  }

  async function changeRole(userId: string, role: OrgRole) {
    await updateMemberRole(orgId, userId, role);
    onChanged();
  }

  async function remove(member: OrgMember) {
    const name = member.profile.full_name || member.profile.email;
    const ok = window.confirm(
      `¿Quitar el acceso de ${name} a esta empresa? La cuenta se mantiene y sus reportes ya emitidos también.`
    );
    if (!ok) return;
    await removeMember(orgId, member.profile.id);
    onChanged();
  }

  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            <th>Persona</th>
            <th>Rol</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const isSelf = member.profile.id === currentUserId;
            return (
              <tr key={member.profile.id}>
                <td>
                  <strong>{member.profile.full_name || '—'}</strong>
                  <div className="adm-muted">{member.profile.email}</div>
                </td>
                <td>
                  {assignableRoles.includes(member.role) && !isSelf ? (
                    <select
                      value={member.role}
                      onChange={(e) =>
                        void changeRole(member.profile.id, e.target.value as OrgRole)
                      }
                    >
                      {assignableRoles.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    ROLE_LABELS[member.role]
                  )}
                </td>
                <td>
                  {member.profile.accepted_at ? (
                    <span className="adm-badge adm-badge-ok">Activo</span>
                  ) : (
                    <span className="adm-badge">Invitación pendiente</span>
                  )}
                </td>
                <td className="adm-cell-actions">
                  {!isSelf && (
                    <button
                      className="adm-linklike adm-danger"
                      type="button"
                      onClick={() => void remove(member)}
                    >
                      Quitar acceso
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
